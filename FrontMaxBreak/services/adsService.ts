// services/adsService.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { logger } from '../utils/logger';
import {
  ADMOB_ANDROID_BANNER_ID,
  ADMOB_ANDROID_INTERSTITIAL_ID,
  ADMOB_IOS_BANNER_ID,
  ADMOB_IOS_INTERSTITIAL_ID,
} from '../config/ads';

const REAL_BANNER_AD_UNIT_ID = Platform.OS === 'ios' ? ADMOB_IOS_BANNER_ID : ADMOB_ANDROID_BANNER_ID;
const REAL_INTERSTITIAL_AD_UNIT_ID = Platform.OS === 'ios' ? ADMOB_IOS_INTERSTITIAL_ID : ADMOB_ANDROID_INTERSTITIAL_ID;

export const ADS_ENABLED = !!REAL_BANNER_AD_UNIT_ID || !!REAL_INTERSTITIAL_AD_UNIT_ID;

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

// Delay before an interstitial is even requested, so a first-time user gets to
// see the screen they opened before any ad can interrupt them — showing an ad
// the instant the app launches is a well-documented uninstall driver.
const INTERSTITIAL_DELAY_MS = 5000;

// Shared across every interstitial trigger (app-launch, scoreboard-entry, ...) —
// at most one interstitial shows per app session, regardless of which trigger
// fires first. Without this, a user who opens the app and immediately jumps to
// the scoreboard could see the app-launch interstitial fire while already on
// the scoreboard screen, followed by the scoreboard-entry one — two ads in one
// session from what's meant to be a "once per process" cap.
let interstitialShownThisSession = false;

function createOnceInterstitialHook(label: string) {
  return function useOnceInterstitial(): void {
    useEffect(() => {
      if (!ADS_ENABLED || interstitialShownThisSession || !INTERSTITIAL_AD_UNIT_ID) return;

      let isMounted = true;
      let unsubscribeLoaded: (() => void) | undefined;
      let unsubscribeError: (() => void) | undefined;

      const delayTimer = setTimeout(() => {
        if (interstitialShownThisSession) return;
        initAds().then(() => {
          if (!isMounted || interstitialShownThisSession) return;

          const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID as string);

          unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            if (!isMounted || interstitialShownThisSession) return;
            interstitialShownThisSession = true;
            interstitial.show().catch((error: any) => {
              logger.warn(`[Ads] ${label} interstitial show failed:`, error?.message);
            });
          });

          unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
            logger.warn(`[Ads] ${label} interstitial load failed:`, error?.message);
          });

          interstitial.load();
        });
      }, INTERSTITIAL_DELAY_MS);

      return () => {
        isMounted = false;
        clearTimeout(delayTimer);
        unsubscribeLoaded?.();
        unsubscribeError?.();
      };
    }, []);
  };
}

// Shown once per app process, on cold start.
export const useInterstitialOnce = createOnceInterstitialHook('app-launch');

// Shown once per app process, the first time the scoreboard setup screen is opened —
// shares the same session-wide cap as the app-launch interstitial above, so a
// user only ever sees one interstitial total per session, from whichever
// trigger fires first.
export const useScoreboardEntryInterstitial = createOnceInterstitialHook('scoreboard-entry');
