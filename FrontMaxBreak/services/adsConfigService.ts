// services/adsConfigService.ts
import firestore from '@react-native-firebase/firestore';
import { getOrCreateDeviceId } from '../utils/deviceIdentity';
import { logger } from '../utils/logger';

export type AdsRuntimeConfig = {
  bannersEnabled: boolean;
  interstitialsEnabled: boolean;
};

type RemoteAdsDoc = {
  bannersEnabled?: unknown;
  interstitialsEnabled?: unknown;
  disabledDeviceIds?: unknown;
};

const SAFE_DEFAULT: AdsRuntimeConfig = { bannersEnabled: true, interstitialsEnabled: true };

// Pure — kept side-effect-free so the exact same logic can be exercised from
// ads_config_test.mjs without any RN/Firestore dependency.
export function computeEffectiveAdsConfig(
  doc: RemoteAdsDoc | null | undefined,
  deviceId: string
): AdsRuntimeConfig {
  if (!doc) return SAFE_DEFAULT;
  const bannersEnabled = typeof doc.bannersEnabled === 'boolean' ? doc.bannersEnabled : true;
  const interstitialsEnabled = typeof doc.interstitialsEnabled === 'boolean' ? doc.interstitialsEnabled : true;
  const disabledDeviceIds = Array.isArray(doc.disabledDeviceIds) ? (doc.disabledDeviceIds as string[]) : [];
  if (disabledDeviceIds.includes(deviceId)) {
    return { bannersEnabled: false, interstitialsEnabled: false };
  }
  return { bannersEnabled, interstitialsEnabled };
}

let cachedConfig: AdsRuntimeConfig = SAFE_DEFAULT;
let initPromise: Promise<void> | null = null;

// Memoized, safe to call from every ad choke point (mirrors initAds() in
// adsService.ts) — only the first call actually fetches.
export function initAdsConfig(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const deviceId = await getOrCreateDeviceId();
        const snap = await firestore().collection('remote_config').doc('ads').get();
        const data = snap.exists() ? (snap.data() as RemoteAdsDoc) : null;
        cachedConfig = computeEffectiveAdsConfig(data, deviceId);
        logger.log('[AdsConfig] loaded:', cachedConfig);
      } catch (error: any) {
        logger.warn('[AdsConfig] fetch failed — defaulting to ads on:', error?.message);
        cachedConfig = SAFE_DEFAULT;
      }
    })();
  }
  return initPromise;
}

export function isAdsConfigEnabled(kind: 'banner' | 'interstitial'): boolean {
  return kind === 'banner' ? cachedConfig.bannersEnabled : cachedConfig.interstitialsEnabled;
}
