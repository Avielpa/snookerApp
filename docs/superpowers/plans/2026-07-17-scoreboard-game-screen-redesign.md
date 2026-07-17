# Scoreboard Game Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the scoreboard game screen (`app/scoreboard/game.tsx`) to the approved v3 design (unified brass-pinned score panel, restrained gold accents, felt-texture background, real landscape layout) without removing, hiding, or changing the behavior of any existing feature.

**Architecture:** Pure visual/layout refactor. Two new presentational components (`ScorePanel`, `FormRow`) replace inline JSX blocks in `game.tsx`; `BallPad`, `BreakChain`, and `scoreboardTheme.ts` get restyled in place. `useSnookerGame.ts` (game logic/state machine) is not touched — every prop passed into the restyled components is the same data that flows today.

**Tech Stack:** React Native + Expo (existing), `expo-linear-gradient` (already a dependency, used elsewhere — no native rebuild required), plain `View`-based bars (no `react-native-svg` — that's a deliberate existing constraint, see `MomentumGraph.tsx` header comment).

## Global Constraints

- Every one of the 9 portrait pieces and both landscape columns listed in the spec must keep rendering under the exact same conditions they do today (e.g. insight ticker only when `insightText` truthy, snooker ribbon only when a player is 2+ snookers behind, race tracker only when `bestOf` is a real number) — spec section "Non-goals", bullet 3.
- No new game-logic tests — this is a visual change, matching the precedent set by the earlier scroll-behavior fix in this same file (spec "Testing expectations").
- No `react-native-svg` dependency — spec inherits this from `MomentumGraph.tsx`'s existing design constraint.
- `eas update --channel preview` before `--channel production`, both requiring separate explicit user approval (CLAUDE.md).
- Existing `scoreboardColors` field names (`primary`, `textMuted`, etc.) are not renamed — only new fields are added — so unmodified consumers (`rules.tsx`, `history.tsx`, `rivalry.tsx`, `FoulModal`, `FrameSummary`) keep working untouched.

---

## File Structure

| File | Change |
|---|---|
| `FrontMaxBreak/constants/scoreboardTheme.ts` | Modify — add new tokens, adjust 2 existing values |
| `FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx` | **Create** — unified brass-pinned score panel (replaces `potBlock` + `cardsBlock` in `game.tsx`) |
| `FrontMaxBreak/app/components/scoreboard/FormRow.tsx` | **Create** — merged win-probability + momentum row (replaces `winProbBlock` + `momentumBlock`) |
| `FrontMaxBreak/app/components/scoreboard/BreakChain.tsx` | Modify — recolor to new tokens only, structure unchanged |
| `FrontMaxBreak/app/components/scoreboard/BallPad.tsx` | Modify — radial-gloss ball buttons, restyled action row |
| `FrontMaxBreak/app/scoreboard/game.tsx` | Modify — swap in `ScorePanel`/`FormRow`, restyle insight ticker/snooker ribbon/ad slot, rebuild landscape two-column layout |
| `FrontMaxBreak/app/components/scoreboard/PlayerCard.tsx` | **Delete** — fully superseded by `ScorePanel` (only used in `game.tsx`, confirmed via grep in the design phase) |

---

## Task 1: Add new design tokens to `scoreboardTheme.ts`

**Files:**
- Modify: `FrontMaxBreak/constants/scoreboardTheme.ts`

**Interfaces:**
- Produces: `ScoreboardColors.textSage: string`, `ScoreboardColors.borderGlass: string`, `ScoreboardColors.pinGold: string`, `ScoreboardColors.backgroundVignetteEnd: string` — consumed by every task below.

- [ ] **Step 1: Add the new fields to the interface and the object**

Edit `FrontMaxBreak/constants/scoreboardTheme.ts`:

```ts
export interface ScoreboardColors {
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  backgroundVignetteEnd: string; // NEW — darkest point of the radial background vignette
  cardBackground: string;
  cardBorder: string;
  borderGlass: string;           // NEW — translucent panel border (score panel, ad slot)
  textPrimary: string;
  textSecondary: string;
  textSage: string;              // NEW — cool secondary text, replaces textSecondary in restyled components
  textMuted: string;
  textHeader: string;
  primary: string;
  pinGold: string;                // NEW — brighter gold for corner pins / gloss highlights
  error: string;
}

export const scoreboardColors: ScoreboardColors = {
  background: '#0a2e21',
  backgroundSecondary: '#0a2a1f',
  backgroundTertiary: '#123526',
  backgroundVignetteEnd: '#072317',
  cardBackground: '#0f3527',
  cardBorder: '#2b5940',
  borderGlass: 'rgba(255,255,255,0.09)',
  textPrimary: '#f2ece0',
  textSecondary: '#b9b0a0',
  textSage: '#8b978d',
  textMuted: '#647069',
  textHeader: '#eccb7c',
  primary: '#c79a3e',
  pinGold: '#c7a45c',
  error: '#e0645f',
};
```

Note: `textMuted` changes from `#877e70` to `#647069` (spec table) — this is used today in `rules.tsx`, `history.tsx`, `rivalry.tsx`, `FoulModal`, `FrameSummary` as a muted-text color. This is an intentional, low-risk shift (one step darker within the same sage family, spec-approved) that will also apply there; no layout or logic in those files depends on the exact hex value, only on it being "the muted color."

- [ ] **Step 2: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors (interface is additive; `textMuted` is a value change, not a type change).

- [ ] **Step 3: Commit**

```bash
git add FrontMaxBreak/constants/scoreboardTheme.ts
git commit -m "feat: add scoreboard redesign color tokens"
```

---

## Task 2: Create `ScorePanel` (unified brass-pinned score panel)

**Files:**
- Create: `FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx`
- Delete: `FrontMaxBreak/app/components/scoreboard/PlayerCard.tsx` (in this task, once `ScorePanel` replaces its only caller in Task 6)

**Interfaces:**
- Consumes: `scoreboardColors` (Task 1's new fields), `BALL_VALUES`/nothing from game logic — pure display props.
- Produces:
```ts
interface ScorePanelProps {
  playerNames: [string, string];
  scores: [number, number];
  framesWon: [number, number];
  currentBreak: number;
  highestBreak: [number, number];
  currentPlayer: 0 | 1;
  pointsOnTable: number;
  isTrainMode: boolean;
  onEndVisit?: (forPlayer: 0 | 1) => void; // train mode has no second player, caller passes undefined
}
```
Default export `ScorePanel(props: ScorePanelProps)`.

- [ ] **Step 1: Write the component**

Create `FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx`:

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface ScorePanelProps {
  playerNames: [string, string];
  scores: [number, number];
  framesWon: [number, number];
  currentBreak: number;
  highestBreak: [number, number];
  currentPlayer: 0 | 1;
  pointsOnTable: number;
  isTrainMode: boolean;
  onEndVisit?: (forPlayer: 0 | 1) => void;
}

// Unified score panel — the redesign's signature element. Squared corners (deliberately
// breaking from the rounded language everywhere else) + 4 brass corner pins, styled like
// a physical nameplate on a scoreboard cabinet. Replaces the old 3-block layout
// (points-remaining card + 2 separate PlayerCards) with one panel — same data, same
// conditions, just visually merged. See docs/superpowers/specs/2026-07-17-scoreboard-game-screen-redesign-design.md.
export default function ScorePanel({
  playerNames, scores, framesWon, currentBreak, highestBreak, currentPlayer,
  pointsOnTable, isTrainMode, onEndVisit,
}: ScorePanelProps) {
  const c = scoreboardColors;

  function renderPlayer(idx: 0 | 1) {
    const isActive = currentPlayer === idx;
    const canTapToEndVisit = !isTrainMode && !isActive && !!onEndVisit;
    const inner = (
      <>
        <Text style={[styles.name, { color: isActive ? c.textHeader : c.textSage }]} numberOfLines={1}>
          {playerNames[idx]}
        </Text>
        <Text style={[styles.score, { color: isActive ? c.textHeader : c.textPrimary }]}>
          {scores[idx]}
        </Text>
        {!isTrainMode && (
          <Text style={[styles.meta, { color: c.textMuted }]}>
            Frames {framesWon[idx]}{highestBreak[idx] > 0 ? ` · Best ${highestBreak[idx]}` : ''}
          </Text>
        )}
        {isActive && currentBreak > 0 && (
          <View style={[styles.breakBadge, { backgroundColor: c.pinGold }]}>
            <Text style={styles.breakBadgeText}>Break {currentBreak}</Text>
          </View>
        )}
      </>
    );

    if (canTapToEndVisit) {
      return (
        <TouchableOpacity
          key={idx}
          style={[styles.playerCol, isActive && styles.playerColActive, idx === 0 && styles.borderRight]}
          activeOpacity={0.7}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEndVisit?.(idx); }}
        >
          {inner}
        </TouchableOpacity>
      );
    }
    return (
      <View key={idx} style={[styles.playerCol, isActive && styles.playerColActive, idx === 0 && styles.borderRight]}>
        {inner}
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: c.cardBackground, borderColor: c.borderGlass }]}>
      <View style={[styles.pin, styles.pinTL, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinTR, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinBL, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinBR, { backgroundColor: c.pinGold }]} />
      <View style={styles.scoreRow}>
        {renderPlayer(0)}
        {!isTrainMode && renderPlayer(1)}
      </View>
      <View style={[styles.potRow, { borderTopColor: c.borderGlass }]}>
        <Text style={[styles.potValue, { color: c.textPrimary }]}>{pointsOnTable}</Text>
        <Text style={[styles.potLabel, { color: c.textSage }]}>points remaining</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 6, // squared vs. the rest of the screen's rounded elements — the signature detail
    borderWidth: 1,
    overflow: 'hidden',
  },
  pin: { position: 'absolute', width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  pinTL: { top: 6, left: 6 },
  pinTR: { top: 6, right: 6 },
  pinBL: { bottom: 6, left: 6 },
  pinBR: { bottom: 6, right: 6 },
  scoreRow: { flexDirection: 'row' },
  playerCol: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  playerColActive: { backgroundColor: 'rgba(199,164,92,0.08)' },
  borderRight: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  name: { fontSize: 11, fontFamily: 'PoppinsBold', letterSpacing: 1, textTransform: 'uppercase' },
  score: { fontSize: 42, fontFamily: 'PoppinsBold', lineHeight: 48, marginTop: 4 },
  meta: { fontSize: 10, marginTop: 4 },
  breakBadge: { marginTop: 6, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 4 },
  breakBadgeText: { color: '#0a2a1f', fontSize: 10, fontFamily: 'PoppinsBold' },
  potRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.16)',
  },
  potValue: { fontSize: 24, fontFamily: 'PoppinsBold' },
  potLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
});
```

Note on the Fraunces serif font from the design spec: this app has no custom font files or `useFonts`/`expo-google-fonts` setup anywhere (confirmed by repo-wide search during the design phase — `PoppinsBold` has been silently falling back to the system font on every screen, not actually loading Poppins). Adding real font-loading infrastructure app-wide is out of scope for a score-digit accent per the spec's own fallback clause ("or fall back to a system serif if font loading turns out to be nontrivial"). This task uses `PoppinsBold` (i.e., system default, consistent with the rest of the app) for the score digits rather than introducing `expo-font` + `useFonts` + a new font asset as new infrastructure. If you want real Fraunces later, that's a separate follow-up task (add to `docs/OPEN_MISSIONS.md`, not silently done here).

- [ ] **Step 2: Delete the now-unused `PlayerCard.tsx`**

This happens once Task 6 removes its only import (`app/scoreboard/game.tsx`). Do it as part of Task 6's commit, not here — keeping the old component present and simply unused for one task avoids a broken intermediate state if tasks are reviewed independently.

- [ ] **Step 3: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors. `ScorePanel.tsx` isn't imported anywhere yet, so this only validates the file compiles standalone.

- [ ] **Step 4: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx
git commit -m "feat: add ScorePanel component for scoreboard redesign"
```

