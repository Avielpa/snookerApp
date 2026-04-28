// utils/deviceIdentity.ts
// Generates and persists a stable UUID for this device (no sign-up required).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

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

    const newId = generateUUID();
    try {
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (stored) {
            cachedDeviceId = stored;
            return stored;
        }
        await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    } catch (e) {
        logger.warn('[DeviceIdentity] AsyncStorage error, using in-memory UUID only', e);
    }
    cachedDeviceId = newId;
    return newId;
}
