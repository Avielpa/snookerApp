# Handoff: Session/Frame Timers + Leaderboard — Known Follow-ups

**Written**: 2026-09-17, at the end of a long session that built, deployed, and
device-tested the session/frame timers + global best-break leaderboard
feature. **Status: shipped and live in production**, verified working
end-to-end on a real device (S24) with a real logged-in account. This doc is
for whoever picks up the follow-up work — nothing here is broken in a way
that blocks users, but several real, concrete items were found and
deliberately deferred rather than fixed as drive-bys.

## What's live right now

- Session timer (ticks in the header, any game mode) + frame timer (starts
  on first pot, freezes at frame end, resets per-break) — `hooks/useSessionTimer.ts`,
  `hooks/useFrameTimer.ts`, wired in `app/scoreboard/game.tsx`.
- Global best-break leaderboard, split by **6/10/15 reds**, with flag-not-reject
  anti-cheat (`maxBreak/oneFourSeven/break_timing.py`) — `app/components/scoreboard/LeaderboardTab.tsx`.
- "🏆 Leaderboard" shortcut button on the Play Mode setup screen, deep-linking
  via `?tab=leaderboard` — `app/scoreboard/index.tsx` + `resolveInitialTab()`
  in `app/scoreboard/history.tsx`.
- All backend + frontend commits are on `master`, pushed and deployed
  (Railway backend, EAS `preview` + `production` channels).
- Full test suite: **1,998 assertions across 12 files**, all green.
- Device-verified end-to-end with a real logged-in test account: timers
  start/stop/reset correctly across consecutive breaks without restarting
  the session, and the saved `frame_time_seconds` on the backend matched
  the on-screen value exactly (75s = "1:15").

Full history: `docs/SESSION_2026-09-16_session_frame_timers_and_leaderboard.md`
(original build) and this conversation's earlier turns (RTL/bidi bugs found
and fixed on-device, 10-reds gap, "no time" copy, shortcut button — all
already shipped).

## Known deferred items — real, found, not yet fixed

These were surfaced by code review or device testing during this session
and explicitly parked rather than fixed inline, per the "don't fix
out-of-scope findings as a drive-by" rule. None are user-blocking.

### 1. Leaderboard's reds-count pill toggle scrolls away with the list
**File**: `FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx:67-98`

