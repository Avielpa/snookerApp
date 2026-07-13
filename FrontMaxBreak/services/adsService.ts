// services/adsService.ts
import { useEffect } from 'react';
import mobileAds, {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { logger } from '../utils/logger';

const REAL_BANNER_AD_UNIT_ID = 'ca-app-pub-7026436404209900/5896032920';
const REAL_INTERSTITIAL_AD_UNIT_ID = 'ca-app-pub-7026436404209900/4391379567';

export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : REAL_BANNER_AD_UNIT_ID;
export const INTERSTITIAL_AD_UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : REAL_INTERSTITIAL_AD_UNIT_ID;

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
    let unsubscribeLoaded: (() => void) | undefined;
    let unsubscribeError: (() => void) | undefined;

    initAds().then(() => {
      if (!isMounted || interstitialShownThisSession) return;

      const interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID);

      unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        if (!interstitialShownThisSession) {
          interstitialShownThisSession = true;
          interstitial.show().catch((error: any) => {
            logger.warn('[Ads] Interstitial show failed:', error?.message);
          });
        }
      });

      unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error: any) => {
        logger.warn('[Ads] Interstitial load failed:', error?.message);
      });

      interstitial.load();
    });

    return () => {
      isMounted = false;
      unsubscribeLoaded?.();
      unsubscribeError?.();
    };
  }, []);
}
