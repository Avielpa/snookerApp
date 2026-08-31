// Tests for the Home upper-drawer priority: Live tab shows Also Live
// (collapsed), other tabs keep Today's Matches. See homeDrawer.ts.

import { TodayMatchGroupWithItems } from '../app/home/hooks/useTodayMatches';
import {
    resolveHomeDrawerMode,
    shouldShowOtherLiveFooter,
    matchIdentityKey,
    relevantTodayCategories,
    filterGroupsByCategories,
    collectOtherLiveGroups,
    countGroupMatches,
} from '../app/home/utils/homeDrawer';
import { MatchListItem } from '../app/home/types';

function matchItem(apiMatchId: number, overrides: Partial<MatchListItem> = {}): MatchListItem {
    return {
        id: apiMatchId,
        api_match_id: apiMatchId,
        player1_id: 10,
        player2_id: 20,
        score1: null,
        score2: null,
        note: null,
        scheduled_date: null,
        winner_id: null,
        status_code: 1,
        type: 'match',
        matchCategory: 'livePlaying',
        ...overrides,
    };
}

function group(overrides: Partial<TodayMatchGroupWithItems> = {}): TodayMatchGroupWithItems {
    return {
        event_id: 1,
        event_name: 'British Open',
        is_qualifier: false,
        matches: [matchItem(100)],
        ...overrides,
    };
}

describe('resolveHomeDrawerMode', () => {
    it('uses otherLive on the Live tab', () => {
        expect(resolveHomeDrawerMode('livePlaying')).toBe('otherLive');
    });

    it('uses today on the Upcoming tab', () => {
        expect(resolveHomeDrawerMode('upcoming')).toBe('today');
    });

    it('uses today on the Results tab', () => {
        expect(resolveHomeDrawerMode('finished')).toBe('today');
    });

    it('uses today on the Draw tab', () => {
        expect(resolveHomeDrawerMode('draw')).toBe('today');
    });

    it('uses today on the Other Tours tab', () => {
        expect(resolveHomeDrawerMode('otherTours')).toBe('today');
    });

    it('uses today on the All filter', () => {
        expect(resolveHomeDrawerMode('all')).toBe('today');
    });

    it('uses today on the on-break filter', () => {
        expect(resolveHomeDrawerMode('onBreak')).toBe('today');
    });
});

describe('shouldShowOtherLiveFooter', () => {
    it('hides the footer when the upper drawer is Also Live', () => {
        expect(shouldShowOtherLiveFooter('otherLive')).toBe(false);
    });

    it('keeps the footer when the upper drawer is Today', () => {
        expect(shouldShowOtherLiveFooter('today')).toBe(true);
    });
});

describe('matchIdentityKey', () => {
    it('prefers api_match_id when present', () => {
        expect(matchIdentityKey({ id: 9, api_match_id: 400 })).toBe('api:400');
    });

    it('falls back to id when api_match_id is null', () => {
        expect(matchIdentityKey({ id: 9, api_match_id: null })).toBe('id:9');
    });

    it('falls back to id when api_match_id is undefined', () => {
        expect(matchIdentityKey({ id: 9 })).toBe('id:9');
    });
});

describe('relevantTodayCategories', () => {
    // The Results-tab leak bug (2026-08-31): Today's Matches showed
    // not-yet-played matches under Results because it never scoped its
    // content to the selected tab, same class of bug as the Live-tab
    // flapping fix. Each single-category tab now sees only its own category.
    it('Results tab wants only finished matches', () => {
        expect(relevantTodayCategories('finished')).toEqual(['finished']);
    });

    it('Upcoming tab wants only upcoming matches', () => {
        expect(relevantTodayCategories('upcoming')).toEqual(['upcoming']);
    });

    it('Draw tab keeps the mixed upcoming+finished view (no single category context)', () => {
        expect(relevantTodayCategories('draw')).toEqual(['upcoming', 'finished']);
    });

    it('Other Tours tab keeps the mixed view', () => {
        expect(relevantTodayCategories('otherTours')).toEqual(['upcoming', 'finished']);
    });

    it('All filter keeps the mixed view', () => {
        expect(relevantTodayCategories('all')).toEqual(['upcoming', 'finished']);
    });

    it('never includes live or on-break — those belong only in Also Live', () => {
        (['finished', 'upcoming', 'draw', 'otherTours', 'all', 'onBreak'] as const).forEach((filter) => {
            const categories = relevantTodayCategories(filter);
            expect(categories).not.toContain('livePlaying');
            expect(categories).not.toContain('onBreak');
        });
    });
});

