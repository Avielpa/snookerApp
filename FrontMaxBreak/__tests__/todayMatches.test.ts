// __tests__/todayMatches.test.ts
// Tests for the "Today's Matches" feature's pure/testable pieces:
// matchStatusToCategory, addMatchItemFields (useTodayMatches.tsx) and
// getTodayMatches (todayMatchesService.ts). See
// docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md.

import { matchStatusToCategory, addMatchItemFields, TodayMatchGroupWithItems } from '../app/home/hooks/useTodayMatches';
import { buildTodayMatchesListItems } from '../app/home/utils/todayMatchesListItems';
import { TodayMatchGroup } from '../services/todayMatchesService';

describe('matchStatusToCategory', () => {
    it('maps 0 to upcoming', () => {
        expect(matchStatusToCategory(0)).toBe('upcoming');
    });

    it('maps 1 to livePlaying', () => {
        expect(matchStatusToCategory(1)).toBe('livePlaying');
    });

    it('maps 2 to onBreak', () => {
        expect(matchStatusToCategory(2)).toBe('onBreak');
    });

    it('maps 3 to finished', () => {
        expect(matchStatusToCategory(3)).toBe('finished');
    });

    it('maps null to upcoming', () => {
        expect(matchStatusToCategory(null)).toBe('upcoming');
    });

    it('maps an unknown status code to upcoming', () => {
        expect(matchStatusToCategory(99)).toBe('upcoming');
    });
});

describe('addMatchItemFields', () => {
    const baseMatch = {
        id: 1,
        api_match_id: 100,
        player1_id: 10,
        player2_id: 20,
        score1: null,
        score2: null,
        note: null,
        scheduled_date: '2026-08-31T12:00:00Z',
        winner_id: null,
    };

    function makeGroup(overrides: Partial<TodayMatchGroup> = {}): TodayMatchGroup {
        return {
            event_id: 1,
            event_name: 'British Open',
            event_tour: 'main',
            is_qualifier: false,
            matches: [{ ...baseMatch, status_code: 0 } as any],
            ...overrides,
        };
    }

    it('preserves the group event fields', () => {
        const group = makeGroup();
        const result = addMatchItemFields(group);
        expect(result.event_id).toBe(1);
        expect(result.event_name).toBe('British Open');
        expect(result.is_qualifier).toBe(false);
    });

    it('tags each match with type "match"', () => {
        const result = addMatchItemFields(makeGroup());
        expect(result.matches[0].type).toBe('match');
    });

    it('computes matchCategory from status_code for a live match', () => {
        const group = makeGroup({ matches: [{ ...baseMatch, status_code: 1 } as any] });
        const result = addMatchItemFields(group);
        expect(result.matches[0].matchCategory).toBe('livePlaying');
    });

    it('computes matchCategory from status_code for a finished match', () => {
        const group = makeGroup({ matches: [{ ...baseMatch, status_code: 3 } as any] });
        const result = addMatchItemFields(group);
        expect(result.matches[0].matchCategory).toBe('finished');
    });

    it('handles a group with an empty matches array', () => {
        const group = makeGroup({ matches: [] });
        const result = addMatchItemFields(group);
        expect(result.matches).toEqual([]);
    });

    it('handles multiple matches independently', () => {
        const group = makeGroup({
            matches: [
                { ...baseMatch, api_match_id: 100, status_code: 0 } as any,
                { ...baseMatch, api_match_id: 101, status_code: 1 } as any,
            ],
        });
        const result = addMatchItemFields(group);
        expect(result.matches[0].matchCategory).toBe('upcoming');
        expect(result.matches[1].matchCategory).toBe('livePlaying');
    });
});

