# Session Timer, Frame Timer & Global Best-Break Leaderboard — Design Spec

**Date**: 2026-09-16
**Status**: Approved by user, pending implementation plan.

## 1. Problem / Goal

The Scoreboard's Train mode already tracks a per-user personal-best break
(`PlayerBestBreak`, shipped 2026-09-14, see
`docs/SESSION_2026-09-14_best_break_phase2.md`). The user wants to extend
this with:

1. A **session timer** — tracks total time played (any mode: Match /
   Unlimited / Train), for a "time played today" stat.
2. A **frame timer** — tracks how long an individual frame takes, for
   (a) a per-frame duration stat and (b) an anti-cheat signal on best-break
   submissions.
3. A **global leaderboard** — lets users compare their best break against
   other users, addressing the "people can lie" self-report problem with a
   realistic-time anti-cheat check instead of blocking the feature outright.

## 2. Non-goals

- No per-shot / tap-interval timing analysis. Considered and explicitly
  deferred — it needs per-pot timestamp storage and a second statistic for
  a nice-to-have; the single frame-time-vs-realistic-floor check already
  covers the real anti-cheat need. Logged here as a future idea, not built.
- No change to `useSnookerGame.ts`'s reducer or its existing 1039-assertion
  test suite. Both new timers are external observers of game state, not
  reducer state.
- No change to the existing Train-mode-only gating on best-break submission
  (fixed in Phase 2 — Match mode never calls the best-break endpoint). The
  leaderboard inherits this gate for free since it reads the same table.
- Session timer does not persist a "today" total for guests (no account to
  attach history to — matches `gameStorage.saveMatch`'s existing login
  gate). Guests still see a live current-session counter.

## 3. Session Timer

**New file**: `FrontMaxBreak/hooks/useSessionTimer.ts`

- Starts counting on mount (game screen opened), regardless of mode.
- Pure hook: internal `startedAt` ref + `setInterval`-driven elapsed-seconds
  state. One responsibility: report elapsed seconds since mount.
- No dependency on `useSnookerGame`'s `GameState`.

**"Time played today" stat**:
- For logged-in users: add `durationSeconds: number` to the saved match
  record shape written by `gameStorage.ts`'s `saveMatch()`. New pure helper
  `services/gameStorage.ts::sumDurationForToday(matches)` sums
  `durationSeconds` across today's records (date compare only, no mutation).
- For guests: no persisted history exists (existing gate), so only the live
  `useSessionTimer` value is shown — no "today total" claim is made.

## 4. Frame Timer

**New file**: `FrontMaxBreak/hooks/useFrameTimer.ts`

- Starts on the first ball potted in the frame (any colour — first pot
  event after `frameNumber` last changed).
- Stops at frame end (`isFrameOver` transitions to `true`, whichever cause:
  win, concede, respot shootout resolution).
- Resets when `frameNumber` increments.
- Implemented as an **external observer** in `game.tsx`: watches the
  `GameState` returned by `useSnookerGame`, does not modify the reducer.
  One responsibility: report elapsed seconds for the current frame, and the
  final elapsed seconds once a frame closes.

**Uses**:
- Displayed as a "frame took X:XX" stat (e.g. in `FrameSummary.tsx`).
- Passed to `bestBreakService.submitBreak()` as `frame_time_seconds` when a
  Train-mode frame ends (existing submission call site in `game.tsx`).

## 5. Backend: extend `PlayerBestBreak`

No new model — the existing table already has one row per
`(user, reds_count)`, which is exactly what a leaderboard needs. Migration
adds two columns:

```python
frame_time_seconds = models.IntegerField(null=True, blank=True)
is_verified = models.BooleanField(default=True)
```

