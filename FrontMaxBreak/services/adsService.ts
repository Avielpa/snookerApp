// services/adsService.ts
import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

// Shown once per app process, the first time the scoreboard setup screen is opened —
// shares the same session-wide cap as other interstitial triggers, so a
// user only ever sees one interstitial total per session, from whichever
// trigger fires first.
export const useScoreboardEntryInterstitial = createOnceInterstitialHook('scoreboard-entry');

const MEDIA_INTERSTITIAL_COOLDOWN_KEY = '@maxbreak_media_interstitial_last_shown';
export const MEDIA_INTERSTITIAL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// Pure timestamp check — no RN/AsyncStorage dependency, so it's unit-testable
// in plain Node alongside the rest of the FrontMaxBreak test suite.
export function isMediaInterstitialCooldownElapsed(
  lastShownAt: number | null,
  now: number,
  cooldownMs: number = MEDIA_INTERSTITIAL_COOLDOWN_MS
): boolean {
  if (lastShownAt === null) return true;
  return now - lastShownAt >= cooldownMs;
}

// Shown on entering the Media tab, at most once per MEDIA_INTERSTITIAL_COOLDOWN_MS
// (persisted across app restarts via AsyncStorage) — unlike the "once per
// process" hooks above, repeatedly leaving and returning to the Media tab
// across separate app sessions must not re-show the ad every time. Still
// respects the shared session-wide cap so it doesn't double up with another
// interstitial trigger firing in the same session.
export function useMediaTabInterstitial(): void {
  useEffect(() => {
    if (!ADS_ENABLED || interstitialShownThisSession || !INTERSTITIAL_AD_UNIT_ID) return;

    let isMounted = true;
    let unsubscribeLoaded: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;

    AsyncStorage.getItem(MEDIA_INTERSTITIAL_COOLDOWN_KEY)
      .catch(() => null)
      .then((stored: string | null) => {
        if (!isMounted || interstitialShownThisSession) return;
        const lastShownAt = stored ? parseInt(stored, 10) : null;
        if (!isMediaInterstitialCooldownElapsed(lastShownAt, Date.now())) return;

        delayTimer = setTimeout(() => {
          if (interstitialShownThisSession) return;
          initAds().then(() => {
            if (!isMounted || interstitialShownThisSession) return;

            const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID as string);

            unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
              if (!isMounted || interstitialShownThisSession) return;
              interstitialShownThisSession = true;
              AsyncStorage.setItem(MEDIA_INTERSTITIAL_COOLDOWN_KEY, String(Date.now())).catch(() => {});
              interstitial.show().catch((error: any) => {
                logger.warn('[Ads] media-tab interstitial show failed:', error?.message);
              });
            });

            unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
              logger.warn('[Ads] media-tab interstitial load failed:', error?.message);
            });

            interstitial.load();
          });
        }, INTERSTITIAL_DELAY_MS);
      });

    return () => {
      isMounted = false;
      if (delayTimer) clearTimeout(delayTimer);
      unsubscribeLoaded?.();
      unsubscribeError?.();
    };
  }, []);
}