describe('filterGroupsByCategories', () => {
    it('drops live matches so they do not appear on Upcoming', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 2,
                matches: [
                    matchItem(200, { matchCategory: 'livePlaying' }),
                    matchItem(201, { matchCategory: 'upcoming' }),
                ],
            }),
        ], ['upcoming', 'finished']);
        expect(result).toHaveLength(1);
        expect(result[0].matches.map((m) => m.api_match_id)).toEqual([201]);
    });

    it('on the Results tab, drops a not-yet-played match from the same group as a finished one', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 2,
                event_name: 'British Open Qualifiers',
                matches: [
                    matchItem(200, { matchCategory: 'finished' }),
                    matchItem(201, { matchCategory: 'upcoming' }),
                ],
            }),
        ], relevantTodayCategories('finished'));
        expect(result[0].matches.map((m) => m.api_match_id)).toEqual([200]);
    });

    it('on the Upcoming tab, drops a finished match from the same group as an upcoming one', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 2,
                matches: [
                    matchItem(200, { matchCategory: 'finished' }),
                    matchItem(201, { matchCategory: 'upcoming' }),
                ],
            }),
        ], relevantTodayCategories('upcoming'));
        expect(result[0].matches.map((m) => m.api_match_id)).toEqual([201]);
    });

    it('drops a group left with zero matches after filtering', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 2,
                matches: [matchItem(200, { matchCategory: 'upcoming' })],
            }),
        ], relevantTodayCategories('finished'));
        expect(result).toEqual([]);
    });

    it('keeps finished and upcoming matches together for the mixed (Draw/All) view', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 2,
                matches: [
                    matchItem(202, { matchCategory: 'finished' }),
                    matchItem(203, { matchCategory: 'upcoming' }),
                ],
            }),
        ], relevantTodayCategories('draw'));
        expect(result[0].matches.map((m) => m.matchCategory)).toEqual(['finished', 'upcoming']);
    });

    it('drops a group that is only live matches', () => {
        const result = filterGroupsByCategories([
            group({
                event_id: 80,
                event_name: 'Q Tour Event 7',
                matches: [matchItem(800, { matchCategory: 'livePlaying' })],
            }),
        ], relevantTodayCategories('all'));
        expect(result).toEqual([]);
    });

    it('returns empty for an empty input', () => {
        expect(filterGroupsByCategories([], ['upcoming', 'finished'])).toEqual([]);
    });

    it('filters independently across multiple groups', () => {
        const result = filterGroupsByCategories([
            group({ event_id: 1, matches: [matchItem(1, { matchCategory: 'finished' })] }),
            group({ event_id: 2, matches: [matchItem(2, { matchCategory: 'upcoming' })] }),
        ], relevantTodayCategories('finished'));
        expect(result.map((g) => g.event_id)).toEqual([1]);
    });
});

function liveMatch(apiMatchId: number, overrides: Partial<MatchListItem> & { event_id?: number; event_name?: string; event_tour?: string } = {}) {
    return {
        ...matchItem(apiMatchId, { matchCategory: 'livePlaying', ...overrides }),
        event_id: 70,
        event_name: 'Senior Masters',
        event_tour: 'seniors',
        ...overrides,
    };
}

