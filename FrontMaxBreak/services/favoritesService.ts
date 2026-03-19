// services/favoritesService.ts
// Device-local favourites (players + matches) with server sync.
// Uses an in-memory cache so reads are synchronous after first load.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';
import { getOrCreateDeviceId } from '../utils/deviceIdentity';
import { logger } from '../utils/logger';

const CACHE_KEY = '@maxbreak_favorites';

interface Favorites {
    playerIds: number[];
    matchIds: number[];
}

// In-memory cache — populated on first loadFavorites() call
let cache: Favorites | null = null;

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
    } catch {}
}

/**
 * Load favourites from server (falls back to local cache on error).
 * Also primes the in-memory cache for synchronous reads.
 */
export async function loadFavorites(): Promise<Favorites> {
    try {
        const deviceId = await getOrCreateDeviceId();
        const response = await api.get(`device/favorites/?device_id=${deviceId}`);
        const favs: Favorites = {
            playerIds: (response.data.player_ids ?? []).map(Number),
            matchIds: (response.data.match_ids ?? []).map(Number),
        };
        await writeCache(favs);
        return favs;
    } catch (error) {
        logger.warn('[Favorites] Could not load from server, using local cache');
        return readCache();
    }
}

/**
 * Persist updated player favourites to server + local cache.
 */
export async function savePlayerFavorites(playerIds: number[]): Promise<void> {
    const current = await readCache();
    await writeCache({ ...current, playerIds });
    try {
        const deviceId = await getOrCreateDeviceId();
        await api.patch('device/favorites/players/', { device_id: deviceId, player_ids: playerIds });
    } catch (error) {
        logger.warn('[Favorites] Could not sync player favorites to server');
    }
}

/**
 * Persist updated match favourites to server + local cache.
 */
export async function saveMatchFavorites(matchIds: number[]): Promise<void> {
    const current = await readCache();
    await writeCache({ ...current, matchIds });
    try {
        const deviceId = await getOrCreateDeviceId();
        await api.patch('device/favorites/matches/', { device_id: deviceId, match_ids: matchIds });
    } catch (error) {
        logger.warn('[Favorites] Could not sync match favorites to server');
    }
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

export async function toggleMatchFavourite(matchId: number): Promise<boolean> {
    const favs = await readCache();
    const isFav = favs.matchIds.includes(matchId);
    const updated = isFav
        ? favs.matchIds.filter((id) => id !== matchId)
        : [...favs.matchIds, matchId];
    await saveMatchFavorites(updated);
    return !isFav;
}
