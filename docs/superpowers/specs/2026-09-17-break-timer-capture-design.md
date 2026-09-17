# Break-timer capture — design spec

**Date**: 2026-09-17
**Status**: Approved by user in-chat (section-by-section), pending final spec review before writing-plans.
**Sub-project 1 of 2** (see "Out of scope" — sub-project 2, the Profile tab, is a separate future brainstorm/spec).

## Problem

Match and Unlimited mode currently have no concept of "how long did that break take." Train mode already
gets per-break timing sent to the backend (`frame_time_seconds` on `PlayerBestBreak`, via
`services/bestBreakService.ts::submitBreak`), but Match/Unlimited mode's `frameElapsedSeconds`
(`useFrameTimer`, fixed 2026-09-17) only measures the whole frame, not each player's individual scoring
visit ("break"). The user wants a live break timer shown during play, plus the completed-break data saved
to their account so it can feed a future personal-stats view.

## Scope

In scope:
1. A live-ticking break timer shown in the existing `Break {currentBreak}` badge (`ScorePanel.tsx`) for
   whichever player is currently on strike, in Match and Unlimited modes.
2. Detecting when a break ends (player switch via tap-to-end-visit, a foul, or the frame ending) and
   capturing that break's final value + duration.
3. A "this is me" picker at Match/Unlimited setup, so exactly one of the two player slots is tagged as the
   logged-in account.
4. Saving each completed break for the tagged "me" player to the backend as an individual event, when
   logged in. Guests: no backend save (matches existing Train-mode guest behavior — no error, no local
   queue-for-later).
5. **Extend the existing personal-best-break leaderboard (`PlayerBestBreak`) to Match/Unlimited mode for
   the "me" player.** This reuses `services/bestBreakService.ts::submitBreak(redsCount, breakValue,
   durationSeconds)` completely as-is — that function and its backend endpoint
   (`scoreboard/best-break/`) are already mode-agnostic (just `reds_count` + `break` + optional
   `frame_time_seconds`, no mode field at all). The only new code is one additional call site: when a
   completed-break event fires (item 2) for `completedBreak.player === config.mePlayerIndex`, call
   `submitBreak` with that break's own value and duration — the same event already driving item 4's new
   `BreakTimingRecord` save, just also feeding the pre-existing leaderboard. Train mode's own existing
   call (`game.tsx:174-181`, on frame-over) is untouched. This directly fixes the reported "Yuval's higher
   breaks don't show on the global table" gap — that gap was the deliberate Train-mode-only restriction
   from the 2026-09-14 fix, not a bug, and is now closed for the "me" player specifically (never for a
   local pass-and-play opponent, which is exactly what caused the original attribution bug this
   restriction was created to prevent).

Out of scope (deferred to sub-project 2, a separate brainstorm/spec):
- The Profile tab UI itself (shot avg time, frame avg, session total time, break time, highest break).
- "Shot avg time" specifically — this needs its own definition (time between successive pots?) that wasn't
  settled in this brainstorm; punted to the Profile tab's own design session.
- Any new UI showing the *average* break time inside the scoreboard itself — this spec only captures data;
  displaying aggregates is the Profile tab's job.
- Train mode — already has equivalent timing via the existing frame-timer/best-break path; untouched by
  this spec.

## Design

### 1. Live timer: `useBreakTimer` hook

New file `FrontMaxBreak/hooks/useBreakTimer.ts`, structurally identical in spirit to
`hooks/useFrameTimer.ts` (pure observer of `GameState` fields passed in by `game.tsx`; never touches
`useSnookerGame`'s reducer; a pure `computeBreakTimerState` function for unit testing, wrapped by a
`useState`-driven hook — using `useState` from the start, not the ref-based pattern `useFrameTimer` had
before today's fix).

Input per render (all derived from `GameState.current`, the active frame snapshot):
```ts
interface BreakTimerInput {
  currentPlayer: 0 | 1;
  currentBreak: number;      // resets to 0 when a break ends
  breakBallsLength: number;  // snap.breakBalls.length — 0 means no pot yet this break
  isFrameOver: boolean;
}
```

State machine (`computeBreakTimerState`):
- Tracks `{ currentPlayer, startedAt: number | null, frozenElapsedMs: number | null }`.
- If `currentPlayer` changes from the previous render (break handed to the other player) **or**
  `isFrameOver` just became true **or** `currentBreak` dropped back to 0 while `startedAt` was set (break
  ended without a player-slot change — covers the tap-to-end-visit-on-self / respot cases): freeze the
  elapsed time and emit a "break completed" event (see below) if `startedAt` was non-null.
- If `breakBallsLength` goes from 0 to 1 (first pot of a fresh break) and not already started: set
  `startedAt = now`.
- Otherwise carry state forward unchanged (same non-mutation discipline as `useFrameTimer`).

`game.tsx` renders the live value only for the active player:
`ScorePanel`'s `breakBadge` becomes `Break {currentBreak} · {formatElapsed(elapsedSeconds)}` (reusing
`formatElapsed` from `hooks/useSessionTimer.ts`) — shown only when `isActive && currentBreak > 0`, matching
the existing conditional exactly. Both Match and Unlimited mode get this (bestOf === null / Single Frame
included, since they use the same `ScorePanel`). Train mode is untouched — it keeps its existing
Break-badge-less panel and its existing Train-specific timer path.

