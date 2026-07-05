// services/analyticsService.ts
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

// iOS has no GoogleService-Info.plist configured (no iOS app registered in
// Firebase Console yet — see app.config.js). Confirmed by device testing:
// actually calling into @react-native-firebase/analytics on the current iOS
// binary crashes natively (not a catchable JS exception — bypasses try/catch
// below), so this must never even attempt the call on iOS, not just guard the
// import. Remove this platform check once iOS has a proper native Firebase build.
const ANALYTICS_SUPPORTED = Platform.OS !== 'ios';

// Lazy + guarded require: @react-native-firebase/analytics throws synchronously
// at import time if the native module isn't compiled into the installed binary
// (e.g. users still on an older Android build predating Firebase integration).
// A static top-level import would crash the entire app on launch for those
// users, since this file is pulled in by the root layout for every screen.
let analyticsModule: typeof import('@react-native-firebase/analytics').default | null | undefined;

function getAnalytics() {
    if (!ANALYTICS_SUPPORTED) return null;
    if (analyticsModule === undefined) {
        try {
            analyticsModule = require('@react-native-firebase/analytics').default;
        } catch (err) {
            logger.warn('[analyticsService] native module unavailable', err);
            analyticsModule = null;
        }
    }
    return analyticsModule;
}

export async function logScreenView(screenName: string): Promise<void> {
    try {
        const analytics = getAnalytics();
        if (!analytics) return;
        await analytics().logScreenView({
            screen_name: screenName,
            screen_class: screenName,
        });
    } catch (err) {
        logger.warn('[analyticsService] logScreenView failed', err);
    }
}

export async function logTap(eventName: string, params?: Record<string, string | number | boolean>): Promise<void> {
    try {
        const analytics = getAnalytics();
        if (!analytics) return;
        await analytics().logEvent(eventName, params);
    } catch (err) {
        logger.warn('[analyticsService] logTap failed', err);
    }
}
