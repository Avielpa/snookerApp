// Tests for the Home upper-drawer priority: Live tab shows Also Live
// (collapsed), other tabs keep Today's Matches. See homeDrawer.ts.

import { TodayMatchGroupWithItems } from '../app/home/hooks/useTodayMatches';
import {
    resolveHomeDrawerMode,
    shouldShowOtherLiveFooter,
    isLiveOrOnBreak,
    matchIdentityKey,
    liveMatchesFromGroup,
    excludeLiveFromGroups,
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

describe('isLiveOrOnBreak', () => {
    it('treats livePlaying as live-or-break', () => {
        expect(isLiveOrOnBreak('livePlaying')).toBe(true);
    });

    it('treats onBreak as live-or-break', () => {
        expect(isLiveOrOnBreak('onBreak')).toBe(true);
    });

    it('does not treat upcoming as live-or-break', () => {
        expect(isLiveOrOnBreak('upcoming')).toBe(false);
    });

    it('does not treat finished as live-or-break', () => {
        expect(isLiveOrOnBreak('finished')).toBe(false);
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

describe('liveMatchesFromGroup', () => {
    it('keeps only live and on-break matches', () => {
        const result = liveMatchesFromGroup(group({
            matches: [
                matchItem(1, { matchCategory: 'livePlaying' }),
                matchItem(2, { matchCategory: 'onBreak' }),
                matchItem(3, { matchCategory: 'upcoming' }),
                matchItem(4, { matchCategory: 'finished' }),
            ],
        }));
        expect(result?.matches.map((m) => m.api_match_id)).toEqual([1, 2]);
    });

    it('returns null when a group has no live or on-break matches', () => {
        expect(liveMatchesFromGroup(group({
            matches: [matchItem(3, { matchCategory: 'upcoming' })],
        }))).toBeNull();
    });

    it('returns null for an empty group', () => {
        expect(liveMatchesFromGroup(group({ matches: [] }))).toBeNull();
    });

    it('preserves event metadata on the filtered group', () => {
        const result = liveMatchesFromGroup(group({
            event_id: 2,
            event_name: 'British Open Qualifiers',
            is_qualifier: true,
            matches: [matchItem(5, { matchCategory: 'livePlaying' })],
        }));
        expect(result?.event_id).toBe(2);
        expect(result?.is_qualifier).toBe(true);
        expect(result?.event_name).toBe('British Open Qualifiers');
    });
});

describe('excludeLiveFromGroups', () => {
    it('drops live matches so they do not appear on Upcoming', () => {
        const result = excludeLiveFromGroups([
            group({
                event_id: 2,
                matches: [
                    matchItem(200, { matchCategory: 'livePlaying' }),
                    matchItem(201, { matchCategory: 'upcoming' }),
                ],
            }),
        ]);
        expect(result).toHaveLength(1);
        expect(result[0].matches.map((m) => m.api_match_id)).toEqual([201]);
    });

    it('drops on-break matches so they stay on the Live tab', () => {
        const result = excludeLiveFromGroups([
            group({
                event_id: 2,
                matches: [matchItem(210, { matchCategory: 'onBreak' })],
            }),
        ]);
        expect(result).toEqual([]);
    });

    it('keeps finished and upcoming matches for Today\'s Matches', () => {
        const result = excludeLiveFromGroups([
            group({
                event_id: 2,
                matches: [
                    matchItem(202, { matchCategory: 'finished' }),
                    matchItem(203, { matchCategory: 'upcoming' }),
                ],
            }),
        ]);
        expect(result[0].matches.map((m) => m.matchCategory)).toEqual(['finished', 'upcoming']);
    });

    it('drops a group that is only live matches', () => {
        const result = excludeLiveFromGroups([
            group({
                event_id: 80,
                event_name: 'Q Tour Event 7',
                matches: [matchItem(800, { matchCategory: 'livePlaying' })],
            }),
        ]);
        expect(result).toEqual([]);
    });

    it('returns empty for an empty input', () => {
        expect(excludeLiveFromGroups([])).toEqual([]);
    });
});

describe('collectOtherLiveGroups', () => {
    const focusedId = 1;

    it('drops the focused event even when that event has live matches', () => {
        const result = collectOtherLiveGroups(
            [group({ event_id: 1, matches: [matchItem(100, { matchCategory: 'livePlaying' })] })],
            [],
            focusedId,
        );
        expect(result).toEqual([]);
    });

    it('keeps a qualifier sibling live match (different event_id, same family)', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 2,
                event_name: 'British Open Qualifiers',
                is_qualifier: true,
                matches: [matchItem(200, { matchCategory: 'livePlaying' })],
            })],
            [],
            focusedId,
        );
        expect(result).toHaveLength(1);
        expect(result[0].event_id).toBe(2);
        expect(result[0].matches[0].api_match_id).toBe(200);
    });

    it('drops leftover upcoming/finished today matches from the Also Live drawer', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 2,
                is_qualifier: true,
                matches: [
                    matchItem(201, { matchCategory: 'upcoming' }),
                    matchItem(202, { matchCategory: 'finished' }),
                ],
            })],
            [],
            focusedId,
        );
        expect(result).toEqual([]);
    });

    it('keeps a Q-Tour live match from today groups', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 80,
                event_name: 'Q Tour Event 7',
                matches: [matchItem(800, { matchCategory: 'livePlaying' })],
            })],
            [],
            focusedId,
        );
        expect(result.map((g) => g.event_id)).toEqual([80]);
    });

    it('keeps a women\'s-tour live match from today groups', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 90,
                event_name: "World Women's Championship",
                matches: [matchItem(900, { matchCategory: 'livePlaying' })],
            })],
            [],
            focusedId,
        );
        expect(result.map((g) => g.event_id)).toEqual([90]);
    });

    it('adds other-live API matches that are not already in today groups', () => {
        const extra = {
            ...matchItem(700),
            event_id: 70,
            event_name: 'Senior Masters',
            event_tour: 'seniors',
        };
        const result = collectOtherLiveGroups([], [extra], focusedId);
        expect(result).toHaveLength(1);
        expect(result[0].event_id).toBe(70);
        expect(result[0].matches[0].api_match_id).toBe(700);
    });

    it('does not duplicate a match that appears in both today groups and other-live', () => {
        const shared = matchItem(200, { matchCategory: 'livePlaying' });
        const result = collectOtherLiveGroups(
            [group({
                event_id: 2,
                event_name: 'British Open Qualifiers',
                is_qualifier: true,
                matches: [shared],
            })],
            [{ ...shared, event_id: 2, event_name: 'British Open Qualifiers', event_tour: 'main' }],
            focusedId,
        );
        expect(countGroupMatches(result)).toBe(1);
    });

    it('excludes an other-live match that belongs to the focused event', () => {
        const result = collectOtherLiveGroups(
            [],
            [{ ...matchItem(100), event_id: 1, event_name: 'British Open', event_tour: 'main' }],
            focusedId,
        );
        expect(result).toEqual([]);
    });

    it('returns empty when both sources are empty', () => {
        expect(collectOtherLiveGroups([], [], focusedId)).toEqual([]);
    });

    it('does not exclude anything when focusedEventId is null', () => {
        const result = collectOtherLiveGroups(
            [group({ event_id: 1, matches: [matchItem(100, { matchCategory: 'livePlaying' })] })],
            [],
            null,
        );
        expect(result).toHaveLength(1);
        expect(result[0].event_id).toBe(1);
    });

    it('keeps on-break matches from a non-focused event', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 2,
                matches: [matchItem(210, { matchCategory: 'onBreak' })],
            })],
            [],
            focusedId,
        );
        expect(result[0].matches[0].matchCategory).toBe('onBreak');
    });

    it('groups leftover other-live matches by event_id', () => {
        const result = collectOtherLiveGroups(
            [],
            [
                { ...matchItem(701), event_id: 70, event_name: 'Senior Masters', event_tour: 'seniors' },
                { ...matchItem(702), event_id: 70, event_name: 'Senior Masters', event_tour: 'seniors' },
                { ...matchItem(801), event_id: 80, event_name: 'Q Tour Event 7', event_tour: 'other' },
            ],
            focusedId,
        );
        expect(result.map((g) => g.event_id).sort()).toEqual([70, 80]);
        expect(result.find((g) => g.event_id === 70)?.matches).toHaveLength(2);
    });

    it('does not list the same extra match twice', () => {
        const extra = { ...matchItem(701), event_id: 70, event_name: 'Senior Masters', event_tour: 'seniors' };
        const result = collectOtherLiveGroups([], [extra, extra], focusedId);
        expect(countGroupMatches(result)).toBe(1);
    });

    it('is generic: a Championship League group sibling is other-live', () => {
        const result = collectOtherLiveGroups(
            [group({
                event_id: 55,
                event_name: 'Championship League Group 2',
                matches: [matchItem(550, { matchCategory: 'livePlaying' })],
            })],
            [],
            54,
        );
        expect(result[0].event_id).toBe(55);
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
