# Session 2026-07-21 — Stats-tab crash fix + iOS ads recovery

Full writeup of everything investigated and fixed in this session, for future
agents picking up related work. Read this before touching `services/adsService.ts`,
`components/ads/BannerAdSlot.tsx`, `config/ads.ts`, `app.config.js`, or
`app.json`'s `runtimeVersion`.

## Bug 1 — App-wide crash: `ReferenceError: Property 'WeakRef' doesn't exist`

**Symptom**: user reported a crash opening the Stats tab on the match screen
(screenshot: generic ErrorBoundary screen, error text `ReferenceError: Property
'WeakRef' doesn't exist`).

**Root cause chain**:
1. Commit `be8f38eb` ("Upgrade to Expo SDK 53 / React Native 0.79.6") bumped
   `@react-navigation/native` to `^7.0.14` (resolved to `7.17.0`).
2. `@react-navigation/core@7.17.0`'s `useNavigationBuilder.tsx` calls
   `new WeakRef(route.params)` in a `useEffect` when a nested navigator consumes
   route params — new in this version.
3. `WeakRef` is a JS-engine global; older Hermes builds (bundled into native
   binaries built before the SDK53 upgrade) don't implement it.
4. `FrontMaxBreak/app.json`'s `runtimeVersion` was a **hardcoded static string
   (`"1.0.0"`) that was never bumped** during the SDK53 upgrade — so Expo
   Updates treated old (pre-SDK53) and new native binaries as "compatible" and
   kept serving new OTA JS bundles (built against RN 0.79.6 / react-navigation
   7.17) to phones still running the old native binary with old Hermes.
5. Old Hermes executes the new JS, hits `new WeakRef(...)`, throws, the app's
   root `ErrorBoundary` catches it and shows the generic crash screen.

