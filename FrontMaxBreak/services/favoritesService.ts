// services/favoritesService.ts
// Device-local favourites (players + matches) with server sync.
// Uses an in-memory cache so reads are synchronous after first load.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { getOrCreateDeviceId } from '../utils/deviceIdentity';
import { getAuthHeader } from './authService';
import { logger } from '../utils/logger';

const CACHE_KEY = '@maxbreak_favorites';

interface Favorites {
    playerIds: number[];
    matchIds: number[];
}

// In-memory cache — populated on first loadFavorites() call
let cache: Favorites | null = null;

// Warm cache immediately when module is imported so sync reads work on first render
(async () => {
    try {
        const stored = await AsyncStorage.getItem(CACHE_KEY);
        if (stored && !cache) cache = JSON.parse(stored);
    } catch {}
})();

async function readCache(): Promise<Favorites> {
    if (cache) return cache;
    try {
        const stored = await AsyncStorage.getItem(CACHE_KEY);
        if (stored) {
            cache = JSON.parse(stored);
            return cache!;
        }
    } catch {}
    return { playerIds: [], matchIds: [] };
}

async function writeCache(favs: Favorites): Promise<void> {
    cache = favs;
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(favs));
    } catch (e) {
        logger.error('[Favorites] Failed to persist to AsyncStorage', e);
    }
}

/**
 * Clear all favorites tied to this device on logout — local cache AND the
 * backend device-level row. Without clearing both, a different account
 * logging in on the same device would inherit the previous account's
 * favorites two ways: from the local cache directly, and from re-fetching
 * the still-populated DeviceToken row via `device/favorites/`. Either path
 * alone would then get auto-pushed onto the new account by loadFavorites().
 * Best-effort — a failed backend clear must not block logout.
 */
export async function clearFavoritesCache(): Promise<void> {
    cache = { playerIds: [], matchIds: [] };
    try {
        await AsyncStorage.removeItem(CACHE_KEY);
    } catch (e) {
        logger.error('[Favorites] Failed to clear AsyncStorage cache', e);
    }
    try {
        const deviceId = await getOrCreateDeviceId();
        await Promise.allSettled([
            api.patch('device/favorites/players/', { device_id: deviceId, player_ids: [] }),
            api.patch('device/favorites/matches/', { device_id: deviceId, match_ids: [] }),
        ]);
    } catch (e) {
        logger.warn('[Favorites] Could not clear device-level favorites on logout', e);
    }
}

/**
 * Load favourites from server (falls back to local cache on error).
 * Also primes the in-memory cache for synchronous reads.
 */
export async function loadFavorites(): Promise<Favorites> {
    // Always read local cache first so we never lose locally-saved stars
    const local = await readCache();
    const allPlayerIds = new Set(local.playerIds);
    const allMatchIds = new Set(local.matchIds);

    // Load from device UUID endpoint
    try {
        const deviceId = await getOrCreateDeviceId();
        const response = await api.get(`device/favorites/?device_id=${deviceId}`);
        (response.data.player_ids ?? []).map(Number).forEach((id: number) => allPlayerIds.add(id));
        (response.data.match_ids ?? []).map(Number).forEach((id: number) => allMatchIds.add(id));
    } catch {
        logger.warn('[Favorites] Could not load device favorites from server');
    }

    // Load from user account endpoint if logged in (cross-device sync)
    let authHeader: string | null = null;
    let userPlayerIds: number[] = [];
    let userMatchIds: number[] = [];
    try {
        authHeader = await getAuthHeader();
        if (authHeader) {
            const response = await api.get('user/favorites/', { headers: { Authorization: authHeader } });
            userPlayerIds = (response.data.player_ids ?? []).map(Number);
            userMatchIds = (response.data.match_ids ?? []).map(Number);
            userPlayerIds.forEach((id: number) => allPlayerIds.add(id));
            userMatchIds.forEach((id: number) => allMatchIds.add(id));
        }
    } catch {
        logger.warn('[Favorites] Could not load user favorites from server');
    }

    const merged: Favorites = {
        playerIds: Array.from(allPlayerIds),
        matchIds: Array.from(allMatchIds),
    };
    if (merged.playerIds.length > 0 || merged.matchIds.length > 0 || local.playerIds.length > 0 || local.matchIds.length > 0) {
        await writeCache(merged);
    }

    // Close the account-sync gap: favorites starred while logged out (or on a
    // device before it was linked) live only in the device/local layer and
    // never reach the account, so other devices on the same account never see
    // them and never get notified. Push the merged union up once we detect it
    // has grown beyond what the account already has.
    if (authHeader) {
        const hasNewPlayers = merged.playerIds.some((id) => !userPlayerIds.includes(id));
        const hasNewMatches = merged.matchIds.some((id) => !userMatchIds.includes(id));
        if (hasNewPlayers) {
            api.patch('user/favorites/players/', { player_ids: merged.playerIds }, { headers: { Authorization: authHeader } })
                .catch(() => logger.warn('[Favorites] Could not sync merged player favorites to account'));
        }
        if (hasNewMatches) {
            api.patch('user/favorites/matches/', { match_ids: merged.matchIds }, { headers: { Authorization: authHeader } })
                .catch(() => logger.warn('[Favorites] Could not sync merged match favorites to account'));
        }
    }

    return merged;
}

