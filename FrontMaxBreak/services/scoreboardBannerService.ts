import AsyncStorage from '@react-native-async-storage/async-storage';

export const BANNER_FIRST_SHOWN_KEY = '@maxbreak_scoreboard_banner_first_shown';
export const PROMO_WINDOW_DAYS = 10;

/**
 * Idempotent — sets the first-shown timestamp on first-ever call from anywhere
 * (banner, badge, profile dot all share this single window), reads it afterwards.
 */
export async function isWithinPromoWindow(): Promise<boolean> {
    try {
        const stored = await AsyncStorage.getItem(BANNER_FIRST_SHOWN_KEY);
        if (stored === null) {
            await AsyncStorage.setItem(BANNER_FIRST_SHOWN_KEY, new Date().toISOString());
            return true;
        }
        const firstShown = new Date(stored).getTime();
        const daysElapsed = (Date.now() - firstShown) / (1000 * 60 * 60 * 24);
        return daysElapsed <= PROMO_WINDOW_DAYS;
    } catch {
        return false;
    }
}

export const shouldShowScoreboardBanner = isWithinPromoWindow;
