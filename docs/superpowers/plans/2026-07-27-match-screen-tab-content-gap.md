# Match Screen Tab-Content Gap — Investigation & Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Find and eliminate the large empty black gap that appears between the tab-pill row and the actual tab content on the Match Details screen (`app/match/MatchEnhanced.tsx`), reported as present on every tab (Overview, Frames, Stats, H2H, Comments), not just Frames.

**Architecture:** This is a `bug-fix-expert` investigation per CLAUDE.md rule 12 — systematic-debugging Phase 1 (root cause) is only partially complete via static code reading; a live-device diagnostic step is required before any fix is written, because no CSS/style value in the codebase accounts for a gap of this size. Do not skip the diagnostic task and jump to a guessed fix.

**Tech Stack:** React Native + Expo Router, `react-native-google-mobile-ads` (BannerAd), StyleSheet-based styling (`styles-modern.ts`).

## Global Constraints
- Rule 1 (CLAUDE.md): plan first, code never — no Edit/Write against app code until this plan (or a revision of it) is explicitly approved.
- Rule 9: any code change here must be checked against old/cached match data (e.g. matches with `frame_scores` missing, `realMatchFormat` unresolved) so nothing else regresses.
- Rule 10: any real fix goes in the smallest possible existing file/component — this is not a rebuild.
- Test on a real Preview APK before Production, per rule "Test on Preview APK before production."
- No `eas update`/`eas build`/`git push` without explicit user approval (Critical Rules section).

---

## What's already known (Phase 1 findings, static analysis only)

**Where the gap sits in the tree** (`app/match/MatchEnhanced.tsx:887-906`):
```
<PlayerScoreHeader .../>      <- hero scoreboard, sticky
<TabNavigation .../>          <- horizontal-scroll pill row, height:48
<BannerAdSlot />              <- ad slot, minHeight:60, no maxHeight
<View style={styles.contentContainer}>   <- flex:1, paddingHorizontal:10, NO paddingTop
  {renderTabContent()}        <- switch on selectedTab, each branch renders
                                  its own inner <ScrollView> (Overview/Frames/
                                  Stats/H2H/Comments tabs all follow this
                                  identical pattern — confirmed by reading all
                                  five)
</View>
```

**Ruled out:**
- No style value anywhere in `styles-modern.ts` or any of the five tab components (`OverviewTab.tsx`, `FramesTab.tsx`, `StatsTab.tsx`, `H2HTab.tsx`, `CommentsTab.tsx`) is larger than `marginTop: 32` (a spinner in `CommentsTab.tsx`). Nothing explains a ~500px screenshot gap on its own.
- `contentContainer` (`flex:1, paddingHorizontal:10`) has no `paddingTop`, `justifyContent`, or `minHeight` that could push content down.
- Each tab's outer `<ScrollView>` deliberately has **no** `style`/`flex:1` prop and **no** `contentContainerStyle` — this is intentional, not a bug. Git history (`39698e53`, `2388f833`, `7f70f2ef`) shows this exact "outer plain `View` + each tab owns its own bare `ScrollView`" pattern was put in place specifically to fix a real iOS bug ("nesting ScrollView/RefreshControl collapsed content to zero height"). It has been stable since April 2026 across many commits — not a new regression, don't touch it as a first move.
- The debug overlay visible in the screenshot (`scrollTop: 473.52…`, `titleTop: ?`, `diff: ?`) does **not** exist anywhere in this repo (`FrontMaxBreak/` grepped case-insensitively for `scrolltop`/`titletop` — zero matches, all git refs checked). It is external tooling on the device (a screen/scroll inspector overlay), not app output — ignore it as a red herring, do not try to "fix" it in our code.

**Leading hypothesis (untested — needs the diagnostic task below before acting on it):**
`BannerAdSlot` (`components/ads/BannerAdSlot.tsx`) is the only element that:
1. sits exactly at the location of the gap (between the tab row and `contentContainer`),
2. is mounted once in `MatchEnhanced.tsx:901`, identically for every value of `selectedTab` — which matches the user's report that the gap is present "all over this session," not just on Frames,
3. has a container style with `minHeight: 60` but **no `maxHeight`**, wrapping a native `<BannerAd unitId={...} size={BannerAdSize.BANNER} onAdFailedToLoad={...} />` from `react-native-google-mobile-ads`. If the native ad view fails to report its constrained 320×50 size back through the bridge before an ad loads (or the ad request stalls without ever calling `onAdFailedToLoad`), there is nothing in `BannerAdSlot`'s styles stopping the native view from occupying much more vertical space than intended.

