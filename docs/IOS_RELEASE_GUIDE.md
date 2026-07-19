# iOS Release Guide — Bring iOS to Parity with Android

**Read this whole file before touching any code.** It documents exactly what's missing on iOS,
why, and the exact steps (Apple-side + code-side) to close each gap. Do the sections in order —
later sections depend on earlier ones.

## Current state (as of 2026-07-19)

Android is the only fully working platform. iOS builds exist but are **crippled on purpose** via
two separate stopgaps, both added because the required Apple/Firebase/AdMob registration was
never finished:

| Feature | Android | iOS | Why iOS is broken |
|---|---|---|---|
| Push notifications (Firebase) | ✅ working | ❌ **entirely excluded from the build** | No `GoogleService-Info.plist` — no iOS app registered in Firebase Console |
| Ads (AdMob) | ✅ real ads | ❌ **hard-disabled in code** | No real iOS AdMob app registered — iOS was requesting Android's ad unit IDs under Google's public *sample* App ID, which crashed the Mobile Ads SDK on launch |
| App Store Connect app record | N/A | ✅ **already exists** | `ascAppId: 6762826909`, `appleTeamId: HPNS9888XR` are already in `FrontMaxBreak/eas.json` under `submit.production.ios` — someone already created the App Store Connect listing and has an Apple Developer Program membership |
| Bundle identifier | `com.avielpahima.maxbreaksnooker` | `com.avielpahima.maxbreaksnooker` (same, already set) | Not blocking |

So: **you do NOT need to enroll in the Apple Developer Program or create the App Store Connect
app from scratch** — that part is done. What's missing is registering this same iOS app inside
**Firebase** and **AdMob**, then flipping two code guards back on.

## Relevant files

- `FrontMaxBreak/app.config.js` — dynamic Expo config; has the `isIosBuild` flag that strips
  Firebase plugins on iOS (lines ~11–15, ~43–46) and the AdMob `iosAppId` (line ~40)
- `FrontMaxBreak/services/adsService.ts` — `ADS_ENABLED = Platform.OS !== 'ios'` guard (this is
  THE "exception where ads exist in code but get disabled to avoid crashing" the user is
  referring to)
- `FrontMaxBreak/components/ads/BannerAdSlot.tsx` — reads `ADS_ENABLED`, renders nothing on iOS
- `FrontMaxBreak/eas.json` — `submit.production.ios` already has `appleId`, `ascAppId`, `appleTeamId`
- `FrontMaxBreak/app.json` — `expo.ios.bundleIdentifier: com.avielpahima.maxbreaksnooker`, `buildNumber: "1"`

---

## Part 1 — Register the iOS app in Firebase (fixes push notifications)

1. Go to the Firebase Console → the existing MaxBreak project (same project the Android app
   `google-services.json` belongs to).
2. Project settings → "Add app" → iOS.
3. **Bundle ID must be exactly** `com.avielpahima.maxbreaksnooker` (must match
   `FrontMaxBreak/app.json` → `expo.ios.bundleIdentifier`).
4. Apple App ID (the `ascAppId`) — optional field in Firebase's wizard, value is `6762826909`
   if it asks.
5. Download the generated **`GoogleService-Info.plist`**.
6. Place it at `FrontMaxBreak/GoogleService-Info.plist` (do not commit it if it contains secrets
   — check whether the existing `google-services.json` for Android is committed or gitignored
   and follow the same pattern; do not commit blindly).
7. Code changes needed in `FrontMaxBreak/app.config.js`:
   - Add a `googlesServicesFile` reference for iOS the same way Android does it (look at how
     `android.googleServicesFile` is wired at line ~24 and mirror it for `ios.googleServicesFile`).
   - Remove the `isIosBuild` exclusion of `@react-native-firebase/app` and
     `@react-native-firebase/analytics` from the `plugins` array (lines ~43–46) — once the plist
     exists, prebuild will no longer fail on iOS.
   - Delete the now-stale comment at lines 11–14 explaining the exclusion.

## Part 2 — Register the iOS app in AdMob (fixes ads)

1. Go to AdMob console. Memory notes an app already named **"MaxBreak"** exists there under iOS
   — check that first before creating a new one; it may already be registered but just not wired
   into the code yet.
2. If it doesn't exist yet: Apps → Add app → iOS → "Yes, it's listed on an app store" (once the
   App Store Connect listing is live) or "No" if not yet published — either way link it to
   bundle ID `com.avielpahima.maxbreaksnooker` / ASC app ID `6762826909` when prompted.
3. Create two ad units for the iOS app (separate from Android's — ad unit IDs are per-platform-app
   in AdMob, you cannot reuse Android's):
   - Banner ad unit
   - Interstitial ad unit
4. Copy down:
   - The iOS **App ID**, format `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`
   - The iOS **Banner ad unit ID**, format `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`
   - The iOS **Interstitial ad unit ID**, same format
5. Code changes needed:
   - `FrontMaxBreak/app.config.js` line 40 — replace
     `iosAppId: 'ca-app-pub-3940256099942544~1458002511'` (Google's public test App ID) with the
     real iOS App ID from step 4.
   - `FrontMaxBreak/services/adsService.ts`:
     - Add `REAL_BANNER_AD_UNIT_ID_IOS` and `REAL_INTERSTITIAL_AD_UNIT_ID_IOS` constants (new,
       alongside the existing `REAL_BANNER_AD_UNIT_ID` / `REAL_INTERSTITIAL_AD_UNIT_ID` which are
       Android's — do not overwrite those, iOS needs its own).
     - Change `BANNER_AD_UNIT_ID` / `INTERSTITIAL_AD_UNIT_ID` from a flat `__DEV__ ? Test : Real`
       ternary to also branch on `Platform.OS === 'ios'` and pick the iOS constants there.
     - **Delete** the line `export const ADS_ENABLED = Platform.OS !== 'ios';` and its explanatory
       comment block above it — this is the crash-avoidance guard from commit `88ddce0f` and is
       no longer needed once iOS has its own real App ID + ad units.
     - Remove the `if (!ADS_ENABLED) return Promise.resolve();` early-return inside `initAds()`.
     - Remove the `if (!ADS_ENABLED || shownThisSession) return;` guard in
       `createOnceInterstitialHook` → go back to just `if (shownThisSession) return;`.
   - `FrontMaxBreak/components/ads/BannerAdSlot.tsx`:
     - Remove the `ADS_ENABLED` import and its two usages (`if (ADS_ENABLED) initAds();` →
       `initAds();`, and `if (!ADS_ENABLED || failed)` → `if (failed)`).

## Part 3 — Build and verify

Both parts above are **native config plugin changes** — they require a fresh native build, not
`eas update`:

```bash
cd FrontMaxBreak
eas build --profile preview --platform ios
```

Test on a real device or TestFlight build:
- Push notifications arrive (Part 1)
- Banner ad renders on Home + Match screens, interstitial fires once per session (Part 2)
- No crash on cold launch

Only after preview verifies clean:

```bash
eas build --profile production --platform ios
eas submit --platform ios   # uses submit.production.ios in eas.json — already configured
```

## Things to double check before starting

- Confirm whether an Apple Developer Program membership is currently active (it must be, since
  App Store Connect app `6762826909` already exists) — if it lapsed, renew first, nothing else
  will work.
- Confirm bundle ID `com.avielpahima.maxbreaksnooker` in App Store Connect matches
  `FrontMaxBreak/app.json` exactly.
- Per this repo's rules ([[CLAUDE.md]]): preview build + on-device test before production, and
  get explicit user approval before running any `eas build`/`eas submit`/deploy command.
