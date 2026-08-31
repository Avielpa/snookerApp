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

## Lesson
Do not treat "other live" as "not main tour". The generic rule is "not the focused `event_id`". Qualifier siblings are a different event and belong in Also Live.
