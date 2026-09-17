# Session 2026-09-17 — Career-history rolling-sweep automation (Open Mission #22)

## Task

Open Mission #22 (`docs/OPEN_MISSIONS.md`) asked for scheduled automation of
`sync_career_history`, framed as "no scheduled automation for the command that refreshes
CueTracker `ct_*` career-stats fields, causing them to drift stale." Explicitly framed as a
new feature/decision, not a bug fix.

## Important finding: the mission's premise was half-wrong

Before building anything, `sync_career_history.py` was read in full, alongside
`nightly_stats_check.yml`/`nightly_stats_checks.py` (the reference pattern to mirror) and
`auto_live_monitor.py` (to check what already calls `sync_career_history`).

Two things turned out to be different from what the mission entry said:

1. **`sync_career_history` does not touch CueTracker or `PlayerCareerStats` at all.** It
   syncs `PlayerMatchHistory` from **snooker.org's `t=8`** match-history endpoint (per-player
   season matches — round names, scores, winner). The `ct_*` fields cited in the mission
   (`ct_total_centuries`, `ct_career_prize_total`, etc.) live on a completely different model
   (`PlayerCareerStats`) and are written by a different command,
   **`update_player_ct_stats`** (`maxBreak/oneFourSeven/management/commands/update_player_ct_stats.py`),
   which scrapes `cuetracker.net/players/<slug>/career-total-statistics` pages directly.

2. **`sync_career_history` is not actually unscheduled.** `auto_live_monitor.py`
   (`_check_player_history_update`, called from the main loop only when
   `_has_active_matches()` is true) calls `call_command('sync_career_history', '--top', '128')`
   once a day at 4-5 AM UTC during an active tournament, plus `--new-players-only` the day
   before a tournament starts. The mission's "confirmed via `Procfile` and
   `.github/workflows/`" check was technically accurate (there's no top-level cron/Procfile
   entry) but missed the call buried inside the daemon's own control-flow logic.
   `update_player_ct_stats` — the command that *does* touch `ct_*` fields — has the exact
   same shape: called from `_check_nightly_active_updates`, 2-3 AM UTC, same
   `_has_active_matches()` gate, further narrowed to only players with a match
   scheduled today/yesterday (`_get_todays_player_ids()`).

