// utils/deviceIdentity.ts
// Generates and persists a stable UUID for this device (no sign-up required).

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = '@maxbreak_device_id';

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
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (stored) {
            cachedDeviceId = stored;
            return stored;
        }

        const newId = generateUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
        cachedDeviceId = newId;
        return newId;
    } catch {
        // Fallback: in-memory ID if AsyncStorage fails
        if (!cachedDeviceId) cachedDeviceId = generateUUID();
        return cachedDeviceId;
    }
}
