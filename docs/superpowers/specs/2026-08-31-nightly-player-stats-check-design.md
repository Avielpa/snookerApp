# Nightly Player-Stats Accuracy Check — Design

Date: 2026-08-31
Status: Approved for planning

## Problem

MaxBreak presents player career stats (titles, maximums, match history,
finals reached) that are sourced from `PlayerMatchHistory` / `Player` /
career-backfill jobs. There is no automated way to know when that data
drifts from reality or has internal gaps — inaccuracies would only
surface if a user happened to notice a wrong number. Two manual,
one-off management commands already exist (`validate_career_data.py`,
`verify_player_stats.py`) but neither is scheduled, neither alerts
anyone, and both require someone to remember to run them.

## Goal

An independent, nightly, automated job that:
1. Checks every player's stats for internal inconsistency (DB-only).
2. Cross-checks a rolling slice of players against snooker.org's own
   career aggregates (source of truth), covering the *entire* player
   roster over time — not just top-ranked players, since the Compare
   tool lets a user look up any two players.
3. Attempts a narrow, already-trusted repair for flags it knows how to
   fix, then re-verifies.
4. Notifies the developer only when something is still wrong after
   that attempt (or the attempt itself failed) — silent on a clean or
   self-healed night.
5. Runs fully independently of the Railway backend (no new Railway
   service, no changes to `Procfile`), and can never trigger a
   production deploy or write anything outside one already-reviewed
   command's own write path.

## Non-goals (out of scope, logged to `docs/OPEN_MISSIONS.md`)

- Validating `PlayerCareerStats`, `CenturyRecord`, or `Ranking` rows.
- Any UI/frontend change.
- Replacing or modifying the existing manual commands
  (`validate_career_data.py`, `verify_player_stats.py`) — they remain
  as-is for ad hoc manual use.

## Architecture

```
GitHub Actions (cron, 03:00 UTC nightly)
   │
   ├─ checkout repo, setup Python, pip install -r maxBreak/requirements.txt
   ├─ restore cursor from actions/cache (key: nightly-stats-cursor)
   ├─ run: python manage.py nightly_stats_check
   │     env: DATABASE_URL, SECRET_KEY, ADMIN_EXPO_PUSH_TOKEN
   │     ├─ DB-only pass over ALL Player rows
   │     ├─ API cross-check pass over next 100 players (cursor-based,
   │     │    wraps to start at end of roster), 30s/call throttle
   │     ├─ for flags in the known-safe auto-fixable set:
   │     │    → call backfill_career_history --player-id X --force
   │     │    → re-run that player's checks
   │     │    → capped at N auto-fix attempts per run
   │     ├─ aggregate: still-flagged players + errors + auto-fixed log
   │     └─ if still-flagged or errors: send one Expo push via
   │          existing send_expo_push() to ADMIN_EXPO_PUSH_TOKEN
   │          else: no notification (silent success)
   └─ save cursor back to actions/cache
```

No new Railway service. No git commits back to the repo. No writes to
any model except through `backfill_career_history`'s existing,
already-manually-used write path.

## Components

### 1. `oneFourSeven/management/commands/nightly_stats_check.py` (new file)

- **DB-only pass**: adapted from `validate_career_data.py`'s flag
  logic (`NO_MATCHES`, `LOW_MATCHES`, `NO_FINALS`, `RN%` round-name
  coverage, `ORPHAN` seasons), run over every `Player` row (not
  rank-limited).
- **API cross-check pass**: adapted from `verify_player_stats.py`'s
  t=4 logic (`FINALS<TITLES`, `BAD_WIN%`), but **read-only** — it must
  never call `.save()` on a `Player` row itself (the silent
  `NumRankingTitles`/`NumMaximums` overwrite in the existing command is
  deliberately not carried over). Covers the next 100 players by ID
  order each run, cursor persisted via GitHub Actions cache, wraps at
  end of roster.
