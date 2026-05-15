# Scoreboard Feature — Developer Reference

## What this feature is

A full snooker scorekeeper built into the app. Three modes:

- **Match mode** — two players, tracks frames won, supports Best-of-N, single frame, or unlimited
- **Unlimited mode** — same as match but no automatic end; user taps "End ⏹" when done
- **Train mode** — solo practice, each break is one "frame", session never ends automatically

---

## File map

```
app/scoreboard/
  index.tsx          — setup screen (player names, reds, format, mode) + resume card
  game.tsx           — main game screen; default export is GameScreenWrapper (loads draft),
                       inner GameScreen holds all logic + useFocusEffect auto-save
  history.tsx        — rivalry cards list (matches tab) + training sessions (training tab)
  rivalry.tsx        — H2H detail screen: stats + session list + "New Session" button
  rules.tsx          — rules reference page

app/components/scoreboard/
  PlayerCard.tsx     — per-player score card (name, score, break, frames won)
  BallPad.tsx        — ball buttons + action buttons (end visit, foul, undo, concede)
  FoulModal.tsx      — foul value picker + who plays next
  FrameSummary.tsx   — end-of-frame overlay (scores, winner, next/end options)

app/components/
  Header.tsx         — persistent header; shows "← Home" inside /scoreboard/*, "▶ Play" elsewhere
                       Account button (🔑/👤) opens AuthCard modal
  AuthCard.tsx       — login/register/logout modal card; calls syncOnLogin on success
  BottomBar.tsx      — bottom nav; intercepts taps with Alert when isGameActive=true
  SideNav.tsx        — TV/tablet nav; same interception as BottomBar

hooks/
  useSnookerGame.ts  — pure state machine, all game logic lives here
                       accepts optional initialState?: GameState for resume

contexts/
  GameContext.tsx    — isGameActive / setGameActive; provider in _layout.tsx
  AuthContext.tsx    — global JWT auth state (user, loggedIn, doLogin, doRegister, doLogout)

services/
  gameStorage.ts     — AsyncStorage read/write for matches, sessions, draft; groupByRivalry()
  authService.ts     — JWT login/register/logout; tokens stored in SecureStore; auto-refresh
  scoreboardSyncService.ts — uploadMatch, downloadMatches, mergeServerMatchesLocally, syncOnLogin
```

---

## Save & Resume

### Problem solved
Accidental navigation away from the game screen (tapping a bottom bar item) previously reset all game state with no warning.

### Architecture

**Draft storage** (`gameStorage.ts`):
- Separate `sb_draft` AsyncStorage key — never touched by `loadAllMatches()` or history.tsx
- `GameDraft` interface: `{ params, state: GameState, savedAt }`
- `saveDraft / loadDraft / clearDraft`

**Global game-active flag** (`contexts/GameContext.tsx`):
- `isGameActive` / `setGameActive` — set true on screen focus, false on blur
- Provider wraps `<ThemedLayout>` in `_layout.tsx`

**Auto-save on blur** (`game.tsx` — `useFocusEffect`):
- On focus: `clearDraft()` (in-memory is authoritative), `setGameActive(true)`
- On blur: `setGameActive(false)`. If `matchSaved.current === false` AND game has progress (any score/break/frame result), saves a draft.
- `matchSaved.current` is set to `true` before any intentional navigation (handleEndMatch, handleMatchOver, handleTrainEndSession "End Session" onPress). This prevents saving a draft when the user explicitly ends.
- "Progress" check: `frameResults.length > 0 || scores[0] > 0 || scores[1] > 0 || currentBreak > 0` — prevents phantom resume cards from zero-state games.

**Wrapper component** (`game.tsx`):
- `GameScreenWrapper` (default export): loads draft on mount via `useEffect`; if `draft.params.id === params.id`, passes state as `initialState` to inner `GameScreen`. Shows blank background while loading (<50ms).
- `GameScreen` (internal): receives `initialState?: GameState`, passes to `useSnookerGame(config, initialState)`.

**Navigation interception** (`BottomBar.tsx`, `SideNav.tsx`):
- Reads `isGameActive` from context
- On tap: if active, shows `Alert("Game in progress — Leave / Stay")` before navigating
- `alertActive` ref (per-component) prevents double-firing the alert

**Contextual header button** (`Header.tsx`):
- Uses `usePathname()`. Inside `/scoreboard/*` → shows `← Home` (navigates to `/`). Otherwise shows `▶ Play`.

**Resume card** (`index.tsx`):
- `useFocusEffect` reloads draft every time the setup screen gains focus
- If draft exists: shows a card above the setup form with player names, mode, frame number
- Tapping card → pushes to `/scoreboard/game` with `draft.params` (same id as draft → wrapper loads state)
- "✕" dismiss button: calls `clearDraft()` + clears state
- `startMatch()`: calls `clearDraft()` before generating new id (user chose not to resume)

### What does NOT save a draft
- Train sessions with no progress (zero score, no breaks, no completed frames)
- After `handleEndMatch` / `handleMatchOver` / "End Session" in train mode
- When `FrameSummary` shows and user taps "Next Frame" then navigates (isFrameOver resets, state is after confirmFrameEnd)

### Resume with FrameSummary open
If the user navigated away while `isFrameOver=true` (FrameSummary was visible), the draft captures that state. On resume, `useEffect` watching `snap.isFrameOver` fires on mount and re-shows FrameSummary. The user can then confirm the frame end as normal.

---

## How a game starts (index.tsx → game.tsx)

