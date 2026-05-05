"""
AI match prediction module.
Provides Elo computation, feature engineering, XGBoost prediction,
and Claude API narrative generation for snooker match outcome predictions.
"""
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np

try:
    import joblib
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False

try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False

from django.conf import settings
from django.db.models import Q

from .models import (
    CenturyRecord,
    MatchFrameScore,
    MatchesOfAnEvent,
    PlayerMatchHistory,
)
from .player_stats import (
    get_deciding_frames,
    get_finals_record,
    get_frame_stats,
    get_ranking_trend,
    get_season_stats,
    get_seasons_in_top16,
    get_win_streak,
)

MODEL_DIR = Path(__file__).resolve().parent.parent / "ml_models"

_elo_cache = None   # {player_id: float} — computed once per process lifetime
_model_cache = None  # loaded CalibratedClassifierCV — loaded once per process

FEATURE_NAMES = [
    'elo', 'weighted_form', 'h2h_win_rate', 'world_ranking', 'ranking_trend',
    'frame_win_pct', 'deciding_pct', 'finals_pct', 'streak_norm',
    'century_rate', 'top16_seasons',
    'avg_break_quality', 'break_rate', 'frame_dominance', 'stamina_score',
]

# ── ELO ───────────────────────────────────────────────────────────────────────

def compute_elo_ratings() -> dict:
    """
    Iterates all finished PlayerMatchHistory rows in chronological order
    and applies Elo updates (K=10, start=1500) for every player.
    Result is cached in _elo_cache for the process lifetime.
    Returns {player_id: float}.
    """
    global _elo_cache
    if _elo_cache is not None:
        return _elo_cache

    elo: dict[int, float] = {}
    K = 10
    matches = (
        PlayerMatchHistory.objects
        .filter(
            status=3,
            winner_id__isnull=False,
            player1_id__isnull=False,
            player2_id__isnull=False,
        )
        .order_by('scheduled_date', 'api_match_id')
        .values('player1_id', 'player2_id', 'winner_id')
    )
    for m in matches:
        p1, p2, w = m['player1_id'], m['player2_id'], m['winner_id']
        e1 = elo.get(p1, 1500.0)
        e2 = elo.get(p2, 1500.0)
        expected1 = 1.0 / (1.0 + 10 ** ((e2 - e1) / 400.0))
        actual1 = 1.0 if w == p1 else 0.0
        elo[p1] = e1 + K * (actual1 - expected1)
        elo[p2] = e2 + K * ((1 - actual1) - (1 - expected1))

    _elo_cache = elo
    return elo


def get_elo_on_date(player_id: int, cutoff_date) -> float:
    """
    Computes Elo for player_id using only matches before cutoff_date.
    Used during model training to prevent data leakage.
    Returns 1500.0 if player has no history before that date.
    """
    elo: dict[int, float] = {}
    K = 10
    matches = (
        PlayerMatchHistory.objects
        .filter(
            status=3,
            winner_id__isnull=False,
            scheduled_date__lt=cutoff_date,
        )
        .filter(Q(player1_id=player_id) | Q(player2_id=player_id))
        .order_by('scheduled_date')
        .values('player1_id', 'player2_id', 'winner_id')
    )
    for m in matches:
        p1, p2, w = m['player1_id'], m['player2_id'], m['winner_id']
        e1 = elo.get(p1, 1500.0)
        e2 = elo.get(p2, 1500.0)
        exp1 = 1.0 / (1.0 + 10 ** ((e2 - e1) / 400.0))
        act1 = 1.0 if w == p1 else 0.0
        elo[p1] = e1 + K * (act1 - exp1)
        elo[p2] = e2 + K * ((1 - act1) - (1 - exp1))
    return elo.get(player_id, 1500.0)


# ── FORM ──────────────────────────────────────────────────────────────────────