### 2. Break-completed event → backend save

When `useBreakTimer` (via a callback prop, same pattern as `onEndVisit`) reports a completed break for the
player slot tagged "me" **and** the user is logged in, `game.tsx` calls a new
`services/breakTimingService.ts::submitBreakTiming(breakValue, durationSeconds, mode)` — fire-and-forget,
matching `submitBreak`'s existing error-swallowing pattern (a failed save must never interrupt play).

`mode` is `'match' | 'unlimited'` (Train mode never calls this — it already has its own path). Breaks with
`breakValue === 0` (a miss with no points) are still recorded — a fast 0 does carry timing signal for a
future "shot speed" stat — but this is a judgment call worth confirming (see Edge Cases → open question).

New Django model, `oneFourSeven/models.py` (pattern-matched to `PlayerBestBreak` immediately above it):

```python
class BreakTimingRecord(models.Model):
    """
    One completed break's duration, from Match/Unlimited mode, for the player slot tagged
    "me" at match setup. Personal analytics only — never a competitive/global leaderboard,
    so (unlike PlayerBestBreak) there is no anti-cheat validation: this is the user's own
    account, no one else's data is at stake, and no reward is gated on accuracy.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='break_timings')
    break_value = models.IntegerField()
    duration_seconds = models.IntegerField()
    mode = models.CharField(max_length=16, choices=[('match', 'Match'), ('unlimited', 'Unlimited')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Break Timing Record"
        verbose_name_plural = "Break Timing Records"

    def __str__(self):
        return f"{self.user.username} / {self.mode} / break {self.break_value} in {self.duration_seconds}s"
```

