# Session 2026-08-31 — Home Live-tab drawer priority

## Symptom
The new Today's Matches drawer started expanded above the Home list. When the Live tab auto-opened (existing highest-priority behavior), users had to scroll past today's leftover matches before seeing the focused tournament's live cards.

## Root-cause chain
1. Today's Matches was prepended to every tab's list and defaulted to expanded.
2. `OtherLiveSection` lived only as a FlatList footer, after the focused event's live cards.
3. `all_live_matches_view` blanket-excluded `Tour='main'`, so a live qualifier sibling never appeared in Also Live — only inside the Today drawer.

## Decision
Tab-aware single upper drawer, generic by `event_id` (not by tour name):
- Live tab → Also Live, collapsed by default, focused live cards first
- Upcoming/Results → Today's Matches unchanged
- Footer Also Live is hidden on the Live tab (same matches would duplicate)

## Files
- `FrontMaxBreak/app/home/utils/homeDrawer.ts` (new) — mode + other-live grouping
- `FrontMaxBreak/__tests__/homeDrawer.test.ts` (new)
- `FrontMaxBreak/app/index.tsx` — wire drawer + hide footer on Live
- `FrontMaxBreak/app/home/components/TodayMatchesToggle.tsx` — label/icon/color props
- `maxBreak/oneFourSeven/views.py` — `all_live_matches_view` no longer excludes main tour
- `maxBreak/oneFourSeven/tests_all_live_matches.py` (new)
- `docs/HOME_SCREEN_ARCHITECTURE.md` — Live-tab drawer documented

## Verified
- Jest: `homeDrawer.test.ts` + `todayMatches.test.ts` — 64 passed
- `node offseason_tab_test.mjs` — 42 passed
- Django tests for `all_live_matches_view` written; no local venv here so not executed this session

## Still needs a real device
- Preview OTA: Live tab must show focused live cards first, Also Live one collapsed row
- Upcoming tab still shows Today's Matches expanded
- Qualifier/Q-Tour live appear under Also Live when expanded
- Open mission #12: a stale pre-ATT preview APK will crash on this OTA — needs a fresh preview build first

## Follow-up
Upcoming still showed live cards because Today's Matches included every status. `excludeLiveFromGroups` now strips live/on-break from that drawer so they only appear on the Live tab.

## Follow-up 2 — flapping live/on-break in Also Live
Investigated by [Investigate flapping live/on-break status](9ff40886-0b26-4ff7-b9bd-2d1419107aff). Root cause: `collectOtherLiveGroups` merged two sources with different poll intervals (`useTodayMatches`, 120s; `useOtherLiveMatches`, 30s) and let the stale 120s copy win on collision — the badge flipped every time the two polls disagreed. Not a snooker.org API issue; both endpoints read the identical `Status` column.
Fix: since the earlier backend change (`all_live_matches_view` no longer excludes `Tour='main'`) already made `useOtherLiveMatches` a complete generic source, dropped the `todayGroups`-derived half entirely — `collectOtherLiveGroups` is now single-sourced from the 30s poll only. Removed now-dead helpers (`liveMatchesFromGroup`, `liveGroupsExcludingFocus`, `allMatchKeys`). Signature changed from `(todayGroups, otherLiveMatches, focusedEventId)` to `(otherLiveMatches, focusedEventId)`.
Tradeoff: the "· Qualifiers" header suffix (sourced from `todayGroups`' `is_qualifier` flag) no longer appears on a qualifier's group inside Also Live specifically — Today's Matches on Upcoming/Results is unaffected.
Separate, unrelated finding logged as Open Mission #14 (not fixed): `update_live_matches.py`'s stuck-match repair writes `Status=2` believing it means "Finished," while every runtime reader treats it as "On Break." Doesn't cause flapping — only mislabels already-finished tournaments' stuck matches.

## Lesson
Do not treat "other live" as "not main tour". The generic rule is "not the focused `event_id`". Qualifier siblings are a different event and belong in Also Live.
Do not merge two data sources with different poll cadences into one derived view without an explicit freshness rule — the "combine todayGroups + otherLiveMatches" pattern looked reasonable but silently let a 120s-stale snapshot overwrite a 30s-fresh one on every render.