def compute_weighted_form(player_id: int, cutoff_date=None, lam: float = 0.96, n: int = 20) -> float:
    """
    Exponential decay weighted win rate over last n finished matches.
    Formula: Σ(y_i × λ^i) / Σ(λ^i)  where i=0 is the most recent match.
    Returns 0.5 (neutral) when no match history is found.
    """
    qs = PlayerMatchHistory.objects.filter(
        player_id=player_id,
        status=3,
        winner_id__isnull=False,
    )
    if cutoff_date is not None:
        qs = qs.filter(scheduled_date__lt=cutoff_date)
    matches = list(
        qs.order_by('-scheduled_date', '-api_match_id')
          .values('winner_id')[:n]
    )
    if not matches:
        return 0.5
    numerator = denominator = 0.0
    for i, m in enumerate(matches):
        w = lam ** i
        numerator += w * (1.0 if m['winner_id'] == player_id else 0.0)
        denominator += w
    return numerator / denominator if denominator > 0 else 0.5


# ── H2H ───────────────────────────────────────────────────────────────────────

def get_h2h_smoothed(p1_id: int, p2_id: int, cutoff_date=None, alpha: int = 2) -> float:
    """
    Laplace-smoothed H2H win rate for p1 against p2.
    Formula: (p1_wins + α) / (total_meetings + 2α)
    α=2 means no-history defaults to 0.50 (neutral prior).
    """
    qs = PlayerMatchHistory.objects.filter(
        status=3,
        winner_id__isnull=False,
    ).filter(
        Q(player1_id=p1_id, player2_id=p2_id) |
        Q(player1_id=p2_id, player2_id=p1_id)
    )
    if cutoff_date is not None:
        qs = qs.filter(scheduled_date__lt=cutoff_date)
    total = qs.count()
    p1_wins = qs.filter(winner_id=p1_id).count()
    return (p1_wins + alpha) / (total + 2 * alpha)


# ── FRAME SCORE FEATURES (from CueTracker scraper) ────────────────────────────

def _get_recent_match_db_ids(player_id: int, n: int, cutoff_date=None) -> list:
    """Returns up to n MatchesOfAnEvent DB primary keys for a player's recent finished matches."""
    qs = MatchesOfAnEvent.objects.filter(
        Q(Player1ID=player_id) | Q(Player2ID=player_id),
        Status__in=[2, 3],
    )
    if cutoff_date is not None:
        qs = qs.filter(ScheduledDate__lt=cutoff_date)
    return list(
        qs.order_by('-ScheduledDate', '-id')
          .values_list('id', flat=True)[:n]
    )


def compute_frame_features(player_id: int, n_matches: int = 10, cutoff_date=None) -> dict:
    """
    Computes 4 break-quality features from MatchFrameScore data:
      avg_break_quality : mean of highest breaks ≥50 across recent frames
      break_rate        : fraction of frames where player made a break ≥50
      frame_dominance   : mean (player_pts - opponent_pts) per frame
      stamina_score     : mean break quality in late frames minus early frames

    Returns None for all values when insufficient frame data exists.
    XGBoost handles None→NaN natively.
    """
    null_result = {
        'avg_break_quality': None,
        'break_rate': None,
        'frame_dominance': None,
        'stamina_score': None,
    }

    match_ids = _get_recent_match_db_ids(player_id, n_matches, cutoff_date)
    if not match_ids:
        return null_result

    # Map match DB id → which slot (1 or 2) is our player
    slot_map = {
        m.id: (1 if m.Player1ID == player_id else 2)
        for m in MatchesOfAnEvent.objects.filter(id__in=match_ids)
    }

    frames = list(
        MatchFrameScore.objects.filter(match_id__in=match_ids)
        .order_by('match_id', 'frame_number')
        .values('match_id', 'frame_number',
                'player1_points', 'player2_points',
                'player1_break', 'player2_break')
    )
    if not frames:
        return null_result

    breaks_all, diffs, early_breaks, late_breaks = [], [], [], []

    for f in frames:
        slot = slot_map.get(f['match_id'], 1)
        my_pts = f['player1_points'] if slot == 1 else f['player2_points']
        opp_pts = f['player2_points'] if slot == 1 else f['player1_points']
        my_break = f['player1_break'] if slot == 1 else f['player2_break']

        diffs.append(my_pts - opp_pts)

        if my_break is not None:
            breaks_all.append(my_break)
            if f['frame_number'] <= 5:
                early_breaks.append(my_break)
            else:
                late_breaks.append(my_break)

    total_frames = len(frames)
    return {
        'avg_break_quality': float(np.mean(breaks_all)) if breaks_all else None,
        'break_rate': len(breaks_all) / total_frames if total_frames > 0 else None,
        'frame_dominance': float(np.mean(diffs)) if diffs else None,
        'stamina_score': (
            float(np.mean(late_breaks) - np.mean(early_breaks))
            if early_breaks and late_breaks else None
        ),
    }


