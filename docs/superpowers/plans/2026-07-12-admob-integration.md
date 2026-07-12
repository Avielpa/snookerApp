# AdMob Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google AdMob to MaxBreak — a small banner on Home and Match detail screens, and one gentle interstitial per app session, using test ad unit IDs.

**Architecture:** `react-native-google-mobile-ads` provides the native SDK. A small `adsService.ts` owns SDK init and the session-gated interstitial hook; a `BannerAdSlot.tsx` component wraps the library's banner with the app's theming. Both are consumed by existing screens with minimal edits — no backend involvement.

**Tech Stack:** React Native 0.79.6, Expo SDK 53, `react-native-google-mobile-ads` (Expo config plugin), TypeScript 5.3.3.

## Global Constraints

- Dark mode only — any UI added must use `colors.textPrimary` / `colors.textSecondary` / `colors.textMuted` from `contexts/ThemeContext.tsx` (never `colors.text`, which doesn't exist).
- Test ad unit IDs only in this plan (both preview and production channels) — no real AdMob ad unit IDs yet.
- This library has native code — changes here require a new native build (`eas build`), not `eas update`. Do not attempt `eas update` to ship this.
- New code goes in new files/functions (`services/adsService.ts`, `components/ads/BannerAdSlot.tsx`) — do not fold ad logic into existing large files.
- No backend changes — this is 100% frontend/native-SDK.
- Verification per task: since this is a native-SDK UI feature with no pure business logic, use `npx tsc --noEmit` (run from `FrontMaxBreak/`) as the pass/fail gate for each task instead of a Node test script. Full manual verification happens once on a real preview build after all tasks are done (see Task 5).
- Never commit `google-services.json`, `google-services-preview.json`, `.env`, or any secret file.
- Do not run `eas build` or push to master without explicit user approval — stop before that step and ask.

---

### Task 1: Install the AdMob library and wire the config plugin

**Files:**
- Modify: `FrontMaxBreak/package.json` (dependency added by npm install)
- Modify: `FrontMaxBreak/app.config.js`

**Interfaces:**
- Produces: the `react-native-google-mobile-ads` package available for import in later tasks; `app.config.js` plugin entry configured with Google's public test App IDs.

- [ ] **Step 1: Install the package**

Run from `FrontMaxBreak/`:

```bash
npm install react-native-google-mobile-ads
```

Expected: package added to `package.json` dependencies, no errors.

- [ ] **Step 2: Add the config plugin to `app.config.js`**

Open `FrontMaxBreak/app.config.js`. Add the plugin entry to the `plugins` array (inside the existing `module.exports.expo.plugins` array, which currently ends with `'./plugins/withDisableAdIdCollection'` inside the `isIosBuild` conditional block). Add the new plugin **outside** that Android-only conditional, since AdMob should ship on both platforms once iOS is set up — but since iOS builds are currently excluded project-wide (see the `isIosBuild` comment at the top of the file), place it in the unconditional part of the array so it's ready when iOS resumes:

```javascript
    plugins: [
      ...(baseConfig.plugins || []),
      'expo-secure-store',
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-3940256099942544~3347511713',
          iosAppId: 'ca-app-pub-3940256099942544~1458002511',
        },
      ],
      ...(isIosBuild ? [] : [
        '@react-native-firebase/app',
        '@react-native-firebase/analytics',
        './plugins/withDisableAdIdCollection',
      ]),
    ],
```

Both App IDs above are Google's official public test App IDs (safe to ship — they only ever serve test ads, never real ones, regardless of build).

- [ ] **Step 3: Verify config loads without error**

Run from `FrontMaxBreak/`:

```bash
node -e "console.log(JSON.stringify(require('./app.config.js').expo.plugins, null, 2))"
```

Expected: prints the plugins array including the `react-native-google-mobile-ads` entry with no thrown errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.config.js
git commit -m "feat: install react-native-google-mobile-ads and wire config plugin"
```

---

### Task 2: `adsService.ts` — SDK init, test ad unit IDs, session-gated interstitial hook

**Files:**
- Create: `FrontMaxBreak/services/adsService.ts`

**Interfaces:**
- Consumes: `react-native-google-mobile-ads` exports `mobileAds`, `InterstitialAd`, `AdEventType`, `TestIds` (all from the package installed in Task 1).
- Produces:
  - `export const BANNER_AD_UNIT_ID: string`
  - `export const INTERSTITIAL_AD_UNIT_ID: string`
  - `export function initAds(): Promise<void>` — initializes the Mobile Ads SDK once; safe to call multiple times (no-ops after the first successful call); never throws (catches and logs internally).
  - `export function useInterstitialOnce(): void` — a hook with no return value; call it once from the root layout. Loads one interstitial and shows it as soon as it's loaded, but only the first time it's called across the app's process lifetime (module-level boolean flag, not persisted storage).

- [ ] **Step 1: Write `adsService.ts`**

```typescript
// services/adsService.ts
import { useEffect } from 'react';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { logger } from '../utils/logger';

export const BANNER_AD_UNIT_ID = TestIds.BANNER;
export const INTERSTITIAL_AD_UNIT_ID = TestIds.INTERSTITIAL;

let sdkInitPromise: Promise<void> | null = null;

export function initAds(): Promise<void> {
  if (!sdkInitPromise) {
    sdkInitPromise = mobileAds()
      .initialize()
      .then(() => {
        logger.log('[Ads] Mobile Ads SDK initialized');
      })
      .catch((error: any) => {
        logger.warn('[Ads] SDK init failed — app continues without ads:', error?.message);
      });
  }
  return sdkInitPromise;
}

let interstitialShownThisSession = false;

export function useInterstitialOnce(): void {
  useEffect(() => {
    if (interstitialShownThisSession) return;

    let isMounted = true;

    initAds().then(() => {
      if (!isMounted || interstitialShownThisSession) return;

      const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!interstitialShownThisSession) {
          interstitialShownThisSession = true;
          interstitial.show().catch((error: any) => {
            logger.warn('[Ads] Interstitial show failed:', error?.message);
          });
        }
      });

      const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        logger.warn('[Ads] Interstitial load failed:', error?.message);
      });

      interstitial.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeError();
      };
    });

    return () => {
      isMounted = false;
    };
  }, []);
}
```

- [ ] **Step 2: Type-check**

Run from `FrontMaxBreak/`:

```bash
npx tsc --noEmit
```

Expected: no errors referencing `services/adsService.ts`. (Pre-existing unrelated errors elsewhere in the repo, if any, are not this task's concern — only confirm no new errors from this file.)

- [ ] **Step 3: Commit**

```bash
git add services/adsService.ts
git commit -m "feat: add adsService with SDK init and session-gated interstitial hook"
```

---

### Task 3: `BannerAdSlot.tsx` — themed banner wrapper component

**Files:**
- Create: `FrontMaxBreak/components/ads/BannerAdSlot.tsx`

**Interfaces:**
- Consumes: `BANNER_AD_UNIT_ID` and `initAds` from `services/adsService.ts` (Task 2); `useColors` from `contexts/ThemeContext.tsx`; `BannerAd`, `BannerAdSize` from `react-native-google-mobile-ads`.
- Produces: `export default function BannerAdSlot(): JSX.Element` — a component with no props, usable as `<BannerAdSlot />` from any screen.

- [ ] **Step 1: Write `BannerAdSlot.tsx`**

```typescript
// components/ads/BannerAdSlot.tsx
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useColors } from '../../contexts/ThemeContext';
import { BANNER_AD_UNIT_ID, initAds } from '../../services/adsService';

