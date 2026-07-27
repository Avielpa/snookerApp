# Session 2026-07-27 — Match Details: iOS content-inset gap (root cause + fix)

## Symptom

On the Match Details screen (physical iOS device only), a large empty
void (~450-540pt) appeared between the tab bar (Overview/Frames/Stats/H2H)
and the scrollable tab content (ad banner, frame cards, etc.) on every tab.
Not reproducible in the simulator; not consistently reproducible even on
device across different debugging passes, which is what made this so hard
to pin down.

## What did NOT work (and why each attempt looked plausible)

1. **Native header removal** (`headerShown: false` + custom `TopActionRow`)
   — fixed a real, separate bug (native "< index" back-title text and
   double safe-area inset), but did not touch this gap.
2. **`SafeAreaView` → plain `View` + `useSafeAreaInsets()`** — fixed a
   genuine double top-inset bug (SafeAreaView stacking on top of iOS
   native-stack's own inset handling), but again a different bug from this
   one.
3. **Moving `BannerAdSlot` from a static sibling to the first child inside
   each tab's `ScrollView`** — this WAS a real improvement (eliminated a
   structural risk) and is still the correct architecture, but did not
   fix this specific gap.
4. **Removing `flexGrow`/`justifyContent`/`alignItems` from
   `contentContainerStyle`, simplifying to plain padding** — reasonable
   simplification, not the cause.
5. **"Rainbow debugging" (colored backgrounds on every container in the
   chain)** — this is what made the investigation genuinely confusing:
   with debug colors applied, the gap did not appear in the screenshot.
   Removing the colors (and only the colors — verified via `git show` diff)
   brought the gap back. This looked like it disproved every structural
   theory, and even raised a "stale OTA bundle" hypothesis that also
   turned out to be wrong (the next screenshot, on a freshly force-quit
   app with a different live match, still showed the gap).

## Root cause (confirmed with hard numbers, not visual guessing)

Added `measureInWindow()` calls (screen-absolute coordinates, not
Yoga-relative) at three points: `TabNavigation`'s own bottom edge,
`FramesTab`'s `ScrollView`'s own top edge, and `BannerAdSlot`'s top/bottom
edges (also re-measured on the ad's `onAdLoaded` event, to rule out a
native-ad-resize race). Rendered the four numbers in a small on-screen
overlay and had the user screenshot it directly.

Result: `tabBottom ≈ scrollTop ≈ 515.67`, `adTop ≈ 527.67` (only the coded
12pt `paddingTop`), `adBottom ≈ 593.67` (a completely normal ~66pt ad
height). **Yoga's layout tree was correct the entire time.** But in that
same screenshot, the debug overlay `<Text>` — a plain RN element, not the
native ad — was visually painted roughly 450pt lower than its measured
position. A plain `<Text>` being visually displaced from its own
`measureInWindow()` position rules out any native-ad-SDK-specific
explanation; it has to be something affecting the `ScrollView`'s own
rendered content position.

That combination — Yoga layout correct, visual paint position wrong, iOS
only, immune to every padding/margin/flex change — is the signature of
**iOS `UIScrollView`'s automatic content-inset adjustment**
(`contentInsetAdjustmentBehavior`, RN default `'automatic'`). It
calculates extra top inset based on translucent navigation/tab bars at
the *native* UIKit layer, entirely outside RN's JS/Yoga layout tree —
which is exactly why `measureInWindow` (a JS-bridge measurement) reported
correct positions while the actual composited pixels were pushed down.
This screen replaces the native header with `headerShown: false` and a
custom `TopActionRow`, so iOS's automatic calculation has no way to know
the "real" header is gone and was reserving inset space for it anyway.
The inconsistent reproduction across earlier debugging rounds is
consistent with this: the automatic inset's computed value depends on
the navigation controller's bar-visibility state at the moment of layout,
which can vary run-to-run.

## Fix

`contentInsetAdjustmentBehavior="never"` on all 5 tab `ScrollView`s
(`OverviewTab`, `FramesTab`, `StatsTab`, `H2HTab`, `CommentsTab`).

## Files touched

- `app/match/components/OverviewTab.tsx`, `FramesTab.tsx`, `StatsTab.tsx`,
  `H2HTab.tsx`, `CommentsTab.tsx` — added `contentInsetAdjustmentBehavior="never"`.
- `app/match/components/TabNavigation.tsx`, `components/ads/BannerAdSlot.tsx`
  — reverted temporary `measureInWindow` instrumentation added during
  diagnosis.
- `utils/debugLayoutProbe.ts` — deleted (temporary diagnostic-only module).

## What was verified

- `npx tsc --noEmit`: clean.
- Full 26-file test suite: all passing (this bug and fix are pure native
  ScrollView behavior, not covered by the pure-logic `.mjs` test suite —
  no test coverage exists or is meaningful for this class of bug).
- **Not yet re-confirmed on physical device** after this specific fix at
  the time of writing — the numeric measurement proved the mechanism
  conclusively, but a fresh screenshot after this exact push is the final
  confirmation step for whoever picks this up next.

## Lesson for future agents

If a physical-device-only layout bug survives multiple rounds of style
(padding/margin/flex) fixes with no code-level explanation, and especially
if visual debugging (colored backgrounds) gives inconsistent or
contradictory results between rounds — stop guessing with colors and
add real `measureInWindow()` numbers instead. Colors changed rendering in
a way that happened to avoid the bug in some passes (likely by altering
render/measure timing just enough), which produced a false "structurally
fine" signal. Numbers don't lie the same way. Also: `contentInsetAdjustmentBehavior`
is worth checking early on *any* iOS-only "content is displaced/gap
appeared" report involving a `ScrollView` on a screen with a custom
(non-native) header — it's invisible to every JS-level layout tool.
