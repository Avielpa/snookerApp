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
    try {
        const authHeader = await getAuthHeader();
        if (authHeader) {
            const response = await api.get('user/favorites/', { headers: { Authorization: authHeader } });
            (response.data.player_ids ?? []).map(Number).forEach((id: number) => allPlayerIds.add(id));
            (response.data.match_ids ?? []).map(Number).forEach((id: number) => allMatchIds.add(id));
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
