// app/home/utils/todayMatchesListItems.ts
// One job: turn today's match groups into the same row shapes (roundHeader,
// match) the main list already renders — so Today's Matches scrolls as
// part of one continuous list instead of its own boxed-in panel.
import { ListItem } from '../types';
import { TodayMatchGroupWithItems } from '../hooks/useTodayMatches';

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