When the Leaderboard's scroll-container bug was fixed (converting to a
`FlatList`), the reds-count pill row (`pillRow`) was passed in as
`ListHeaderComponent`, which means it now scrolls out of view along with
the entries once a user scrolls down a long leaderboard — previously
(when the list didn't scroll at all) the pills were always visible.
**Fix**: use `stickyHeaderIndices={[0]}` on the `FlatList`, or move the
pill row outside the `FlatList` into a sibling `View` above it.

### 2. Frame timer has a render/hook-order fragility
**File**: `FrontMaxBreak/hooks/useFrameTimer.ts:47-59`

`stateRef` (a `useRef`) is mutated inside a `useEffect` but read directly
during render via `const s = stateRef.current`. This works correctly today
because of the specific order `useFrameTimer()` is called relative to
other effects in `game.tsx` (confirmed by the final whole-branch reviewer
who traced it), but it is not concurrent-safe and would silently break if
a future refactor reorders the hook calls in `game.tsx`.
**Fix**: convert to a `useState`-based reducer (`setState(computeFrameTimerState(...))`
directly in the input-effect) instead of a ref + forced re-render counter.
Low priority — only matters if `game.tsx`'s hook order changes.

### 3. Session timer resets on draft-resume, doesn't accumulate
**File**: `FrontMaxBreak/hooks/useSessionTimer.ts:11` (seeds from `Date.now()` at mount)

All 4 `StoredMatch` save sites in `game.tsx` write `durationSeconds` as an
overwrite of the current session's elapsed time, not an accumulation. If a
session is interrupted and resumed from the `sb_draft` auto-save, the
recorded `durationSeconds` only reflects time since the resume, undercounting
the real total. **Latent, not live** — nothing currently reads
`durationSeconds` in the UI (see #4), so this has zero visible effect yet.
Must be fixed before building a "time played today" feature on top of it.

### 4. `sumDurationForToday` is dead code — no UI uses it yet
**File**: `FrontMaxBreak/services/gameStorage.ts:159`

Exported, tested (4 assertions in `stats_test.mjs`), but nothing in `app/`
calls it (confirmed via grep — zero callers outside test files). The
session timer only shows *live* elapsed time for the current session; there
is no "time played today" total anywhere in the app. If you build that
feature, fix #3 first or the total will be wrong.

### 5. Leaderboard shows "No records yet" even on a network failure
**File**: `FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx:22-33` (the `fetchLeaderboard` call site)

`fetchLeaderboard()` (in `services/leaderboardService.ts`) swallows all
errors into `[]` by design (matches the rest of the service layer's
error-handling convention), so `LeaderboardTab` can't distinguish "this
board is genuinely empty" from "the request failed." An offline user sees
a factually wrong "No records yet for this format." message.
**Fix**: have the component track a `failed` boolean (e.g. a sentinel
return value or a second exported function that reports the error), and
show "Couldn't load the leaderboard — check your connection" with a retry
button instead.

### 6. `best_break_test.mjs`'s `submitBreak` mirror doesn't test the error path
**File**: `FrontMaxBreak/best_break_test.mjs`

The real `submitBreak()` wraps its POST in try/catch and returns `null` on
failure — `game.tsx`'s call site relies on this ("never throws") via an
unguarded `.then()`. The test file's inline mirror of `submitBreak` has no
try/catch, so this guarantee is asserted by inspection, not by a real test.
**Fix**: add the try/catch to the mirror and one rejecting-mock test case.

### 7. `LeaderboardTab`'s FlatList `keyExtractor` uses a positional key
**File**: `FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx:96`

`keyExtractor={(entry, i) => \`${entry.username}-${i}\`}` — fine today since
the list is always a fresh, fully-replaced fetch result, but it's a
positional key, not a stable server-provided ID. Trivial risk, noted for
completeness. `achieved_at` (already returned by the API) would make it a
true stable key if this ever becomes a concern (e.g. incremental updates).

### 8. Anti-cheat frame-time test coverage gap at the view layer
**File**: `maxBreak/oneFourSeven/tests_best_break.py`

No explicit test exercises a negative or zero `frame_time_seconds` value at
the `best_break_view` call site (the pure function `is_realistic_frame_time`
itself is fully covered in `tests_break_timing.py`, this is specifically
about the view's integer-coercion path). Low priority — behavior is
correct by inspection (any `frame_time_seconds <= break_value`'s realistic
floor of 0 is impossible to construct maliciously in a way that matters),
just untested at that specific layer.

## Not-yet-built follow-up ideas (discussed with user, not started)

- **"You're #N globally" tie-in on the Frame Summary** after a new personal
  best, tapping through straight to the Leaderboard — the highest-value
  discoverability improvement discussed but not built. Needs a small
  backend addition: the leaderboard endpoint doesn't currently return "my
  rank" for an arbitrary user outside the top 50, so a new query or param is
  needed (e.g. `?highlight_username=<user>` or a separate `/my-rank/` endpoint).
- **"Time played today" UI** — `sumDurationForToday()` already exists and is
  tested but has no UI. Fix #3 above first (accumulation bug) or this will
  ship with wrong numbers on any resumed-draft session.

## Pre-existing, unrelated item (already logged separately)

`docs/OPEN_MISSIONS.md` #20 — `python manage.py test oneFourSeven` (bare
app label, no dotted path) fails on Windows with `ModuleNotFoundError`.
Found during this session's Task 4 but confirmed pre-existing (reproduces
on an unmodified checkout too). Not fixed, not this feature's bug.

## For the next agent

- Everything above is a **deferred, non-blocking** finding — none of it
  needs fixing before any of the others. Pick based on what the user asks
  for next.
- If you touch `LeaderboardTab.tsx` for item #1 or #5, re-verify on a real
  device with a Hebrew-locale/RTL setting — this file has already had two
  real RTL/bidi bugs found only on-device (row order + rank text bidi
  reordering), neither of which the automated test suite could have caught.
  Read this session's earlier fixes (`forceLtr`, `LTR_ROW`) before changing
  anything here.
- `useFrameTimer.ts` (#2) and `useSessionTimer.ts` (#3) must never be
  refactored to depend on `useSnookerGame.ts`'s reducer — this was a hard
  constraint of the original feature build, confirmed untouched by every
  task reviewer.
