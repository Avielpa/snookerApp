# Open Missions

Running list of known issues, deferred work, and follow-ups that are NOT currently being worked on but should not be forgotten. Claude must check this file at the start of any bug investigation or feature work to see if it's related to an existing open item, and add new items here whenever work surfaces something out-of-scope that shouldn't be lost.

## Open

### 1. `PlayerMatchHistoryOrderingTest.test_null_date_appears_last` fails on current baseline
- **Found**: 2026-07-09, during test run for the match-favorite/notification ID churn fix.
- **Status**: Pre-existing failure, confirmed to fail identically on the pre-fix baseline (not a regression from that fix). Not fixed, not investigated further.
- **Likely cause**: stale test fixture data drifting against the current season — same class of bug as the season-detection hardcoding pattern found and fixed elsewhere on 2026-07-09 (see `project_season_detection_bug_pattern.md` memory). Needs confirming, not assumed.
- **Next step when picked up**: read the test, check for a hardcoded season/date, compare against `constants.current_season_int()` pattern used in the season-detection fixes.

### 2. `NotifDedup` also keyed by volatile `api_match_id`
- **Found**: 2026-07-09, during investigation of the favorite/notification ID churn bug (`BUG_match_favorite_id_churn_2026-07-09.md`).
- **Status**: Explicitly scoped OUT of that fix. Deliberately left untouched.
- **Impact**: lower severity than the favorites bug — worst case is a duplicate/re-fired notification when a match's `api_match_id` churns and its dedup key no longer matches, not a silently missing one.
- **Next step when picked up**: apply the same stable-PK pattern (`MatchesOfAnEvent.pk`) used for the favorites fix — see `push_notifications.py::get_tokens_for_match_db_id` for the reference pattern.

### 3. Dev-only Postgres tooling installed for testing, not committed
- **Found**: 2026-07-09, while running Postgres-specific JSONField (`__contains`) tests locally for the favorites fix (SQLite can't run them).
- **Status**: `pgserver` + `tzdata` were installed into the local venv to make the test suite runnable, but were NOT added to `requirements.txt` since they're dev-only tooling.
- **Next step when picked up**: decide whether to formalize a local Postgres test setup (e.g. documented in CLAUDE.md) or leave it as an ad hoc one-off — currently anyone re-running these specific tests locally will need to reinstall the same packages themselves.

## Resolved / closed
(move items here with a one-line resolution note when closed, don't delete history)
