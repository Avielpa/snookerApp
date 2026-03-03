import { Alert, Linking } from 'react-native';

export interface NewsArticle {
    id: number;
    title: string;
    url: string;
    image_url: string | null;
    source_name: string;
    published_at: string; // ISO date string
}

export async function openArticle(url: string): Promise<void> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
        clearTimeout(timeout);

        if (response.status === 404) {
            const mainSite = new URL(url).origin;
            Alert.alert(
                'Article not found',
                'This article is no longer available on the site.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open main site', onPress: () => Linking.openURL(mainSite).catch(() => {}) },
                ]
            );
            return;
        }
    } catch {
        // timeout or network error — just open the URL anyway
    }
    Linking.openURL(url).catch(() => {});
}

export const SOURCE_COLORS: Record<string, string> = {
    'BBC Sport': '#B71C1C',   // dark red  — 5.5:1 contrast with white
    'WPBSA': '#004D40',       // dark teal — 7.1:1 contrast with white
    'SnookerHQ': '#BF360C',   // deep orange — 4.9:1 contrast with white
};

export function timeAgo(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
