# Plan: "Today's Matches" Home Section

**Status:** Awaiting approval. No code written yet.
**Date:** 2026-08-31

## 1. Symptom (what triggered this)

Today British Open's main draw started, but a few of its Qualifiers matches
(a separate `Event` row) were rescheduled onto today and hadn't been played
yet (0-0). The user found them only by going Calendar → Past Tours →
British Open Qualifiers. Nowhere in the app proactively shows "here's what's
playing today" outside the single tournament Home happens to have resolved
as active.

## 2. Root cause chain

1. Each Qualifying stage is its own `Event` row, linked to its main draw via
   `Event.Main = <main_event_id>` (`models.py:194-197`). This FK already
   exists and is already used by `tournament_path.py`'s
   `qualifier_siblings()`.
2. Calendar's bucketing (`views.py::calendar_tabs_view`, lines 1113-1123)
   classifies an event as Active / Upcoming / Recent purely by comparing
   `today` against the event's static `StartDate`/`EndDate` — never by
   whether any of its matches are still unplayed.
3. British Open Qualifiers' `EndDate` (from snooker.org) is in the past, but
   some of its matches got rescheduled and now have `ScheduledDate = today`,
   `Status = 0`. Calendar has no signal for that, so the event still buckets
   as "Recent/Past" and the unplayed matches ride along with it.
4. `active_main_event_view` (`views.py:1156`) resolves **one** event as "the
   tournament happening now"; `all_live_matches_view` (`views.py:1694`)
   explicitly excludes `Tour='main'` (it's for women's/seniors/Q-Tour only).
   Home (`useHomeData.tsx`) only ever loads matches for that single resolved
   event. Nothing in the app currently asks "what's scheduled today,
   anywhere?" — so any match outside the one resolved event is invisible
   unless a user manually digs through Calendar.

**Conclusion:** not a bug in the strict sense — everything is behaving per
its own local logic. The gap is a missing feature: no place in the app
answers "what plays today" across every event/tour at once.

## 3. Decided scope (confirmed with user)

- Generic solution — works for any main event with a Qualifying sibling,
  not hardcoded to British Open.
- Match filter: **scheduled for today, any status** (0=not started,
  1/2=live, 3=finished) — so a live qualifier shows LIVE, a match already
  finished today still shows its score.
- Surfaced as a new **"Today's Matches" section at the top of Home**,
  collapsible, **starts expanded**.
- Duplication with the existing per-tournament match list below it is
  **allowed** — this section is a glance/summary, not a replacement.
- **Other tours included** (women's/seniors/Q-Tour matches scheduled today
  show here too, even though they also live in the Other Tours tab).

## 4. Design principle for this feature

One function = one action. Every new function is independently testable
without mocking a Django view or a React component tree.

## 5. Backend — new file, zero existing-file logic changes

`maxBreak/oneFourSeven/today_matches.py` (new file):

```
get_today_date() -> date
    # one line: date.today()

get_matches_scheduled_today() -> QuerySet[MatchesOfAnEvent]
    # MatchesOfAnEvent.objects.filter(ScheduledDate__date=get_today_date())
    #     .select_related('Event')
    # No Tour filter, no Status filter, no event-bucket filter.

is_qualifier_event(event) -> bool
    # delegates to tournament_path.event_is_qualifier(event) — no duplicate logic

build_today_match_row(match, player_names_map) -> dict
    # delegates to the existing views._build_match_dict() for the match
    # payload shape, then adds: event_id, event_name, event_tour,
    # is_qualifier

group_matches_by_event(rows: list[dict]) -> list[dict]
    # pure function, no DB access. Groups the flat row list into
    # [{event_id, event_name, event_tour, is_qualifier, matches: [...]}, ...]
    # ordered by event_name for stable display order.

today_matches_view(request)
    # orchestrates: get_matches_scheduled_today() -> build rows -> group
    # -> Response({'date': ..., 'groups': [...]})
```

New URL: `GET /oneFourSeven/matches/today/` — added to `urls.py` as one new
`path()` line, importing `today_matches_view` from the new module. No
existing URL pattern touched.

### Connection map (backend)

- `today_matches.py` reads: `MatchesOfAnEvent`, `Event` (via
  `select_related`), `tournament_path.event_is_qualifier`,
  `views._build_match_dict`, `views.get_player_names` (existing player-name
  lookup helper already used by `all_live_matches_view` and others).
- `today_matches.py` is read-only — no writes to any model, no consumer
  anywhere in the codebase currently expects this endpoint to not exist, so
  adding it changes no existing response shape.
