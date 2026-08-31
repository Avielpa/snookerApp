// One job: decide which Home upper drawer to show, and which other-live
// matches belong in it. Live tab → Also Live; other tabs → Today's Matches.
import { ActiveFilterType, MatchCategory, MatchListItem } from '../types';
import { TodayMatchGroupWithItems } from '../hooks/useTodayMatches';

export type HomeDrawerMode = 'today' | 'otherLive';

export const OTHER_LIVE_ACCENT = '#22C55E';

export interface OtherLiveSourceMatch extends MatchListItem {
    event_name: string;
    event_tour?: string;
}

export function resolveHomeDrawerMode(activeFilter: ActiveFilterType): HomeDrawerMode {
    return activeFilter === 'livePlaying' ? 'otherLive' : 'today';
}

export function shouldShowOtherLiveFooter(drawerMode: HomeDrawerMode): boolean {
    return drawerMode === 'today';
}

export function isLiveOrOnBreak(category: MatchCategory): boolean {
    return category === 'livePlaying' || category === 'onBreak';
}

export function matchIdentityKey(match: { id: number; api_match_id?: number | null }): string {
    if (match.api_match_id != null) return `api:${match.api_match_id}`;
    return `id:${match.id}`;
}

export function excludeLiveFromGroup(group: TodayMatchGroupWithItems): TodayMatchGroupWithItems | null {
    const matches = group.matches.filter((match) => !isLiveOrOnBreak(match.matchCategory));
    if (matches.length === 0) return null;
    return { ...group, matches };
}

export function excludeLiveFromGroups(groups: TodayMatchGroupWithItems[]): TodayMatchGroupWithItems[] {
    return groups
        .map(excludeLiveFromGroup)
        .filter((group): group is TodayMatchGroupWithItems => group != null);
}

export function countGroupMatches(groups: TodayMatchGroupWithItems[]): number {
    return groups.reduce((sum, group) => sum + group.matches.length, 0);
}

function isFocusedEvent(eventId: number, focusedEventId: number | null): boolean {
    return focusedEventId != null && eventId === focusedEventId;
}

function addToEventGroup(
    byEvent: Map<number, TodayMatchGroupWithItems>,
    match: OtherLiveSourceMatch
): void {
    const eventId = match.event_id ?? -(byEvent.size + 1);
    const existing = byEvent.get(eventId);
    if (existing) {
        existing.matches.push(match);
        return;
    }
    byEvent.set(eventId, {
        event_id: eventId,
        event_name: match.event_name,
        is_qualifier: false,
        matches: [match],
    });
}

// Single source of truth: the live/on-break poll (useOtherLiveMatches, 30s
// interval). Do NOT merge in a second, slower-polling source (e.g. the
// today's-matches poll) — combining two sources with different refresh
// cadences caused a real bug where a match's displayed status flapped
// between live/on-break every time the two polls landed at different
// moments and disagreed (see SESSION_2026-08-31_HOME_LIVE_DRAWER.md,
// "Follow-up" section, 2026-08-31).
export function collectOtherLiveGroups(
    otherLiveMatches: OtherLiveSourceMatch[],
    focusedEventId: number | null
): TodayMatchGroupWithItems[] {
    const byEvent = new Map<number, TodayMatchGroupWithItems>();
    const seen = new Set<string>();
    for (const match of otherLiveMatches) {
        if (match.event_id != null && isFocusedEvent(match.event_id, focusedEventId)) continue;
        const key = matchIdentityKey(match);
        if (seen.has(key)) continue;
        seen.add(key);
        addToEventGroup(byEvent, match);
    }
    return Array.from(byEvent.values());
}
