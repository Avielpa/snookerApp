# AdMob Integration

## What's here

- `FrontMaxBreak/services/adsService.ts` — Mobile Ads SDK init (`initAds()`), test ad unit ID constants, and `useInterstitialOnce()` — a hook that shows one interstitial per app process lifetime.
- `FrontMaxBreak/components/ads/BannerAdSlot.tsx` — themed banner wrapper. Renders `null` if the ad fails to load.
- `FrontMaxBreak/app.config.js` — `react-native-google-mobile-ads` config plugin. Android uses MaxBreak's real AdMob App ID (`ca-app-pub-7026436404209900~6184340367`); iOS still uses Google's public test App ID (`ca-app-pub-3940256099942544~1458002511`) since no iOS app is registered in AdMob yet.

## Where ads show

- Banner: below the filter row on Home screen (`app/index.tsx`) and below the score header/tab navigation on Match detail screen (`app/match/MatchEnhanced.tsx`) — deliberately placed away from the bottom tab bar to avoid crowding it.
- Interstitial: once per app session, shortly after cold start, mounted from `app/_layout.tsx`.

## Current state: real ad units, test IDs in dev

`services/adsService.ts` uses Google's public test ad unit IDs when `__DEV__` is true (local dev/Expo Go), and MaxBreak's real AdMob ad unit IDs in any built binary (preview APK and production):
- Banner: `ca-app-pub-7026436404209900/5896032920`
- Interstitial: `ca-app-pub-7026436404209900/4391379567`

This means **the preview APK now serves real ads** — avoid excessive manual clicking on ads during testing (AdMob policy: invalid traffic). Revenue only counts once the app-ads.txt verification (see AdMob console) clears the serving cap.

## Requires a native build

`react-native-google-mobile-ads` has native code. Changes to it are **not** picked up by `eas update` — you must run a new `eas build` (preview first, then production) for any change here to reach a device.

## Manual verification checklist (run once per native build)

- [ ] Fresh install, cold start: exactly one interstitial appears within the first few seconds, and does not reappear on further in-app navigation during the same session.
- [ ] Force-quit and relaunch: interstitial appears again (new session) — confirms the gate is per-process, not persisted.
- [ ] Home screen: small banner visible just below the filter row, doesn't overlap the BottomBar, doesn't break scrolling.
- [ ] Match detail screen: small banner visible just below the score header/tab navigation, same layout checks.
- [ ] Airplane mode / no network: app still loads and functions normally; banner slots collapse to nothing (no broken-image placeholder), no interstitial blocks the UI waiting to load.
- [ ] No crash or ANR on a device without Google Play Services (if available for testing) — `initAds()` catch path should keep the app fully usable.

## Follow-ups (not done in this pass)

- Register MaxBreak in the AdMob console and create real banner + interstitial ad units, then swap the test IDs in `app.config.js` and `adsService.ts` for the real ones.
- `FrontMaxBreak/plugins/withDisableAdIdCollection.js` currently disables Firebase Analytics' advertising-ID (AD_ID) collection with the stated reason "MaxBreak has no ads" — that's no longer true once this ships. Revisit whether AD_ID collection should be re-enabled for ad targeting/attribution, and check whether the Play Console "Advertising ID" data-safety declaration needs updating (manual Play Console step, not code).
- Rewarded ads (deferred per the design spec).
- `app-ads.txt` (not applicable — no companion website).