describe('buildTodayMatchesListItems', () => {
    const matchItem = (apiMatchId: number, overrides = {}) => ({
        id: apiMatchId,
        api_match_id: apiMatchId,
        player1_id: 10,
        player2_id: 20,
        score1: null,
        score2: null,
        note: null,
        scheduled_date: null,
        winner_id: null,
        status_code: 0,
        type: 'match' as const,
        matchCategory: 'upcoming' as const,
        ...overrides,
    });

    function makeGroup(overrides: Partial<TodayMatchGroupWithItems> = {}): TodayMatchGroupWithItems {
        return {
            event_id: 1,
            event_name: 'British Open',
            is_qualifier: false,
            matches: [matchItem(100)],
            ...overrides,
        };
    }

    it('returns an empty list for no groups', () => {
        expect(buildTodayMatchesListItems([])).toEqual([]);
    });

    it('emits one roundHeader followed by that group\'s matches', () => {
        const items = buildTodayMatchesListItems([makeGroup()]);
        expect(items[0].type).toBe('roundHeader');
        expect(items[1].type).toBe('match');
        expect(items).toHaveLength(2);
    });

    it('labels a qualifier group\'s header with "· Qualifiers"', () => {
        const items = buildTodayMatchesListItems([makeGroup({ is_qualifier: true })]);
        expect((items[0] as any).roundName).toBe('British Open · Qualifiers');
    });

    it('does not add "· Qualifiers" for a non-qualifier group', () => {
        const items = buildTodayMatchesListItems([makeGroup({ is_qualifier: false })]);
        expect((items[0] as any).roundName).toBe('British Open');
    });

    it('emits a separate roundHeader per group, in the given order', () => {
        const items = buildTodayMatchesListItems([
            makeGroup({ event_id: 1, event_name: 'British Open' }),
            makeGroup({ event_id: 2, event_name: 'British Open Qualifiers', is_qualifier: true }),
        ]);
        const headers = items.filter((i) => i.type === 'roundHeader');
        expect(headers).toHaveLength(2);
        expect((headers[0] as any).roundName).toBe('British Open');
        expect((headers[1] as any).roundName).toBe('British Open Qualifiers · Qualifiers');
    });

    it('gives every roundHeader a unique id even across groups', () => {
        const items = buildTodayMatchesListItems([
            makeGroup({ event_id: 1 }),
            makeGroup({ event_id: 2 }),
        ]);
        const headerIds = items.filter((i) => i.type === 'roundHeader').map((i: any) => i.id);
        expect(new Set(headerIds).size).toBe(headerIds.length);
    });

    it('includes every match from a group with multiple matches', () => {
        const items = buildTodayMatchesListItems([
            makeGroup({ matches: [matchItem(100), matchItem(101), matchItem(102)] }),
        ]);
        const matchItems = items.filter((i) => i.type === 'match');
        expect(matchItems).toHaveLength(3);
    });

    it('handles a group with zero matches (header only, no crash)', () => {
        const items = buildTodayMatchesListItems([makeGroup({ matches: [] })]);
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('roundHeader');
    });
});

describe('getTodayMatches', () => {
    const mockGet = jest.fn();

    beforeEach(() => {
        jest.resetModules();
        mockGet.mockReset();
        jest.doMock('../services/api', () => ({
            api: { get: mockGet },
        }));
    });

    it('calls the matches/today/ endpoint with skipCache', async () => {
        mockGet.mockResolvedValue({ data: { date: '2026-08-31', groups: [] } });
        const { getTodayMatches } = require('../services/todayMatchesService');

        await getTodayMatches();

        expect(mockGet).toHaveBeenCalledWith('matches/today/', { skipCache: true });
    });

    it('returns the response data', async () => {
        const payload = { date: '2026-08-31', groups: [{ event_id: 1, event_name: 'British Open', event_tour: 'main', is_qualifier: false, matches: [] }] };
        mockGet.mockResolvedValue({ data: payload });
        const { getTodayMatches } = require('../services/todayMatchesService');

        const result = await getTodayMatches();

        expect(result).toEqual(payload);
    });

    it('propagates a network failure to the caller', async () => {
        mockGet.mockRejectedValue(new Error('Network Error'));
        const { getTodayMatches } = require('../services/todayMatchesService');

        await expect(getTodayMatches()).rejects.toThrow('Network Error');
    });
});
