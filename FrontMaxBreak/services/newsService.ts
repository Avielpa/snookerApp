import { NewsArticle } from '../app/components/news/newsUtils';
import { logger } from '../utils/logger';

const RSS_FEEDS = [
    { url: 'https://feeds.bbci.co.uk/sport/snooker/rss.xml', sourceName: 'BBC Sport' },
    { url: 'https://wpbsa.com/feed',                          sourceName: 'WPBSA' },
    { url: 'https://snookerhq.com/feed',                      sourceName: 'SnookerHQ' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractText(xml: string, tag: string): string {
    // CDATA variant: <tag><![CDATA[...]]></tag>
    const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`).exec(xml);
    if (cdata) return cdata[1].trim();
    // Plain variant: <tag>...</tag>
    const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(xml);
    if (plain) return plain[1].trim();
    return '';
}

function extractLink(itemXml: string): string {
    // Standard <link> tag (handles CDATA too)
    const link = extractText(itemXml, 'link');
    if (link.startsWith('http')) return link;
    // <guid> is often the permalink in WordPress feeds
    const guid = extractText(itemXml, 'guid');
    if (guid.startsWith('http')) return guid;
    return '';
}

function extractImageUrl(itemXml: string): string | null {
    // BBC Sport uses media:thumbnail
    const mediaThumbnail = /media:thumbnail[^>]*url="([^"]+)"/.exec(itemXml);
    if (mediaThumbnail) return mediaThumbnail[1];
    // WordPress: enclosure (podcast/image attachment)
    const enclosure = /enclosure[^>]*url="([^"]+\.(jpg|jpeg|png|webp)[^"]*)"/.exec(itemXml);
    if (enclosure) return enclosure[1];
    // WordPress: media:content
    const mediaContent = /media:content[^>]*url="([^"]+)"/.exec(itemXml);
    if (mediaContent) return mediaContent[1];
    // Last resort: first <img> in content:encoded
    const imgTag = /<img[^>]+src="([^"]+\.(jpg|jpeg|png|webp))[^"]*"/.exec(itemXml);
    if (imgTag) return imgTag[1];
    return null;
}

// ─── Feed fetcher ─────────────────────────────────────────────────────────────

async function fetchFeed(feedUrl: string, sourceName: string, idOffset: number): Promise<NewsArticle[]> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(feedUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            logger.warn(`[News] ${sourceName} responded ${response.status}`);
            return [];
        }

        const xml = await response.text();
        const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? [];

        const articles: NewsArticle[] = [];
        itemMatches.slice(0, 5).forEach((item, index) => {
            const title = extractText(item, 'title');
            const url   = extractLink(item);
            if (!title || !url) return;

            const rawDate = extractText(item, 'pubDate') || extractText(item, 'dc:date');
            const published_at = rawDate
                ? new Date(rawDate).toISOString()
                : new Date().toISOString();

            articles.push({
                id: idOffset + index,
                title,
                url,
                image_url: extractImageUrl(item),
                source_name: sourceName,
                published_at,
            });
        });

        return articles;
    } catch (e) {
        logger.warn(`[News] Failed to fetch ${sourceName}: ${e}`);
        return [];
    }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchAllNews(): Promise<NewsArticle[]> {
    const results = await Promise.allSettled([
        fetchFeed(RSS_FEEDS[0].url, RSS_FEEDS[0].sourceName, 1000),
        fetchFeed(RSS_FEEDS[1].url, RSS_FEEDS[1].sourceName, 2000),
        fetchFeed(RSS_FEEDS[2].url, RSS_FEEDS[2].sourceName, 3000),
    ]);

    const articles: NewsArticle[] = [];
    for (const result of results) {
        if (result.status === 'fulfilled') articles.push(...result.value);
    }

    // Sort by newest first, return at most 15
    articles.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    return articles.slice(0, 15);
}