- **Auto-fixable flag set**: `NO_MATCHES`, `LOW_MATCHES`, `ORPHAN`
  (missing-data shaped issues that `backfill_career_history --force`
  is already the known repair for). Capped at, e.g., 20 auto-fix
  attempts per run to bound total runtime and API load; anything past
  the cap is reported as still-flagged rather than attempted.
- **Non-auto-fixable flags**: `BAD_WIN%`, `FINALS<TITLES`, `NO_FINALS`
  — these can indicate a genuine data anomaly rather than missing
  data, so they always go straight to the notify path for human
  review, never an automatic write.
- **Failure isolation**: every per-player check, every
  `backfill_career_history` invocation, and the single outbound Expo
  push call are individually wrapped in try/except — one bad row, a
  DB hiccup, or Expo being briefly down degrades to "log and skip
  that piece," never crashes the whole run.
- **Report**: printed to stdout (captured in the Actions run log
  regardless of outcome) — auto-fixed list, still-flagged list, any
  errors. This is the durable record; no new DB table.
- **Exit code**: non-zero if anything is still flagged or errored
  after auto-fix attempts, so a failed GitHub Actions run is a second,
  independent signal beyond the push notification.
- **Flags**:
  - `--dry-run` — run all checks and print the report, skip both the
    auto-fix step and the push notification (for manual verification
    before the first scheduled run, and for local testing).
  - `--notify-token` — Expo push token to notify (from
    `ADMIN_EXPO_PUSH_TOKEN` env var in the workflow).
  - `--batch-size` (default 100) / `--max-autofix` (default 20) —
    overridable for testing without editing constants.

### 2. Cursor persistence

- File `nightly_stats_cursor.json`, restored/saved via
  `actions/cache@v4` keyed on a fixed cache key (e.g.
  `nightly-stats-cursor`), scoped to the workflow's working directory.
  Never committed to git, never touches `master`, cannot trigger a
  Railway deploy.
- If the cache is evicted (inactivity, size limits), the sweep just
  restarts from the first player by ID — harmless, not an error.

### 3. GitHub Actions workflow: `.github/workflows/nightly_stats_check.yml`

- `on: schedule: cron: '0 3 * * *'` (03:00 UTC nightly) +
  `workflow_dispatch` for manual runs.
- Secrets required (repo secrets, added by the user): `DATABASE_URL`
  (Railway Postgres connection string), `SECRET_KEY` (Django boot
  requirement), `ADMIN_EXPO_PUSH_TOKEN` (developer's own Expo push
  token).
- Steps: checkout → setup-python → `pip install -r
  maxBreak/requirements.txt` → restore cache → `python manage.py
  nightly_stats_check` (from `maxBreak/`) → save cache (always, even
  on failure, via `if: always()`).

### 4. Tests

- New test file (e.g. `maxBreak/oneFourSeven/tests/test_nightly_stats_check.py`)
  exercising the flag logic against fixture `Player`/`PlayerMatchHistory`
  rows — no live API, no live DB dependency beyond Django's test DB.
  Cases: each flag type triggers correctly; auto-fixable vs
  non-auto-fixable routing; cap-at-N behavior; clean run produces no
  notification; a simulated `backfill_career_history` failure is
  logged, not raised.
- Manual dry-run (`--dry-run`) against production data once, reviewed
  before the workflow is enabled on a schedule.

## Safety properties (carried from earlier discussion, restated as
acceptance criteria)

- The job contains no direct `.save()`/`.update()` calls on any model;
  its only write path is invoking the existing
  `backfill_career_history --force` command for a narrow, known-safe
  flag set.
- The job never commits to or pushes any branch; cursor state lives
  only in GitHub Actions cache.
- A failure in any one player's check, any one auto-fix attempt, or
  the push notification call cannot abort the rest of the run.
- Runs entirely on GitHub Actions infrastructure — a failure cannot
  affect the Railway `web` or `live_monitor` processes.
- Clean and self-healed nights produce zero notifications; only
  genuinely unresolved issues page the developer.
