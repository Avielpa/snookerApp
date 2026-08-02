// hooks/useTrackingPermissions.ts
// App Tracking Transparency (ATT) — required by Apple whenever an ad SDK is
// present in the bundle (App Store Review Guideline 5.1.2), independent of
// whether the ads end up personalized. Android has no ATT concept, so every
// entry point here is a safe no-op off iOS.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { logger } from '../utils/logger';

let attRequestPromise: Promise<void> | null = null;

// Ensures the ATT prompt has been shown (or the permission was already
// resolved from a prior launch) at most once per app process. Memoized so
// it's safe to call from multiple places — the root layout (to prompt as
// early as possible) and the ad SDK's own init path (so ad requests always
// wait for this to settle first, regardless of component mount order).
export function ensureTrackingPermissionRequested(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  // Guards against dev clients/Expo Go builds that haven't been rebuilt
  // with this native module yet — avoids a hard crash there.
  if (!TrackingTransparency.isAvailable()) return Promise.resolve();

  if (!attRequestPromise) {
    attRequestPromise = TrackingTransparency.getTrackingPermissionsAsync()
      .then(({ status }) => {
        if (status === 'undetermined') {
          return TrackingTransparency.requestTrackingPermissionsAsync().then((result) => {
            logger.log(`[ATT] Permission requested, result: ${result.status}`);
          });
        }
        logger.log(`[ATT] Permission already resolved: ${status}`);
      })
      .catch((error: any) => {
        logger.warn('[ATT] Permission request failed:', error?.message);
      });
  }
  return attRequestPromise;
}

// Thin hook wrapper — call once near the app root so the ATT dialog appears
// as early as possible, rather than waiting for the first ad to mount.
export function useTrackingPermissions(): void {
  useEffect(() => {
    ensureTrackingPermissionRequested();
  }, []);
}