`index.tsx` collects: `player1`, `player2`, `numberOfReds`, `bestOf`, then calls:

```
router.push({
  pathname: '/scoreboard/game',
  params: { id, player1, player2, numberOfReds, bestOf, mode }
});
```

`game.tsx` reads `params.bestOf`:
- `"train"` → `isTrainMode = true`, config `bestOf = 9999`
- `"unlimited"` → `isUnlimitedMode = true`, config `bestOf = 9999`
- `"single"` → `bestOf = null` (single frame)
- `"3"` / `"5"` / etc → `bestOf = parseInt(...)`

`index.tsx` also accepts optional params `prefillPlayer1` / `prefillPlayer2` — used when navigating from the rivalry detail "New Session" button to pre-fill player names.

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

## Unlimited mode specifics

| Behaviour | Implementation |
|---|---|
| No automatic end | `bestOf=9999` → target = 5000, unreachable |
| "End ⏹" button | Visible in game top-bar only when `isUnlimitedMode` |
| `handleUnlimitedEndMatch` | Saves only completed frames; ignores current in-progress frame |
| `StoredMatch.mode` | `'unlimited'` |
| Counts in rivalry stats | Yes — filtered same as `'match'` in `groupByRivalry` and `computePlayerStats` |

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

## Rivalry / H2H history

### Concept
Instead of a flat match list, completed matches are grouped by player pair into "rivalries".
X vs Y and Y vs X are the same rivalry (key is alphabetically sorted lowercase names).

### groupByRivalry (gameStorage.ts)
- Filters `StoredMatch` to match/unlimited modes with both player names set
- Groups by normalized pair key `"a|b"` (alphabetical)
- Display names taken from the chronologically earliest session
- Returns `RivalryGroup[]` sorted by most-recently-played

```typescript
interface RivalryGroup {
  key: string                   // "a|b" normalized
  player1: string               // display name
  player2: string
  matches: StoredMatch[]        // newest first
  lastPlayedAt: string
  matchesWon: [number, number]
  framesWon: [number, number]
  highestBreak: [number, number]
  totalSessions: number
}
```

### Navigation flow
```
history.tsx (rivalry cards)
  → tap card → rivalry.tsx (H2H stats + session list)
    → tap "New Session" → index.tsx with prefillPlayer1/prefillPlayer2 params
      → game.tsx → back to history.tsx on end
```

### Deleting sessions
Red "Delete" button on each session card in rivalry.tsx. Updates both local storage and in-memory state. Does not currently delete from cloud (backend) — cloud copy persists until next sync overwrites it.

---

## Cloud sync / Auth

### Architecture
- **Local-first**: AsyncStorage is always the primary store. Server is backup/sync.
- **JWT auth**: `authService.ts` — tokens in SecureStore (encrypted), auto-refresh 30 seconds before expiry.
- **Upload**: After each completed match, if logged in, `uploadMatch()` fires and forgets.
- **Sync on login**: `syncOnLogin()` downloads server matches, merges by match ID (newer completedAt wins), then uploads all local matches.

### Backend endpoints
```
POST   /oneFourSeven/auth/login/              → { access, refresh, user }
POST   /oneFourSeven/users/                   → register
POST   /oneFourSeven/auth/token/refresh/      → { access, refresh? }
DELETE /oneFourSeven/auth/delete-account/     → 204 (IsAuthenticated)
GET    /oneFourSeven/scoreboard/matches/      → list user's matches
POST   /oneFourSeven/scoreboard/matches/      → upsert by match_id
DELETE /oneFourSeven/scoreboard/matches/<id>/ → 204
GET    /oneFourSeven/account-deletion/        → public HTML page (Google Play)
```

### ScoreboardMatch model (Django)
```python
class ScoreboardMatch(models.Model):
    user     = ForeignKey(User, CASCADE, related_name='scoreboard_matches')
    match_id = CharField(max_length=64, db_index=True)   # frontend UUID
    data     = JSONField()                                # full StoredMatch blob
    created_at / updated_at = auto timestamps
    unique_together = ('user', 'match_id')
```

### Security
- Access token: 60-minute lifetime
- Refresh token: 30-day lifetime, rotates on use
- Tokens stored in SecureStore (never AsyncStorage)
- `device_tokens_view` locked to `IsAdminUser`
- Account deletion is immediate and cascades all ScoreboardMatch records

---

## Storage shape (gameStorage.ts)

```typescript
interface StoredMatch {
  id: string                              // UUID generated by generateMatchId()
  player1Name: string
  player2Name: string
  numberOfReds: number
  bestOf: number | null
  startedAt: string                       // ISO string
  completedAt?: string
  isComplete: boolean
  frameResults: FrameResult[]
  framesWon: [number, number]
  mode?: 'match' | 'train' | 'unlimited' // undefined = match (legacy)
}

interface GameDraft {
  params: {
    id: string
    player1: string
    player2: string
    numberOfReds: string   // string — raw URL params
    bestOf: string         // 'train' | 'unlimited' | 'single' | '3' | '5' | ...
  }
  state: GameState
  savedAt: string
}
```

Keys:
- `sb_match_<id>` — individual completed/in-progress match records
- `sb_match_index` — ordered list of match IDs
- `sb_draft` — single draft slot (only one game can be paused at a time)

`computePlayerStats` and `groupByRivalry` filter out train sessions.
`loadAllMatches` uses `sb_match_index` only — never reads `sb_draft`.

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

Expected: `✅ All N assertions passed` for each file — 907 total. If any fail, fix before deploying.

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
3. Confirm all 907 assertions still pass
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