**Anti-cheat check** (single small function in `data_savers.py` or
`views.py`'s best-break upsert path):

```python
REALISTIC_SECONDS_PER_POINT = 320 / 147  # Ronnie O'Sullivan's fastest official 147 (5:20)

def is_realistic_frame_time(frame_time_seconds: int, break_value: int) -> bool:
    floor_seconds = REALISTIC_SECONDS_PER_POINT * break_value
    return frame_time_seconds >= floor_seconds
```

- A single named constant, not a per-ball-value lookup table.
- If a submitted break fails the check: **still saved**, `is_verified` set
  to `False`. Never silently rejected — a real fast break must never be
  destroyed on a false positive. The personal-best value and the
  leaderboard entry both still update; the UI shows an "unverified" badge.
- `frame_time_seconds` is optional (`null=True`) — old rows written before
  this change, or any future submission path that doesn't have a timer
  value, must not break. `is_verified` defaults to `True` for those (no
  time data means no basis to flag it).

**API contract change**: `POST /scoreboard/best-break/` request body gains
an optional `frame_time_seconds` field. `submitBreak()`
(`services/bestBreakService.ts`) is updated to accept and send it; the
signature change is additive (existing callers passing no timer value still
work, backend treats missing value as `null`).

## 6. Global Leaderboard

**New backend endpoint**: `GET /scoreboard/leaderboard/?reds_count=<n>`
- Reads directly from `PlayerBestBreak` filtered by `reds_count`.
- Orders by `best_break` desc, `frame_time_seconds` asc as tiebreak (nulls
  last).
- Returns top N (default 50) rows: `username`, `best_break`,
  `frame_time_seconds`, `is_verified`, `achieved_at`.
- One read-only view function, no new serializer complexity beyond the two
  new fields already on `PlayerBestBreak`.

**New frontend file**: `FrontMaxBreak/services/leaderboardService.ts`
- One function: `fetchLeaderboard(redsCount: number): Promise<LeaderboardEntry[]>`.
- Same axios + error-swallow pattern as `bestBreakService.ts` (returns `[]`
  on error, never throws).

**UI**: new "Leaderboard" tab in `app/scoreboard/history.tsx`, alongside
the existing Matches and Training Sessions tabs. A reds_count toggle (6-red
/ 15-red, matching the existing format split) switches which board is
shown. Row format matches the user's mockup:

```
1. David   Break 30   Time 3:20
2. Moshe   Break 29   Time 2:59
3. Ner     Break 29   Time 3:01
```

An unverified entry gets a small badge/icon next to its row (e.g. "⚠ unverified timing"), never hidden.

## 7. Data flow summary

```
game.tsx (Train mode)
  useSessionTimer()  ──────────────────────────► "time played today" (local)
  useFrameTimer()  ─┬─► FrameSummary.tsx (display: "frame took X:XX")
                     └─► submitBreak(reds, break, frame_time_seconds)
                              │
                              ▼
                     POST /scoreboard/best-break/
                              │  is_realistic_frame_time() check
                              ▼
                     PlayerBestBreak row (upsert-if-higher, + frame_time_seconds, is_verified)
                              │
                              ▼
                     GET /scoreboard/leaderboard/?reds_count=N
                              │
                              ▼
                     history.tsx "Leaderboard" tab
```

## 8. Testing plan (per project rule: 100+ assertions before deploy)

New/updated test files, following the existing `*_test.mjs` pattern:

- `session_timer_test.mjs` — start/elapsed/mount behavior of
  `useSessionTimer`'s pure logic, `sumDurationForToday()` date-filtering
  edge cases (today vs yesterday vs empty).
- `frame_timer_test.mjs` — start-on-first-pot, stop-on-frame-end, reset-on-
  next-frame, across Match/Train/Unlimited modes.
- Extend `best_break_test.mjs` — `frame_time_seconds` passed through
  `submitBreak()` correctly, missing-value case.
- Backend `tests_best_break.py` additions — `is_realistic_frame_time()`
  boundary cases (exactly at floor, just under, just over, break_value=0
  guard), migration default values for existing rows, new leaderboard
  endpoint (ordering, tiebreak, `reds_count` filter, top-N limit).

Each new function gets its own isolated test — no cross-function test
reuse, matching the "one action per function" rule.

## 9. Files touched (new vs modified)

**New**:
- `FrontMaxBreak/hooks/useSessionTimer.ts`
- `FrontMaxBreak/hooks/useFrameTimer.ts`
- `FrontMaxBreak/services/leaderboardService.ts`
- `FrontMaxBreak/session_timer_test.mjs`
- `FrontMaxBreak/frame_timer_test.mjs`
- `maxBreak/oneFourSeven/migrations/00XX_playerbestbreak_timing_fields.py`

**Modified**:
- `maxBreak/oneFourSeven/models.py` (`PlayerBestBreak` + 2 fields)
- `maxBreak/oneFourSeven/views.py` (upsert path + new leaderboard view)
- `maxBreak/oneFourSeven/serializers.py` (expose new fields)
- `maxBreak/oneFourSeven/tests_best_break.py`
- `FrontMaxBreak/services/bestBreakService.ts` (`submitBreak` signature)
- `FrontMaxBreak/services/gameStorage.ts` (`durationSeconds` field,
  `sumDurationForToday`)
- `FrontMaxBreak/app/scoreboard/game.tsx` (wire both timers, pass
  `frame_time_seconds` to `submitBreak`)
- `FrontMaxBreak/app/scoreboard/history.tsx` (new Leaderboard tab)
- `FrontMaxBreak/app/components/scoreboard/FrameSummary.tsx` (frame-time
  display)
- `FrontMaxBreak/best_break_test.mjs`

## 10. Compatibility with old data

- Existing `PlayerBestBreak` rows: `frame_time_seconds` nullable,
  `is_verified` defaults `True` — no backfill needed, no existing row is
  retroactively flagged.
- Existing saved match records without `durationSeconds`: treated as `0`/
  excluded from the sum, never crashes the "today" total.
- Leaderboard endpoint is purely additive (new URL) — no existing endpoint
  changes shape.
