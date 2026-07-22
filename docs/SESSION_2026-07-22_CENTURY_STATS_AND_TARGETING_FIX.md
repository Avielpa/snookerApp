# Session: Century-stats data bug + daily targeting-job fix (2026-07-22)

## Symptom

User reported the Stats "centuries" table showed Bingyu Chang with 2 maximum
(147) breaks, but believed he'd made a 3rd within the past ~9 months.

## Root cause chain

1. `CenturyRecord.career_147s` is copied from `Player.NumMaximums`
   (`fetch_ct_centuries.py`), which is itself synced from snooker.org's
   official `t=4` API (NOT CueTracker — CueTracker only supplies
   `career_total`/season/frame/prize stats).
2. Live call to `https://api.snooker.org/?t=4&p=1981` confirmed
   `NumMaximums: 3` — our DB had `2`, stale.
3. Traced why it never refreshed: two daily jobs are supposed to catch this —
   `update_player_api_stats.py` (today's match players) and
   `rebuild_player_stats.py` (monthly, top-128 only). Bingyu Chang isn't
   top-128 ranked, so he depends entirely on the daily job.
4. Found the actual bug in `_get_todays_player_ids()` (duplicated in both
   `update_player_api_stats.py` and `update_player_ct_stats.py`):
   ```python
   UpcomingMatch.objects.filter(scheduled_date__date=today, tour_type='main').exclude(status=3)
   ```
   `UpcomingMatch.status == 3` means **Finished** (see models.py:674-679).
   `.exclude(status=3)` threw away exactly the matches whose completion is
   what changes a player's stats — the job could never do its job for the
   case it exists for. Compounded by the job running at 2 AM UTC and only
   checking `scheduled_date__date=today`, missing matches that finished the
   previous evening (`yesterday` in `scheduled_date`).
5. Separately found `rebuild_player_stats.py` had `DELAY_BETWEEN_PLAYERS = 0.5`
   (comment: "polite CueTracker scraping") but that loop also calls the
   snooker.org `t=4` API every iteration, which needs the real 2-req/min
   (30s) spacing used everywhere else that calls it
   (`verify_player_stats.py`, `sync_career_history.py`, etc.) — this file
   was missed in the earlier 2026-07-09 rate-limit sweep. Confirmed by
   hitting `[API-WARN] could not reach snooker.org t=4` on a manual re-run
   done 15s after the first.

## Fixes applied

- `update_player_api_stats.py` / `update_player_ct_stats.py`:
  `_get_todays_player_ids()` now checks `scheduled_date__date__in=[today, yesterday]`
  and no longer excludes `status=3`.
- `rebuild_player_stats.py`: `DELAY_BETWEEN_PLAYERS` raised from 0.5s to 30s
  (comment updated to explain the snooker.org rate limit, not just CueTracker).
- Data: manually corrected `Player.NumMaximums` (2→3) and all of Bingyu
  Chang's `CenturyRecord` rows (`career_147s` 2→3, `career_total` 86→90) via
  `rebuild_player_stats --player-id 1981`, then a direct bulk update since the
  century scraper only touches players on the live current-season leaderboard
  page, not historical rows.
- Tests: `maxBreak/oneFourSeven/tests_player_stats_targeting.py` — 13
  assertions covering the targeting matrix (finished/live/on-break/scheduled,
  today/yesterday/2-days-ago/future, tour-type filtering, None-id handling,
  midnight boundary). Full existing suite re-run: 131 tests, only the
  pre-existing `test_null_date_appears_last` failure (already tracked in
  `docs/OPEN_MISSIONS.md` item #1) plus 2 transient Railway-Postgres
  connection drops during teardown — neither caused by this change.

## One-off full rebuild (2026-07-22, run once)

After the fixes deployed, ran a genuine one-off `python manage.py
rebuild_player_stats` (all top-128/149-with-overlap players) as a temporary
Railway service (`rebuild-stats-oneoff`, `restartPolicyType: NEVER`,
`cronSchedule: null`, same repo/branch as `web`) so it ran server-side and
independent of any local machine. Completed cleanly: 149/149 processed, 0
errors, 143 CueTracker-synced, 130 missing prize rows backfilled. Service
removal was staged but Railway requires **dashboard 2FA to finalize a service
deletion** — this can't be done via API/MCP token. The user needs to click
"Apply" on the pending removal in the Railway dashboard; until then it just
sits there stopped (no cost, doesn't restart).

## For next time: how to re-run this manually

`rebuild_player_stats` is a normal Django management command — running it
does **not** cost anything by itself when idle; the only "cost" is the
runtime while it's actually executing (snooker.org + CueTracker HTTP calls,
~30-40s/player). Options if a full re-sync is ever needed again:

- Locally: `cd maxBreak && python manage.py rebuild_player_stats` (uses local
  `.env` DATABASE_URL — pulls prod data over the network, works but is slow
  and ties up your machine for the ~80-90 min full run).
- Single player: `python manage.py rebuild_player_stats --player-id <ID>`
  (fast, seconds, useful for one-off corrections like this session's).
  Note: this does not touch pre-existing `CenturyRecord` rows for seasons
  the scraper won't re-visit — those need a manual bulk `.update()` after,
  same as done for Bingyu Chang here.
- Full sweep on Railway (recommended for all-128, since it survives your
  machine going to sleep): recreate the same temporary one-off service
  pattern used this session — same repo/branch/root as `web`, `startCommand:
  python manage.py rebuild_player_stats`, `restartPolicyType: NEVER`,
  `cronSchedule: null`, referencing `web`'s `DATABASE_URL`/`SECRET_KEY`/
  `RUN_INIT` variables — then delete the service afterward (requires
  dashboard 2FA click, can't be scripted).

## Lesson for future agents

If you touch `_get_todays_player_ids()`-style "smart targeting" logic again:
check what each status code *means* in the specific model before excluding
it — `UpcomingMatch.status` and `MatchesOfAnEvent.Status` use **different**
enums (3 = Finished vs 3 = Unknown), and code copy-pasted between files can
silently carry the wrong assumption. Also: any command that calls
snooker.org's `t=4`/similar API in a loop needs the real 30s/2-req-min delay
— grep for `DELAY_BETWEEN_PLAYERS`/similar constants under 30 before trusting
an existing command's pacing.
