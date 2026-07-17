// services/adsService.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { logger } from '../utils/logger';

const REAL_BANNER_AD_UNIT_ID = 'ca-app-pub-7026436404209900/5896032920';
const REAL_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-7026436404209900/4391379567';

// No AdMob app is registered for iOS yet (app.config.js hardcodes Google's public sample
// app ID there) — these ad unit IDs belong to the real Android AdMob app and crash the SDK
// on iOS when requested under a different app ID. Ads are disabled entirely on iOS until a
// real iOS AdMob app is registered. Remove this guard then.
export const ADS_ENABLED = Platform.OS !== 'ios';

export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : REAL_BANNER_AD_UNIT_ID;
export const INTERSTITIAL_AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : REAL_INTERSTITIAL_AD_UNIT_ID;

let sdkInitPromise: Promise<void> | null = null;

export function initAds(): Promise<void> {
  if (!ADS_ENABLED) {
    return Promise.resolve();
  }
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

function createOnceInterstitialHook(label: string) {
  let shownThisSession = false;

  return function useOnceInterstitial(): void {
    useEffect(() => {
      if (!ADS_ENABLED || shownThisSession) return;

      let isMounted = true;
      let unsubscribeLoaded: (() => void) | undefined;
      let unsubscribeError: (() => void) | undefined;

      initAds().then(() => {
        if (!isMounted || shownThisSession) return;

        const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

        unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
          if (!shownThisSession) {
            shownThisSession = true;
            interstitial.show().catch((error: any) => {
              logger.warn(`[Ads] ${label} interstitial show failed:`, error?.message);
            });
          }
        });

        unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
          logger.warn(`[Ads] ${label} interstitial load failed:`, error?.message);
        });

        interstitial.load();
      });

      return () => {
        isMounted = false;
        unsubscribeLoaded?.();
        unsubscribeError?.();
      };
    }, []);
  };
}

// Shown once per app process, on cold start.
export const useInterstitialOnce = createOnceInterstitialHook('app-launch');

// Shown once per app process, the first time the scoreboard setup screen is opened —
// independent of the app-launch one above (both can fire in the same session).
export const useScoreboardEntryInterstitial = createOnceInterstitialHook('scoreboard-entry');
