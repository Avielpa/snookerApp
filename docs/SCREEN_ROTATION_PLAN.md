# Plan: Screen Rotation Support (Game Screen)

## Context
The app is globally locked to portrait via `app.json` `"orientation": "portrait"`. The user wants to be able to rotate the device while using the scoreboard game screen. No third-party native module is needed — React Native's built-in `useWindowDimensions()` is sufficient to detect orientation and adapt layouts.

**This requires one native build** — the orientation lock is baked into the Android manifest at compile time. OTA alone cannot fix this.

---

## Approach
1. Change `app.json` orientation to `"default"` (allows all orientations at OS level)
2. In the game screen, use `useWindowDimensions()` to detect landscape (`width > height`) and render a split-screen layout
3. Fix `PlayerCard.tsx` so `minHeight: 140` doesn't overflow the left column in landscape
4. No new packages, no new files — changes are contained to 3 existing files

**Note**: Other screens will also be rotatable after this change, but they use flex-based layouts that already adapt. Only the game screen gets a custom landscape design.

---

## Files to Change

### 1. `FrontMaxBreak/app.json`
- Line 6: `"orientation": "portrait"` → `"orientation": "default"`

### 2. `FrontMaxBreak/app/scoreboard/game.tsx`
At the top of `GameScreen` component:
```ts
const { width, height } = useWindowDimensions();  // add import
const isLandscape = width > height;
```

**Landscape layout** (when `isLandscape === true`):
```
[         TopBar — full width         ]
[  Left column  |  Right column       ]
[  Points info  |                     ]
[  P1 Card      |     BallPad         ]
[  P2 Card      |                     ]
[  Snooker      |                     ]
[  banner       |                     ]
```
- Outer root: `flexDirection: 'column'` (unchanged)
- After TopBar: new `<View style={{ flex:1, flexDirection:'row' }}>` wraps the rest
- Left column (`flex: 1`): Points box + PlayerCards + snooker banner (column, no spacer)
- Right column (`flex: 1`): BallPad directly, with `flex: 1` to fill height

**Portrait layout** (unchanged when `!isLandscape`): current vertical stack.

Implementation: use conditional wrapping view — one `return` statement with an `isLandscape` branch for the middle section (between TopBar and modals). Keep modals and FoulModal/FrameSummary outside the branch (they're overlays, unaffected).

### 3. `FrontMaxBreak/app/components/scoreboard/PlayerCard.tsx`
- Add `useWindowDimensions()` at the top
- Change `minHeight: 140` → `minHeight: isLandscape ? 70 : 140`
- This prevents the two stacked cards from overflowing the left column in landscape (~360px height available after TopBar)

---

## Safe Area Handling
- `insets.top` already applied to `paddingTop` of root — unchanged
- `insets.bottom` spacer already at the bottom — keep it on the right column bottom in landscape
- In landscape on Android, side insets (`insets.left`, `insets.right`) may need padding on the outer columns — add `paddingLeft: insets.left` and `paddingRight: insets.right` to the left/right columns

---

## Implementation Order
1. `app.json` — 1-line change
2. `PlayerCard.tsx` — add `useWindowDimensions`, adjust `minHeight`
3. `game.tsx` — add `useWindowDimensions`, add landscape layout branch

---

## Build & Verification
1. **Native build required**: `eas build --profile preview --platform android`
2. Install APK on device
3. Open game screen → rotate device → confirm layout switches to split-screen
4. Rotate back → confirm portrait layout restored
5. Check player cards don't overflow in landscape on small phone (~5.5")
6. Test modal (FoulModal, FrameSummary) still appears correctly in landscape
7. Run existing tests (no game logic changed, all 1160 assertions should still pass):
   ```
   node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs && node autosave_test.mjs
   ```