This has NOT been confirmed. `BannerAdSlot` is used identically on Home, Calendar, Rankings, Stats, Player, and the Scoreboard screens — if this hypothesis is right, we'd expect to see (or rule out) the same gap on at least one of those screens too, which is a fast, free data point the diagnostic task below collects.

---

### Task 1: Confirm or rule out the BannerAdSlot hypothesis (diagnostic, no shipped fix)

**Files:**
- Read only, no edits — this is evidence-gathering per systematic-debugging Phase 1/3 ("test minimally, one variable at a time").

- [ ] **Step 1: Ask the user two quick data points before writing any code**
  1. Does the same gap appear on Home, Calendar, or Rankings (all three also mount `<BannerAdSlot />`)? If yes → the bug is in `BannerAdSlot`/ad SDK itself, not `MatchEnhanced.tsx`-specific. If no → the bug is specific to how Match screen assembles its layout around the ad slot, and `BannerAdSlot` is probably not the cause.
  2. Does the gap shrink/disappear if they wait a few seconds on the Match screen after it loads (i.e., is it there from first paint, or does it appear only while an ad is mid-request)? A gap that shrinks once an ad finishes loading (or once `onAdFailedToLoad` fires and the slot unmounts to `null`) confirms the ad-view-sizing theory directly.

- [ ] **Step 2: If the user can't answer from memory, reproduce on a Preview build with `adb logcat` open**, filtering for `GoogleMobileAds`/`Ads` tags, and watch whether `onAdFailedToLoad` ever fires for the Match screen's banner. If it never fires within ~10s while the gap is visible, that's strong confirmation the native view is stuck in an unconstrained pre-load state.

- [ ] **Step 3: Record the answer in this plan file** (edit this file, add a "Diagnostic result" subsection under this task) before proceeding to Task 2 or Task 3. Do not skip to a fix based on the hypothesis alone — confirm first per the Iron Law ("NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST").

---

### Task 2: Fix — if Task 1 confirms the BannerAdSlot/native-ad-view hypothesis

**Files:**
- Modify: `FrontMaxBreak/components/ads/BannerAdSlot.tsx`

**Interfaces:**
- Consumes: `ADS_ENABLED`, `BANNER_AD_UNIT_ID`, `initAds` from `services/adsService.ts` (unchanged).
- Produces: same default-export `BannerAdSlot()` component, same zero-prop usage at all 12 existing call sites (Home, Calendar, Rankings, Stats, Player, Match, and the 5 Scoreboard screens) — do not change its external API.

- [ ] **Step 1: Add a hard ceiling to the ad container so a misbehaving native view can never expand the slot**

```tsx
const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 60,
    maxHeight: 60,       // NEW — native AdView can never exceed this regardless of its own reported intrinsic size
    flexShrink: 0,
    overflow: 'hidden',  // NEW — clips instead of pushing sibling layout if the native view still tries to grow
  },
  frame: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Verify the visible ad creative still renders correctly at 320×50 inside the clipped frame** — run the Preview build, visit Home (already has ads working per memory) and confirm no visual regression (ad not cropped, still centered).

- [ ] **Step 3: Reproduce the original bug scenario on Match screen and confirm the gap is gone** across all five tabs (Overview, Frames, Stats, H2H, Comments), both while an ad is loading and after `onAdFailedToLoad` fires.

- [ ] **Step 4: Run the full frontend test suite** (`node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs`) — this component isn't covered by these suites, but rule 8 requires no regression; confirm all still report `✅ All N assertions passed`.

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/components/ads/BannerAdSlot.tsx
git commit -m "fix: cap BannerAdSlot height so a stalled native ad view can't create a layout gap"
```

---

### Task 3: Fix — if Task 1 rules out BannerAdSlot (gap is Match-screen-specific)

This task is intentionally left as a decision point, not a guessed implementation — per the Iron Law, writing fix code for a hypothesis that Task 1 disproved would itself violate systematic-debugging. If Task 1's diagnostic shows the gap is Match-screen-only:

