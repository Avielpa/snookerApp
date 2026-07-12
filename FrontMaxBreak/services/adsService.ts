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