New endpoint `POST /scoreboard/break-timing/` (new view function in `views.py`, new URL in `urls.py`,
JWT-authenticated same as `best_break_view`) — simple create, no upsert logic needed (every event is its
own row, unlike `PlayerBestBreak`'s "only if higher" semantics).

### 3. "This is me" picker at setup

`app/scoreboard/index.tsx` (setup screen) gains a toggle, shown only for Match/Unlimited (not Train, which
already has exactly one real player): "Who are you? [Player 1] [Player 2]", defaulting to Player 1. Stored
as a new field on the match config, e.g. `mePlayerIndex: 0 | 1`, persisted through `sb_draft` the same way
the rest of `MatchConfig` already is (no special-casing needed — it's just another field on an object
that's already fully serialized/restored).

## Connection map

- `hooks/useBreakTimer.ts` (new) → consumed only by `app/scoreboard/game.tsx`.
- `game.tsx` → reads `state.current.currentPlayer/currentBreak/breakBalls.length/isFrameOver` (already
  destructured for other purposes, e.g. the existing frame-timer wiring) → passes `elapsedSeconds` into
  `ScorePanel` (new prop) → on a completed-break callback, calls `breakTimingService.submitBreakTiming`
  when `config.mePlayerIndex === completedBreak.player && isLoggedIn()`.
- `ScorePanel.tsx` → new optional prop `activeBreakElapsedSeconds?: number`, purely additive — existing
  callers (if any pass no such prop) render exactly as today.
- `services/breakTimingService.ts` (new) → `maxBreak/oneFourSeven/views.py::break_timing_view` (new) →
  `models.py::BreakTimingRecord` (new) — a dead-end for now (no reader yet); the Profile tab (sub-project
  2) will be the first consumer of `GET`-side data, which this spec does not need to build yet since
  nothing reads it back this round. A read endpoint isn't part of this spec's scope — added when sub-
  project 2 needs it, per YAGNI.
- On the same completed-break event (for `completedBreak.player === config.mePlayerIndex` only):
  `game.tsx` also calls the **existing** `services/bestBreakService.ts::submitBreak` → **existing**
  `maxBreak/oneFourSeven/views.py::best_break_view` → **existing** `models.py::PlayerBestBreak` →
  **existing** `leaderboard_view` / `LeaderboardTab.tsx`. No new backend code on this path at all — purely
  a new frontend call site into infrastructure that already works and is already tested.
- `app/scoreboard/index.tsx` → new `mePlayerIndex` field on `MatchConfig`, flows into `game.tsx` via
  existing config-passing, persisted via existing `sb_draft` serialization (no new AsyncStorage key).

## Edge cases

1. **Guest user** (not logged in): `submitBreakTiming` is never called at all — checked before the fetch,
   not after a failed auth response, matching the Train-mode nudge pattern (no error toast).
2. **Foul before any pot**: `breakBallsLength` never left 0, so `startedAt` never got set — no completed-
   break event fires (a 0-duration phantom break must not be recorded). Mirrors `useFrameTimer`'s existing
   `hasAnyPotThisFrame` guard.
3. **Undo mid-break**: potting then undoing doesn't reset `currentPlayer`, so the timer keeps running
   (same "already started, never resets except on the real end conditions" behavior as `useFrameTimer`).
4. **Frame ends mid-break** (final black potted): `isFrameOver` becoming true must freeze and emit the
   completed break exactly once — must not double-fire if `currentPlayer` also happens to change in the
   same render.
5. **Respotted-black shootout / tied frame**: breaks during the shootout still start/stop normally; no
   special-casing needed since the hook only watches `currentPlayer`/`currentBreak`/`breakBallsLength`,
   which behave the same way as any other break.
6. **"Me" player never gets a turn** (rare, e.g. opponent runs the whole frame): zero events for that
   frame — correct, nothing to record.
7. **Match/Unlimited resumed from `sb_draft` mid-break**: the in-progress break's `startedAt` is lost on
   resume (same known limitation as the session-timer's own resume gap, logged as an existing follow-up in
   `docs/SESSION_2026-09-17_HANDOFF_timers_leaderboard_followups.md`) — the resumed break will start timing
   from the resume point, not the original start. Documented limitation, not fixed by this spec.
8. **Zero-value break** (a visit that ends in a foul with no pots, or a miss with no score): per the open
   question below, decide whether to record `breakValue: 0` events at all.
9. **Backend failure** (network drop, 401 expiry mid-match): fire-and-forget, swallowed — matches
   `submitBreak`'s existing behavior, play is never interrupted.
10. **Rapid consecutive breaks** (both players missing quickly): each must produce its own distinct event,
    not be coalesced — verified via the pure `computeBreakTimerState` function's unit tests.
11. **Old data / existing accounts**: no migration concern — this is a brand-new model with no prior rows;
    every existing user simply has zero `BreakTimingRecord` rows until they next play Match/Unlimited
    logged in. No backfill needed.
12. **Single Frame mode** (`bestOf === null`): uses the same `ScorePanel`/reducer path as Best-of-N — must
    get the same timer behavior, no special-casing.
13. **Leaderboard extension — opponent's break must never submit**: the existing attribution bug
    (Phase 2, 2026-09-14) happened because Match mode submitted *both* players' breaks under one login.
    The new call site must gate strictly on `completedBreak.player === config.mePlayerIndex` — a
    completed break for the *other* slot must never reach `submitBreak`, even accidentally (e.g. if a
    default/fallback value for `mePlayerIndex` were ever wrong). Test this explicitly: a completed break
    for the non-"me" player must produce zero `submitBreak` calls.
14. **Leaderboard extension — reds_count consistency**: `PlayerBestBreak` is keyed per `(user,
    reds_count)`. Match/Unlimited mode already lets the user pick `numberOfReds` at setup same as Train
    mode, so no new reds-count handling is needed — but verify a Match played with a non-standard reds
    count (e.g. 6 reds) correctly lands in the same per-reds-count bucket a 6-red Train session would.

### Resolved: zero-value breaks

Confirmed with the user: zero-value breaks (`breakValue === 0`) are **skipped**, not saved. This is mostly
moot in practice since edge case 2's guard already prevents a timer from starting until the first pot —
but `computeBreakTimerState`'s completed-break emission must still explicitly check `breakValue > 0` before
firing, to cover any path where a break starts (a pot happens) but ends up scoring 0 net (e.g. a potted
ball later voided by a foul that removes the point without ever resetting `breakBallsLength` back to 0
first — verify this can't actually happen during implementation; if it can't, the check is a harmless
guard rather than dead logic).

## Second-order risks

- **Data volume**: every Match/Unlimited break by a logged-in user creates a row. For a typical match
  (say 10-20 breaks/visits per frame across a multi-frame match), this is a small, bounded number per
  session — not a concern at current usage levels, but worth keeping in mind if this ever needs pruning.
- **`ScorePanel` prop growth**: adding `activeBreakElapsedSeconds` is the fourth or fifth prop threaded
  through from `game.tsx`; if the Profile tab later needs more live values shown here, consider grouping
  timer-related props into a single object rather than one-prop-per-value, to avoid an unwieldy prop list
  — not needed yet at one new prop, but noted for the next addition.
- **Setup-screen UI addition**: the new "this is me" toggle is one more decision at match setup, which
  could feel like friction for casual play — defaulting to Player 1 keeps the common case (solo player is
  always P1) a no-op tap.

## Testing plan

- Extend a new `break_timer_test.mjs` (mirroring `frame_timer_test.mjs`'s structure) with pure-function
  tests for `computeBreakTimerState` covering every edge case above that's expressible without mounting
  React (1-11, skipping only the resume-from-draft case which needs a real device/emulator check).
- Backend: new Django test class for `break_timing_view` (auth required, creates a row, rejects
  unauthenticated requests) — pattern-matched to whatever test coverage `best_break_view` already has.
- Full existing suite (all 12 `.mjs` files + backend `oneFourSeven` tests) re-run after implementation to
  confirm zero regressions, per rule 10/13.
- Manual on-device preview verification (rule 16): live badge ticks correctly for the active player only,
  in Match and Unlimited, for both "me" as Player 1 and "me" as Player 2, across a full match with several
  breaks, fouls, and at least one undo.