# ── FEATURE COLLECTION ────────────────────────────────────────────────────────

def collect_player_features(
    player_id: int,
    opponent_id: int,
    elo_value: float,
    cutoff_date=None,
) -> dict:
    """
    Gathers all 15 features for player_id in a match versus opponent_id.
    elo_value must be pre-computed by the caller (from compute_elo_ratings
    for live predictions, or get_elo_on_date for training).
    cutoff_date prevents future data leakage during training.
    """
    trend = get_ranking_trend(player_id)
    frame_s = get_frame_stats(player_id)
    deciding = get_deciding_frames(player_id)
    finals = get_finals_record(player_id)
    streak = get_win_streak(player_id)
    top16 = get_seasons_in_top16(player_id)
    season = get_season_stats(player_id)

    ranking_pos = trend.get('current') or 200
    season_matches = max(season.get('matches') or 1, 1)

    century_entry = CenturyRecord.objects.filter(player_id=player_id).first()
    season_centuries = (century_entry.season_current if century_entry else 0) or 0

    ff = compute_frame_features(player_id, n_matches=10, cutoff_date=cutoff_date)

    return {
        'elo':               elo_value,
        'weighted_form':     compute_weighted_form(player_id, cutoff_date),
        'h2h_win_rate':      get_h2h_smoothed(player_id, opponent_id, cutoff_date),
        'world_ranking':     1.0 / ranking_pos,
        'ranking_trend':     float(trend.get('delta') or 0),
        'frame_win_pct':     float(frame_s.get('frame_pct') or 50.0),
        'deciding_pct':      float(deciding.get('deciding_pct') or 50.0),
        'finals_pct':        float(finals.get('finals_pct') or 50.0),
        'streak_norm':       math.tanh((streak or 0) / 5.0),
        'century_rate':      season_centuries / season_matches,
        'top16_seasons':     float(top16 or 0),
        'avg_break_quality': ff['avg_break_quality'],
        'break_rate':        ff['break_rate'],
        'frame_dominance':   ff['frame_dominance'],
        'stamina_score':     ff['stamina_score'],
    }


def build_feature_vector(p1_feat: dict, p2_feat: dict) -> np.ndarray:
    """
    Builds a 30-dim feature vector: 15 differences (p1-p2) + 15 absolute p1 values.
    None → NaN so XGBoost handles missing frame data natively.
    """
    diffs = [
        (p1_feat[k] - p2_feat[k])
        if p1_feat[k] is not None and p2_feat[k] is not None
        else float('nan')
        for k in FEATURE_NAMES
    ]
    abs_p1 = [
        p1_feat[k] if p1_feat[k] is not None else float('nan')
        for k in FEATURE_NAMES
    ]
    return np.array(diffs + abs_p1, dtype=float)


# ── MODEL ─────────────────────────────────────────────────────────────────────

def load_model():
    """Loads trained model from disk (once per process). Returns None if not found."""
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    pkl_path = MODEL_DIR / "match_predictor.pkl"
    if pkl_path.exists() and ML_AVAILABLE:
        _model_cache = joblib.load(pkl_path)
        return _model_cache
    return None


def invalidate_model_cache():
    """Call after retraining to force reload on next prediction."""
    global _model_cache, _elo_cache
    _model_cache = None
    _elo_cache = None


# ── FALLBACK RULE-BASED SCORER ────────────────────────────────────────────────