export default function BannerAdSlot() {
  const colors = useColors();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    initAds();
  }, []);

  if (failed) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.BANNER}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 4,
  },
});
```

- [ ] **Step 2: Type-check**

Run from `FrontMaxBreak/`:

```bash
npx tsc --noEmit
```

Expected: no errors referencing `components/ads/BannerAdSlot.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ads/BannerAdSlot.tsx
git commit -m "feat: add themed BannerAdSlot component"
```

---

### Task 4: Wire ads into the root layout, Home screen, and Match detail screen

**Files:**
- Modify: `FrontMaxBreak/app/_layout.tsx`
- Modify: `FrontMaxBreak/app/index.tsx`
- Modify: `FrontMaxBreak/app/match/MatchEnhanced.tsx`

**Interfaces:**
- Consumes: `useInterstitialOnce` from `services/adsService.ts` (Task 2); `BannerAdSlot` default export from `components/ads/BannerAdSlot.tsx` (Task 3).

- [ ] **Step 1: Call the interstitial hook once in `_layout.tsx`**

In `FrontMaxBreak/app/_layout.tsx`, add the import near the other hook imports (after line 15, `useAnalyticsScreenTracking`):

```typescript
import { useInterstitialOnce } from '../services/adsService';
```

Then inside `ThemedLayout`, right after the existing `useAnalyticsScreenTracking();` call (around line 33), add:

```typescript
    // Show one gentle interstitial ad per app session, shortly after cold start
    useInterstitialOnce();
```

- [ ] **Step 2: Add the banner to the Home screen**

In `FrontMaxBreak/app/index.tsx`, add the import near the other component imports (after the `OtherToursTab` import, around line 32):

```typescript
import BannerAdSlot from '../components/ads/BannerAdSlot';
```

Then in the main return block, insert `<BannerAdSlot />` directly after the closing `</View>` of the `listArea` container and before `</SafeAreaView>` (this is the block currently ending `))}\n                </View>\n            </SafeAreaView>` near the end of the file):

```typescript
                </View>

                <BannerAdSlot />
            </SafeAreaView>
        </View>
    );
