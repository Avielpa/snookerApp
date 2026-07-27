// services/mutedMatchesService.ts
// Device-local "muted" state for pinned matches — lets a user keep a match
// pinned to the top of their Home feed while suppressing its notifications.
//
// UI SHELL ONLY — unlike favoritesService's match-pinning (which already
// drives real push notifications via the live-monitor daemon, see
// oneFourSeven/push_notifications.py::get_tokens_for_match), this is
// frontend-only for now. Toggling mute here does NOT currently affect
// whether the backend sends a notification.
//
// TODO(notifications): wire this into the backend before shipping it as a
// real feature — get_tokens_for_match would need to exclude devices that
// have muted a given match_id (e.g. a parallel `muted_match_ids` field on
// DeviceToken/UserFavorite, checked alongside favorite_match_ids).
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = '@maxbreak_muted_matches';

let cache: number[] | null = null;

async function readCache(): Promise<number[]> {
    if (cache) return cache;
    let ids: number[] = [];
    try {
        const stored = await AsyncStorage.getItem(CACHE_KEY);
        ids = stored ? JSON.parse(stored) : [];
    } catch {
        ids = [];
    }
    cache = ids;
    return ids;
}

async function writeCache(ids: number[]): Promise<void> {
    cache = ids;
    try {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(ids));
    } catch {
        // best-effort — local UI state only, not worth surfacing an error for
    }
}

export function isMatchMutedSync(matchId: number): boolean {
    return cache?.includes(matchId) ?? false;
}

export async function isMatchMutedAsync(matchId: number): Promise<boolean> {
    const ids = await readCache();
    return ids.includes(matchId);
}

export async function toggleMatchMute(matchId: number): Promise<boolean> {
    const ids = await readCache();
    const isMuted = ids.includes(matchId);
    const updated = isMuted ? ids.filter((id) => id !== matchId) : [...ids, matchId];
    await writeCache(updated);
    return !isMuted;
}
