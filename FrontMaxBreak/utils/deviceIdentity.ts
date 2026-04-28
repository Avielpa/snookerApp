// utils/deviceIdentity.ts
// Generates and persists a stable UUID for this device (no sign-up required).
// Dual-storage: AsyncStorage (primary) + SecureStore (backup).
// If AsyncStorage is cleared by the OS, SecureStore recovers the original UUID
// so favorites and notification subscriptions survive aggressive memory management.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { logger } from './logger';

const DEVICE_ID_KEY = '@maxbreak_device_id';
const SECURE_DEVICE_ID_KEY = 'maxbreak_device_id';

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
        // 1. Try AsyncStorage (fast, primary)
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (stored) {
            cachedDeviceId = stored;
            // Keep SecureStore in sync in case it's stale
            await SecureStore.setItemAsync(SECURE_DEVICE_ID_KEY, stored).catch(() => {});
            return stored;
        }

        // 2. AsyncStorage empty — check SecureStore for recovery
        const secured = await SecureStore.getItemAsync(SECURE_DEVICE_ID_KEY).catch(() => null);
        if (secured) {
            logger.warn('[DeviceIdentity] Recovered UUID from SecureStore — AsyncStorage was cleared');
            await AsyncStorage.setItem(DEVICE_ID_KEY, secured).catch(() => {});
            cachedDeviceId = secured;
            return secured;
        }

        // 3. First install — generate and persist to both stores
        const newId = generateUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, newId).catch(() => {});
        await SecureStore.setItemAsync(SECURE_DEVICE_ID_KEY, newId).catch(() => {});
        cachedDeviceId = newId;
        return newId;
    } catch (e) {
        logger.warn('[DeviceIdentity] Storage error, using in-memory UUID only', e);
        if (!cachedDeviceId) cachedDeviceId = generateUUID();
        return cachedDeviceId;
    }
}
