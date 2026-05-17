import AsyncStorage from '@react-native-async-storage/async-storage';

export const NUDGE_KEY = '@maxbreak_signup_nudge_shown';

export async function shouldShowSignupNudge(): Promise<boolean> {
    try {
        const val = await AsyncStorage.getItem(NUDGE_KEY);
        return val === null;
    } catch {
        return true;
    }
}

export async function markSignupNudgeShown(): Promise<void> {
    try {
        await AsyncStorage.setItem(NUDGE_KEY, 'true');
    } catch {
        // best-effort
    }
}

export async function resetSignupNudge(): Promise<void> {
    try {
        await AsyncStorage.removeItem(NUDGE_KEY);
    } catch {
        // best-effort
    }
}
