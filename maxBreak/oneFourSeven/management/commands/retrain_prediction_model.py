"""
Management command: retrain_prediction_model

Trains an XGBoost match prediction model on historical PlayerMatchHistory data.
Features are computed with cutoff_date=match_date to prevent data leakage.
Uses walk-forward TimeSeriesSplit CV, then saves a Platt-calibrated final model.

Performance optimisations:
  - Elo pre-computed in ONE chronological pass (O(N) total, vs O(N²) per-match)
  - Static player stats (ranking, frame %, streak, etc.) cached per player_id
    so each player is queried once, not once per match they appear in

Usage:
    python manage.py retrain_prediction_model
    python manage.py retrain_prediction_model --min-samples 200
"""
import json
import math
from datetime import datetime
from pathlib import Path

import numpy as np

from django.core.management.base import BaseCommand

from oneFourSeven.ai_prediction import (
    FEATURE_NAMES,
    compute_frame_features,
    compute_weighted_form,
    get_h2h_smoothed,
    invalidate_model_cache,
)
from oneFourSeven.models import CenturyRecord, PlayerMatchHistory
from oneFourSeven.player_stats import (
    get_deciding_frames,
    get_finals_record,
    get_frame_stats,
    get_ranking_trend,
    get_season_stats,
    get_seasons_in_top16,
    get_win_streak,
)

MODEL_DIR = Path(__file__).resolve().parent.parent.parent.parent / "ml_models"