- [ ] **Step 1: Re-open investigation focused on `MatchEnhanced.tsx`'s own fixed elements** (`PlayerScoreHeader`, `TabNavigation`) rather than `BannerAdSlot`. Both were rewritten today (2026-07-27) in commits `79a09ffa` and `fc88966b` — `fc88966b`'s own commit message documents a previous "giant vertical blocks" bug in this exact area (`TabNavigation`'s horizontal ScrollView stacking children in column direction because `contentContainerStyle` didn't force `flexDirection: 'row'`) that was supposedly already fixed. Check the *current* rendered output on a real device with React DevTools/Flipper layout inspector attached (not just reading source) to see whether a residual/different variant of that same class of bug survived the `fc88966b` fix — e.g., inspect the live tree for any unexpectedly-tall node between the tab row and `contentContainer`.
- [ ] **Step 2: Once a specific oversized node is identified via the inspector, return to this plan and add a new Task 4 with the concrete fix** (exact file, exact style change) — do not add speculative style tweaks without that confirmed node identified first.

---

---

## UPDATE 2026-07-27 17:5x — superseded by a parallel investigation already on master

While this plan's Task 1 was pending user confirmation, `origin/master` received three new commits from a **separate, already-in-progress investigation** of this exact bug (author `AmielCohen96`, merged into local HEAD mid-session: `3bcb5cf0` → `699f6d44`). That work is far more advanced than the static-analysis hypothesis above (BannerAdSlot native-ad-view sizing) and **disproves it**: `BannerAdSlot` was never the shared element under test in their instrumentation, and their numeric measurements show the real discrepancy is unrelated to any single component's declared size.

**Confirmed by the user:** the gap reproduces on every tab (Overview, Frames, Stats, H2H, Comments), and the most recent fix attempt on master (`01cd66d4`, disabling the Stack screen-transition animation) **did not fix it**.

