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

export function liveMatchesFromGroup(group: TodayMatchGroupWithItems): TodayMatchGroupWithItems | null {
    const matches = group.matches.filter((match) => isLiveOrOnBreak(match.matchCategory));
    if (matches.length === 0) return null;
    return { ...group, matches };
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

function liveGroupsExcludingFocus(
    todayGroups: TodayMatchGroupWithItems[],
    focusedEventId: number | null
): TodayMatchGroupWithItems[] {
    return todayGroups
        .filter((group) => !isFocusedEvent(group.event_id, focusedEventId))
        .map(liveMatchesFromGroup)
        .filter((group): group is TodayMatchGroupWithItems => group != null);
}

function allMatchKeys(groups: TodayMatchGroupWithItems[]): Set<string> {
    const keys = new Set<string>();
    for (const group of groups) {
        for (const match of group.matches) {
            keys.add(matchIdentityKey(match));
        }
    }
    return keys;
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

function unmatchedOtherLive(
    otherLiveMatches: OtherLiveSourceMatch[],
    focusedEventId: number | null,
    seen: Set<string>
): TodayMatchGroupWithItems[] {
    const byEvent = new Map<number, TodayMatchGroupWithItems>();
    for (const match of otherLiveMatches) {
        if (match.event_id != null && isFocusedEvent(match.event_id, focusedEventId)) continue;
        const key = matchIdentityKey(match);
        if (seen.has(key)) continue;
        seen.add(key);
        addToEventGroup(byEvent, match);
    }
    return Array.from(byEvent.values());
}

export function collectOtherLiveGroups(
    todayGroups: TodayMatchGroupWithItems[],
    otherLiveMatches: OtherLiveSourceMatch[],
    focusedEventId: number | null
): TodayMatchGroupWithItems[] {
    const fromToday = liveGroupsExcludingFocus(todayGroups, focusedEventId);
    const extras = unmatchedOtherLive(otherLiveMatches, focusedEventId, allMatchKeys(fromToday));
    return [...fromToday, ...extras];
}