So the real gap behind the observed `ct_*` staleness is in `update_player_ct_stats`'s
gating (off-season and any week a top player isn't personally playing get zero refresh),
not in `sync_career_history`. This is logged as its own new item, **Open Mission #24**, per
working rule 11 (pull an out-of-scope finding into its own tracked item rather than fixing
it silently inside this task).

## What was still built for `sync_career_history`, and why

Even though `sync_career_history` isn't the direct cause of `ct_*` staleness, it genuinely
had the same underlying gap the mission described: it only ever runs conditionally, inside
the live-monitor daemon, gated on an active tournament — there is no unconditional schedule
that guarantees the full top-128 `PlayerMatchHistory` roster gets refreshed regardless of
tour state. That's real, independently-worth-fixing automation debt, and the task explicitly
asked for this specific command to get the `nightly_stats_check.yml` treatment. Building it
does not fix the `ct_*` symptom, but it closes a real gap and mirrors the requested pattern
exactly, so it was completed as asked with the misattribution called out clearly (in
`docs/OPEN_MISSIONS.md` #22, in this doc, and in the handback report) rather than silently
building the wrong thing or refusing the task outright.

### Schedule/shape decision

`sync_career_history`'s existing-player loop calls the snooker.org `t=8` endpoint with a
hardcoded `API_CALL_DELAY = 30` seconds between requests (2 calls/min — snooker.org's rate
limit, unrelated to CueTracker). A full top-128 run is ~100-120 "existing" players (the rest
are usually "new" players needing a one-time full backfill instead) — at 30s/player that's
50-60 minutes minimum, before backfill time for new players. Given that:

- A **nightly** cron (like `nightly_stats_check`) would mean the job is either always running
  or barely finishes before the next kicks off — wasteful for a slower-moving dataset than
  live match stats.
- **Weekly**, with a small per-run batch, spreads the same total work out and keeps each run
  short and cheap.

Chosen: **weekly cron (`0 5 * * 0`, Sundays 05:00 UTC)**, `--batch-size 40`. At 30s/player,
40 players ≈ 20 minutes — comfortable under the workflow's 60-minute timeout. A ~100-player
existing-roster sweeps fully in ~3 runs (~3 weeks), which is a reasonable cadence for
season-long match-history data that only changes when a player actually plays. New-player
full backfill is **never** batched — deliberately: that set is small (only genuinely new
top-128 entrants), each player only needs it once, and batching it would risk delaying a
brand-new player's entire career backfill across multiple weekly runs for no benefit.

### Implementation

- **New file**: `maxBreak/oneFourSeven/career_sync_batching.py` — pure, dependency-free
  `load_cursor` / `save_cursor` / `select_batch` functions, deliberately mirroring
  `nightly_stats_checks.py`'s cursor pattern (position-index cursor, wraps instead of
  raising on a shrinking/growing roster) but living in its own module with its own cursor
  file (`career_sync_cursor.json`, JSON key `next_index`) so the two rolling sweeps can never
  collide or share state — confirmed by a regression test
  (`test_uses_a_distinct_file_from_nightly_stats_cursor`) that the two commands' default
  cursor-file paths are different.
- **Modified**: `maxBreak/oneFourSeven/management/commands/sync_career_history.py` — added
  two new, fully opt-in arguments:
  - `--batch-size N` — when set, only the first N IDs of a cursor-rotated slice of the
    *existing-players* list get their current-season update this run (new-player full
    backfill is unaffected, always runs for the complete new-player set).
  - `--cursor-file PATH` — override location, default `maxBreak/career_sync_cursor.json`
    (same directory-resolution pattern as `nightly_stats_check.py`'s `DEFAULT_CURSOR_FILE`).
  - When `--batch-size` is omitted, behavior is **byte-for-byte identical** to before this
    change — no cursor file is read or written, every existing player is processed, exactly
    as the manual "run it for everyone right now" use case relies on. This was verified by a
    test (`test_without_batch_size_updates_every_existing_player`) asserting the cursor file
    is never created in that mode.
- **New GitHub Actions workflow**: `.github/workflows/career_stats_sync.yml` — mirrors
  `nightly_stats_check.yml`'s structure (checkout, setup-python 3.12, install
  `maxBreak/requirements.txt`, restore/save `maxBreak/career_sync_cursor.json` via
  `actions/cache`, `concurrency` group to prevent overlapping runs, `workflow_dispatch` for
  manual triggering). Uses the already-configured `DATABASE_URL`/`SECRET_KEY` secrets — no
  new secrets introduced. Runs
  `python manage.py sync_career_history --top 128 --batch-size 40`.

## Files touched

- `maxBreak/oneFourSeven/career_sync_batching.py` (new)
- `maxBreak/oneFourSeven/tests_career_sync_batching.py` (new, 18 assertions across
  `LoadCursorTests`/`SaveCursorTests`/`SelectBatchTests`)
- `maxBreak/oneFourSeven/tests_sync_career_history.py` (new, 10 tests covering the command's
  new flag wiring — batch limiting, cursor persistence/rollover, full-sweep coverage across
  multiple runs, new-player backfill never batched, `--new-players-only` early return never
  writes a cursor, `--help` documents the new flag)
- `maxBreak/oneFourSeven/management/commands/sync_career_history.py` (modified — new opt-in
  args + batching block; original code path untouched when the args are omitted)
- `.github/workflows/career_stats_sync.yml` (new)
- `docs/OPEN_MISSIONS.md` (item #22 updated with status + the misattribution correction;
  new item #24 added for the actual `update_player_ct_stats` gap)

## What was verified

Ran for real (not read only) from `maxBreak/` with the venv active:

```
python manage.py test oneFourSeven.tests_career_sync_batching oneFourSeven.tests_sync_career_history -v 2
```

Result: **28 tests, all passing** (0 failures, 0 errors). No real network calls were made —
`_fetch_and_save` (the snooker.org-calling method) and `call_command('backfill_career_history', ...)`
are mocked in every test, matching how `tests_nightly_stats_check.py` mocks
`attempt_autofix`/`fetch_api_titles` rather than hitting real network calls. No real
CueTracker scrape was triggered anywhere in this session, per the task's explicit
instruction.

One real gotcha found and worked around during test-writing: the command's existing-player
loop calls Django's `close_old_connections()` before each per-player fetch (correct in
production — a real, hours-long loop over live network calls shouldn't hold a stale DB
connection). Inside a `TestCase`'s wrapping atomic transaction, that same call forcibly
closes the one connection the test transaction depends on, breaking every later query in
that test and cascading into the next test's `setUp` (`django.db.utils.InterfaceError:
connection already closed`). Fixed by patching `close_old_connections` to a no-op in these
batching-focused tests (real network I/O isn't being exercised there anyway — that's what
`_fetch_and_save`, separately mocked, covers) rather than touching the production code path.

## What was NOT verified / still needs human review before push

- **No real scrape or live run was performed** — per the task's explicit instruction, only
  the batching/cursor logic was unit-tested with mocks. The workflow itself has never
  actually executed against Railway's `DATABASE_URL`.
- **The batch-size/timing math (40 players ≈ 20 min at 30s/player) is arithmetic, not
  measured** — the real `_fetch_and_save` call also does DB writes and can retry/backoff on
  errors; actual per-run wall time on Railway/GitHub Actions could differ. Worth watching the
  first couple of real `workflow_dispatch` runs before trusting the weekly schedule blindly.
- **Files are all left as working-tree edits/new files, not committed or pushed** — a new
  scheduled workflow only takes effect once pushed to `master` (GitHub Actions only reads
  workflow files from the default branch), so pushing this is itself the "enable it" action
  and needs explicit human approval, per the task's instructions and this repo's
  deployment-approval rule.
- **Item #24 (the actual `ct_*`/`update_player_ct_stats` staleness cause) is not fixed** —
  deliberately out of scope for this session, logged for a future pick-up.

## Lesson for the next agent

Before automating or fixing "command X is stale/broken," **grep for what actually writes
the field being complained about** — `grep -rn "ct_total_centuries\|ct_career_prize_total"
maxBreak/oneFourSeven/management/commands/` immediately shows `update_player_ct_stats.py`
as the only writer, not `sync_career_history.py`. A prior session's mission write-up
(`docs/OPEN_MISSIONS.md` #22, itself written from `docs/SESSION_2026-09-17_H2H_DUPLICATE_ROW_FIX.md`)
had already conflated the two commands by name-association (both have "career_history"-ish
names and are called from the same `auto_live_monitor` function), and that conflation would
have propagated silently into a shipped "fix" that didn't fix anything, had it not been
re-checked at the code level here. Also: `auto_live_monitor.py`'s daemon loop calls several
management commands conditionally from inside Python control flow (`call_command(...)`
scattered through `_check_*` methods) — "no cron/Procfile entry" is not the same as
"unscheduled"; always grep `call_command\(` inside `auto_live_monitor.py` before concluding
a command has zero automation.