describe('collectOtherLiveGroups', () => {
    // Single-sourced from the live/on-break poll only (see 2026-08-31 fix:
    // merging in a second, slower-polling source caused live/break to flap
    // every time the two polls disagreed — SESSION_2026-08-31_HOME_LIVE_DRAWER.md).
    const focusedId = 1;

    it('drops the focused event even when that event has live matches', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(100, { event_id: 1, event_name: 'British Open' })],
            focusedId,
        );
        expect(result).toEqual([]);
    });

    it('keeps a qualifier sibling live match (different event_id, same family)', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(200, { event_id: 2, event_name: 'British Open Qualifiers', event_tour: 'main' })],
            focusedId,
        );
        expect(result).toHaveLength(1);
        expect(result[0].event_id).toBe(2);
        expect(result[0].matches[0].api_match_id).toBe(200);
    });

    it('keeps a Q-Tour live match', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(800, { event_id: 80, event_name: 'Q Tour Event 7', event_tour: 'other' })],
            focusedId,
        );
        expect(result.map((g) => g.event_id)).toEqual([80]);
    });

    it('keeps a women\'s-tour live match', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(900, { event_id: 90, event_name: "World Women's Championship", event_tour: 'womens' })],
            focusedId,
        );
        expect(result.map((g) => g.event_id)).toEqual([90]);
    });

    it('excludes an other-live match that belongs to the focused event', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(100, { event_id: 1, event_name: 'British Open', event_tour: 'main' })],
            focusedId,
        );
        expect(result).toEqual([]);
    });

    it('returns empty when the source is empty', () => {
        expect(collectOtherLiveGroups([], focusedId)).toEqual([]);
    });

    it('does not exclude anything when focusedEventId is null', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(100, { event_id: 1, event_name: 'British Open' })],
            null,
        );
        expect(result).toHaveLength(1);
        expect(result[0].event_id).toBe(1);
    });

    it('keeps on-break matches from a non-focused event', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(210, { event_id: 2, matchCategory: 'onBreak' } as any)],
            focusedId,
        );
        expect(result[0].matches[0].matchCategory).toBe('onBreak');
    });

    it('groups matches by event_id', () => {
        const result = collectOtherLiveGroups(
            [
                liveMatch(701, { event_id: 70, event_name: 'Senior Masters' }),
                liveMatch(702, { event_id: 70, event_name: 'Senior Masters' }),
                liveMatch(801, { event_id: 80, event_name: 'Q Tour Event 7' }),
            ],
            focusedId,
        );
        expect(result.map((g) => g.event_id).sort()).toEqual([70, 80]);
        expect(result.find((g) => g.event_id === 70)?.matches).toHaveLength(2);
    });

    it('does not list the same match twice if the API returns a duplicate', () => {
        const extra = liveMatch(701, { event_id: 70 });
        const result = collectOtherLiveGroups([extra, extra], focusedId);
        expect(countGroupMatches(result)).toBe(1);
    });

    it('is generic: a Championship League group sibling is other-live', () => {
        const result = collectOtherLiveGroups(
            [liveMatch(550, { event_id: 55, event_name: 'Championship League Group 2' })],
            54,
        );
        expect(result[0].event_id).toBe(55);
    });

    it('does not flap between calls when the underlying data is unchanged (regression: dual-source race)', () => {
        // Simulates two consecutive polls of the SAME single source returning
        // the SAME match — output must be identical every time, since there
        // is no second, slower-polling source left to disagree with it.
        const snapshot = [liveMatch(200, { event_id: 2, event_name: 'British Open Qualifiers' })];
        const first = collectOtherLiveGroups(snapshot, focusedId);
        const second = collectOtherLiveGroups(snapshot, focusedId);
        expect(first).toEqual(second);
        expect(first[0].matches[0].matchCategory).toBe('livePlaying');
    });
});

describe('countGroupMatches', () => {
    it('sums matches across groups', () => {
        expect(countGroupMatches([
            group({ matches: [matchItem(1), matchItem(2)] }),
            group({ event_id: 2, matches: [matchItem(3)] }),
        ])).toBe(3);
    });

    it('returns 0 for an empty list', () => {
        expect(countGroupMatches([])).toBe(0);
    });
});