### What the parallel investigation already proved (do not re-litigate these)
1. (`73228326`) Rainbow-color debug rendering is unreliable for this bug — four rounds showed no gap in colored debug views while the real gap persisted in normal builds. **Don't use color-based debug overlays to verify this bug again.**
2. (`73228326`, `1b0d6601`) Numeric `measureInWindow` measurement, re-checked continuously (not one-shot, to rule out staleness from the 30s live-match poll): `scrollTop`/`titleTop` diff stays ~8pt — **matching the coded padding exactly** — continuously, while the visual gap persists at full size. **This means React Native's own layout engine (Yoga) has the correct position. The bug is purely a paint/compositing discrepancy, not a flexbox/style bug.** Do not propose CSS/style fixes (margin, padding, flex, height) — Tasks 2/3 above are void for this reason and should not be executed.
3. (`73228326`, comment) `contentInsetAdjustmentBehavior="never"` (an iOS ScrollView inset fix) did not close the gap.
4. (`01cd66d4`) `animation: 'none'` on the Stack screen transition did not close the gap (confirmed by user 2026-07-27).
5. (`73228326`, commit message) **Every reproduction so far has been on a LIVE match with the 30s auto-refresh poll** (`MatchEnhanced.tsx`'s `setInterval(..., 30000)` effect) — the bug appears correlated with a post-mount data update cycle, not present from first paint. This is the strongest lead not yet tested to exhaustion.

### Current debug instrumentation still live in the codebase
`FramesTab.tsx:224-269` has a temporary on-screen overlay (`scrollTop`/`titleTop`/`diff`/last-measured timestamp, re-measured every 1s) — this is what appears in the corner of every screenshot of this bug. **Leave it in place** until the bug is fixed and verified; it's the only reliable ground-truth signal found so far. Remove only as part of the final fix's cleanup step.

### Next hypothesis (not yet tested — proposed, needs approval before implementing)
Android's native `RefreshControl`/`SwipeRefreshLayout` is documented to leave a stale downward scroll/transform offset on its child `ScrollView` when `refreshing` toggles programmatically shortly after mount or during a data refresh — a **native-side** offset that Yoga/`measureInWindow` cannot see (consistent with finding #2 above), and that would affect every tab identically since all five tab components wrap their content in `<ScrollView refreshControl={...}>` with the same pattern (confirmed by reading all five files). This also fits finding #5: `loadData(true)` sets `isRefreshing` true→false on every 30s live-poll tick and on every manual refresh, which is exactly the "toggle `refreshing` programmatically" trigger this native bug requires.

### Task 4: Diagnostic — test whether RefreshControl is the offset source (single variable, per systematic-debugging Phase 3)

**Files:**
- Modify (temporarily): `FrontMaxBreak/app/match/components/FramesTab.tsx`

- [ ] **Step 1: Temporarily remove only the `refreshControl` prop from `FramesTab`'s `<ScrollView>` (`FramesTab.tsx:246-261`)** — leave the existing debug overlay, `contentInsetAdjustmentBehavior="never"`, and everything else untouched, so this is the one variable under test:

```tsx
<ScrollView
  ref={scrollRef}
  style={{ flex: 1 }}
  contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
  contentInsetAdjustmentBehavior="never"
  showsVerticalScrollIndicator={false}
  // TEMP: refreshControl removed to test whether Android's native
  // RefreshControl/SwipeRefreshLayout is leaving a stale scroll offset
  // that Yoga can't see. Restore once this diagnostic is resolved.
>
```

- [ ] **Step 2: Ship this as a Preview OTA update (with explicit user approval first, per CLAUDE.md), reproduce the bug scenario** (open a live or just-finished match's Frames tab, let at least one 30s poll tick happen) **and report whether the gap is present or gone.**
  - Gone → root cause confirmed: RefreshControl is the native offset source. Proceed to Task 5 (real fix: keep `RefreshControl` but reset native scroll position explicitly after each data update — e.g. `scrollRef.current?.scrollTo({ y: 0, animated: false })` inside the `isRefreshing` false-transition — rather than removing pull-to-refresh functionality).
  - Still present → this hypothesis is also disproven; do not attempt a 4th unverified fix per the Iron Law's "3+ fixes failed → question the architecture" rule (fixes so far: `contentInsetAdjustmentBehavior`, `animation:'none'`, and if this fails, RefreshControl-offset would be #3) — stop and have a live-device inspection session (Flipper/React DevTools layout inspector attached to a real repro) instead of further blind hypothesis testing.
  - Revert this temporary change regardless of outcome once the data point is collected — it's a diagnostic, not a candidate fix (removing pull-to-refresh is not an acceptable permanent fix even if it "solves" the gap).

---

## RESOLVED 2026-07-27 ~18:42

**Root cause confirmed:** Android's native `RefreshControl` (`SwipeRefreshLayout`) wrapping each tab's `ScrollView` was getting stuck applying its pull-to-refresh drag-offset transform to its child content — a native-side transform invisible to React Native's own layout tree (Yoga/`measureInWindow`), which is why every JS-level fix attempt (content inset, transition animation, scroll-position reset while still using `RefreshControl`) failed: they were all correct about Yoga's model but none of them removed the actual native component applying the stray offset.

**Decisive evidence:** a debug overlay (`position:'absolute', top:4`, so it should paint right at the top of the scrollable content) was itself found painted ~500px lower than coded — proving the *entire* content area, including elements with no dependency on document flow, was shifted by a uniform native-level offset, not a layout/spacing bug.

**Fix:** removed `refreshControl` from all 5 tabs' `ScrollView`s (`OverviewTab.tsx`, `FramesTab.tsx`, `StatsTab.tsx`, `H2HTab.tsx`, `CommentsTab.tsx`). Pull-to-refresh is gone for now; live matches still get fresh data via the existing 30s auto-poll in `MatchEnhanced.tsx`. Confirmed fixed via `measureInWindow` diagnostic (`tabNavBottom` == `contentTop` exactly) and visually on-device.

**Not the cause (ruled out during investigation, for future reference):**
- `BannerAdSlot` native ad view sizing (original hypothesis — wrong location once BannerAdSlot moved inside each tab's scrolled content).
- CSS/style values anywhere in `styles-modern.ts` or any tab component — none were large enough to explain the gap.
- `contentInsetAdjustmentBehavior` (iOS-only, this bug reproduced on Android).
- Stack screen-transition animation, at both the in-screen level and the correct navigator level (`_layout.tsx` per-route `<Stack.Screen>` override) — this was a legitimate, well-reasoned fix for a different real gap (route-push fade timing) but not this bug.
- Stale/rolled-back OTA bundle — explicitly re-verified with the user mid-investigation (today's redesign was confirmed visible on the device reporting the bug).

**Follow-up needed (not done in this session — logged for future work):** pull-to-refresh UX is currently missing on all 5 Match Details tabs. A future task should design a replacement that doesn't use native `RefreshControl`/`SwipeRefreshLayout` directly on these ScrollViews — e.g. a manual pull gesture built without the native swipe-refresh wrapper, or a visible refresh button — and should be added to `docs/OPEN_MISSIONS.md` if not picked up immediately.

**Debug instrumentation added during investigation and since removed:** two `measureInWindow`-based on-screen overlays (one in `FramesTab.tsx` measuring `scrollTop`/`titleTop`, one in `MatchEnhanced.tsx` measuring all layer boundaries) were added, used to find the root cause, and then fully removed once the fix was confirmed. If this class of bug resurfaces, the same `measureInWindow`-on-an-interval pattern (checking whether an absolutely-positioned marker paints where Yoga says it should) is the fastest way to distinguish a real layout bug from a native transform/paint bug.

---

## SUPERSEDED — the RefreshControl theory in the "RESOLVED" section above was WRONG

After the "RESOLVED" fix above was shipped, the user reported the gap was **still present** on a fresh force-close/reopen. This triggered a deeper investigation using a real Android emulator (`adb`/`uiautomator dump`) instead of relying on the user's device round-trip, which let iteration happen in seconds instead of minutes.

**Real root cause, confirmed via `uiautomator dump`'s ground-truth native view hierarchy** (not React's model — the actual OS-level laid-out bounds): `TabNavigation.tsx`'s horizontal `ScrollView` (`style={styles.tabContainer}`, which declares `height: 40`) was rendering as an `android.widget.HorizontalScrollView` with real bounds **682px tall**, while its visible tab-pill content only occupied the top ~83-110px. The remaining ~570-600px was genuine empty native scrollable area — not a rendering/paint artifact, an actual oversized native view — and every other layer below it (content ScrollView, etc.) started immediately after this oversized bar, which is what produced the visual gap.

This explains why `RefreshControl` removal appeared to fix it in one test: it likely never fixed anything — the "confirmed fixed" screenshot from that round was probably a case where the bug happened not to manifest (its trigger condition wasn't fully understood even by the time it was fixed), not genuinely resolved. Removing/restoring `RefreshControl` was orthogonal to the real bug the whole time.

**Real fix**: in `TabNavigation.tsx`, wrap the horizontal `ScrollView` in a plain `<View style={styles.tabContainer}>` and remove `style` from the `ScrollView` itself (keep `contentContainerStyle`). A plain Android `View` reliably enforces a fixed `height` where the horizontal `ScrollView`'s own `style.height` did not. Also added `overflow: 'hidden'` to `styles.tabContainer` in `styles-modern.ts` as defense in depth.

**Verified**: reproduced the bug directly in an Android emulator running the Preview build, confirmed the 682px native bounds via `uiautomator dump`, applied the fix, force-closed/relaunched, and confirmed via a fresh `uiautomator dump` that `HorizontalScrollView` bounds dropped to ~110px and content now starts immediately after it — checked across Overview, Frames, Stats, and H2H tabs. `RefreshControl` was then restored on all 5 tabs (full test suite + typecheck still pass) since it was never the actual cause.

**Lesson**: `measureInWindow` (used throughout the earlier investigation) reports Yoga's/React's model of where a view *should* be, read back through the native bridge — but it apparently did NOT catch this specific bug (the TabNavigation ScrollView's own inflated height), even though in hindsight it should have been able to (a `tabNavBottom` measurement taken via `measureInWindow` in one attempt DID read as 264.38 matching `contentTop`, suggesting the bug is either intermittent/state-dependent, or a component-remount changed its behavior between test rounds). **A native `uiautomator dump` of the real Android view hierarchy is strictly more trustworthy ground truth than any in-app JS-side measurement** for this class of "why is there empty space no style explains" bug, and should be reached for earlier next time a similar bug resists JS-side diagnosis — it requires an emulator/device with `adb` access but is otherwise fast and conclusive.

## Self-review notes
- Spec coverage: user asked for (a) locate the gap's div/element, (b) find the connected style, (c) find the cause, (d) explain where it should be, (e) a fix plan. Tasks above cover (a)-(c) in the "What's already known" section, (d) implicitly (content should start immediately after the tab row / ad slot with no unexplained space), (e) via Task 1 (diagnostic) → Task 2 or 3 (conditional fix).
- No placeholder steps: Task 2's fix is a concrete, complete code diff; Task 3 is explicitly a decision point (not a placeholder for actual work) because Task 1 hasn't run yet — writing a guessed fix here would violate the Iron Law this plan is built around.
