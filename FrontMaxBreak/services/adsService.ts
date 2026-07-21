import { Platform } from 'react-native';
import {
  ADMOB_IOS_BANNER_ID,
  ADMOB_IOS_INTERSTITIAL_ID,
  ADMOB_ANDROID_BANNER_ID,
  ADMOB_ANDROID_INTERSTITIAL_ID,
} from '../config/ads';

// Google test ad unit IDs
const GOOGLE_TEST_BANNER = __DEV__ ? 'ca-app-pub-3940256099942544/6300978111' : undefined;
const GOOGLE_TEST_INTERSTITIAL = __DEV__ ? 'ca-app-pub-3940256099942544/1033173712' : undefined;

// Platform-specific real IDs
export const REAL_BANNER_AD_UNIT_ID_IOS = ADMOB_IOS_BANNER_ID;
export const REAL_INTERSTITIAL_AD_UNIT_ID_IOS = ADMOB_IOS_INTERSTITIAL_ID;
export const REAL_BANNER_AD_UNIT_ID_ANDROID = ADMOB_ANDROID_BANNER_ID;
export const REAL_INTERSTITIAL_AD_UNIT_ID_ANDROID = ADMOB_ANDROID_INTERSTITIAL_ID;

// Exposed IDs (the app should use these constants)
export const BANNER_AD_UNIT_ID = __DEV__
  ? GOOGLE_TEST_BANNER
  : Platform.OS === 'ios'
  ? REAL_BANNER_AD_UNIT_ID_IOS
  : REAL_BANNER_AD_UNIT_ID_ANDROID;

export const INTERSTITIAL_AD_UNIT_ID = __DEV__
  ? GOOGLE_TEST_INTERSTITIAL
  : Platform.OS === 'ios'
  ? REAL_INTERSTITIAL_AD_UNIT_ID_IOS
  : REAL_INTERSTITIAL_AD_UNIT_ID_ANDROID;

// Ads are intentionally disabled at runtime until a build-compatible native SDK
// integration is available for this Expo SDK version.
export const ADS_ENABLED = false;

let hasInitialized = false;
let shownThisSession = false;

export async function initAds(): Promise<void> {
  if (hasInitialized) return;
  try {
    // Dynamically require expo-ads-admob to avoid hard dependency failures in other environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admob = require('expo-ads-admob');
    if (admob && admob.AdMobInterstitial) {
      const { AdMobInterstitial } = admob;
      const interstitialId = INTERSTITIAL_AD_UNIT_ID;
      if (interstitialId) {
        try {
          AdMobInterstitial.setAdUnitID(interstitialId);
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // expo-ads-admob not installed — ignore silently
  }
  hasInitialized = true;
}

export async function showInterstitialOnce(): Promise<void> {
  if (shownThisSession) return;
  shownThisSession = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const admob = require('expo-ads-admob');
    if (admob && admob.AdMobInterstitial) {
      const { AdMobInterstitial } = admob;
      const interstitialId = INTERSTITIAL_AD_UNIT_ID;
      if (!interstitialId) return;
      try {
        AdMobInterstitial.setAdUnitID(interstitialId);
        await AdMobInterstitial.requestAdAsync({ servePersonalizedAds: true });
        await AdMobInterstitial.showAdAsync();
      } catch (e) {
        // ignore fail-to-show
      }
    }
  } catch (e) {
    // SDK not installed — no-op
  }
}
