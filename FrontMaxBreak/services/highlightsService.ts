// services/highlightsService.ts
//
// Fetches YouTube channel highlights via the YouTube Data API v3.
// Uses the uploads playlist trick: channel ID 'UC...' → playlist ID 'UU...' (no extra API call).
//
// To add a new channel:
//   1. Visit youtube.com/@ChannelHandle → View Source → search "externalId" to get UC...
//   2. Add a constant below and a one-liner export function
//
// Channel IDs:
//   WST     — UC5lTEvtwu6SR3LMSmU9VZ2Q  (youtube.com/@WorldSnookerTour)
//   TNT     — UCexJsWmC7rvfRaqK8MF3JFA  (TNT Sports Snooker)
//   Mubeen  — UCb4vVvFCy29IC-9soDMQgCw
//   SASA    — UC7Fu3Qlk9IfFWA2bpfYF7GA
//   Shachar — UCC7zF2g2XmvzXLP--sGj2BQ  (Shachar Rodberg)
//
// Quota: playlistItems.list = 1 unit. Free tier = 10,000 units/day.
// API key rotation: run `eas secret:create --scope project --name EXPO_PUBLIC_YOUTUBE_API_KEY --value NEW_KEY --force`
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';
import { getSeasonEvents, Event } from './tourServices';

const WST_CHANNEL_ID    = 'UC5lTEvtwu6SR3LMSmU9VZ2Q';
const TNT_CHANNEL_ID    = 'UCexJsWmC7rvfRaqK8MF3JFA';
const MUBEEN_CHANNEL_ID = 'UCb4vVvFCy29IC-9soDMQgCw';
const SASA_CHANNEL_ID   = 'UC7Fu3Qlk9IfFWA2bpfYF7GA';
const SHACHAR_CHANNEL_ID = 'UCC7zF2g2XmvzXLP--sGj2BQ';

// Key is injected at build time via EAS Secrets (never hardcoded).
// To rotate: run `eas secret:create --scope project --name EXPO_PUBLIC_YOUTUBE_API_KEY --value NEW_KEY --force`
const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;

export interface Highlight {
    videoId: string;
    title: string;
    published_at: string;
    thumbnail_url: string;
    url: string;
}

export interface HighlightsResult {
    highlights: Highlight[];
    filterName: string | null;
}

function uploadsPlaylistId(channelId: string): string {
    return 'UU' + channelId.slice(2);
}

async function fetchWithCache(key: string, fetcher: () => Promise<Highlight[]>): Promise<Highlight[]> {
    const fresh = await fetcher();
    if (fresh.length > 0) {
        AsyncStorage.setItem(key, JSON.stringify(fresh)).catch(() => {});
        return fresh;
    }
    try {
        const cached = await AsyncStorage.getItem(key);
        return cached ? JSON.parse(cached) : [];
    } catch {
        return [];
    }
}

async function fetchChannelVideos(channelId: string, label: string, maxResults = 20): Promise<Highlight[]> {
    const playlistId = uploadsPlaylistId(channelId);
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${maxResults}&key=${YOUTUBE_API_KEY}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
            logger.warn(`[${label}] YouTube API returned ${res.status}`);
            return [];
        }
        const data = await res.json();
        const highlights: Highlight[] = (data.items ?? [])
            .map((item: any) => {
                const s = item.snippet;
                const videoId: string = s?.resourceId?.videoId ?? '';
                const title: string = s?.title ?? '';
                if (!videoId || !title || title === 'Private video' || title === 'Deleted video') return null;
                return {
                    videoId,
                    title,
                    published_at: s?.publishedAt ?? '',
                    thumbnail_url: s?.thumbnails?.high?.url ?? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                };
            })
            .filter(Boolean) as Highlight[];
        logger.log(`[${label}] Fetched ${highlights.length} videos`);
        return highlights;
    } catch (e) {
        logger.warn(`[${label}] Failed: ${e}`);
        return [];
    } finally {
        clearTimeout(timeout);
    }
}

function getFilterName(events: Event[]): string | null {
    const now = new Date();
    const mainTours = events.filter(e => e.Tour === 'main' && e.Name && e.StartDate && e.EndDate);

    const active = mainTours.find(e => {
        const start = new Date(e.StartDate!);
        const end = new Date(e.EndDate!);
        end.setHours(23, 59, 59, 999);
        return start <= now && now <= end;
    });
    if (active?.Name) return active.Name;

    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = mainTours
        .filter(e => {
            const end = new Date(e.EndDate!);
            return end >= cutoff && end < now;
        })
        .sort((a, b) => new Date(b.EndDate!).getTime() - new Date(a.EndDate!).getTime())[0];
    return recent?.Name ?? null;
}

export function filterHighlightsByTournament(highlights: Highlight[], name: string): Highlight[] {
    const filler = new Set(['the', 'snooker', 'championship', 'at', 'in', 'of', 'and', 'vs', '&', 'tour']);
    const keywords = name
        .toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 2 && !filler.has(w));
    return highlights.filter(h =>
        keywords.some(kw => h.title.toLowerCase().includes(kw))
    );
}

// Highlights tab channels
export async function fetchHighlights(): Promise<HighlightsResult> {
    try {
        const [highlights, events] = await Promise.all([
            fetchWithCache('highlights_wst', () => fetchChannelVideos(WST_CHANNEL_ID, 'WST')),
            getSeasonEvents(),
        ]);
        return { highlights, filterName: getFilterName(events) };
    } catch (e) {
        logger.warn(`[WST] Failed: ${e}`);
        return { highlights: [], filterName: null };
    }
}

export const fetchTNT     = () => fetchWithCache('highlights_tnt',    () => fetchChannelVideos(TNT_CHANNEL_ID,    'TNT'));

// Creators tab channels
export const fetchMubeen  = () => fetchWithCache('highlights_mubeen', () => fetchChannelVideos(MUBEEN_CHANNEL_ID, 'Mubeen'));
export const fetchSASA    = () => fetchWithCache('highlights_sasa',   () => fetchChannelVideos(SASA_CHANNEL_ID,   'SASA'));
export const fetchShachar = () => fetchWithCache('highlights_shachar', () => fetchChannelVideos(SHACHAR_CHANNEL_ID, 'Shachar'));
