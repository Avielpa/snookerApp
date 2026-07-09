# Session 2026-07-09: Championship League visibility, season-detection bugs, live-monitor infra

## What triggered this session

User reported three issues:
1. Championship League tournament (live, started 2026-06-22) didn't appear anywhere in the app despite being covered by snooker.org.
2. Century stats table (Stats screen) showed no data for the current season; last season's data looked frozen.
3. "Other tours" (Women's/Seniors/Q-Tour) had barely any data.

## Root causes found and fixed

### 1. Championship League completely invisible
- `constants.py`: `EXCLUDED_EVENT_NAME_PATTERNS = ['Championship League Stage']` blocked all ~40 group sub-events from ever syncing into the DB.
- `update_tournaments.py`, `update_matches.py`, `sync_other_tours.py` each had their **own independent hardcoded** "Championship League Stage" exclusion that didn't reference the shared constant — clearing the constant alone wasn't enough; had to fix all four call sites.
- Fix: removed all exclusions. User confirmed intentional — CL groups have real live matches worth showing.

### 2. Season-boundary mismatch corrupting century stats
- Backend season rollover used **September** as the cutoff (`views_stats.py`, `fetch_ct_centuries.py`); frontend (`useSeasonSelector.ts`) uses **May**. Real snooker calendar rolls over ~June (Championship League is literally the season-opener).
- Result: the daily century-scrape job kept writing new-season (2026-27) low counts into the `"2025-26"` bucket for months, silently overwriting real historical totals (e.g. Ali Carter's real 28 got overwritten to 2, Si Jiahui's 34→1) for any player who already had a century in the new season.
- Fixed the May cutoff everywhere (see "hardcoded season" section below), then **repaired** the corrupted `2025-26` data plus every other season in the Stats dropdown by re-scraping CueTracker's dedicated per-season historical pages (`https://cuetracker.net/statistics/centuries/most-made/season/{year}-{year+1}` — fast, no snooker.org rate limit involved). New command: `repair_all_historical_centuries` (loops 2018-19 → last completed season). One-off `repair_2025_26_centuries` also exists for just that season.

### 3. Systemic hardcoded `season = 2025` / `datetime.now().year - 1` bug (found ~13 instances)
The single most impactful class of bug this session. Every instance defaulted to a **fixed** season number or a **month-blind** `year - 1` formula, both of which silently go stale the moment a new season actually starts (~May/June). Fixed by adding one canonical helper:

```python
# oneFourSeven/constants.py
def current_season_int() -> int:
    """Season rolls over in May, matching frontend's useSeasonSelector.ts."""
    from datetime import date
    today = date.today()
    return today.year if today.month >= 5 else today.year - 1
```

Locations fixed (all now call `current_season_int()` or the equivalent `_current_season_label()`/`_current_season_int()` pattern in `views_stats.py`):
- `views.py`: `calendar_tabs_view` (hardcoded `2025` default — this is why the Calendar API silently excluded the live Championship League event even after the exclusion-list fix), rankings-by-type view, ranking-tabs view, `tours_by_status_view`.
- `views_stats.py`: `_current_season_label()`, `_current_season_int()` (Sept → May).
- `fetch_ct_centuries.py`: same Sept → May fix, plus added `--url`/`--season` overrides for one-off historical repairs.
- `auto_live_monitor.py`: `_startup_sync()` and `_run_monthly_updates()` both hardcoded `'2025'` — this is the **actual monthly job**, so monthly updates were pulling last season's tournament list regardless of what month it ran.
- `sync_career_history.py`, `backfill_career_history.py`, `validate_career_data.py`: hardcoded `datetime.now().year - 1` with zero month check.
- `sync_other_tours.py`, `check_backfill_status.py`, `monthly_full_update.py`, `comprehensive_automation.py`: same pattern, fixed for consistency (the latter three aren't wired into the automated pipeline, manual tools only).

**Lesson for future sessions:** if you find one hardcoded-season instance, grep the whole repo (`grep -rn "= 2025\b\|year - 1"`) — this bug species was copy-pasted across a dozen files.

### 4. Rate-limit violations (403 cascade)
- `constants.py` documents the real limit: `REQUESTS_PER_MINUTE = 2` → `MIN_REQUEST_INTERVAL = 30` seconds.
- 8 management commands slept only `6` seconds between snooker.org calls (`update_matches.py`, `update_players.py`, `update_rankings.py`, `update_round_details.py`, `update_tournaments.py`, `daily_matches_update.py`, `update_live_matches.py`, `fetch_all_data.py`), some with comments claiming "10 requests/minute" — never the actual limit. Fixed all to import and use `MIN_REQUEST_INTERVAL`.

### 5. Critical infra bug: live-monitor daemon misconfigured as a cron job
- `auto_live_monitor.py` is written as a genuine infinite `while not self.should_stop:` loop (a persistent daemon by design — polls live scores every 2 min during tournaments, 15 min otherwise, handles daily/monthly windows internally).
- It was deployed on Railway as service **"auto command"** with `cronSchedule: "*/10 * * * *"` and `restartPolicyType: NEVER`. Since the process never exits on its own, each cron trigger could in principle stack a new overlapping copy on top of ones still running — a likely contributor to the 403 cascade, and it meant all the daemon's in-memory de-dup tracking (`last_daily_run`, `currently_on_break`, `processed_tournament_ends`, etc.) was getting wiped every 10 minutes regardless of anything else.
- **Fix**: converted "auto command" to a genuine persistent worker — `cronSchedule: null`, `restartPolicyType: ON_FAILURE`. Verified it now runs continuously (30+ min uptime observed, no crashes, no 403s) instead of restarting every 10 minutes.
- **Important Railway platform quirk learned**: `updateServiceTool` alone only *stages* a config change — you must also call `commitStagedChangesTool` or the change silently doesn't apply, and the next deploy uses the stale config. Several early attempts this session failed silently this way before the pattern was identified. Always: stage → commit → wait ~30-60s for propagation → deploy → verify via `getServiceConfigTool`.
- **Also learned**: the `fetch-all-data-oneoff` one-off service has some execution-time/resource limit — the full ~10-step `fetch_all_data` pipeline was repeatedly observed to be silently killed partway through (deployment marked `SUCCESS`, logs just stop, no error). Workaround: split large multi-step jobs into small focused one-off commands (see `finish_priority_backfill.py`, `repair_2025_26_centuries.py`, `repair_all_historical_centuries.py`) that can each complete within one run, rather than relying on the giant pipeline finishing in one shot.

### 6. `update_matches --empty-only` wasted its rate-limited queue on far-future events
- Query ordered by `-StartDate` (most recent first) — but "most recent" by raw date math put **next season's not-yet-drawn placeholder events** (e.g. World Championship 2027, dated ~April 2027) ahead of Championship League's June 2026 dates, purely because 2027 > 2026 numerically. Those always fail (snooker.org has no match/draw data for events that far out) but burned through the 30s-per-call queue before ever reaching events that actually had data available now.
- Fix: excludes events starting more than 30 days out from the empty-only backfill target.

### 7. Championship League Calendar UI: grouped card + multi-leg date display
- Championship League produces ~40 "Stage/Group" sub-events per run — flooded the Calendar list. New `FrontMaxBreak/utils/championshipLeagueGroup.ts` collapses them into one expandable card (tap to reveal individual groups).
- **Second bug found by user after initial ship**: Championship League isn't one continuous event — it's played in **separate multi-day blocks** spread across a season (e.g. late June, then again December/January). The group card's date range was computed as the raw min/max across ALL sub-events, which made a card that's actually only "live" for a few days at a time look like it spans 7 months (`Jun 22 – Jan 23`). Fixed by clustering sub-events into "legs" (gap > 21 days = new leg) and displaying only the relevant leg's date range (active leg > soonest upcoming leg > most recent past leg), while `children` still contains every sub-event regardless of leg. Card also now shows `legCount` when >1 ("played in N separate runs this season").
- Tests: `FrontMaxBreak/championship_league_group_test.mjs` — 39 assertions covering single-leg, multi-leg, status aggregation, case-insensitivity, parent-event folding.

## What was explicitly NOT touched (verified via `git diff`, not just claimed)

Given user's (justified) concern about scope — the live-match detection/priority logic in `FrontMaxBreak/app/home/`, `services/tourServices.ts` (`getActiveTournamentId`, other-tours fallback, Media-tab redirect), and `app/index.tsx` had **zero changes** this session. The only backend files touched in `auto_live_monitor.py` were: two season-number fixes (9 lines) and one sleep-duration fix — verified via `git diff <pre-session-commit> HEAD -- <file>` and shown to the user directly.

## Known follow-up NOT done this session (flagged, not fixed — needs a design decision)

`getActiveTournamentId()` (`tourServices.ts`) picks the first "active-by-date" main-tour event via `.find()` with no deliberate priority when **multiple** tournaments are simultaneously active — increasingly likely now that Championship League correctly exists in the DB (many of its sub-events share one broad Stage-level date range even though only 1-2 groups play on any given day). This is pre-existing behavior, not newly broken, but more visible now. User said "leave it for now" — revisit only if it causes a visible problem.

## New management commands added this session

| Command | Purpose | One-off or permanent |
|---|---|---|
| `finish_priority_backfill` | `update_matches --empty-only` + `fetch_ct_centuries`, small enough to survive the one-off container's execution limit | One-off (was used, then service reverted to default) |
| `repair_2025_26_centuries` | Re-scrapes CueTracker's 2025-26 historical page to restore corrupted totals | One-off, kept in repo for reference |
| `repair_all_historical_centuries` | Same idea, generalized across every season in the Stats dropdown (2018-19 → last completed season) | One-off, kept in repo for reference |

`fetch_all_data.py` also permanently gained a `update_matches --empty-only` step so future full-pipeline runs keep catching newly-unblocked events automatically (though note the pipeline's tendency to be killed partway through on the one-off container — see point 5).

## Verified end state (as of session end)

- Championship League: parent + all ~100 sub-events (current + historical + next-season legs) synced, real match data flowing, Calendar UI grouped correctly.
- Centuries: 2018-19 through 2026-27 all populated with real CueTracker data, zero corruption remaining.
- Other tours: 159 events / 2537 matches across Q Tour, Women's, Seniors, Other.
- `auto command` (live monitor) confirmed running as a genuine persistent process, 30+ min continuous uptime, zero 403s observed post-fix.
- No 403 errors observed in any run after the rate-limit fix landed.

## Files changed (chronological commits, master branch)

```
ba5f69ca  fix: show Championship League, fix century-stats season mismatch, group CL in Calendar
f0142d78  chore: add permanent empty-event backfill + one-off 2025-26 centuries repair
bda792b8  fix: remove 3 more hardcoded Championship League Stage exclusions
d61b7683  fix: throttle all snooker.org API loops to the real 2 req/min limit
6922ea4a  fix: calendar_tabs_view had hardcoded target_season=2025 default
4750c06c  fix: career-history commands used hardcoded year-1 as "current season"
9f9a4ac7  chore: add focused one-off backfill (empty-match events + centuries)
5564a7c9  fix: empty-only backfill wasted its rate-limited queue on far-future events
d9eaba3a  fix: remaining hardcoded season=2025 defaults + misleading CL date span
98819ea4  chore: add one-off repair for all historical century seasons
```

(Plus the Railway infra change — "auto command" service cron→persistent conversion — which is NOT in git, it's a Railway service-config change made via the Railway MCP/dashboard.)