- `urls.py` gets exactly one new line. No existing route's behavior changes.

## 6. Frontend — new files, one mount-point edit

```
services/todayMatchesService.ts        (new file)
  getTodayMatches(): Promise<TodayMatchesResponse>
      # one fetch call to GET matches/today/, one job: return typed JSON.

app/home/hooks/useTodayMatches.ts      (new file)
  useTodayMatches()
      # owns: groups state, loading state, error state, its own refetch
      # timer (poll every 2 min, matching the cadence useLiveMatchDetection
      # already uses elsewhere in Home — no new interval convention).
      # Does NOT read from or write to useHomeData / useLiveMatchDetection.
      # A network failure here just leaves the section unrendered — it
      # never blocks or errors the rest of Home.

app/home/components/TodayMatchesGroup.tsx   (new file)
  TodayMatchesGroup({ eventName, isQualifier, matches })
      # renders one tournament header + a list of matches, each row is the
      # existing <MatchItem> component (reused, no new visual pattern).

app/home/components/TodayMatchesSection.tsx (new file)
  TodayMatchesSection()
      # calls useTodayMatches(), renders a collapsible header (starts
      # expanded) + one <TodayMatchesGroup> per group.
      # Renders nothing at all when groups is empty (no empty box).
```

`app/index.tsx`: **one line added** — `<TodayMatchesSection />` mounted
above the existing tournament match list. No other line in this file
changes.

### Connection map (frontend)

- `TodayMatchesSection` is self-contained: its own hook, own fetch, own
  timer. It reads `MatchItem` (existing, already used by the main Home list
  and `OtherLiveSection` — a shared component, not modified) purely as a
  prop-in component; it does not change `MatchItem`'s props or behavior.
- Nothing in `useHomeData.tsx`, `useLiveMatchDetection.ts`,
  `matchProcessing.ts`, or the existing Home render tree is edited except
  the single mount line in `app/index.tsx`.
- No existing screen (Calendar, Tour detail, other-tours tab) is touched —
  this plan does not change Calendar's bucketing, as scoped out earlier in
  this conversation.

## 7. Before-snapshot (rule 11b)

Since every touched consumer is a brand-new file except one single mount
line in `app/index.tsx`, the only "before" behavior to snapshot is: Home
today renders with no "Today's Matches" section at all, and the existing
tournament match list renders exactly as it does now. That is the baseline
to diff against after the one-line mount is added — the rest of Home's
render output must be byte-for-byte identical before/after except for the
new section appearing above it.

## 8. Second-order risks

- **Duplicate live-polling load**: this adds a second 2-minute poll
  alongside `useLiveMatchDetection`'s existing one. Acceptable — it's one
  extra lightweight request, not a new polling *pattern* on the backend.
- **Old app builds** calling a backend that now has this new endpoint: no
  effect, old builds never call it (additive endpoint, nothing removed).
- **New app build against an old backend** (pre-OTA-rollout window, or a
  stale preview APK per Open Mission history): `getTodayMatches()` 404s or
  network-errors — must fail silently (rendered as "no section"), never a
  Home-screen crash. This will be an explicit test case.
- **Timezone**: filtering by server-local `date.today()` matches the
  existing convention used by `calendar_tabs_view` and
  `active_main_event_view` — not a new inconsistency, but still means a
  user far from the server's timezone could see "today" roll over a few
  hours early/late. Documented, not fixed, matches existing behavior
  elsewhere in the app.

## 9. Exhaustive test list (backend, pytest/Django test style)

`get_matches_scheduled_today()`:
1. Returns matches with `ScheduledDate` = today, any Status (0/1/2/3).
2. Excludes matches with `ScheduledDate` on other days.
3. Excludes matches with `ScheduledDate = None`.
4. Includes matches from a `Tour='main'` event.
5. Includes matches from a Qualifying event (`Type='Qualifying'`).
6. Includes matches from a non-main tour event (women's/seniors/Q-Tour).
7. Includes matches from multiple different events scheduled the same day.
8. Returns empty queryset when nothing is scheduled today.

`is_qualifier_event()`:
9. True for `Type='Qualifying'`.
10. True for a name ending in "Qualifiers" even if `Type` is blank
    (matches existing `event_is_qualifier` behavior — reused, but tested
    here as a contract check).
11. False for a normal main-draw event.

`build_today_match_row()`:
12. Row contains all fields from `_build_match_dict` plus `event_id`,
    `event_name`, `event_tour`, `is_qualifier`.
13. `is_qualifier=True` for a match on a Qualifying event.
14. `is_qualifier=False` for a match on a main-draw event.

`group_matches_by_event()`:
15. Groups two matches from the same event into one group.
16. Produces two separate groups for two different events.
17. Groups are ordered by event name.
18. Empty input list → empty output list.

`today_matches_view()` (full endpoint, via Django test client):
19. 200 response with correct `date` field = today's ISO date.
20. Response groups British-Open-main and British-Open-Qualifiers as two
    separate groups when both have matches today (the exact scenario that
    triggered this plan).
21. Response includes a women's-tour match scheduled today (other-tours
    inclusion, per decided scope).
