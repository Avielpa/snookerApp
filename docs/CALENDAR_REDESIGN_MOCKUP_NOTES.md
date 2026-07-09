# Calendar Tab Redesign — Mockup Notes

**STATUS: APPROVED (2026-07-09), v4 — ready for implementation.** Style-only mockup exploration via the visual-companion browser tool, not implemented in code yet. Final mockups saved at `docs/mockups/calendar_redesign_final_v3_main_tours.html` (Main Tours tab state) and `docs/mockups/calendar_redesign_final_v4_others.html` (Others tab state).

## Direction agreed

- Kept the app's existing green/amber baize palette + tour-type colors already used on Home's Other Tours tab (Q Tour blue `#5AA9E6`, Women's pink `#F0648C`, Seniors orange `#FF9F45`) — no new colors invented.
- Compact cards (~30% shorter than v1/v2 — smaller icon tile, single meta line instead of stacked two-line).
- Featured "hero" card for the live tournament (progress bar, day count, prize) — same pattern as Home's Live tab featured row.
- Real `Main Tours | Others` segmented control restored (was missing from the first mockup round).
- Season chip rendered as an actual dropdown affordance (`Season 2026-27 ▾`) — matches the real `SeasonPicker` component's chip+modal-sheet behavior, not a new interaction.
- Search field added under the header — matches the real screen's collapsible tap-to-reveal search pattern.
- "Others" tab groups by tour type (Q Tour / Women's / Seniors) under colored headers with a small circular dot indicator (not emoji — swapped after a round where the Women's header used a heart emoji and the user asked for a plain circle like the other two, for visual consistency).

## Iteration history

| Round | Feedback | Fix |
|---|---|---|
| v1 | "Still little bit dead"; "where the other tours?"; season should be a dropdown; scrolling shows past-season tournaments that need filtering | Investigated real code — Main Tours/Others segment existed but was missing from mockup; season dropdown already exists in real `SeasonPicker` component, mockup just didn't render the affordance; past-season leak flagged as a **real production bug**, not a mockup issue (see below) |
| v2 | (addressed round 1 findings) | Added segment control, season dropdown chip, punched up color (gradient hero card, colored icon tiles, amber prize highlights) |
| v3 | Direction approved; cards still too big | Shrunk cards ~30%; added search field |
| v4 | Wanted the "Others" tab state shown too | Added Q Tour/Women's/Seniors grouped view at same v3 card density |
| v4 (follow-up) | Women's section used a heart emoji, wanted a plain circle like Q Tour/Seniors | Replaced all three tour-header icons with CSS-drawn colored dots (not emoji) for exact color match and consistency |

## Separate bug found during this work — NOT part of this style pass

**Past-season tournaments can leak into the current-season "All" list.** Confirmed as a real production bug by the user. Root cause (investigated read-only, not fixed):
- Backend (`views.py:1037-1061`) filters by a stored `Event.Season` DB field.
- Frontend (`CalendarEnhanced.tsx:410`) separately filters by `dateToSeasonYear(StartDate)`.
- The frontend never sends `selectedSeason` to the backend — `getCalendarByTab(tabType)` has no season param — so `allTournaments` is always whatever the backend's `Event.Season` filter returns, and the frontend filter is the only safety net.
- If any `Event.Season` DB value was mistagged at import time (this app has a documented history of exactly that — see `project_season_detection_bug_pattern` memory), a row can pass the backend filter yet its real `StartDate` is clearly a prior season, slipping past both checks.
- Blast radius: not calendar-only — any other view trusting `Event.Season` directly (stats, records) is equally exposed if stale rows exist.
- **Explicitly parked per user instruction** — "don't mess with complicated logic while doing something else." Proposed fix: a one-off DB audit (find Events where `Season` disagrees with what `StartDate` implies) + backfill, same pattern as the existing `current_season_int()` fix. Needs its own session.

## Next steps when resuming

1. This mockup is approved — next real step is an implementation plan (style-only, `StyleSheet`/hardcoded-hex/spacing changes to `CalendarEnhanced.tsx` and its card component, no logic/data-fetching changes), not further mockup iteration, unless new issues surface on review.
2. The past-season leak bug is separate work, tracked above — pick it up in its own session with `systematic-debugging`.