def rule_based_prediction(p1_feat: dict, p2_feat: dict) -> tuple[float, float]:
    """
    Weighted feature difference → sigmoid → win probabilities.
    Used when no trained model file exists (first deploy, before retraining).
    """
    weights = {
        'elo': 0.22, 'weighted_form': 0.18, 'h2h_win_rate': 0.15,
        'world_ranking': 0.10, 'ranking_trend': 0.05, 'frame_win_pct': 0.05,
        'deciding_pct': 0.10, 'finals_pct': 0.04, 'streak_norm': 0.05,
        'century_rate': 0.02, 'top16_seasons': 0.01,
        'avg_break_quality': 0.01, 'break_rate': 0.01,
        'frame_dominance': 0.01, 'stamina_score': 0.00,
    }
    score = 0.0
    for k, w in weights.items():
        v1 = p1_feat.get(k) or 0.0
        v2 = p2_feat.get(k) or 0.0
        score += w * (v1 - v2)
    p1_prob = 1.0 / (1.0 + math.exp(-score * 4))
    return round(p1_prob, 4), round(1 - p1_prob, 4)


# ── CLAUDE NARRATIVE ──────────────────────────────────────────────────────────

def generate_claude_narrative(
    p1_name: str, p2_name: str,
    p1_feat: dict, p2_feat: dict,
    p1_prob: float,
) -> str:
    """
    Calls claude-sonnet-4-6 to generate a 3-4 sentence match analysis.
    Falls back to a static sentence if API key is missing or call fails.
    """
    if not ANTHROPIC_AVAILABLE or not getattr(settings, 'ANTHROPIC_API_KEY', ''):
        winner = p1_name if p1_prob >= 0.5 else p2_name
        return f"Statistical analysis favours {winner} based on current form and historical head-to-head data."

    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        winner = p1_name if p1_prob >= 0.5 else p2_name
        conf = max(p1_prob, 1 - p1_prob) * 100

        def _fmt(v, decimals=2):
            return f"{v:.{decimals}f}" if v is not None else "N/A"

        prompt = (
            f"You are a professional snooker analyst. Write a 3-4 sentence expert prediction "
            f"for {p1_name} vs {p2_name}. The statistical model predicts {winner} wins "
            f"({conf:.0f}% confidence). Focus on 2-3 specific key factors from the data below. "
            f"Do NOT mention the confidence percentage directly. Write in present tense.\n\n"
            f"{p1_name}: Elo={p1_feat['elo']:.0f}, form={_fmt(p1_feat['weighted_form'])}, "
            f"H2H={_fmt(p1_feat['h2h_win_rate'])}, frame_win%={_fmt(p1_feat['frame_win_pct'],1)}, "
            f"deciding%={_fmt(p1_feat['deciding_pct'],1)}, streak={_fmt(p1_feat['streak_norm'])}, "
            f"avg_break={_fmt(p1_feat.get('avg_break_quality'),0)}, "
            f"frame_dominance={_fmt(p1_feat.get('frame_dominance'),1)}, "
            f"stamina={_fmt(p1_feat.get('stamina_score'),1)}\n"
            f"{p2_name}: Elo={p2_feat['elo']:.0f}, form={_fmt(p2_feat['weighted_form'])}, "
            f"H2H={_fmt(p2_feat['h2h_win_rate'])}, frame_win%={_fmt(p2_feat['frame_win_pct'],1)}, "
            f"deciding%={_fmt(p2_feat['deciding_pct'],1)}, streak={_fmt(p2_feat['streak_norm'])}, "
            f"avg_break={_fmt(p2_feat.get('avg_break_quality'),0)}, "
            f"frame_dominance={_fmt(p2_feat.get('frame_dominance'),1)}, "
            f"stamina={_fmt(p2_feat.get('stamina_score'),1)}"
        )

        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=240,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip()
    except Exception:
        winner = p1_name if p1_prob >= 0.5 else p2_name
        return f"Statistical analysis favours {winner} based on current form and historical head-to-head data."


# ── TOP FACTORS ───────────────────────────────────────────────────────────────

