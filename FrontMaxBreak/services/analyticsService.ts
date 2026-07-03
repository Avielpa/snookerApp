// services/analyticsService.ts
import analytics from '@react-native-firebase/analytics';
import { logger } from '../utils/logger';

export async function logScreenView(screenName: string): Promise<void> {
    try {
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
        await analytics().logEvent(eventName, params);
    } catch (err) {
        logger.warn('[analyticsService] logTap failed', err);
    }
}
