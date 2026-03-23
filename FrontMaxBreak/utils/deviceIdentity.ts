// utils/deviceIdentity.ts
// Generates and persists a stable UUID for this device (no sign-up required).
// Uses SecureStore (backed by Android Keystore / iOS Keychain) so the ID survives
// app reinstalls and storage clears. Falls back to AsyncStorage if SecureStore is
// unavailable, and migrates any existing AsyncStorage UUID on first run.

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@maxbreak_device_id';
const SECURE_OPTIONS = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

let cachedDeviceId: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
    if (cachedDeviceId) return cachedDeviceId;

    try {
        // 1. Try SecureStore (survives reinstall)
        let id = await SecureStore.getItemAsync(KEY, SECURE_OPTIONS);

        if (!id) {
            // 2. Migrate from AsyncStorage (one-time, transparent)
            const legacy = await AsyncStorage.getItem(KEY).catch(() => null);
            if (legacy) {
                id = legacy;
                await AsyncStorage.removeItem(KEY).catch(() => {});
            }
        }

        if (!id) {
            // 3. Generate fresh UUID
            id = generateUUID();
        }

        await SecureStore.setItemAsync(KEY, id, SECURE_OPTIONS);
        cachedDeviceId = id;
        return id;
    } catch {
        // SecureStore unavailable — fall back to AsyncStorage
        try {
            let id = await AsyncStorage.getItem(KEY);
            if (!id) {
                id = generateUUID();
                await AsyncStorage.setItem(KEY, id);
            }
            cachedDeviceId = id;
            return id;
        } catch {
            // Last resort: transient in-memory UUID
            if (!cachedDeviceId) cachedDeviceId = generateUUID();
            return cachedDeviceId;
        }
    }
}
