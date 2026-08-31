# Session 2026-08-31: Nightly Player-Stats Accuracy Check

## What was built

A new, independent, nightly automated job that checks player stats
accuracy and pages the developer only when something is genuinely
wrong. Full design rationale: `docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md`.

## Why this shape

Two manual, one-off management commands already existed
(`validate_career_data.py`, `verify_player_stats.py`) with the exact
flag logic needed, but neither was scheduled or alerted anyone. The
brainstorming session surfaced two real risks in the naive version of
this idea before any code was written:

1. **Sampling by rank (top-N) misses the middle of the roster** — the
   Compare tool lets a user look up any two players, not just top-32,
   so checking only top-ranked players would leave most of the roster
   unverified. Fixed by a rolling cursor-based sweep over the *entire*
   player list instead of a fixed top-N.
2. **Persisting the rolling-sweep cursor via a git commit to `master`
   would have silently triggered a Railway redeploy every night**
   (per this repo's `git push master` → auto-deploy convention).
   Fixed by persisting the cursor in GitHub Actions cache instead —
   it never touches git or the repo at all.

## Files touched and why

- `maxBreak/oneFourSeven/nightly_stats_checks.py` (new) — all pure flag
  logic, DB snapshot building, cursor I/O, the snooker.org fetch, the
  auto-fix wrapper, and notification building. Kept separate from the
  management command specifically so the flag rules are unit-testable
  without a database or network.
- `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py`
  (new) — thin orchestration: loops over players, calls the helpers
  above, prints the report, exits non-zero when anything is still
  flagged.
- `maxBreak/oneFourSeven/tests_nightly_stats_check.py` (new) — full
  test suite, following this app's existing flat `tests_<topic>.py`
  convention (see `tests_player_stats_targeting.py`).
- `.github/workflows/nightly_stats_check.yml` (new) — cron workflow,
  runs entirely on GitHub Actions infrastructure, independent of
  Railway.
- `docs/OPEN_MISSIONS.md` — logged the broader stats-audit (
  `PlayerCareerStats`, `CenturyRecord`, `Ranking`) as an explicit
  non-goal, not forgotten.
- `CLAUDE.md` — added `nightly_stats_check` to the management-commands
  list.

## What was verified

- Full test suite passes: `cd maxBreak && python manage.py test
  oneFourSeven.tests_nightly_stats_check -v 2` (106 tests across
  pure-logic, DB-snapshot, cursor, API-fetch, auto-fix, notification,
  and full-command integration tests).
- Manual dry-run against local dev DB (`--dry-run --no-api`) confirmed
  the report prints correctly and the command exits 0 in dry-run mode
  regardless of flags found.
- YAML syntax of the new workflow file validated with `yaml.safe_load`.

## What still needs real-world confirmation

- The workflow has NOT yet run on GitHub Actions against the real
  production database — it needs three repo secrets added first
  (`DATABASE_URL`, `SECRET_KEY`, `ADMIN_EXPO_PUSH_TOKEN`), then either
  a `workflow_dispatch` manual trigger or waiting for the first
  scheduled 03:00 UTC run, to confirm it actually connects to Railway
  Postgres and the Expo push notification arrives on a real device.
- The cursor's actual sweep rate against the real player roster size
  hasn't been measured — the design assumes ~100/night is a reasonable
  batch given the roster size, but this should be sanity-checked after
  the first few real runs (check `maxBreak/oneFourSeven/nightly_stats_cursor.json`'s
  restored value in the Action logs' cache step across a few nights).

## Lessons for the next agent

### Design & Architecture
- `backfill_career_history --force` is the ONLY write path in this
  whole feature — do not add any other write path to this job without
  re-reading the design doc's safety properties section first.
- Do not persist any state for this job via a git commit — that's how
  the Railway auto-deploy-on-`master`-push trap gets triggered
  accidentally. Use GitHub Actions cache (or a DB table, if ever
  needed) instead.
- `nightly_stats_checks.py`'s functions are deliberately DB/network-free
  where possible (`compute_db_flags`, `compute_api_flags`,
  `is_auto_fixable`, `build_notification`) — if you add a new flag rule,
  add it as a pure function taking a `PlayerSnapshot`, not as an inline
  query in the management command, so it stays unit-testable.

### Critical Implementation Findings (Tasks 7–8)
- **The post-autofix recheck step is NOT optional.** The first implementation attempt dropped the re-verification step after `attempt_autofix()` to simplify test mocking, but this breaks the feature's core promise: a failed auto-fix that doesn't raise an exception would be silently reported as "fixed" without anyone noticing. The recheck was restored during review — do not remove it again to make tests pass.
- **Test fixtures must use `current_season_int()` not hardcoded years.** A test fixture hardcoded `FirstSeasonAsPro=2024` for the "healthy" player baseline. Since `build_snapshot()`'s `years_as_pro` formula uses the real wall-clock current season, this fixture would have silently started failing as real calendar time advanced past 2025 — exactly the "season detection time-bomb" bug class that already plagued this project. Fixed by deriving all fixture season values from `current_season_int()` at setup time.
- **The recheck's own `build_snapshot()` call can crash the entire nightly run.** During review, the restored recheck logic had a critical bug: if the second `build_snapshot()` call raised an exception, the exception handler set a flags variable but forgot to bind the `recheck_snapshot` variable used in the next line, causing an uncaught `UnboundLocalError` that would crash the ENTIRE nightly job (no summary, no notifications, no other players checked) just from one player's verification failing. Fixed by falling back to the pre-recheck snapshot in the exception handler, plus a dedicated regression test targeting the second snapshot call.
- **GitHub Actions caches are immutable per key — a static cache key creates a one-time-only save.** The original workflow used a single static key (`nightly-stats-cursor`) for both restoring and saving the rolling-sweep cursor. GitHub Actions caches are write-once: the save step would silently succeed on the very first run ever, then no-op every subsequent night, meaning the cursor never advanced and the same ~100 players would be checked forever, defeating the entire rolling-sweep design. Fixed in Task 8 by using a per-run-unique save key (`${{ github.run_id }}`) plus `restore-keys` prefix fallback on restore.
