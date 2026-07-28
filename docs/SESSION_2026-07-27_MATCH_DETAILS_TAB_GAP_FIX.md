# Session: Match Details tab-content gap — investigation and fix (2026-07-27)

## Symptom

On the Match Details screen (`app/match/MatchEnhanced.tsx`), every tab (Overview, Frames, Stats, H2H, Comments) rendered a large empty black gap (~500px) between the tab-pill row and the actual tab content, on Android. Reproduced immediately on first open (not tied to a later refresh/re-render), on multiple different matches (live and finished), and only on this screen — not on Home, Calendar, Rankings, or any other screen that also uses `BannerAdSlot`/similar scroll patterns.

This session picked up an investigation that was **already in progress from a separate concurrent session** (commits authored `AmielCohen96`, merged into this branch mid-session via `git fetch`/pull, HEAD moved `3bcb5cf0` → `699f6d44`). That session had already ruled out CSS/style causes via `measureInWindow` (see below) before this session took over.

## Full root-cause chain

1. **Static code read (this session, before knowing about the parallel investigation)**: read every style value in `styles-modern.ts` and all 5 tab components. Nothing was large enough to explain a 500px gap. Hypothesized `BannerAdSlot`'s native ad view might be reserving unconstrained space — **disproven** by the user confirming the gap did not appear on Home/Calendar/Rankings, which also mount `BannerAdSlot`.