class Command(BaseCommand):
    help = "Train XGBoost match prediction model on historical PlayerMatchHistory data"

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-samples', type=int, default=400,
            help="Minimum valid training rows required before training (default: 400)"
        )

    def handle(self, *args, **options):
        try:
            import pandas as pd
            from xgboost import XGBClassifier
            from sklearn.calibration import CalibratedClassifierCV
            from sklearn.metrics import brier_score_loss, roc_auc_score
            from sklearn.model_selection import TimeSeriesSplit
            import joblib
        except ImportError as e:
            self.stderr.write(f"Missing dependency: {e}. Run: pip install xgboost scikit-learn pandas joblib")
            return

        self.stdout.write("=" * 60)
        self.stdout.write("  MaxBreak AI Prediction Model — Retraining")
        self.stdout.write("=" * 60)

        rows = self._extract_training_samples(options['min_samples'])
        if rows is None:
            return

        col_diffs = [f"diff_{f}" for f in FEATURE_NAMES]
        col_abs   = [f"abs_{f}"  for f in FEATURE_NAMES]
        df = pd.DataFrame(rows)
        X = df[col_diffs + col_abs].values.astype(float)
        y = df['label'].values.astype(int)

        self.stdout.write(f"\nDataset: {len(y)} samples  |  p1 wins: {y.sum()}  |  p2 wins: {len(y)-y.sum()}")
        self.stdout.write(f"Feature dims: {X.shape[1]}  (15 diff + 15 abs)\n")

        self._run_walk_forward_cv(X, y, TimeSeriesSplit, XGBClassifier, brier_score_loss, roc_auc_score)
        self._train_and_save(X, y, XGBClassifier, CalibratedClassifierCV, brier_score_loss, roc_auc_score, joblib)

        invalidate_model_cache()
        self.stdout.write(self.style.SUCCESS("\nElo and model caches invalidated. Next prediction uses fresh model."))

    # ── ELO PRE-COMPUTATION (single O(N) pass) ────────────────────────────────

    def _precompute_elo(self, matches) -> list:
        """
        Walks through all matches chronologically once, maintaining a running
        Elo dict. Records each player's Elo BEFORE the match is processed.
        Returns a list of (e1_before, e2_before) aligned with the matches list.

        This replaces 115,000 separate get_elo_on_date() DB calls (which were
        each re-scanning all prior matches from scratch — O(N²) overall).
        """
        K = 10
        elo = {}
        result = []
        for m in matches:
            p1, p2, winner = m['player1_id'], m['player2_id'], m['winner_id']
            e1 = elo.get(p1, 1500.0)
            e2 = elo.get(p2, 1500.0)
            result.append((e1, e2))
            exp1 = 1.0 / (1.0 + 10 ** ((e2 - e1) / 400.0))
            act1 = 1.0 if winner == p1 else 0.0
            elo[p1] = e1 + K * (act1 - exp1)
            elo[p2] = e2 + K * ((1 - act1) - (1 - exp1))
        self.stdout.write(f"Elo pre-computed for {len(elo)} unique players in one pass.")
        return result

    # ── STATIC PLAYER STATS (cached per player_id) ────────────────────────────

    def _get_static_features(self, player_id: int, cache: dict) -> dict:
        """
        Fetches features that don't have a cutoff date (ranking, frame %, etc.).
        Result is cached per player_id — each player is queried only once
        regardless of how many matches they appear in.
        """
        if player_id in cache:
            return cache[player_id]

        trend   = get_ranking_trend(player_id)
        frame_s = get_frame_stats(player_id)
        dec     = get_deciding_frames(player_id)
        fin     = get_finals_record(player_id)
        streak  = get_win_streak(player_id)
        top16   = get_seasons_in_top16(player_id)
        seas    = get_season_stats(player_id)
        cent    = CenturyRecord.objects.filter(player_id=player_id).first()

        ranking_pos  = trend.get('current') or 200
        seas_matches = max(seas.get('matches') or 1, 1)
        seas_cent    = (cent.season_current if cent else 0) or 0

        result = {
            'world_ranking': 1.0 / ranking_pos,
            'ranking_trend': float(trend.get('delta') or 0),
            'frame_win_pct': float(frame_s.get('frame_pct') or 50.0),
            'deciding_pct':  float(dec.get('deciding_pct') or 50.0),
            'finals_pct':    float(fin.get('finals_pct') or 50.0),
            'streak_norm':   math.tanh((streak or 0) / 5.0),
            'century_rate':  seas_cent / seas_matches,
            'top16_seasons': float(top16 or 0),
        }
        cache[player_id] = result
        return result

    # ── DATA EXTRACTION ───────────────────────────────────────────────────────

    def _extract_training_samples(self, min_samples: int):
        self.stdout.write("Loading finished matches from PlayerMatchHistory...")
        matches = list(
            PlayerMatchHistory.objects.filter(
                status=3,
                winner_id__isnull=False,
                score1__isnull=False,
                score2__isnull=False,
                player1_id__isnull=False,
                player2_id__isnull=False,
            ).order_by('scheduled_date').values(
                'player1_id', 'player2_id', 'winner_id', 'scheduled_date',
            )
        )
        self.stdout.write(f"Found {len(matches)} valid finished matches")

        if len(matches) < min_samples:
            self.stderr.write(
                f"Only {len(matches)} matches — need at least {min_samples}. "
                f"Run backfill_career_history to populate more data."
            )
            return None

        # Pre-compute Elo for all matches in one chronological pass
        self.stdout.write("Pre-computing Elo ratings (single pass)...")
        elo_values = self._precompute_elo(matches)

        # Cache static player features — computed once per unique player
        self.stdout.write("Building player stats cache...")
        static_cache = {}

        rows = []
        skipped = 0
        total = len(matches)

        self.stdout.write(f"Extracting features for {total} matches...")
        for i, m in enumerate(matches):
            if i % 2000 == 0 and i > 0:
                self.stdout.write(
                    f"  {i}/{total} matches processed  "
                    f"({len(rows)} rows built, {skipped} skipped)  "
                    f"players cached: {len(static_cache)}"
                )
            try:
                p1     = m['player1_id']
                p2     = m['player2_id']
                winner = m['winner_id']
                dt     = m['scheduled_date']
                e1, e2 = elo_values[i]

                f1 = self._get_features(p1, p2, e1, dt, static_cache)
                f2 = self._get_features(p2, p1, e2, dt, static_cache)

                diff_row = {
                    f"diff_{k}": (f1[k] - f2[k])
                    if f1[k] is not None and f2[k] is not None
                    else float('nan')
                    for k in FEATURE_NAMES
                }
                abs_row = {
                    f"abs_{k}": f1[k] if f1[k] is not None else float('nan')
                    for k in FEATURE_NAMES
                }
                rows.append({**diff_row, **abs_row, 'label': 1 if winner == p1 else 0})
            except Exception:
                skipped += 1
                continue

        self.stdout.write(f"Extracted {len(rows)} training rows  ({skipped} skipped due to errors)")
        return rows

    def _get_features(self, player_id: int, opponent_id: int,
                      elo: float, cutoff, static_cache: dict) -> dict:
        """Assembles all 15 features. Static features come from cache."""
        static = self._get_static_features(player_id, static_cache)
        ff = compute_frame_features(player_id, n_matches=10, cutoff_date=cutoff)

        return {
            'elo':               elo,
            'weighted_form':     compute_weighted_form(player_id, cutoff),
            'h2h_win_rate':      get_h2h_smoothed(player_id, opponent_id, cutoff),
            'world_ranking':     static['world_ranking'],
            'ranking_trend':     static['ranking_trend'],
            'frame_win_pct':     static['frame_win_pct'],
            'deciding_pct':      static['deciding_pct'],
            'finals_pct':        static['finals_pct'],
            'streak_norm':       static['streak_norm'],
            'century_rate':      static['century_rate'],
            'top16_seasons':     static['top16_seasons'],
            'avg_break_quality': ff['avg_break_quality'],
            'break_rate':        ff['break_rate'],
            'frame_dominance':   ff['frame_dominance'],
            'stamina_score':     ff['stamina_score'],
        }

    # ── CROSS-VALIDATION ──────────────────────────────────────────────────────

    def _run_walk_forward_cv(self, X, y, TimeSeriesSplit, XGBClassifier, brier_score_loss, roc_auc_score):
        self.stdout.write("Running walk-forward cross-validation (5 folds)...")
        self.stdout.write("  (Uses TimeSeriesSplit — trains on past, tests on future)")
        tscv = TimeSeriesSplit(n_splits=5)
        brier_scores, aucs = [], []

        for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(X)):
            model = XGBClassifier(
                max_depth=5,
                learning_rate=0.05,
                n_estimators=300,
                subsample=0.8,
                min_child_weight=5,
                reg_lambda=1.0,
                eval_metric='logloss',
                verbosity=0,
            )
            model.fit(X[train_idx], y[train_idx])
            probs = model.predict_proba(X[test_idx])[:, 1]
            bs  = brier_score_loss(y[test_idx], probs)
            auc = roc_auc_score(y[test_idx], probs)
            brier_scores.append(bs)
            aucs.append(auc)
            self.stdout.write(
                f"  Fold {fold_idx+1}:  train={len(train_idx)}  test={len(test_idx)}"
                f"  Brier={bs:.4f}  AUC={auc:.4f}"
            )

        self.stdout.write(
            f"\nCV Summary:  Brier={np.mean(brier_scores):.4f} ±{np.std(brier_scores):.4f}"
            f"  |  AUC={np.mean(aucs):.4f} ±{np.std(aucs):.4f}"
        )
        self.stdout.write(f"  Baseline (always 0.5): Brier=0.2500")
        improvement = 0.25 - np.mean(brier_scores)
        self.stdout.write(f"  Model improvement over baseline: {improvement:+.4f}\n")

    # ── TRAIN + SAVE ─────────────────────────────────────────────────────────

    def _train_and_save(self, X, y, XGBClassifier, CalibratedClassifierCV,
                        brier_score_loss, roc_auc_score, joblib):
        self.stdout.write("Training final model (XGBoost + Platt calibration)...")

        base = XGBClassifier(
            max_depth=5,
            learning_rate=0.05,
            n_estimators=300,
            subsample=0.8,
            min_child_weight=5,
            reg_lambda=1.0,
            eval_metric='logloss',
            verbosity=0,
        )
        model = CalibratedClassifierCV(base, method='sigmoid', cv=3)
        model.fit(X, y)

        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, MODEL_DIR / "match_predictor.pkl")

        probs = model.predict_proba(X)[:, 1]
        metrics = {
            "brier_score":   round(float(brier_score_loss(y, probs)), 4),
            "roc_auc":       round(float(roc_auc_score(y, probs)), 4),
            "n_samples":     int(len(y)),
            "trained_at":    datetime.utcnow().isoformat() + "Z",
            "model_type":    "XGBoost+PlattCalibration",
            "feature_count": int(X.shape[1]),
            "feature_names": [f"diff_{f}" for f in FEATURE_NAMES] + [f"abs_{f}" for f in FEATURE_NAMES],
        }
        with open(MODEL_DIR / "model_metrics.json", "w") as f:
            json.dump(metrics, f, indent=2)

        self.stdout.write(self.style.SUCCESS(
            f"Model saved to {MODEL_DIR}/match_predictor.pkl\n"
            f"  Brier score (train): {metrics['brier_score']}\n"
            f"  ROC-AUC  (train):  {metrics['roc_auc']}\n"
            f"  Samples:           {metrics['n_samples']}"
        ))