22. Response is `{'date': ..., 'groups': []}` (not an error) when nothing
    is scheduled today.
23. A match scheduled today but already `Status=3` (finished) is still
    included, with its final score.
24. A match scheduled today that is currently `Status=1` (live) is
    included with live status fields populated same as other live-match
    endpoints.
25. Two concurrent main events both with matches today produce two groups
    (rare but real edge case, e.g. overlapping tournament schedules).
26. A qualifier event whose linked main draw hasn't started yet (main
    event `StartDate` in the future) still surfaces its today-scheduled
    qualifier matches.
27. Malformed/missing player name in `player_names_map` doesn't crash the
    row build (falls back the same way `_build_match_dict` already does
    for other endpoints).

## 10. Exhaustive test list (frontend)

`getTodayMatches()` (service):
28. Returns parsed JSON on success.
29. Throws/rejects on network failure (caller decides fallback).

`useTodayMatches()` (hook):
30. Initial state: loading=true, groups=[].
31. After successful fetch: loading=false, groups populated.
32. After failed fetch: loading=false, groups=[] (silent failure, no
    thrown error surfaced to the render tree).
33. Refetches on its own timer without needing a parent re-render.
34. Unmounting the hook's owner stops the timer (no state update after
    unmount / no leaked interval).

`TodayMatchesGroup` (component):
35. Renders one header + N `MatchItem` rows for N matches.
36. Renders a "Qualifiers" label/badge when `isQualifier=true`.
37. Renders nothing extra when `isQualifier=false`.

`TodayMatchesSection` (component):
38. Renders nothing at all when `groups` is empty (no empty collapsible
    box shown).
39. Renders expanded by default when `groups` is non-empty.
40. Collapse toggle hides the group list but keeps the header visible.
41. Expand toggle after a collapse restores the group list.
42. Renders one `TodayMatchesGroup` per group, in the order the backend
    returned them.
43. A live match inside a group shows the same live badge/styling as
    `MatchItem` already renders elsewhere in Home (reused component,
    verified via existing `MatchItem` test coverage / prop contract, not
    reimplemented here).

`app/index.tsx` mount point:
44. `TodayMatchesSection` renders above the existing tournament match list,
    every other existing Home element renders unchanged (before/after
    diff, per rule 11b).

## 11. Verification before claiming done

- Run the full existing frontend suite (`game_test.mjs`,
  `train_test.mjs`, `mega_test.mjs`, `freeball_test.mjs`,
  `stats_test.mjs`, `offseason_tab_test.mjs`) — confirm no regression
  (this feature doesn't touch scoreboard code, but the rule is "run the
  full suite after any change," no exceptions).
- Run Django test suite (`tests`, `tests_favorite_id_churn`,
  `tests_player_stats_targeting`, `tests_tournament_path`,
  `tests_tournament_end_ranking_gate`, plus the new tests for this
  feature) — confirm the one known pre-existing failure
  (`PlayerMatchHistoryOrderingTest.test_null_date_appears_last`, Open
  Mission #1) is the only failure, nothing new.
- `npx tsc --noEmit` on the frontend for type-check evidence.
- Manual check against production data (read-only query, no write) that
  the endpoint's response for today's actual date matches what's expected
  given today's real match rows — including the exact British Open
  Qualifiers scenario that started this investigation.

## 12. What this plan does NOT do (explicitly out of scope)

- Does not change Calendar's Active/Upcoming/Recent bucketing logic.
- Does not change `active_main_event_view`'s single-event resolution.
- Does not change `all_live_matches_view`'s Tour exclusion.
- Does not touch `useHomeData.tsx` or `useLiveMatchDetection.ts` internals.
- Does not deploy anything — this plan ends at "ready to test on preview,"
  per project rules. `eas update --channel preview` and
  `git push master` both require separate explicit approval after this
  plan is approved and implemented.

---

**Next step:** waiting for explicit approval of this plan before any
`Edit`/`Write` call touches application code.
