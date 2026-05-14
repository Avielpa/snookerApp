# AI Insight Feature — V2 Architecture Plan

> Status: Planning complete. Ready to implement.
> All decisions finalised through deep discussion. Do not start coding before re-reading this fully.

---

## What We Are Building

An "AI Insight" button on every upcoming/live match card. Tapping it opens a prediction screen showing:
- Who is predicted to win and with what probability
- Key statistical factors driving the prediction
- Feature breakdown comparing both players
- AI-generated narrative (optional, requires Anthropic API key)

The prediction is powered by an XGBoost ML model trained on 57,000+ historical matches, using 12 carefully chosen features per player. Predictions are pre-computed from stored player profiles — response time under 100ms.

---

## Core Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| Model storage | DB binary (`MLModelStorage` model, `BinaryField`) | Survives redeploys, backed up with DB, zero extra infra |
| Update trigger | Hook into `fetch_frame_scores` + nightly cron | Safe, doesn't touch `auto_live_monitor` |
| Railway service | No new service — management commands + Railway cron | Less complexity, same result |
| Prediction speed | Pre-computed profiles → 6 DB reads → <100ms | No on-the-fly computation |
| Frontend URL | Same `/ai-insight/[matchId]` route | Frontend unchanged from V1 design |

---

## New Database Tables (4 total)

### 1. `PlayerPredictionProfile`
One row per player. Updated after every match. Used for live predictions.

| Field | Type | Description |
|---|---|---|
| player_id | FK → Player | One row per player |
| elo | FloatField | Variable-K Elo (K=25 recent, K=15 mid, K=8 old) |
| weighted_form | FloatField | Exponential decay win rate, last 15 matches (λ=0.96) |
| world_ranking | IntegerField | Current ranking position |
| ranking_trend | IntegerField | Position change vs 6 months ago (negative = improving) |
| deciding_frame_win_rate | FloatField | Win rate when match goes to final frame |
| titles_this_season | IntegerField | Ranking titles won this season |
| finals_this_season | IntegerField | Finals reached this season |
| semis_this_season | IntegerField | Semis reached this season |
| current_streak | IntegerField | Positive = win streak, negative = loss streak |
| updated_at | DateTimeField | Last update timestamp |

### 2. `PlayerFrameProfile`
One row per player. Frame-based stats from last 10 matches with frame data.

| Field | Type | Description |
|---|---|---|
| player_id | FK → Player | One row per player |
| frames_analyzed | IntegerField | Number of frames the stats are based on |
| avg_break_50plus | FloatField | Average value of breaks ≥50 |
| break_50_rate | FloatField | Frames with ≥50 break / total frames |
| break_100_rate | FloatField | Centuries / total frames |
| avg_frame_margin | FloatField | Average point difference per frame (dominance) |
| stamina_score | FloatField | Late frame break avg minus early frame break avg |
| updated_at | DateTimeField | Last update timestamp |

**Stamina score explained:**
Split each match into thirds. Compare break quality in the last third vs first third.
- Positive = player gets stronger as match goes on (good stamina)
- Negative = player fades in long matches (stamina problem)
- Especially important in best-of-17, best-of-19, best-of-25 formats

**Update mechanism:** Sliding window — always recompute from the player's last 10 matches
that have frame data in `MatchFrameScore`. No raw frame storage per player needed.

### 3. `PlayerTournamentRecord`
One row per player per tournament. The "Nadal at Roland Garros" effect.

| Field | Type | Description |
|---|---|---|
| player_id | FK → Player | |
| tournament_name | CharField | Normalised name e.g. "Welsh Open", "UK Championship" |
| editions_played | IntegerField | Times entered this tournament |
| titles | IntegerField | Times won it |
| finals_reached | IntegerField | Finals appearances |
| semis_reached | IntegerField | Semi-final appearances |
| win_rate | FloatField | Laplace-smoothed: (wins+1)/(editions+2) |
| last_result | CharField | "W", "F", "SF", "QF", etc. |

**Why separate table (not in Player):** 500 players × 30 tournaments = 15,000 rows max.
Tiny. Much cleaner than 30+ columns in the Player table.

**Data source:** Our own `PlayerMatchHistory` — no new scraping needed.
- Title = won a match where `round=15` (final) at this event
- Final = played a match where `round=15`
- Semi = played a match where `round=14`

**For prediction:** When predicting a Welsh Open match, look up both players'
`PlayerTournamentRecord` for "Welsh Open". Feature = `p1_win_rate - p2_win_rate`.

### 4. `MatchPredictionFeatures`
One row per finished match. The permanent training dataset. Never deleted — grows forever.

| Field | Type | Description |
|---|---|---|
| match_id | FK → PlayerMatchHistory | |
| match_date | DateField | For walk-forward CV ordering |
| p1_features | JSONField | Full feature snapshot for player 1 at match time |
| p2_features | JSONField | Full feature snapshot for player 2 at match time |
| winner | IntegerField | 1 = p1 won, 2 = p2 won |
| tournament_name | CharField | For tournament-specific analysis |
| created_at | DateTimeField | |