/**
 * Persist updated player favourites to server + local cache.
 */
export async function savePlayerFavorites(playerIds: number[]): Promise<void> {
    const current = await readCache();
    await writeCache({ ...current, playerIds });
    const [deviceId, authHeader] = await Promise.all([getOrCreateDeviceId(), getAuthHeader()]);
    await Promise.allSettled([
        api.patch('device/favorites/players/', { device_id: deviceId, player_ids: playerIds })
            .catch(() => logger.warn('[Favorites] Could not sync player favorites to device endpoint')),
        authHeader
            ? api.patch('user/favorites/players/', { player_ids: playerIds }, { headers: { Authorization: authHeader } })
                .catch(() => logger.warn('[Favorites] Could not sync player favorites to user endpoint'))
            : Promise.resolve(),
    ]);
}

/**
 * Persist updated match favourites to server + local cache.
 */
export async function saveMatchFavorites(matchIds: number[]): Promise<void> {
    const current = await readCache();
    await writeCache({ ...current, matchIds });
    const [deviceId, authHeader] = await Promise.all([getOrCreateDeviceId(), getAuthHeader()]);
    await Promise.allSettled([
        api.patch('device/favorites/matches/', { device_id: deviceId, match_ids: matchIds })
            .catch(() => logger.warn('[Favorites] Could not sync match favorites to device endpoint')),
        authHeader
            ? api.patch('user/favorites/matches/', { match_ids: matchIds }, { headers: { Authorization: authHeader } })
                .catch(() => logger.warn('[Favorites] Could not sync match favorites to user endpoint'))
            : Promise.resolve(),
    ]);
}

// ---- Synchronous helpers (use in-memory cache) ----

export function isPlayerFavouriteSync(playerId: number): boolean {
    return cache?.playerIds.includes(playerId) ?? false;
}

export function isMatchFavouriteSync(matchId: number): boolean {
    return cache?.matchIds.includes(matchId) ?? false;
}

// ---- Toggle helpers ----

export async function togglePlayerFavourite(playerId: number): Promise<boolean> {
    const favs = await readCache();
    const isFav = favs.playerIds.includes(playerId);
    const updated = isFav
        ? favs.playerIds.filter((id) => id !== playerId)
        : [...favs.playerIds, playerId];
    await savePlayerFavorites(updated);
    return !isFav;
}

// ---- Async helpers (read from AsyncStorage when in-memory cache isn't warm yet) ----

export async function isMatchFavouriteAsync(matchId: number): Promise<boolean> {
    const favs = await readCache();
    return favs.matchIds.includes(matchId);
}

export async function isPlayerFavouriteAsync(playerId: number): Promise<boolean> {
    const favs = await readCache();
    return favs.playerIds.includes(playerId);
}

export async function toggleMatchFavourite(matchId: number): Promise<boolean> {
    const favs = await readCache();
    const isFav = favs.matchIds.includes(matchId);
    const updated = isFav
        ? favs.matchIds.filter((id) => id !== matchId)
        : [...favs.matchIds, matchId];
    await saveMatchFavorites(updated);
    return !isFav;
}