def _build_top_factors(
    p1_name: str, p2_name: str,
    p1f: dict, p2f: dict,
    p1_prob: float,
) -> list[str]:
    """Returns up to 3 human-readable strings explaining the key prediction drivers."""
    winner = p1_name if p1_prob >= 0.5 else p2_name
    wf = p1f if p1_prob >= 0.5 else p2f
    lf = p2f if p1_prob >= 0.5 else p1f
    factors = []

    elo_diff = abs(p1f['elo'] - p2f['elo'])
    if elo_diff > 20:
        factors.append(f"Elo advantage: +{elo_diff:.0f} rating points for {winner}")

    h2h = wf['h2h_win_rate']
    if h2h > 0.56:
        factors.append(f"Head-to-head edge: {h2h*100:.0f}% historical win rate vs this opponent")

    form_diff = wf['weighted_form'] - lf['weighted_form']
    if form_diff > 0.06:
        factors.append(f"Stronger current form: {wf['weighted_form']*100:.0f}% recent win rate")

    if wf.get('stamina_score') is not None and wf['stamina_score'] > 2:
        factors.append(f"Late-match stamina: {winner} scores bigger breaks as matches progress")

    bq_w = wf.get('avg_break_quality')
    bq_l = lf.get('avg_break_quality')
    if bq_w is not None and bq_l is not None and (bq_w - bq_l) > 5:
        factors.append(f"Higher break quality: avg {bq_w:.0f} vs {bq_l:.0f} in recent matches")

    if wf.get('deciding_pct') and wf['deciding_pct'] - (lf.get('deciding_pct') or 50) > 5:
        factors.append(f"Clutch record: {wf['deciding_pct']:.0f}% win rate in deciding frames")

    if not factors:
        factors.append(f"{winner} holds the statistical edge across multiple categories")

    return factors[:3]


# ── MAIN ORCHESTRATION ────────────────────────────────────────────────────────

def predict_match(p1_id: int, p2_id: int, p1_name: str, p2_name: str) -> dict:
    """
    Full prediction pipeline:
    1. Compute Elo ratings (cached)
    2. Collect 15 features per player
    3. Run XGBoost model or fall back to rule-based scoring
    4. Generate Claude API narrative
    5. Return structured JSON dict

    This is the only function called by the Django view.
    """
    elo_cache = compute_elo_ratings()

    p1_feat = collect_player_features(p1_id, p2_id, elo_cache.get(p1_id, 1500.0))
    p2_feat = collect_player_features(p2_id, p1_id, elo_cache.get(p2_id, 1500.0))

    model = load_model()
    if model is not None:
        vec = build_feature_vector(p1_feat, p2_feat).reshape(1, -1)
        p1_prob = float(model.predict_proba(vec)[0, 1])
        model_version = "xgboost_trained"
    else:
        p1_prob, _ = rule_based_prediction(p1_feat, p2_feat)
        model_version = "rule_based"

    p2_prob = round(1 - p1_prob, 4)
    conf_gap = abs(p1_prob - 0.5) * 2
    confidence = "high" if conf_gap > 0.30 else "medium" if conf_gap > 0.15 else "low"

    narrative = generate_claude_narrative(p1_name, p2_name, p1_feat, p2_feat, p1_prob)
    top_factors = _build_top_factors(p1_name, p2_name, p1_feat, p2_feat, p1_prob)

    metrics: dict = {}
    metrics_path = MODEL_DIR / "model_metrics.json"
    if metrics_path.exists():
        try:
            with open(metrics_path) as f:
                metrics = json.load(f)
        except Exception:
            pass

    def _safe_round(v):
        return round(v, 4) if isinstance(v, float) else v

    return {
        "predicted_winner_id": p1_id if p1_prob >= 0.5 else p2_id,
        "p1_win_probability":  round(p1_prob, 4),
        "p2_win_probability":  round(p2_prob, 4),
        "confidence":          confidence,
        "features_p1":         {k: _safe_round(v) for k, v in p1_feat.items()},
        "features_p2":         {k: _safe_round(v) for k, v in p2_feat.items()},
        "top_factors":         top_factors,
        "narrative":           narrative,
        "model_version":       model_version,
        "model_brier_score":   metrics.get("brier_score"),
        "generated_at":        datetime.utcnow().isoformat() + "Z",
    }
