# Scoreboard Feature — Developer Reference

## What this feature is

A full snooker scorekeeper built into the app. Two modes:

- **Match mode** — two players, tracks frames won, supports Best-of-N or single frame
- **Train mode** — solo practice, each break is one "frame", session never ends automatically

---

## File map

```
app/scoreboard/
  index.tsx          — setup screen (player names, reds, format, mode)
  game.tsx           — main game screen (the scoreboard UI)
  history.tsx        — match/session history with tab toggle
  rules.tsx          — rules reference page

app/components/scoreboard/
  PlayerCard.tsx     — per-player score card (name, score, break, frames won)
  BallPad.tsx        — ball buttons + action buttons (end visit, foul, undo, concede)
  FoulModal.tsx      — foul value picker + who plays next
  FrameSummary.tsx   — end-of-frame overlay (scores, winner, next/end options)

hooks/
  useSnookerGame.ts  — pure state machine, all game logic lives here

services/
  gameStorage.ts     — AsyncStorage read/write for matches and sessions
```

---

## How a game starts (index.tsx → game.tsx)

`index.tsx` collects: `player1`, `player2`, `numberOfReds`, `bestOf` (or `"single"` or `"train"`), then calls:

```
router.push({
  pathname: '/scoreboard/game',
  params: { id, player1, player2, numberOfReds, bestOf }
});
```

`game.tsx` reads `params.bestOf`:
- `"train"` → `isTrainMode = true`, config `bestOf = 9999` (target = 5000, never reachable)
- `"single"` → `bestOf = null` (single frame, match over after 1 frame)
- `"3"` / `"5"` / etc → `bestOf = parseInt(...)`

---

## useSnookerGame — state machine

**Key types**

```typescript
type GamePhase    = 'reds' | 'colors'
type AwaitingType = 'red' | 'color'

interface FrameSnapshot {
  scores: [number, number]
  currentBreak: number
  currentPlayer: 0 | 1
  pointsOnTable: number
  phase: GamePhase
  redsRemaining: number
  awaiting: AwaitingType
  colorsRemaining: BallType[]   // shrinks in colors phase; full 6 in reds phase
  isFrameOver: boolean
  freeBallActive: boolean       // true after declareFreesBall(); reset by every action
}
```

**Actions (all return new state, no mutation)**

| Action | Effect |
|---|---|
| `potBall(ball)` | Adds points, updates awaiting/phase/redsRemaining. **No-op if `freeBallActive`** |
| `addExtraRed()` | For multiple reds on one shot — score +1, redsRemaining -1, awaiting stays `'color'`. **No-op if `freeBallActive`** |
| `endVisit()` | Switches player, resets `currentBreak` to 0, **awaiting carries over**, resets `freeBallActive` |
| `applyFoul(value, opponentPlays)` | Gives points to opponent; **awaiting is NEVER reset**; resets `freeBallActive` |
| `declareFreesBall()` | Sets `freeBallActive = true`, pushes to history (undoable) |
| `applyFreeBall(nominatedBall)` | Scores on-ball value, advances state correctly, resets `freeBallActive` |
| `undo()` | Pops last snapshot from history stack |
| `concede()` | Sets `isFrameOver = true`, resets `freeBallActive` |
| `confirmFrameEnd(winner, nextBreakerOverride?)` | Saves result, resets frame, increments frame number |

**pointsOnTable formula**

```
reds phase, awaiting=red:   redsRemaining * 8 + 27
reds phase, awaiting=color: 7 + redsRemaining * 8 + 27
colors phase:               sum of colorsRemaining values
```

**CRITICAL: awaiting state rules**

1. `potBall('red')` → awaiting = `'color'`
2. `potBall(color)` in reds phase (redsRemaining > 0) → awaiting = `'red'`
3. `potBall(color)` in reds phase (redsRemaining === 0) → transitions to colors phase
4. `endVisit()` → awaiting **carries over unchanged** to next player
5. `applyFoul()` → awaiting **stays unchanged**
6. Colors phase: awaiting is irrelevant; only `colorsRemaining[0]` matters