```

- [ ] **Step 3: Add the banner to the Match detail screen**

In `FrontMaxBreak/app/match/MatchEnhanced.tsx`, add the import near the other component imports (after the `parseFrameScoresString` import, around line 31):

```typescript
import BannerAdSlot from '../../components/ads/BannerAdSlot';
```

Then in the main return block, insert `<BannerAdSlot />` directly after the closing `</View>` of `contentContainer` and before the closing `</SafeAreaView>` (the block currently ending `<View style={styles.contentContainer}>\n        {renderTabContent()}\n      </View>\n    </SafeAreaView>`):

```typescript
      <View style={styles.contentContainer}>
        {renderTabContent()}
      </View>

      <BannerAdSlot />
    </SafeAreaView>
```

- [ ] **Step 4: Type-check**

Run from `FrontMaxBreak/`:

```bash
npx tsc --noEmit
```

Expected: no errors referencing `app/_layout.tsx`, `app/index.tsx`, or `app/match/MatchEnhanced.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/index.tsx app/match/MatchEnhanced.tsx
git commit -m "feat: mount interstitial on app start and banner ads on Home/Match screens"
```

---

### Task 5: Documentation and manual verification checklist

**Files:**
- Create: `docs/ADMOB.md`

**Interfaces:**
- None — this is a documentation-only task.

- [ ] **Step 1: Write `docs/ADMOB.md`**

```markdown
# AdMob Integration

## What's here

- `FrontMaxBreak/services/adsService.ts` — Mobile Ads SDK init (`initAds()`), test ad unit ID constants, and `useInterstitialOnce()` — a hook that shows one interstitial per app process lifetime.
- `FrontMaxBreak/components/ads/BannerAdSlot.tsx` — themed banner wrapper. Renders `null` if the ad fails to load.
- `FrontMaxBreak/app.config.js` — `react-native-google-mobile-ads` config plugin, currently configured with Google's public **test** App IDs (`ca-app-pub-3940256099942544~3347511713` Android / `~1458002511` iOS).

## Where ads show

- Banner: bottom of Home screen (`app/index.tsx`) and bottom of Match detail screen (`app/match/MatchEnhanced.tsx`).
- Interstitial: once per app session, shortly after cold start, mounted from `app/_layout.tsx`.

## Current state: test ads only

Every ad unit ID in this integration is one of Google's public test IDs — safe to ship to real users, but they never generate real revenue. This is intentional for this pass (see the design spec).

## Requires a native build

`react-native-google-mobile-ads` has native code. Changes to it are **not** picked up by `eas update` — you must run a new `eas build` (preview first, then production) for any change here to reach a device.

## Manual verification checklist (run once per native build)

- [ ] Fresh install, cold start: exactly one interstitial appears within the first few seconds, and does not reappear on further in-app navigation during the same session.
- [ ] Force-quit and relaunch: interstitial appears again (new session) — confirms the gate is per-process, not persisted.
- [ ] Home screen: small banner visible at the bottom, doesn't overlap or push the BottomBar off-screen, doesn't break scrolling.
- [ ] Match detail screen: small banner visible at the bottom of the tab content, same layout checks.
- [ ] Airplane mode / no network: app still loads and functions normally; banner slots collapse to nothing (no broken-image placeholder), no interstitial blocks the UI waiting to load.
- [ ] No crash or ANR on a device without Google Play Services (if available for testing) — `initAds()` catch path should keep the app fully usable.

## Follow-ups (not done in this pass)

- Register MaxBreak in the AdMob console and create real banner + interstitial ad units, then swap the test IDs in `app.config.js` and `adsService.ts` for the real ones.
- `FrontMaxBreak/plugins/withDisableAdIdCollection.js` currently disables Firebase Analytics' advertising-ID (AD_ID) collection with the stated reason "MaxBreak has no ads" — that's no longer true once this ships. Revisit whether AD_ID collection should be re-enabled for ad targeting/attribution, and check whether the Play Console "Advertising ID" data-safety declaration needs updating (manual Play Console step, not code).
- Rewarded ads (deferred per the design spec).
- `app-ads.txt` (not applicable — no companion website).
```

- [ ] **Step 2: Commit**

```bash
git add docs/ADMOB.md
git commit -m "docs: add AdMob integration reference and manual verification checklist"
```

---

## After all tasks: stop before building or deploying

Per the Global Constraints, do **not** run `eas build` or push to master automatically. Once Task 5 is committed, report back to the user that the code is ready and ask whether they want to proceed with a `eas build --profile preview --platform android` to test on a real device.
