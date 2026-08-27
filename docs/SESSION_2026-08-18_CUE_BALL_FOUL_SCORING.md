# Session 2026-08-18 — Cue-ball-in-off foul scoring gap

## Symptom

User report: in the scoreboard, when a player pots a ball (red or colour) and the cue
ball also goes in on the same shot (in-off — always a foul), there was no way to record
"legal object ball potted + cue ball foul" as a single combined outcome. Reported
scenario: last red on the table, player pots the red + the cue ball. Expected: no point
for the red, opponent gets the foul-value points, and the red does not return to the
table (it was legally potted, just fouled by the in-off).

## Root cause chain

`hooks/useSnookerGame.ts` only exposed two mutually-exclusive shot outcomes:
`potBall(ball)` (a clean legal pot) or `applyFoul(foulValue, opponentPlays,
redsAccidentallyPotted)`. There was no way to represent "ball X was potted AND it's a
foul" for anything except reds, and even the reds-side primitive
(`redsAccidentallyPotted`) was undocumented, unlabeled in the UI (no "cue ball" concept
anywhere), and had zero test coverage prior to this fix — confirmed by grepping every
`.mjs` test file for `redsAccidentallyPotted` (zero hits) despite the parameter existing
in the real hook.

The reds-side case (the user's exact reported scenario) actually **self-healed** to the
mathematically correct outcome already, via `getAvailableBalls`'s safety guard (falls
through to the colours sequence once `redsRemaining === 0` regardless of `awaiting`) —
but only if the user bypassed the ball button entirely and went straight to the "Foul"
button. This was a **discoverability gap**, not an arithmetic one, for reds.

The **genuine, unpatched gap was colours**: potting the correct on-colour + cue ball
during the mandatory colours-only phase had no removal mechanism at all — the colour
would incorrectly stay "on" forever. Worse, potting the **final black** + cue ball
(frame-ending case) would leave the frame stuck, since nothing decremented
`colorsRemaining` on a foul. A related pre-existing bug was found and fixed in the same
family: `applyFreeBall`'s colours-phase branch set `isFrameOver = true` directly on the
final black, skipping the tied-score → respot-black check that `potBall` already did —
this was fixed via the same shared helper introduced here, since the approved test list
required it.

## What was fixed

**Engine** (`hooks/useSnookerGame.ts`):
- New `resolveColoursExhausted(scores)` — shared tie-check (frame ends vs. respot-choice
  on the black). `potBall` and `applyFreeBall` both refactored to use it instead of two
  independent inline copies.
- New `resolveFoulPotOutcome(preShotSnap, pottedBall)` — pure helper deciding whether a
  named non-red ball leaves the table permanently (only possible if it's the true on-ball
  during the colours phase) or respots (reds-phase colours always respot; any
  not-the-on-ball colour always respots). Derives the on-ball/wrong-ball distinction
  automatically — no manual toggle needed.
- `applyFoul` extended with a `colourPotted: BallType | null` parameter, delegating to
  both new helpers.
- New `convertLastPotToFoul(foulValue, opponentPlays)` — converts the most recently
  potted ball (top of `breakBalls`/`history`) into a foul outcome in one atomic step, for
  when a player already tapped a ball button and only then realizes the cue ball also
  went in. Only operates on the single most recent shot; reach an earlier one via
  `undo()` first.

**UI**:
- New `app/components/scoreboard/FoulPottedBallsPicker.tsx` — a phase-aware "which ball
  (if any) went down alongside this foul" picker, using the same glossy true-ball-colour
  gradient chips as `BallPad`, restricted to `colorsRemaining` (can't pick an
  already-gone colour).
- `FoulModal.tsx` gained this picker (shown only when `phase==='colors'` or
  `freeBallActive`, since a reds-phase colour is a functional no-op either way), plus a
  `mode: 'foul' | 'convert'` prop that hides the reds/colour pickers in convert mode
  (the ball is already known).
- `app/scoreboard/game.tsx`: new "⚠ This was a foul" affordance next to `BreakChain`,
  visible whenever `breakBalls.length > 0`, opening `FoulModal` in convert mode.

## Files touched

- `FrontMaxBreak/hooks/useSnookerGame.ts` — core logic changes (see above)
- `FrontMaxBreak/app/components/scoreboard/FoulModal.tsx` — unified picker + convert mode
- `FrontMaxBreak/app/components/scoreboard/FoulPottedBallsPicker.tsx` — new component
- `FrontMaxBreak/app/scoreboard/game.tsx` — wiring, new affordance, new state
- `FrontMaxBreak/docs/SCOREBOARD.md` — updated `applyFoul` reference table (was already
  stale before this session — didn't even list the pre-existing `redsAccidentallyPotted`
  param), documented `convertLastPotToFoul`
- `FrontMaxBreak/foulconvert_test.mjs` — new test file, 53 assertions
- `docs/OPEN_MISSIONS.md` — logged item #8 (test-suite architecture drift)

## Verified

- `npx tsc --noEmit -p .` — clean, zero errors (run twice: after engine changes, and
  after UI wiring).
- All 6 pre-existing test suites re-run after every engine change — 1060/1060 assertions
  pass, zero regressions (confirms the `potBall`/`applyFreeBall` refactor to share
  `resolveColoursExhausted` didn't change any existing behavior).
- New `foulconvert_test.mjs` — 53/53 assertions pass, covering colours-phase foul combos,
  free-ball + foul combos, `convertLastPotToFoul` (including undo-after-convert history
  semantics), and the sudden-death respotted-black shootout interaction.
- **NOT verified**: no real-device/Expo build was run — this was a pure logic + UI code
  change, not tested by hand in the Preview APK. Per CLAUDE.md, do this before
  `eas update --channel preview`.

## Lessons for a future agent

- The `.mjs` test files (`game_test.mjs`, `train_test.mjs`, `mega_test.mjs`,
  `freeball_test.mjs`, `stats_test.mjs`, `offseason_tab_test.mjs`, and now
  `foulconvert_test.mjs`) are **hand-reimplementations** of `useSnookerGame.ts`, not
  imports of it. A "1113 assertions passing" claim only means those files' own inline
  copies pass — always re-verify by grepping the actual test file for the
  function/parameter name in question before trusting "passing" as evidence, and mirror
  any new engine logic into these files by hand or it goes untested silently (see Open
  Missions #8).
- `resolveFoulPotOutcome`'s core insight — the on-ball/wrong-ball distinction for a foul
  can be *derived* by comparing the named ball to `colorsRemaining[0]`, never asked as a
  manual toggle — generalizes to any future "which ball, if any" input in this engine;
  don't add a redundant boolean flag alongside a ball-name field, it can't disagree.
- `convertLastPotToFoul` pushes `prev.current` (the pre-conversion, wrongly-scored
  snapshot) onto `history`, not the true pre-shot snapshot — this is deliberate (one
  `undo()` reverts the *conversion*, a second reaches the true pre-shot state) and
  matches every other action's history-push convention. Don't "simplify" this to push
  `preShot` directly; that would break the one-undo-per-action invariant.
