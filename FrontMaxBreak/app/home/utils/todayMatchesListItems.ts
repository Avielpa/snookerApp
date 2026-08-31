// app/home/utils/todayMatchesListItems.ts
// One job: turn today's match groups into the same row shapes (roundHeader,
// match) the main list already renders — so Today's Matches scrolls as
// part of one continuous list instead of its own boxed-in panel.
import { ListItem } from '../types';
import { TodayMatchGroupWithItems } from '../hooks/useTodayMatches';

// One job: drop the group for whichever tournament is already shown in the
// main match list below, so its today's-round matches don't render twice
// on the same screen. A qualifier event has its own, different event_id
// from its main draw, so it's never excluded by this.
export function excludeEventFromGroups(
    groups: TodayMatchGroupWithItems[],
    eventIdToExclude: number | null
): TodayMatchGroupWithItems[] {
    return groups.filter((group) => group.event_id !== eventIdToExclude);
}

export function buildTodayMatchesListItems(groups: TodayMatchGroupWithItems[]): ListItem[] {
    const items: ListItem[] = [];

    for (const group of groups) {
        items.push({
            type: 'roundHeader',
            roundName: group.is_qualifier
                ? `${group.event_name ?? 'Tournament'} · Qualifiers`
                : (group.event_name ?? 'Tournament'),
            id: `todayHeader-${group.event_id}`,
            round: null,
        });

        for (const match of group.matches) {
            items.push(match);
        }
    }

    return items;
}