---

## Task 3: Create `FormRow` (merged win-probability + momentum)

**Files:**
- Create: `FrontMaxBreak/app/components/scoreboard/FormRow.tsx`

**Interfaces:**
- Consumes: existing `MomentumGraph` component (`app/components/scoreboard/MomentumGraph.tsx`, unchanged — still View-bar based, no svg).
- Produces:
```ts
interface FormRowProps {
  winProbability: [number, number] | null;
  momentumSeries: number[];
}
```
Default export `FormRow(props: FormRowProps)`. Returns `null` if both `winProbability` is null and `momentumSeries.length < 2` (matches today's combined visibility — each sub-piece already independently returns/renders nothing when not applicable, same rule, just co-located).

- [ ] **Step 1: Write the component**

Create `FrontMaxBreak/app/components/scoreboard/FormRow.tsx`:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';
import MomentumGraph from './MomentumGraph';

interface FormRowProps {
  winProbability: [number, number] | null;
  momentumSeries: number[];
}

// Merges the win-probability bar and momentum sparkline into one compact row instead of
// two separate stacked blocks — same two pieces of data, same rendering conditions as
// before, just grouped. MomentumGraph itself is untouched (still View-bar, not svg).
export default function FormRow({ winProbability, momentumSeries }: FormRowProps) {
  const c = scoreboardColors;
  const showWinProb = !!winProbability;
  const showMomentum = momentumSeries.length >= 2;
  if (!showWinProb && !showMomentum) return null;

  return (
    <View style={styles.row}>
      {showWinProb && (
        <>
          <Text style={[styles.pct, { color: c.textSage }]}>{winProbability![0]}%</Text>
          <View style={[styles.track, { backgroundColor: c.backgroundTertiary }]}>
            <View style={{ width: `${winProbability![0]}%`, backgroundColor: c.pinGold }} />
            <View style={{ width: `${winProbability![1]}%`, backgroundColor: '#7d1c2c' }} />
          </View>
          <Text style={[styles.pct, { color: c.textSage }]}>{winProbability![1]}%</Text>
        </>
      )}
      {showMomentum && (
        <View style={styles.sparkWrap}>
          <MomentumGraph series={momentumSeries} height={16} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, opacity: 0.9 },
  pct: { fontSize: 9, fontFamily: 'PoppinsBold' },
  track: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  sparkWrap: { width: 46 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/FormRow.tsx
git commit -m "feat: add FormRow component for scoreboard redesign"
```

---

## Task 4: Restyle `BreakChain.tsx` to new tokens

**Files:**
- Modify: `FrontMaxBreak/app/components/scoreboard/BreakChain.tsx`

**Interfaces:** unchanged — same `Props { breakBalls, currentBreak }`, same export. No caller changes needed beyond what Task 6 already does structurally.

- [ ] **Step 1: Swap colors to the new tokens**

Edit `FrontMaxBreak/app/components/scoreboard/BreakChain.tsx`:

```tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BallType } from '../../../hooks/useSnookerGame';
import { scoreboardColors, scoreboardBallColors } from '../../../constants/scoreboardTheme';

interface Props {
  breakBalls: BallType[];
  currentBreak: number;
}

export default function BreakChain({ breakBalls, currentBreak }: Props) {
  const c = scoreboardColors;
  if (breakBalls.length === 0) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.backgroundSecondary, borderColor: c.borderGlass }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {breakBalls.map((ball, i) => (
          <React.Fragment key={i}>
            <View style={[styles.chip, { backgroundColor: scoreboardBallColors[ball] }]} />
            {i < breakBalls.length - 1 && <Text style={[styles.arrow, { color: c.textMuted }]}>›</Text>}
          </React.Fragment>
        ))}
      </ScrollView>
      <Text style={[styles.total, { color: c.pinGold }]}>{currentBreak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  chip: { width: 17, height: 17, borderRadius: 9 },
  arrow: { fontSize: 9, marginHorizontal: 1 },
  total: { fontFamily: 'PoppinsBold', fontSize: 15, marginLeft: 10 },
});
```

Only the color source (`c.cardBorder` → `c.borderGlass`, `c.primary` → `c.pinGold`, hardcoded `'#0a2a1f'` → `c.backgroundSecondary`) changed — structure and props are identical, so this is a safe drop-in.

- [ ] **Step 2: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/BreakChain.tsx
git commit -m "style: recolor BreakChain to new scoreboard tokens"
```

---

## Task 5: Restyle `BallPad.tsx` — glossy ball buttons + restyled action row

**Files:**
- Modify: `FrontMaxBreak/app/components/scoreboard/BallPad.tsx`

**Interfaces:** unchanged — same `Props` interface, same export, same `onPot`/`onExtraRed`/`onMiss`/`onFoul`/`onUndo`/`onConcede`/`onFreeBall` callback signatures. Only the internal JSX/styling of the existing ball buttons and action row changes.

- [ ] **Step 1: Add `expo-linear-gradient` import and a per-ball gradient stop table**

Edit `FrontMaxBreak/app/components/scoreboard/BallPad.tsx` — add near the top, after existing imports:

```tsx
import { LinearGradient } from 'expo-linear-gradient';
```

Add after `const ALL_BALLS: BallType[] = [...]`:

```ts
// Two-stop gradient per ball for a glossy-sphere highlight instead of a flat fill —
// light stop top-left, base ball color everywhere else. Values match
// scoreboardBallColors exactly (same ball → same base color), just adding a highlight.
const BALL_GRADIENT: Record<BallType, [string, string]> = {
  red: ['#e8544f', '#8f1526'],
  yellow: ['#ffe27a', '#b9891c'],
  green: ['#3fb867', '#0e4d26'],
  brown: ['#a06b3f', '#452b16'],
  blue: ['#4a80d6', '#163665'],
  pink: ['#f5b6cd', '#b95f80'],
  black: ['#3a3a3a', '#000000'],
};
```

- [ ] **Step 2: Replace the flat-color ball button with a `LinearGradient` fill**

Replace the ball-button `TouchableOpacity` block inside the `ballRow` map:

```tsx
{ALL_BALLS.map(ball => (
  <TouchableOpacity
    key={ball}
    onPress={() => handlePot(ball)}
    disabled={!isEnabled(ball)}
    activeOpacity={0.7}
    style={[styles.ballButton, { opacity: getOpacity(ball) }]}
  >
    <LinearGradient
      colors={BALL_GRADIENT[ball]}
      start={{ x: 0.3, y: 0.25 }}
      end={{ x: 0.75, y: 0.9 }}
      style={[
        styles.ballGradient,
        { borderWidth: ball === 'black' ? 2 : 0, borderColor: ball === 'black' ? '#555' : undefined },
        isEnabled(ball) && styles.ballEnabled,
      ]}
    >
      <Text style={[styles.ballPts, { color: ball === 'yellow' || ball === 'green' ? '#000' : '#fff' }]}>
        {BALL_VALUES[ball]}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
))}
```

- [ ] **Step 3: Split the old `ballButton` style into an outer sizing style + inner gradient style**

Replace in `const styles = StyleSheet.create({...})`:

```ts
ballButton: {
  flex: 1,
  aspectRatio: 1,
  maxWidth: 52,
  maxHeight: 52,
},
ballGradient: {
  flex: 1,
  borderRadius: 100,
  alignItems: 'center',
  justifyContent: 'center',
},
```

(Remove the old single `ballButton` block that combined sizing + fill + border-radius — sizing now lives on the outer `TouchableOpacity`, fill/radius on the inner `LinearGradient`.)

- [ ] **Step 4: Restyle the action row buttons to use the new glass-border language**

Replace the four `actionBtn` `TouchableOpacity`s' color props (function bodies/handlers unchanged) — only the `style` prop's color values change, using `scoreboardColors`:

```tsx
<TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]} onPress={onMiss}>
  <Text style={[styles.actionText, { color: c.textSage }]}>
    {trainMode ? 'End Break' : 'End Visit'}
  </Text>
</TouchableOpacity>

<TouchableOpacity style={[styles.actionBtn, { backgroundColor: 'rgba(224,100,95,0.14)' }]} onPress={onFoul}>
  <Text style={[styles.actionText, { color: c.error }]}>Foul</Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)', opacity: canUndo ? 1 : 0.35 }]}
  onPress={onUndo}
  disabled={!canUndo}
>
  <Text style={[styles.actionText, { color: c.textSage }]}>↩ Undo</Text>
</TouchableOpacity>

<TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.pinGold }]} onPress={onConcede}>
  <Text style={[styles.actionText, { color: '#0a2a1f', fontWeight: '700' }]}>
    {trainMode ? 'End Session' : 'Concede'}
  </Text>
</TouchableOpacity>
```

The Concede button becomes the pad's one primary-gold CTA per the spec ("gold restricted to ... the one primary CTA").

- [ ] **Step 5: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual visual check**

Run: `cd FrontMaxBreak && npx expo start`, open the scoreboard, start a match, confirm:
- All 7 ball buttons render with a visible gradient highlight, correct enabled/disabled opacity still works (pot a red, confirm colors gray out correctly per `isEnabled`)
- Extra-red button still appears/functions when applicable (untouched code path)
- All 4 action buttons still fire their existing handlers (End Visit, Foul, Undo, Concede/End Session)

- [ ] **Step 7: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/BallPad.tsx
git commit -m "style: glossy gradient ball buttons + restyled action row"
```

---

## Task 6: Integrate into `game.tsx` — portrait layout

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx`
- Delete: `FrontMaxBreak/app/components/scoreboard/PlayerCard.tsx`

**Interfaces:**
- Consumes: `ScorePanel` (Task 2), `FormRow` (Task 3), restyled `BreakChain`/`BallPad` (Tasks 4-5), new `scoreboardTheme.ts` tokens (Task 1).

This is the task that proves nothing broke — capture the BEFORE snapshot in Step 1 before touching any code.

- [ ] **Step 1: BEFORE snapshot — record current conditional-render behavior**

Before editing, open `FrontMaxBreak/app/scoreboard/game.tsx` and note (for the AFTER diff in Step 6) the exact conditions currently gating each block, read from the existing code:

```
insightTicker   : renders iff insightText is truthy
raceTracker     : renders iff !isTrainMode (FrameRaceTracker itself also no-ops if bestOf===null||>=9999)
BannerAdSlot    : always renders (no condition)
potBlock/cardsBlock : always render (train mode renders single PlayerCard; match mode renders both)
breakChainBlock : renders iff !snap.isFrameOver (BreakChain itself also no-ops if breakBalls.length===0)
winProbBlock    : renders iff winProbability && !snap.isFrameOver
momentumBlock   : renders iff !snap.isFrameOver && momentumSeries.length >= 2
snookerBlock    : renders iff !isTrainMode && !snap.isFrameOver && trailerIdx !== null (2+ snookers behind)
ballPadBlock    : always renders
```

This list is what Step 6's manual pass re-verifies after the refactor.

- [ ] **Step 2: Replace `import PlayerCard from '../components/scoreboard/PlayerCard';` with the new imports**

In the import block near the top of `game.tsx`:

```tsx
import ScorePanel from '../components/scoreboard/ScorePanel';
import FormRow from '../components/scoreboard/FormRow';
```

Remove the `import PlayerCard from '../components/scoreboard/PlayerCard';` line entirely.

- [ ] **Step 3: Replace `potBlock` + `cardsBlock` with a single `scorePanelBlock`**

Find and remove the `potBlock` and `cardsBlock` `const` declarations (the `View`/`PlayerCard` JSX for points-remaining and the two player cards). Replace with:

```tsx
const scorePanelBlock = (
  <ScorePanel
    playerNames={playerNames}
    scores={snap.scores}
    framesWon={framesWon}
    currentBreak={snap.currentBreak}
    highestBreak={frameHighestBreak}
    currentPlayer={snap.currentPlayer}
    pointsOnTable={snap.pointsOnTable}
    isTrainMode={isTrainMode}
    onEndVisit={(forPlayer) => endVisit()}
  />
);
```

`onEndVisit` in the old code only fired for the *non-active* player's card and always called the same `endVisit` function regardless of which card was tapped (see the original `onEndVisit={snap.currentPlayer === 1 ? endVisit : undefined}` pattern) — `ScorePanel` already gates "only the inactive player's card is tappable" internally via its own `isActive` check, so the wrapper here can safely just call `endVisit()` whenever it's invoked.

- [ ] **Step 4: Replace `winProbBlock` + `momentumBlock` with a single `formRowBlock`**

Remove the `winProbBlock` and `momentumBlock` `const` declarations. Replace with:

```tsx
const formRowBlock = !snap.isFrameOver && (
  <FormRow winProbability={winProbability} momentumSeries={momentumSeries} />
);
```

- [ ] **Step 5: Update the portrait and landscape render trees to use the renamed blocks**

In the portrait `return (<ScrollView>...)` block (from the earlier scroll fix) and the landscape `return (<View style={styles.landscapeRow}>...)` block, replace every occurrence of `{potBlock}` and `{cardsBlock}` with `{scorePanelBlock}`, and every occurrence of `{winProbBlock}` and `{momentumBlock}` with `{formRowBlock}`. `{breakChainBlock}` and `{snookerBlock}` keep their existing names — only their internal styling changed in Tasks 4 and via the ribbon restyle below.

- [ ] **Step 6: Restyle the insight ticker to a compact chip and the snooker banner to a left-accented ribbon**

Replace the insight ticker `View` (currently `styles.insightTicker`, full-width banner look):

```tsx
{insightText && (
  <View style={[styles.insightChip, { backgroundColor: 'rgba(199,164,92,0.07)', borderColor: 'rgba(199,164,92,0.22)' }]}>
    <Text style={[styles.insightChipText, { color: c.textHeader }]}>💡 {insightText}</Text>
  </View>
)}
```

Replace the `snookerBlock`'s `TouchableOpacity` `style` array (condition/handler/text content unchanged, only the style object changes):

```tsx
style={[styles.snookerRibbon, { backgroundColor: 'rgba(199,164,92,0.06)', borderColor: 'rgba(199,164,92,0.4)' }]}
```

Add to the `StyleSheet.create({...})` at the bottom of `game.tsx`, and remove the old `insightTicker`/`insightTickerText`/`snookerBanner` entries:

```ts
insightChip: {
  marginHorizontal: 16,
  marginTop: 8,
  borderWidth: 1,
  borderRadius: 8,
  paddingHorizontal: 10,
  paddingVertical: 6,
},
insightChipText: { fontSize: 11, fontFamily: 'PoppinsBold' },
snookerRibbon: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginHorizontal: 16,
  marginTop: 10,
  paddingHorizontal: 12,
  paddingVertical: 9,
  borderRadius: 4,
  borderWidth: 1,
  borderLeftWidth: 3,
},
```

(Keep `snookerBannerText`/`snookerBannerBtn` styles as-is — only the outer container style changed.)

- [ ] **Step 7: Delete `PlayerCard.tsx`**

```bash
git rm FrontMaxBreak/app/components/scoreboard/PlayerCard.tsx
```

- [ ] **Step 8: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors, no unresolved `PlayerCard` import anywhere (confirms Step 7's deletion had no other callers, matching what was confirmed during the design/brainstorming phase).

- [ ] **Step 9: AFTER snapshot — manual pass against the BEFORE list**

Run: `cd FrontMaxBreak && npx expo start`, open the scoreboard in portrait on an emulator/device. For each row in Step 1's table, force the condition and confirm the same render/no-render behavior:
- Trigger an insight (play a shot that produces one) → chip appears; no insight → chip absent (same as before)
- Best-of match → race pips show; unlimited/single-frame/train mode → race tracker absent (same as before)
- Ad slot → always visible (same as before)
- Score panel → always visible, single-player layout in train mode, two-player in match mode (same as before)
- Pot a red then a color to build a break → break chain appears with correct ball dots; undo back to 0 break → break chain disappears (same as before, `breakBalls.length===0` check untouched)
- Win prob / momentum → both show together once 2+ shots logged in a real match, absent in train mode or before frame has data (same as before)
- Get a player 2+ snookers behind → ribbon appears with correct names/count and still opens the same "End Frame" `Alert` on tap → absent otherwise (same as before)

Every item must match the BEFORE list exactly — if anything differs, stop and fix before proceeding (this is the rule-11b diff check).

- [ ] **Step 10: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "feat: integrate ScorePanel and FormRow into scoreboard portrait layout"
```

---

## Task 7: Rebuild the landscape layout — two columns, right column fixed, left column independently scrollable

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx`

**Interfaces:** no new props/components — restructures the existing `isLandscape` branch using blocks already defined in Task 6 (`scorePanelBlock`, `breakChainBlock`, `formRowBlock`, `snookerBlock`, `ballPadBlock`) plus the insight ticker / race tracker / `BannerAdSlot` JSX that currently sits above the portrait/landscape branch.

- [ ] **Step 1: Move the insight ticker / race tracker / ad banner into per-orientation blocks**

Currently these three pieces render once, above the `isLandscape` conditional. Wrap the ticker/tracker/ad JSX (already restyled in Task 6 Step 6) into a `const topInfoBlock = (<>...</>)` fragment right before the `isLandscape` check, so both branches can place it:

```tsx
const topInfoBlock = (
  <>
    {insightText && (
      <View style={[styles.insightChip, { backgroundColor: 'rgba(199,164,92,0.07)', borderColor: 'rgba(199,164,92,0.22)' }]}>
        <Text style={[styles.insightChipText, { color: c.textHeader }]}>💡 {insightText}</Text>
      </View>
    )}
    {!isTrainMode && (
      <View style={styles.raceTrackerWrap}>
        <FrameRaceTracker framesWon={framesWon} bestOf={config.bestOf} />
      </View>
    )}
    <BannerAdSlot />
  </>
);
```

Remove this JSX from wherever it currently sits unconditionally in the render tree (both the pre-Task-6 top-level spot and the portrait `ScrollView` from Task 6 Step 6 — it now only exists here, referenced by both branches below).

- [ ] **Step 2: Update the portrait branch to use `topInfoBlock`**

The portrait `ScrollView` from the earlier scroll fix becomes:

```tsx
if (isLandscape) {
  // ... (Step 3 below)
}

return (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
    {topInfoBlock}
    {scorePanelBlock}
    {breakChainBlock}
    {formRowBlock}
    {snookerBlock}
    <View style={{ flex: 1 }} />
    {ballPadBlock}
    <View style={{ height: insets.bottom }} />
  </ScrollView>
);
```

- [ ] **Step 3: Rewrite the landscape branch — scrollable left column, fixed right column**

Replace the entire `if (isLandscape) { return (...) }` block with:

```tsx
if (isLandscape) {
  return (
    <View style={styles.landscapeRow}>
      <ScrollView
        style={[styles.landscapeColumn, { paddingLeft: insets.left }]}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {topInfoBlock}
        {scorePanelBlock}
        {breakChainBlock}
        {formRowBlock}
        {snookerBlock}
      </ScrollView>
      <View style={[styles.landscapeColumn, styles.landscapeRightColumn, { paddingRight: insets.right }]}>
        {ballPadBlock}
        <View style={{ height: insets.bottom }} />
      </View>
    </View>
  );
}
```

The right column (`ballPadBlock`) stays a plain `View`, never a `ScrollView` — this is the fix for the original "landscape is unusable" complaint: the ball pad can never be pushed off-screen or cramped regardless of how much the left column's content grows, because only the left column scrolls.

- [ ] **Step 4: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual pass — landscape, small-phone floor**

Run: `cd FrontMaxBreak && npx expo start`, open on an emulator set to a small-phone landscape resolution (~640×360 logical px, e.g. a Pixel 4a or similar rotated). Confirm:
- Ball pad (all 7 balls + action row) is fully visible and tappable without any scrolling, at all times
- Left column content (score panel, break chain, form row, snooker ribbon when applicable, ad, ticker, race pips) is all reachable by scrolling the left column only
- Rotating mid-game (portrait → landscape → portrait) preserves game state (this is state-machine behavior, untouched by this plan, but must still visibly work since the component tree remounts on orientation change)

- [ ] **Step 6: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "feat: rebuild scoreboard landscape layout with independently-scrolling left column"
```

---

## Task 8: Apply background vignette + run full regression pass

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx` (root `View` background)

**Interfaces:** none — final visual polish + the full before/after test run the user asked for.

- [ ] **Step 1: Swap the flat background for the radial vignette**

`expo-linear-gradient`'s `LinearGradient` doesn't do radial gradients; achieve the vignette with a `LinearGradient` from `c.background` to `c.backgroundVignetteEnd` top-to-bottom (close enough to the mockup's radial look without adding a new dependency). Replace the root `View`'s plain `backgroundColor` with a wrapping `LinearGradient`:

```tsx
import { LinearGradient } from 'expo-linear-gradient';

// ... in the component's return:
<LinearGradient
  colors={[c.background, c.backgroundVignetteEnd]}
  style={[styles.root, { paddingTop: insets.top }]}
>
  {/* existing children unchanged */}
</LinearGradient>
```

Remove the old `{ backgroundColor: c.background, paddingTop: insets.top }` inline style object from the root `View` (the `View` becomes unnecessary here — `LinearGradient` renders as the container itself, so this is a tag rename + prop swap, not a new wrapper level).

- [ ] **Step 2: Typecheck**

Run: `cd FrontMaxBreak && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Run the FULL existing test suite — BEFORE comparison baseline**

This confirms the redesign (which touches zero files under `hooks/useSnookerGame.ts` or `services/`) has zero effect on game logic. Run:

```bash
cd FrontMaxBreak
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```

Expected: `✅ All N assertions passed` for all six files, `1039` total — identical to the pre-redesign baseline (these tests don't touch any file this plan modifies, so this run doubles as both the "before" and "after" confirmation in one command; run it now and again in Step 4 to prove nothing regressed across the whole task sequence).

- [ ] **Step 4: Re-run the full suite once more after all 8 tasks are complete, diff against Step 3**

```bash
cd FrontMaxBreak
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```

Expected: identical `1039`/`1039` result. Any difference means something outside this plan's intended scope broke — stop and investigate before shipping.

- [ ] **Step 5: Full manual feature pass — every button, both orientations**

Using `npx expo start`, play one full training-mode break and one full match-mode frame (best-of-1 is fastest), covering every interactive control on the screen:
- Back button → confirms the "Leave?" alert, Stay/Leave both work
- Rules icon → navigates to `/scoreboard/rules` and back
- End ⏹ (match mode only) → confirms abandon/end-match alert
- All 7 ball buttons (pot each color at least once across the session)
- Extra-red button (pot 2+ reds in one visit in match mode to trigger it)
- End Visit / End Break
- Foul → opens `FoulModal`, confirm/cancel both work
- Undo (after at least one potted ball, confirm it's enabled; confirm disabled state at history start)
- Concede / End Session
- Score-panel tap-to-end-visit (tap the inactive player's card)
- Frame summary modal appears at frame end, Next Frame / End Match both work
- Rotate the device mid-frame at least twice, confirm no crash and state is preserved
- Resume flow: back out mid-game, confirm the resume card appears on `/scoreboard`, confirm resuming lands back in the same state

Expected: every control produces the same result it did before this plan (same handlers, same state machine — only styling changed). Any behavioral difference is a bug introduced by this plan and must be fixed before shipping, not deferred.

- [ ] **Step 6: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "style: apply radial background vignette to scoreboard game screen"
```

---

## Task 9: Ship to preview (production requires separate explicit approval)

**Files:** none — deployment step.

- [ ] **Step 1: Publish to preview**

```bash
cd FrontMaxBreak
npx eas update --channel preview --message "redesign: scoreboard game screen visual overhaul + landscape rebuild"
```

- [ ] **Step 2: Ask the user to test on a real preview-APK device**

Confirm: portrait scroll behavior, landscape two-column behavior on their actual phone (not just an emulator), and that the visual direction matches the approved v3 mockup before requesting `--channel production`.

Per CLAUDE.md, do **not** run `--channel production` until the user explicitly approves after this preview test — this step is a hard stop, not a formality.

---

## Self-Review Notes

- **Spec coverage:** every spec section (tokens table, signature element, portrait's 9 pieces, landscape two-column + independent scroll, responsive floor, non-goals) maps to a task above. The Fraunces font item from the spec's "type pairing" row is explicitly resolved (not left as a placeholder) in Task 2 Step 1's note — using the system-fallback path the spec itself allowed, since the app has no existing font-loading infrastructure to extend.
- **Placeholder scan:** no TBD/TODO markers; every step has real, complete code.
- **Type consistency:** `ScorePanelProps`/`FormRowProps` field names match exactly between their Task 2/3 definitions and their Task 6 call sites (`playerNames`, `scores`, `framesWon`, `currentBreak`, `highestBreak`, `currentPlayer`, `pointsOnTable`, `isTrainMode`, `onEndVisit`, `winProbability`, `momentumSeries`).
- **Deletion safety:** `PlayerCard.tsx`'s only caller (`game.tsx`) is confirmed via the grep run during the design/brainstorming phase (four files matched: `game.tsx`, `PlayerCard.tsx` itself, `scoreboardTheme.ts` doesn't reference it, `docs/SCOREBOARD.md` only mentions it in prose) — safe to delete once Task 6 removes the import.