This row is written BEFORE the match result when features are computed (at prediction time),
then updated with the winner when the match finishes. Training reads this table directly —
no re-computation needed. Training in minutes, not hours.

### 5. `MLModelStorage`
Stores the trained model binary in the DB. Survives all redeploys.

| Field | Type | Description |
|---|---|---|
| version | CharField | e.g. "xgboost_v3_2026Q1" |
| model_binary | BinaryField | Pickled CalibratedClassifierCV object |
| brier_score | FloatField | CV Brier score from last training |
| roc_auc | FloatField | CV AUC from last training |
| n_training_samples | IntegerField | How many rows trained on |
| feature_names | JSONField | List of feature names in order |
| trained_at | DateTimeField | |
| is_active | BooleanField | Only one row is active at a time |

---

## The 12 Features (in order of predictive importance)

| # | Feature | Source table | Notes |
|---|---|---|---|
| 1 | Elo rating | PlayerPredictionProfile | Variable K — recent matches weighted more |
| 2 | Weighted H2H win rate | H2HCache (enhanced) | Recency-decayed, Laplace-smoothed |
| 3 | Tournament win rate (this event) | PlayerTournamentRecord | The Nadal effect |
| 4 | Weighted form (last 15 matches) | PlayerPredictionProfile | λ=0.96 exponential decay |
| 5 | World ranking (1/position) | PlayerPredictionProfile | Normalised to [0,1] |
| 6 | Ranking trend | PlayerPredictionProfile | Improving vs declining trajectory |
| 7 | Deciding frame win rate | PlayerPredictionProfile | Clutch performance under pressure |
| 8 | Stamina score | PlayerFrameProfile | Late vs early frame break quality |
| 9 | Break 50+ rate | PlayerFrameProfile | Scoring consistency per frame |
| 10 | Avg break quality | PlayerFrameProfile | Potting quality under pressure |
| 11 | Titles this season | PlayerPredictionProfile | Current season form |
| 12 | Finals/semis reached | PlayerPredictionProfile | Tournament depth this season |

**Feature vector:** 24 dimensions = 12 differences (p1-p2) + 12 absolute (p1 values).
`None` values → `NaN` (XGBoost handles natively, no imputation needed).

---

## The Math

### Elo (Variable K)
```
Expected_p1 = 1 / (1 + 10^((Elo_p2 - Elo_p1) / 400))
K = 25 if match < 90 days ago
K = 15 if match 90–365 days ago
K = 8  if match > 365 days ago
New_Elo_p1 = Old_Elo_p1 + K × (Actual - Expected)
```
Starting Elo: 1500. Solves the "Xintong was Q-tour" problem — old matches contribute minimally.

### Weighted Form
```
form = Σ(result_i × 0.96^i) / Σ(0.96^i)
where i=0 is most recent match, result=1 for win, 0 for loss
over last 15 matches
```

### Weighted H2H
```
h2h = Σ(win_i × 0.95^i) / Σ(0.95^i)  [over all H2H meetings, i=0 most recent]
smoothed = (h2h_weighted_wins + 2) / (h2h_weighted_total + 4)  [Laplace α=2]
```
Defaults to 0.5 with no history. Old meetings (10+ years ago) contribute ~17% of a recent meeting.

### Tournament Win Rate
```
win_rate = (titles + 1) / (editions_played + 2)  [Laplace α=1]
```
Allen: 1 win / 5 editions → (1+1)/(5+2) = 0.286
Ronnie: 7 wins / 10 editions → (7+1)/(10+2) = 0.667
Feature for this match = 0.667 - 0.286 = 0.381 → strong signal for Ronnie

### Stamina Score
```
Split each match into thirds by frame number.
early_breaks = avg(player_break for frames in first third, where break >= 50)
late_breaks  = avg(player_break for frames in last third,  where break >= 50)
stamina_score = late_breaks - early_breaks
```
Positive = gets stronger. Negative = fades. Null if insufficient frame data.

### Brier Score (primary quality metric)
```
Brier = (1/N) × Σ(predicted_probability - actual_outcome)²
```
- Always predict 0.5: Brier = 0.250 (baseline)
- Target: Brier < 0.215 (14% better than random)
- Good sports model: 0.200–0.220

---

## Update Flow

```
Match finishes (status=3)
        ↓
update_matches command syncs result
        ↓
fetch_frame_scores scrapes CueTracker
        ↓  (hook added here)
update_player_profiles command runs for both players:
  - Recompute Elo (update PlayerPredictionProfile)
  - Recompute weighted_form (last 15 matches)
  - Recompute titles/finals/semis this season
  - Recompute deciding_frame_win_rate
  - Recompute PlayerFrameProfile (last 10 matches with frame data)
  - Update PlayerTournamentRecord for this tournament
  - Write row to MatchPredictionFeatures
        ↓
Nightly Railway cron (3am): python manage.py update_player_profiles --all
  (catches any missed updates)
        ↓
Quarterly: python manage.py retrain_prediction_model
  - Reads MatchPredictionFeatures (SELECT only, instant)
  - Walk-forward TimeSeriesSplit CV (5 folds)
  - Trains XGBoost + Platt calibration
  - Saves to MLModelStorage (replaces active model in DB)
```

