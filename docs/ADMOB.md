# AdMob Integration

## What's here

- `FrontMaxBreak/services/adsService.ts` — Mobile Ads SDK init (`initAds()`), test ad unit ID constants, and `useInterstitialOnce()` — a hook that shows one interstitial per app process lifetime.
- `FrontMaxBreak/components/ads/BannerAdSlot.tsx` — themed banner wrapper. Renders `null` if the ad fails to load.
- `FrontMaxBreak/app.config.js` — `react-native-google-mobile-ads` config plugin. Android uses MaxBreak's real AdMob App ID (`ca-app-pub-7026436404209900~6184340367`); iOS still uses Google's public test App ID (`ca-app-pub-3940256099942544~1458002511`) since no iOS app is registered in AdMob yet.

## Where ads show

- Banner: fixed above the bottom tab bar on Home screen (`app/index.tsx`, rendered as a sibling after the scrollable list — not inline in the scroll content, so it can't overlap list items) and below the score header/tab navigation on Match detail screen (`app/match/MatchEnhanced.tsx`).
- Interstitial: on entering the Media tab (`app/NewsScreen.tsx`), at most once every 4 hours (persisted via AsyncStorage, see `isMediaInterstitialCooldownElapsed`/`useMediaTabInterstitial` in `adsService.ts`). No longer shown on app launch — the previous app-launch trigger was found to hurt retention and was removed (2026-07-26). Still shares the session-wide "one interstitial per process" gate with the scoreboard-entry trigger below.
- Interstitial: also once per app process, the first time the scoreboard setup screen is opened (`useScoreboardEntryInterstitial`, unchanged).

## Current state: real ad units, test IDs in dev

`services/adsService.ts` uses Google's public test ad unit IDs when `__DEV__` is true (local dev/Expo Go), and MaxBreak's real AdMob ad unit IDs in any built binary (preview APK and production):
- Banner: `ca-app-pub-7026436404209900/5896032920`
- Interstitial: `ca-app-pub-7026436404209900/4391379567`

This means **the preview APK now serves real ads** — avoid excessive manual clicking on ads during testing (AdMob policy: invalid traffic). Revenue only counts once the app-ads.txt verification (see AdMob console) clears the serving cap.

## Requires a native build

`react-native-google-mobile-ads` has native code. Changes to it are **not** picked up by `eas update` — you must run a new `eas build` (preview first, then production) for any change here to reach a device.

## Manual verification checklist (run once per native build)

- [ ] Fresh install, cold start: no interstitial appears until the Media tab is opened.
- [ ] First Media-tab visit: one interstitial appears (after the standard load delay); repeat Media-tab visits within the same 4h window show none.
- [ ] After 4+ hours (or clearing app storage to simulate it): visiting the Media tab shows an interstitial again.
- [ ] Home screen: banner visible fixed above the bottom tab bar, doesn't overlap the last list row, doesn't break scrolling.
- [ ] Match detail screen: small banner visible just below the score header/tab navigation, same layout checks.
- [ ] Airplane mode / no network: app still loads and functions normally; banner slots collapse to nothing (no broken-image placeholder), no interstitial blocks the UI waiting to load.
- [ ] No crash or ANR on a device without Google Play Services (if available for testing) — `initAds()` catch path should keep the app fully usable.

## Follow-ups (not done in this pass)

- Register MaxBreak in the AdMob console and create real banner + interstitial ad units, then swap the test IDs in `app.config.js` and `adsService.ts` for the real ones.
- ~~`FrontMaxBreak/plugins/withDisableAdIdCollection.js`~~ — removed. It disabled Firebase Analytics' advertising-ID (AD_ID) collection ("MaxBreak has no ads"), which suppressed the `AD_ID` manifest permission and conflicted with the Play Console "Advertising ID" data-safety declaration once real ads shipped (surfaced as a Play Console release warning). AD_ID collection is now on by default.
- Rewarded ads (deferred per the design spec).
- `app-ads.txt` (not applicable — no companion website).
