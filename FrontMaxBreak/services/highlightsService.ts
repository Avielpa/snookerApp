// services/highlightsService.ts
//
// Fetches World Snooker Tour highlights from their official YouTube channel RSS feed.
// No API key needed — YouTube provides a free public Atom feed per channel.
//
// If the feed returns empty results, the channel username may have changed.
// To find the current channel ID:
//   1. Visit youtube.com/@WorldSnookerTour on desktop
//   2. Right-click → View Page Source → search for "externalId"
//   3. Replace: ?user=WorldSnookerOfficial  →  ?channel_id=UC...
import { logger } from '../utils/logger';
import { getSeasonEvents, Event } from './tourServices';

const WST_YOUTUBE_RSS = 'https://www.youtube.com/feeds/videos.xml?user=WorldSnookerOfficial';

export interface Highlight {
    videoId: string;
    title: string;
    published_at: string;
    thumbnail_url: string;
    url: string;
}

export interface HighlightsResult {
    highlights: Highlight[];
    filterName: string | null; // current or most recent tour name — used for filter chip
}

function parseHighlights(xml: string): Highlight[] {
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    return entries
        .map(entry => {
            const videoId = (entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/) ?? [])[1]?.trim() ?? '';
            const rawTitle = (entry.match(/<title>([\s\S]*?)<\/title>/) ?? [])[1]?.trim() ?? '';
            const published = (entry.match(/<published>([\s\S]*?)<\/published>/) ?? [])[1]?.trim() ?? '';
            const title = rawTitle
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'");
            return {
                videoId,
                title,
                published_at: published,
                thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
            };
        })
        .filter(h => h.videoId && h.title);
}

function getFilterName(events: Event[]): string | null {
    const now = new Date();
    const mainTours = events.filter(e => e.Tour === 'main' && e.Name && e.StartDate && e.EndDate);

    // Active tour takes priority
    const active = mainTours.find(e => {
        const start = new Date(e.StartDate!);
        const end = new Date(e.EndDate!);
        end.setHours(23, 59, 59, 999);
        return start <= now && now <= end;
    });
    if (active?.Name) return active.Name;

    // Fall back to most recently ended tour (within 30 days)
    const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recent = mainTours
        .filter(e => {
            const end = new Date(e.EndDate!);
            return end >= cutoff && end < now;
        })
        .sort((a, b) => new Date(b.EndDate!).getTime() - new Date(a.EndDate!).getTime())[0];
    return recent?.Name ?? null;
}

// Exported so NewsScreen can apply the filter client-side
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

export async function fetchHighlights(): Promise<HighlightsResult> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const [res, events] = await Promise.all([
            fetch(WST_YOUTUBE_RSS, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; snooker-app/1.0)' },
            }),
            getSeasonEvents(),
        ]);
        clearTimeout(timeout);

        if (!res.ok) {
            logger.warn(`[Highlights] YouTube RSS returned ${res.status}`);
            return { highlights: [], filterName: null };
        }

        const xml = await res.text();
        const highlights = parseHighlights(xml);
        const filterName = getFilterName(events);

        logger.log(`[Highlights] Fetched ${highlights.length} videos, filter: "${filterName ?? 'none'}"`);
        return { highlights, filterName };
    } catch (e) {
        logger.warn(`[Highlights] Failed to fetch: ${e}`);
        return { highlights: [], filterName: null };
    }
}