---

## Free ball

### When it applies

After a foul, if the incoming player is snookered (can't hit both sides of the on-ball), they may be awarded a free ball. Any ball can be nominated as the free ball for that shot only.

### UI flow

1. `FoulModal` confirms foul value + who plays next
2. If opponent plays, `game.tsx` shows an Alert: **"Free ball available?"**
3. "Yes" → calls `declareFreesBall()` → `freeBallActive = true`
4. `BallPad` detects `freeBallActive`: all 7 balls light up, status label reads **"Free ball — tap to nominate any ball"**
5. Player taps any ball → `applyFreeBall(nominatedBall)` is called
6. `freeBallActive` resets to `false`; break continues normally

### Scoring rules (applyFreeBall)

| Situation | Points scored | redsRemaining | Next awaiting |
|---|---|---|---|
| reds phase, `awaiting=red` | **1** (always — on-ball is red) | **unchanged** (free ball respotted) | `'color'` |
| reds phase, `awaiting=color` | `BALL_VALUES[nominatedBall]` | unchanged | `'red'` (or colors phase if reds=0) |
| colors phase | `BALL_VALUES[colorsRemaining[0]]` (on-color's value, NOT nominated ball's) | — | sequence advances (slice) |

**Key invariant**: when the on-ball is a red and the free ball is potted, `redsRemaining` does NOT decrement. The nominated ball is respotted; the actual red is still on the table. This is the critical difference from `potBall('red')`.

### getAvailableBalls when freeBallActive

```typescript
if (snap.freeBallActive) return [...COLORS_SEQUENCE, 'red']; // all 7 balls
```

`isFrameOver` still takes priority (returns `[]`).

### Guards that protect other actions

- `potBall` — returns `prev` immediately if `freeBallActive` (use `applyFreeBall` instead)
- `addExtraRed` — returns `prev` immediately if `freeBallActive`
- `endVisit`, `applyFoul`, `concede`, `addExtraRed` — all explicitly set `freeBallActive: false`
- `declareFreesBall` and `applyFreeBall` are both undoable (each pushes to history)

### Extra red button hidden during free ball

`BallPad` hides the extra-red button when `freeBallActive` is true:

```typescript
const showExtraRed = phase === 'reds' && awaiting === 'color'
  && redsRemaining > 0 && !trainMode && !freeBallActive;
```

---

## Critical bug that was fixed

**Bug**: `applyFoul` was resetting `awaiting` to `'red'` when `phase==='reds' && redsRemaining>0`, even when a red had already been potted that visit (awaiting=`'color'`). This let the wrong player pot a red instead of a required color.

**Fix** (in `useSnookerGame.ts`, `applyFoul` function):
```typescript
// WRONG — was:
const newAwaiting = snap.phase === 'reds' && snap.redsRemaining > 0 ? 'red' : snap.awaiting;

// CORRECT — now:
const newAwaiting: AwaitingType = snap.awaiting; // never reset by a foul
```

---

## Train mode specifics

| Behaviour | Implementation |
|---|---|
| Session never ends | `bestOf=9999` → target = 5000, unreachable |
| Player 0 always breaks | `confirmFrameEnd(winner, 0)` — nextBreakerOverride=0 |
| "End Break" = miss | `onMiss={concede}` in BallPad |
| "End Session" button | `handleTrainEndSession()` — saves completed breaks, ignores current break in progress |
| sessionBest | `state.frameResults.reduce((best, fr) => Math.max(best, fr.highestBreak[0]), 0)` |
| History tab | Separate "Training" tab in `history.tsx`, filtered by `m.mode === 'train'` |
| Saves to storage | `StoredMatch` with `mode: 'train'`, `bestOf: null` |
| Extra red button | Hidden in train mode (`showExtraRed = !trainMode`) |
| Free ball | Works identically — same logic, no train-specific behaviour |

---

## Match mode specifics

- **Alternating breaker**: frame 1 = P0, frame 2 = P1, frame 3 = P0, …
  - Formula in `confirmFrameEnd`: `(frameNumber % 2 === 0) ? 0 : 1`
- **Match over trigger**: `framesWon[i] >= Math.ceil(bestOf / 2)`
- **Single frame** (`bestOf=null`): match over immediately after 1 frame
- **Frame summary** shown when `snap.isFrameOver` flips true — rendered via `FrameSummary` modal
- **Snookers needed banner**: shows when a player needs snookers to win the frame

---

## FrameSummary modal

Triggered by `useEffect` watching `snap.isFrameOver`. Passes:
- `winner` (calculated from scores, or player 0 in train mode)
- `isMatchOver` flag
- `onNextFrame` → calls `confirmFrameEnd(pendingWinner, isTrainMode ? 0 : undefined)`
- `onEndMatch` → persists to storage and navigates to history

---

## Storage shape (gameStorage.ts)

```typescript
interface StoredMatch {
  id: string
  player1Name: string
  player2Name: string
  numberOfReds: number
  bestOf: number | null
  startedAt: string         // ISO string
  completedAt?: string
  isComplete: boolean
  frameResults: FrameResult[]
  framesWon: [number, number]
  mode?: 'match' | 'train'  // undefined = match (legacy)
}
```

`computePlayerStats` filters out train sessions: `(!m.mode || m.mode === 'match')`.

---

## Test suite

Four test files at `FrontMaxBreak/` root — run with Node.js, no React needed:

```bash
node game_test.mjs      # 326 assertions, 29 sections — full match mode + game logic
node train_test.mjs     # 51 assertions — train mode + computeTrainingStats
node mega_test.mjs      # 430 assertions — edge cases train+match, all formulas
node freeball_test.mjs  # 100 assertions — free ball in all situations
```

**Run all:**
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs
```

Expected: `✅ All N assertions passed` for each file. If any fail, fix before deploying.

**What's covered:**
- Every ball value and awaiting transition
- pointsOnTable formula at every red count (0–15), both awaiting states, colors phase step-by-step
- Foul bug fix verified (awaiting=color preserved across foul)
- addExtraRed: multiple consecutive, guard conditions, pointsOnTable updates
- endVisit: preserves phase/redsRemaining/colorsRemaining/awaiting/scores
- Undo: deep chains (10+ levels), after foul, after endVisit, after extra red, after declareFreesBall, after applyFreeBall
- Match formats: BO1/BO3/BO5/BO7/BO9 — all win conditions, alternating breaker
- Train mode: bestOf=9999 never ends, player 0 always breaks, sessionBest
- computeTrainingStats: empty, thresholds (25/50), multi-session aggregation
- computePlayerStats: player as P1/P2, win rate, train excluded, incomplete excluded
- 147 maximum break verified
- 1-red, 2-red, 3-red, 6-red, 10-red, 15-red configurations
- colorsRemaining immutability (old references unaffected by pots)
- Free ball: all phases (reds awaiting=red, reds awaiting=color, colors), all nominated balls, redsRemaining invariant, pointsOnTable, undo chain, guard conditions, full frame sequences

---

## How to add a feature

**New ball action:**
1. Add logic to `useSnookerGame.ts` — new `useCallback` function
2. Export from `return { ..., newAction }`
3. Destructure in `game.tsx`
4. Wire up in `BallPad.tsx` (new prop + button)
5. Add test cases to `game_test.mjs` or a new test file

**New match format** (e.g. race-to-X):
- Modify `confirmFrameEnd` in `useSnookerGame.ts` — the `isMatchOver` check
- Update `index.tsx` setup options

**Fixing a scoring bug**:
1. Write a failing test first in `game_test.mjs`
2. Fix the logic in `useSnookerGame.ts`
3. Confirm all 907+ assertions still pass
4. Deploy: `npx eas update --channel preview --message "..."` then production

---

## Deploy commands (from FrontMaxBreak/)

```bash
# JS changes only (OTA — no app store review needed)
npx eas update --channel preview --message "description"
npx eas update --channel production --message "description"

# Native changes (new APK/AAB)
eas build --profile preview --platform android
eas build --profile production --platform android
```

Always preview before production.