---

## Prediction Endpoint Flow

```
GET /ai-prediction/<p1_id>/<p2_id>/?event_id=<id>

1. Check Django cache (1h TTL) → return if hit
2. Load both PlayerPredictionProfile rows (1 query)
3. Load both PlayerFrameProfile rows (1 query)
4. Load both PlayerTournamentRecord rows for this event (1 query)
5. Load H2HCache for this pair (1 query)
6. Load active MLModelStorage (cached in memory after first load)
7. Build 24-dim feature vector
8. model.predict_proba(vector) → p1_win_probability
9. Build response JSON
10. Cache result
Total time: <100ms
```

---

## ML Model Details

**Algorithm:** XGBoost + Platt Calibration
```python
base = XGBClassifier(
    max_depth=5,
    learning_rate=0.05,
    n_estimators=300,
    subsample=0.8,
    min_child_weight=5,
    reg_lambda=1.0,
)
model = CalibratedClassifierCV(base, method='sigmoid', cv=3)
```

**Why XGBoost over weighted formula:**
XGBoost learns non-linear interactions automatically from data. Examples it discovers:
- "Elo edge + H2H edge = 79% win, not 60% + 63%"
- "Tournament record only matters when player has 5+ appearances"
- "Stamina score matters more in best-of-25 than best-of-7"

You cannot discover these rules manually. The model finds them in 57,000+ examples.

**Why Platt Calibration:**
Raw XGBoost outputs are ranking scores, not probabilities. Platt scaling ensures
that when the model says 70%, that player actually wins ~70% of the time across
thousands of predictions. Essential for betting use.

**Training validation:** Walk-forward TimeSeriesSplit (5 folds).
Trains on past, tests on future. Never leaks future data into training.

---

## How the Model Improves Over Time

Every match adds 1 row to `MatchPredictionFeatures`. Never deleted.

| Time | Training rows | Expected Brier |
|---|---|---|
| Launch | ~57,000 | ~0.225 |
| +6 months | ~58,500 | ~0.220 |
| +1 year | ~60,000 | ~0.215 |
| +2 years | ~63,000 | ~0.210 |

Improvement mechanisms:
- Frame data accumulates → stamina/break features become non-null for more players
- Tournament records build up → specialist effect measurable for more players
- Young players' career arcs fully captured → better prediction for new generation
- More H2H meetings → recency-weighted H2H statistically significant for more pairs

Retrain quarterly to pick up new data. The model never loses old patterns — it just adds new ones.

---

## Files to Create / Modify

### Backend
| File | Action |
|---|---|
| `maxBreak/oneFourSeven/models.py` | Add 5 new models |
| `maxBreak/oneFourSeven/ai_prediction.py` | Core ML logic (new) |
| `maxBreak/oneFourSeven/views.py` | Add `ai_prediction_view` |
| `maxBreak/oneFourSeven/urls.py` | Add route |
| `maxBreak/oneFourSeven/management/commands/update_player_profiles.py` | New command |
| `maxBreak/oneFourSeven/management/commands/retrain_prediction_model.py` | New command |
| `maxBreak/requirements.txt` | Add xgboost, scikit-learn, pandas, anthropic, joblib |
| `maxBreak/maxBreak/settings.py` | Add ANTHROPIC_API_KEY |

### Frontend (unchanged from V1 design)
| File | Action |
|---|---|
| `FrontMaxBreak/app/ai-insight/[matchId].tsx` | Prediction screen |
| `FrontMaxBreak/services/aiPredictionService.ts` | API service |
| `FrontMaxBreak/app/home/components/MatchItem.tsx` | Add AI badge |
| `FrontMaxBreak/app/home/styles/modernMatchStyles.ts` | Badge styles |
| `FrontMaxBreak/app/tour/[eventId].tsx` | Add AI badge |

---

## Verification Checklist

### Backend
- [ ] `python manage.py migrate` — all 5 new tables created
- [ ] `python manage.py update_player_profiles --all` — populates all player profiles
- [ ] `python manage.py retrain_prediction_model` — trains and saves model to DB
- [ ] `GET /ai-prediction/97/2469/?event_id=X` — returns JSON in <100ms
- [ ] Second call returns from cache (no extra DB queries)
- [ ] After a test match update — profiles automatically updated

### Frontend
- [ ] AI badge visible on upcoming/live matches, absent on finished
- [ ] Badge absent when either player ID is null
- [ ] Prediction screen loads with verdict, bars, factors, narrative
- [ ] "View Full Comparison" navigates to compare screen with pre-filled players
- [ ] Loading and error states handled gracefully

### Pre-production
- [ ] `eas update --channel preview` — test on device
- [ ] Railway cron job configured for `update_player_profiles` (nightly 3am)
- [ ] Railway cron job configured for `retrain_prediction_model` (quarterly)
- [ ] `eas update --channel production` only after preview verified
