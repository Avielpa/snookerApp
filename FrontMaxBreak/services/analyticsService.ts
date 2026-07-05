// services/analyticsService.ts
import { logger } from '../utils/logger';

// Lazy + guarded require: @react-native-firebase/analytics throws synchronously
// at import time if the native module isn't compiled into the installed binary
// (e.g. users still on an older build predating Firebase integration). A static
// top-level import would crash the entire app on launch for those users, since
// this file is pulled in by the root layout for every screen. Resolving it lazily
// inside a try/catch means the worst case is analytics silently doesn't fire.
let analyticsModule: typeof import('@react-native-firebase/analytics').default | null | undefined;

function getAnalytics() {
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
