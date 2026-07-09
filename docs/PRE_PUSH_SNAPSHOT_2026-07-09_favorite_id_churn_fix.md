# Pre-push snapshot — favorite/notification ID churn fix

**Purpose**: baseline to compare against after `git push master` deploys this fix to Railway, so a fast revert decision can be made if something looks wrong.

## Pre-push state

- **HEAD before push**: `0689a53b39e4ac3e0179d17331d8740ac6ec5d3e` ("super bug agents")
- **Migration state**: migration `0025_devicetoken_favorite_match_db_ids_and_more.py` exists locally, NOT yet applied to production (Railway's Procfile runs `migrate` automatically on deploy — this will apply on push).
- **Files changed this session** (see `git diff --stat` against 0689a53b):
  - `maxBreak/oneFourSeven/models.py` (+14/-0 net, new field only)
  - `maxBreak/oneFourSeven/push_notifications.py` (+26, new function only)
  - `maxBreak/oneFourSeven/views.py` (+93/-15, new helpers wired into 4 existing views)
  - `maxBreak/oneFourSeven/management/commands/auto_live_monitor.py` (+14/-6, 4 notification blocks updated to union old+new lookup)
  - new: `maxBreak/oneFourSeven/migrations/0025_...py`
  - new: `maxBreak/oneFourSeven/tests_favorite_id_churn.py`
  - `CLAUDE.md` (+2, process rules only, no runtime effect)
  - new: `docs/OPEN_MISSIONS.md`, `docs/BUG_match_favorite_id_churn_2026-07-09.md` (docs only)

## Production data snapshot — NOT CAPTURED

Attempted via `mcp__railway__railway-agent` (permission denied — "you don't have the required role (member) on this resource") and via local `railway` CLI (not installed in this environment: `railway: command not found`). No live query of `DeviceToken.favorite_match_ids` / `UserFavorite.favorite_match_ids` / current `MatchesOfAnEvent.api_match_id` values was possible from this session before push.

**Known from the approved plan already**: today's 2 test favorites (CL match, one confirmed 3x reassigned: `10220801→10232815→10232821`) are expected to already be broken pre-push (that's the bug being fixed) and are accepted as lost per your Q1 answer — no backfill. So their pre-push state is "already non-functional," not a clean baseline to protect.

## What to check AFTER push (fast go/no-go)

1. **Railway deploy succeeds** — `web` and `live_monitor` services both redeploy cleanly, migration 0025 applies without error (check Railway deploy logs).
2. **`live_monitor` doesn't crash-loop** — this service runs 24/7 during the live tournament; confirm it comes back up and resumes polling within its normal cycle time.
3. **Favorite a fresh match now** (post-deploy) via the app, confirm the star persists across an app reload.
4. **If that new favorite's match later gets reassigned an `api_match_id`** (only observable during actual live play), confirm the star still shows and a notification still fires — this is the actual bug scenario, can only be confirmed live.
5. **Existing pre-push favorites** (anything favorited before this deploy) should keep working via the untouched legacy `favorite_match_ids` field — spot check one if any exist.

## Fast-revert plan if something looks wrong

- Backend-only change, additive migration (2 new nullable-default JSON fields, no column drops/renames) — a `git revert` of the deploy commit + re-push is safe and reversible; the new fields being present-but-unused on a revert causes no harm.
- If `live_monitor` crash-loops specifically, that's the highest-urgency signal (live tournament dependency) — revert immediately rather than debugging live.