2. **Discovered the parallel investigation** via `git log`/`git show` after a `git fetch` mid-session pulled in 3 new commits. That investigation had already proven, via `measureInWindow` (React Native's real on-screen position API) re-measured continuously every 1s (to rule out staleness from the 30s live-match poll): the ScrollView's own position and a title element inside it both reported the *correct* position relative to their padding — i.e. **Yoga (RN's layout engine) had the right answer**. Yet the screenshot showed the title ~500px lower. This proved the bug was a paint/compositing issue, not a style/flexbox bug — ruling out every margin/padding/height-based fix category.

3. Two fix attempts from that parallel investigation, both already failed before this session resumed: `contentInsetAdjustmentBehavior="never"` (iOS-only fix, irrelevant on this Android repro) and `animation: 'none'` set from *inside* `MatchEnhanced.tsx`'s own `<Stack.Screen>` options.

4. **This session's first fix attempt**: re-applied `animation: 'none'` correctly, at the *navigator* level (`app/_layout.tsx`, as a per-route `<Stack.Screen name="match/[matchId]" options={{animation:'none'}}>` child of the root `<Stack>`), since the in-screen override can only affect re-renders after mount, never the entrance-transition animation the navigator already decided on at push time. This was a real, structurally-correct fix for a *different* potential bug (transition timing) — but **did not fix this gap**. Confirmed by the user testing on-device.

5. **This session's second fix attempt**: hypothesized Android's native `RefreshControl` (`SwipeRefreshLayout`) was leaving a stale scroll offset after `isRefreshing` toggled programmatically. Added `scrollTo({y:0, animated:false})` on the `!isRefreshing` transition to all 5 tabs' ScrollViews. **Did not fix it.**

6. At this point: 2 real fix attempts had failed in this session, on top of 2 from the parallel session — 4 total, past the "3+ failures = question the architecture, don't guess a 4th" threshold from the systematic-debugging process. Instead of another guess, added **new diagnostic instrumentation**: extended the existing debug overlay (in `FramesTab.tsx`, showing `scrollTop`/`titleTop`/`diff` from the parallel session) with a second overlay in `MatchEnhanced.tsx` measuring `rootTop`, `scoreHeaderBottom`, `tabNavBottom`, and `contentTop` via `measureInWindow` on all four layer boundaries simultaneously (root View, PlayerScoreHeader wrapper, TabNavigation wrapper, content container wrapper), re-measured every 1s.

7. **Decisive evidence, from a user screenshot at 18:08 (before instrumentation from step 6 was even added)**: the *original* debug overlay — coded `position: 'absolute', top: 4`, meaning it should paint at the very top of the scrollable content regardless of any flow-layout gap — was itself rendered ~500px lower than coded, at the same offset as the rest of the content. An absolutely-positioned element being shifted by the same amount as everything else proves the entire ScrollView content was being **painted with a uniform downward offset that Yoga never modeled** — not a "gap between elements" in normal document flow at all. This is the signature of Android's `SwipeRefreshLayout` (which `RefreshControl` wraps) getting stuck applying its pull-to-refresh drag-offset transform to its child, a transform that lives outside Yoga's model and that a `scrollTo()` call (which only resets the ScrollView's own internal scroll position, a different transform) cannot touch.

8. **Real fix**: removed `refreshControl` entirely from all 5 tabs' `ScrollView`s (`OverviewTab.tsx`, `FramesTab.tsx`, `StatsTab.tsx`, `H2HTab.tsx`, `CommentsTab.tsx`). This is the actual native component capable of producing this class of bug, not another JS-side workaround.

9. **Confirmed fixed** via the layer-boundary debug overlay from step 6: `tabNavBottom: 264.38` exactly equals `contentTop: 264.38` — content starts precisely where the tab bar ends. Confirmed visually on-device by the user across multiple matches/tabs after a full force-close + reopen (required because OTA updates apply on next cold start).

10. **Cleanup**: removed both debug overlays (the `scrollTop`/`titleTop` one in `FramesTab.tsx` and the layer-boundary one in `MatchEnhanced.tsx`) and their associated refs/state/effects/unused imports (`useState`, `useEffect`, `useRef`, `RefreshControl` import) from all 5 tab files and `MatchEnhanced.tsx`. Restored `MatchEnhanced.tsx`'s root return JSX to its pre-instrumentation shape (no wrapper `<View ref=...>` around `PlayerScoreHeader`/`TabNavigation`/content — those wrappers existed only to attach measurement refs).

## Files touched

- `FrontMaxBreak/app/match/components/OverviewTab.tsx` — removed `refreshControl` prop, scroll-reset effect, unused imports.
- `FrontMaxBreak/app/match/components/FramesTab.tsx` — removed `refreshControl` prop, both debug-measurement effects/overlay, scroll-reset effect, unused imports.
- `FrontMaxBreak/app/match/components/StatsTab.tsx` — same as OverviewTab.
- `FrontMaxBreak/app/match/components/H2HTab.tsx` — same as OverviewTab.
- `FrontMaxBreak/app/match/components/CommentsTab.tsx` — same as OverviewTab (kept its other `useState`/`useEffect`/`useRef` usages, which are unrelated to this bug).
- `FrontMaxBreak/app/match/MatchEnhanced.tsx` — added then removed the layer-boundary debug overlay; final state only differs from before this session in that `<Stack.Screen options={{animation:'none'}}>` now also has a matching per-route override in `_layout.tsx` (kept, since it's a real independent fix for transition timing even though it didn't cause this bug).
- `FrontMaxBreak/app/_layout.tsx` — added `<Stack.Screen name="match/[matchId]" options={{animation:'none'}} />` as a child of the root `<Stack>`. **Kept** — this is a legitimate, correct-location fix even though it wasn't the cause of the gap bug; it does properly suppress the fade-in for this route now, which the in-screen-only override never did.
- `docs/superpowers/plans/2026-07-27-match-screen-tab-content-gap.md` — full investigation plan and resolution log (created this session).
- `docs/OPEN_MISSIONS.md` — added item #8 (pull-to-refresh removed from Match Details tabs, needs a replacement that doesn't use native `RefreshControl` directly).

## What was verified vs. what still needs confirming

**Verified:**
- TypeScript typecheck (`npx tsc --noEmit`) clean after every change in this session.
- Full frontend test suite (`game_test.mjs`, `train_test.mjs`, `mega_test.mjs`, `freeball_test.mjs`, `stats_test.mjs`, `offseason_tab_test.mjs`) — all pass, no regressions (freeball suite now has 121 assertions vs. the 100 documented in CLAUDE.md; that's pre-existing growth, not from this session).
- Gap fix confirmed visually on-device by the user, on multiple matches, after the `RefreshControl`-removal OTA update, via the `measureInWindow` layer-boundary overlay showing exact alignment.
- Confirmed the device was running each pushed OTA update (not a stale/rolled-back bundle) by having the user check for today's visual redesign (square avatars, custom top row) being present — directly relevant because a *different* concurrent thread in this same investigation (from the parallel session, see plan doc) had found real evidence of OTA rollback earlier in the day for an unrelated diagnostic (`Updates.updateId` read threw and triggered expo-updates' automatic rollback-to-last-working-update).

**Not yet done / needs a future session:**
- No pull-to-refresh replacement has been built yet (Open Mission #8). Users currently cannot manually refresh Overview/Stats/H2H/Comments/finished-match Frames tabs at all — only live matches get periodic updates via the 30s poll.
- **Not pushed to production** — this was only published to the `preview` EAS channel. Needs explicit user approval before `eas update --channel production`.
- The exact reason *why* `SwipeRefreshLayout` got stuck was not root-caused further (e.g. which specific interaction — Hermes/release-build optimizations, the concurrent screen-transition-animation changes made the same day, or something else — triggered it). Only that removing the component fixes the symptom. Worth deeper investigation if it resurfaces elsewhere (any other screen that adds `RefreshControl` to a `ScrollView` under similar conditions — e.g. after a per-route native-stack `animation` override, or on a screen with a custom `TopActionRow` replacing the native header — should be treated as at-risk until the real trigger is understood).

## Lessons for future agents

- **When `measureInWindow`/layout-model measurements report a correct position but the actual screenshot disagrees, stop looking at styles.** This is not a CSS bug and no amount of margin/padding/flex changes will fix it. Look for a *transform* applied outside React's layout tree — native scroll offsets, stuck gesture-handler transforms (like `SwipeRefreshLayout`'s pull distance), or GPU/compositor layer caching.
- **An absolutely-positioned debug marker is a cheap, decisive test for this class of bug.** If it doesn't paint where its `top`/`left` coordinates say it should, the whole subtree it's inside is being shifted by something outside Yoga — not a flow-layout issue.
- **`scrollTo({y:0})` and `SwipeRefreshLayout`'s drag-offset are two different transforms.** Resetting scroll position does not reset a stuck pull-to-refresh visual offset; they're independent native mechanisms.
- **Per CLAUDE.md rule 12/systematic-debugging**: after 3+ failed fix attempts, the next step must be new evidence-gathering instrumentation, not a 4th guess. That's what actually broke this investigation open — measuring all four layer boundaries at once, after two individual-hypothesis fixes had failed.
- If this repo's Match Details tabs (or similar screens with `TopActionRow` + custom `Stack.Screen` `animation` override + `RefreshControl`) need pull-to-refresh again, build it without native `RefreshControl`/`SwipeRefreshLayout` until the actual trigger for the stuck-offset bug is understood — don't just re-add it and hope.

## PART 2 (same day, later): the RefreshControl fix above was WRONG — real fix found via emulator

After publishing the `RefreshControl`-removal fix above and the user confirming it fixed the gap, the user later reported **the gap was back** on a fresh force-close/reopen of the same build. Two more JS-side hypotheses (re-testing with fresh `measureInWindow` layer-boundary instrumentation) were about to be tried when an Android emulator became available for direct use (`adb`, already running, MaxBreak Preview installed) — this let iteration happen in seconds via `adb shell am force-stop` / `monkey -p ... -c android.intent.category.LAUNCHER 1` / `adb exec-out screencap` instead of minutes per round-trip through the user's device.

**Reproduced immediately** on a *scheduled* match (0-0, no live poll running at all) — disproving the earlier theory that this was tied to the 30s live-match refresh cycle.

**Real root cause, found via `adb shell uiautomator dump`** (dumps the actual OS-level laid-out Android view hierarchy — ground truth, independent of anything React Native's own JS/bridge layer reports): `TabNavigation.tsx`'s horizontal `ScrollView` — `<ScrollView horizontal style={styles.tabContainer} ...>`, where `styles.tabContainer` declares `height: 40` — was rendering as a real `android.widget.HorizontalScrollView` with bounds `[0,752][1080,1434]`, i.e. **682px tall**, while the actual visible tab-pill buttons inside it only occupied `[...,752][...,835]` — about 83px. The remaining ~600px was genuine, empty, native scrollable area (not a paint/compositing artifact this time — an actually oversized native view), and the content `ScrollView` for whichever tab was selected started immediately after it, at `y=1435`, producing the visible gap.

In other words: **the earlier "RESOLVED" fix (removing `RefreshControl`) probably never fixed anything.** The one test where it appeared fixed was likely a case where this bug's trigger condition (still not fully understood — possibly related to first-mount timing, given `measureInWindow`-based instrumentation from the first investigation phase did, in one run, read `tabNavBottom` as a normal-looking 264.38) didn't fire that particular time, not a genuine fix. `RefreshControl` was orthogonal to the real bug the entire time.

**Fix**: in `TabNavigation.tsx`, wrap the horizontal `ScrollView` in a plain `<View style={styles.tabContainer}>` and move `style` off the `ScrollView` itself (kept `contentContainerStyle={styles.tabContainerContent}` on the ScrollView). A plain Android `View` reliably enforces `height`/`overflow:hidden` where the horizontal `ScrollView`'s own `style.height` silently did not. Also added `overflow: 'hidden'` to `styles.tabContainer` in `styles-modern.ts`.

**Verification method** (all done against the emulator, not the user's device, for speed):
1. Reproduced the bug, confirmed 682px bounds via `uiautomator dump`.
2. Applied the `overflow:'hidden'`-on-ScrollView-style fix alone first — did NOT change the reported bounds (682px unchanged) and did NOT fix the visual gap, confirming `overflow` on the ScrollView's own style has no effect on its own inflated layout bounds.
3. Applied the wrapper-`View` fix — force-closed/relaunched, re-screenshotted: gap gone. Re-ran `uiautomator dump`: `HorizontalScrollView` bounds now `[0,752][1080,862]` (110px), content starts immediately after.
4. Checked Overview, Frames, Stats, and H2H tabs individually — all fixed.
5. Restored `RefreshControl` on all 5 tabs (it was never the cause) — typecheck and full test suite (1039+ assertions) still pass — re-verified once more on the emulator that the gap stays fixed with `RefreshControl` back in place.

**Files touched in this phase**: `FrontMaxBreak/app/match/components/TabNavigation.tsx` (the real fix — wrapper View), `FrontMaxBreak/app/match/styles-modern.ts` (`overflow:'hidden'` added to `tabContainer`), and `OverviewTab.tsx`/`FramesTab.tsx`/`StatsTab.tsx`/`H2HTab.tsx`/`CommentsTab.tsx` (RefreshControl restored, reverting Part 1's change).

**Lessons specific to this phase:**
- **`measureInWindow`-based JS instrumentation, while it correctly ruled out styles/margins/padding in Part 1, did NOT reliably catch this specific bug** (an oversized ScrollView higher up the tree) even though in principle it should have been able to. Don't treat a single clean `measureInWindow` reading as conclusive proof a layer is sized correctly — it may not always reflect the real native bounds consistently.
- **`adb shell uiautomator dump` is strictly more trustworthy ground truth than any in-app JS-side measurement** for "why is there empty space no style explains" bugs. It requires an emulator/device with `adb` access, but once available, iterating against it (relaunch + screenshot + dump, all in a few seconds) is dramatically faster than round-tripping fixes through a user's physical device via OTA updates. Reach for it earlier next time a layout bug resists `measureInWindow`-based diagnosis.
- **A horizontal `ScrollView`'s own `style.height` on Android cannot be assumed to reliably constrain its native layout height.** Wrap it in a plain `View` with the height/overflow constraint instead, and let the ScrollView itself only carry `horizontal`/`contentContainerStyle`/scroll-behavior props.
- When a "confirmed fixed" result later turns out to be wrong, don't just try yet another fix on top — verify with better tooling (here: a real emulator instead of relying on remote user reports) before proposing anything further.