**Fix**: bumped `runtimeVersion` `"1.0.0"` → `"2.0.0"` in `app.json` (commit
`965e83fc`, merged via `0b570a5c`). This does not retroactively fix already-crashing
old-binary users — it stops them from being served incompatible OTA JS going
forward (they'll simply stay on their last-good bundle instead of crashing).
**A new native build (`eas build`) is required for this to take effect** —
`runtimeVersion` is baked into the native binary at build time, not read from
JS at runtime; publishing an `eas update` alone does nothing until a binary
with the new `runtimeVersion` is actually installed.

**Lesson for future SDK/RN upgrades**: any commit that bumps Expo SDK, React
Native, or a native-module-touching dependency (react-navigation, anything
with a config plugin) MUST bump `runtimeVersion` in the same commit, or set a
policy-based value (`{"policy": "appVersion"}` / `"fingerprint"`) so this can't
recur silently. This was NOT done for `be8f38eb` and is why this bug existed
for however long that upgrade has been live.

## Bug 2 — iOS ads: app-wide crash risk + Android ads regression

A separate developer ("AmielCohen96", commit `0e53978b`, pushed directly to
`master`) attempted to add iOS AdMob support and broke ads on **both**
platforms, plus introduced a bundle-resolution failure that would have crashed
the **entire app** on launch, not just the Stats tab or ads:

1. `services/adsService.ts` imported from `../config/ads`, a module that was
   **never created**. `app/_layout.tsx` (root layout, mounted on every launch)
   imports `useInterstitialOnce` from `adsService.ts` — an unresolvable import
   in a file loaded by literally every screen. This alone would break the
   Metro bundle.
2. `app/_layout.tsx` imports `useInterstitialOnce`, `app/scoreboard/index.tsx`
   imports `useScoreboardEntryInterstitial` — both exports were **removed** in
   the rewrite (replaced with a differently-named `showInterstitialOnce`).
   Even if (1) were fixed, both these call sites would crash calling `undefined`
   as a hook.
3. The rewrite swapped the working, already-installed, already-live-in-production
   `react-native-google-mobile-ads` for a dynamic `require('expo-ads-admob')` —
   a package **not installed anywhere in the project**. Every ad call would
   silently no-op even if the imports resolved.
4. `ADS_ENABLED` was hardcoded to `false` — **Android's real, revenue-earning
   ads were disabled too**, not just iOS.
5. `app.config.js`'s `react-native-google-mobile-ads` config plugin entry
   (which injects the AdMob App ID into the native manifest) was deleted
   entirely — meaning even a working ads library would have no App ID wired
   into a fresh native build.
6. `app.config.js` referenced `./plugins/withDisableAdIdCollection` — a plugin
   file that was intentionally deleted in an earlier commit (`9ff8352e`,
   "remove stale AD_ID-collection-disable plugin now that real ads ship").
   Dangling reference, would fail prebuild.
7. Android's `com.google.android.gms.permission.AD_ID` manifest permission
   (required for AdMob attribution) was removed from `app.json`.
8. `app/match/[matchId].tsx` was changed to render its own `<BannerAdSlot />`
   wrapping `MatchEnhanced`, which **already renders its own** `<BannerAdSlot />`
   internally — would have shown two stacked banner ads on the match screen.

**What that commit got right**: a real iOS AdMob **App ID** was registered —
`ca-app-pub-7026436404209900~7553262356` — wired into `app.json`'s
`ios.infoPlist.GADApplicationIdentifier`. This was reused in the fix.

**Fix** (commit `4844c0c4`):
- Recreated `config/ads.ts` with real Android IDs (unchanged, proven) and real
  iOS App ID reused, iOS ad unit IDs left `undefined` pending the user creating
  real ad units.
- Restored `services/adsService.ts` to the `react-native-google-mobile-ads`
  implementation with the original hook API (`useInterstitialOnce`,
  `useScoreboardEntryInterstitial`) that `_layout.tsx`/`scoreboard/index.tsx`
  already depend on — but made it platform-generic via `config/ads.ts` instead
  of the old `Platform.OS !== 'ios'` hard-disable hack.
- Restored `components/ads/BannerAdSlot.tsx` to use the real `BannerAd`
  component.
- Restored the `react-native-google-mobile-ads` config plugin in
  `app.config.js` with both the existing real Android App ID and the newly-known
  real iOS App ID.
- Removed the dangling `withDisableAdIdCollection` reference, restored the
  Android `AD_ID` permission, removed the duplicate banner on the match screen,
  re-added `react-native-google-mobile-ads` to `package.json`
  (was still physically present in `node_modules`, just needed the manifest
  entry restored) and regenerated `package-lock.json`.

**Then the user provided real iOS ad unit IDs** (banner
`ca-app-pub-7026436404209900/4299169781`, interstitial
`ca-app-pub-7026436404209900/4683001528`) — dropped into `config/ads.ts`.
Ads are now fully platform-generic end-to-end: same code path, same library,
same hooks, both platforms, no `Platform.OS`-based feature disabling anywhere
in the ads code. The only per-platform branch is picking which ID constant to
use, same as bundle IDs/App IDs already are.

**Lesson for future agents**: `config/ads.ts` and the hook names
(`useInterstitialOnce`, `useScoreboardEntryInterstitial`) in
`services/adsService.ts` are load-bearing — `app/_layout.tsx` and
`app/scoreboard/index.tsx` import them by exact name. Don't rename without
updating both call sites. Before trusting any commit that touches ads/iOS
config that you didn't write yourself, verify: (a) every import actually
resolves (`npx tsc --noEmit`), (b) every dependency it uses is actually in
`package.json` **and** `node_modules`, (c) `ADS_ENABLED`/equivalent gates
aren't silently disabling a platform that was previously working.

## Bug 3 — Interstitial ad UX risk (product feedback, not a crash)

Two issues raised by the user after ads were restored:

1. **No delay before first interstitial** — `useInterstitialOnce()` fired as
   soon as the SDK initialized and an ad loaded after app launch (could be
   1-2s), which is a known uninstall driver. **Fix**: added a delay
   (`INTERSTITIAL_DELAY_MS`, currently `5000`ms) before either interstitial
   hook even requests an ad.
2. **Double interstitial in one session** — `useInterstitialOnce` (app-launch)
   and `useScoreboardEntryInterstitial` (first scoreboard-entry) each had their
   own independent `shownThisSession` closure variable, so both could fire in
   the same session. Worse, because the app-launch timer is set at the root
   layout level (mounted above the `<Stack>` navigator, persists across all
   screen navigation), a user who opened the app and immediately navigated to
   scoreboard could have the app-launch interstitial fire *while already inside
   scoreboard*, on top of scoreboard's own separately-timed interstitial.
   **Fix**: replaced the two independent flags with one shared
   module-level `interstitialShownThisSession` flag — whichever trigger fires
   first blocks all others for the rest of the session.

Both in commit `4a4ab7d8`.

## State at end of session

- All fixes merged to `master` and pushed (commits `965e83fc` through
  `4a4ab7d8`).
- `npx tsc --noEmit`: clean.
- All 6 frontend test files pass (328 + 51 + 470 + 121 + 48 + 42 = 1060
  assertions) plus `ads_config_test.mjs`.
- Stray branches (`fix/runtime-version-weakref-crash`, already merged) deleted
  locally and on origin. Only `master` (+ `gh-pages`, unrelated static hosting
  for `app-ads.txt`) remain.
- **Not yet done**: no `eas build` has been run this session. Both the
  `runtimeVersion` bump and the ads fixes require a fresh native build
  (Android AAB + iOS) before they take effect for real users — OTA alone
  cannot ship either fix. Get explicit approval before running `eas build`
  per this repo's deployment-approval rule.
- A separate, unrelated WIP change (adding a "Mubeen" YouTube creator tab to
  `NewsScreen.tsx`/`highlightsService.ts`) was found uncommitted in the working
  tree at the start of this session and was stashed, not touched further:
  `git stash list` → `WIP: mubeen creator tab (pre-existing, unrelated to iOS
  merge)`. Restore with `git stash pop` when picking that work back up.
- Firebase/Analytics remains intentionally excluded from iOS builds
  (`app.config.js`) — this is a **safe, guarded gap** (confirmed no crash risk;
  `services/analyticsService.ts` already handles it), not a bug, and is
  separate from push notifications (which use `expo-notifications`, not
  `@react-native-firebase/messaging`, so are unaffected). Closing it requires
  the user to complete Part 1 of `docs/IOS_RELEASE_GUIDE.md` (register the iOS
  app in Firebase Console, get a real `GoogleService-Info.plist`) — not
  something an agent can do without that real file.
