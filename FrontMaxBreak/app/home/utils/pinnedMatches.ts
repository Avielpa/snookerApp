// app/home/utils/pinnedMatches.ts
// Hoists user-pinned (starred/favourited) matches to a dedicated section at
// the top of an already-filtered match list, leaving everything else in its
// original order under its existing status/round headers.
import { ListItem } from '../types';

export const PINNED_SECTION_ID = 'statusHeader-pinned';

export function pinMatchesToTop(items: ListItem[], pinnedMatchIds: Set<number>): ListItem[] {
    if (pinnedMatchIds.size === 0) return items;

    const pinned: ListItem[] = [];
    const rest: ListItem[] = [];

    for (const item of items) {
        if (item.type === 'match') {
            const matchId = item.api_match_id ?? item.id;
            if (matchId != null && pinnedMatchIds.has(matchId)) {
                pinned.push(item);
                continue;
            }
        }
        rest.push(item);
    }

    if (pinned.length === 0) return rest;

    // Drop any header left with no match belonging to it — this only happens
    // when every match under that header got pinned away. Headers are NOT
    // always immediately adjacent to their own match in the original data
    // (e.g. statusHeader -> roundHeader -> match, or stacked "To Be
    // Continued"/"Upcoming" divider headers with no match directly between
    // them) — so position-based lookahead is unreliable. Match round headers
    // to surviving matches by `round` instead; statusHeader and round-less
    // divider headers survive as long as any match remains at all.
    const hasAnyMatchLeft = rest.some((item) => item.type === 'match');
    const roundsWithMatches = new Set(
        rest.filter((item): item is ListItem & { type: 'match' } => item.type === 'match')
            .map((item) => item.round ?? null)
    );

    const cleaned = rest.filter((item) => {
        if (item.type === 'match') return true;
        if (item.type === 'statusHeader') return hasAnyMatchLeft;
        // roundHeader: a specific round survives only if a match of that
        // exact round remains; round-less divider headers (e.g. "To Be
        // Continued") fall back to "does anything remain at all".
        return item.round == null ? hasAnyMatchLeft : roundsWithMatches.has(item.round);
    });

    return [
        {
            type: 'statusHeader',
            title: 'Pinned Matches',
            iconName: 'star',
            id: PINNED_SECTION_ID,
        },
        ...pinned,
        ...cleaned,
    ];
}
