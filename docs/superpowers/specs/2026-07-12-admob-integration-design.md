# AdMob Integration — Design Spec

Date: 2026-07-12

## Goal

Add Google AdMob monetization to MaxBreak with a light touch: small banner ads on two screens, and a single gentle interstitial per app session. No rewarded ads in this pass.

## Context

- AdMob account exists; no app registered yet in the AdMob console.
- App has no companion website, so the `app-ads.txt` step shown in the AdMob console is not applicable and will be skipped.
- Frontend is Expo (React Native, SDK 52). `react-native-google-mobile-ads` is a native module — integrating it requires a new native build (`eas build`), not just `eas update`.

## Scope

**In scope:**
- Banner ad on Home screen (`app/index.tsx`)
- Banner ad on Match detail screen (`app/MatchEnhanced.tsx` / `app/match/[matchId].tsx`)
- One interstitial ad per app session, shown shortly after cold start
- Test ad unit IDs everywhere (both preview and production channels), using Google's official public test IDs
- Config plugin wiring in `app.config.js`

**Out of scope (deferred):**
- Rewarded ads
- Real AdMob ad unit IDs (requires registering the app in the AdMob console first — manual step for the user)
- `app-ads.txt` (no website)
- Ad revenue analytics/reporting

## Architecture

### New files

- `FrontMaxBreak/services/adsService.ts`
  - Initializes the Mobile Ads SDK (`mobileAds().initialize()`) once at app start
  - Exports test ad unit ID constants (banner, interstitial)
  - Exports `useInterstitialOnce()` — a hook that loads and shows one interstitial per app session, using an in-memory (module-level) flag so it never re-fires until the app process restarts. No persistence to AsyncStorage — "session" means "this process lifetime," not "today."

- `FrontMaxBreak/components/ads/BannerAdSlot.tsx`
  - Thin wrapper around the library's `BannerAd` component
  - Applies app spacing/theme conventions (uses `colors` from `ThemeContext` for the container background so there's no flash of mismatched color while the ad loads)
  - Renders nothing (returns `null`) if the ad fails to load, rather than showing a placeholder/error box

### Touch points (existing files, minimal edits)

- `app.config.js` — add `react-native-google-mobile-ads` config plugin with the test Android/iOS App IDs
- `app/index.tsx` — mount `<BannerAdSlot />` near the bottom of the Home screen content
- `app/MatchEnhanced.tsx` (or the match detail route file) — mount `<BannerAdSlot />` below the main match content
- `app/_layout.tsx` — call `useInterstitialOnce()` once at the root so it fires regardless of which screen the user lands on first

### Data flow

No backend involvement at all — this is a pure frontend/native-SDK feature. No new Django models, endpoints, or migrations.

```
App cold start
  → _layout.tsx mounts → mobileAds().initialize()
  → useInterstitialOnce() loads + shows one interstitial (test ID)
  → user navigates normally
  → Home / Match screens render BannerAdSlot (test ID banner)
```

### Error handling

- Interstitial: if it fails to load (no fill, no network), fail silently — no retry loop, no user-facing error. This is an ad, not critical functionality.
- Banner: same — render nothing on failure so layout doesn't break.
- SDK init failure (e.g., Google Play Services missing on some Android devices): wrap `initialize()` in a try/catch; app must continue to function normally with no ads if this fails.

## Testing

Per CLAUDE.md rule 8 (tests required for every new feature): since this is a native-UI/ad-SDK feature with no pure business logic to unit test in isolation (unlike e.g. `computeTrainingStats`), testing here means:
- Manual verification on a preview build: banner renders on Home and Match screens without breaking layout, interstitial shows once per cold start and not again on subsequent screen navigation within the same session, app functions normally if ads fail to load (can simulate via airplane mode).
- A short `docs/ADMOB.md` reference doc summarizing what was added, file locations, and the swap-to-real-IDs steps for later — in place of the usual "100 tests" MD file, since there's no pure-logic surface to assert against with Node scripts (this deviates from the letter of rule 8; flagging explicitly rather than silently skipping it).

## Rollout

1. Implement code changes on a branch (not master)
2. `eas build --profile preview --platform android` — new native build required
3. Install & manually verify on a real device per the Testing section above
4. User approves
5. Merge to master, then production native build (`eas build --profile production --platform android`) when user is ready — versionCode bump required
6. Real ad unit IDs swapped in later, once user has registered the app + ad units in the AdMob console (separate follow-up task)

## Open follow-ups (not part of this task)

- Register MaxBreak as an app in the AdMob console, create real banner/interstitial ad units → then swap test IDs for real ones
- Decide whether ads should be hidden for any future "premium"/ad-free tier (not currently planned, just noting it as a natural extension)
