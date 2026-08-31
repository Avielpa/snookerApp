// app/home/hooks/useTodayMatches.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { getTodayMatches, TodayMatchGroup } from '../../../services/todayMatchesService';
import { logger } from '../../../utils/logger';
import { MatchCategory, MatchListItem } from '../types';

const REFETCH_INTERVAL_MS = 120000; // 2 minutes — matches the rest of Home's live polling cadence

export interface TodayMatchGroupWithItems {
    event_id: number;
    event_name: string | null;
    is_qualifier: boolean;
    matches: MatchListItem[];
}

// One job: turn a raw status_code into the category MatchItem already knows
// how to render (live badge, finished badge, etc.) — no new visual logic.
export function matchStatusToCategory(statusCode: number | null): MatchCategory {
    if (statusCode === 1) return 'livePlaying';
    if (statusCode === 2) return 'onBreak';
    if (statusCode === 3) return 'finished';
    return 'upcoming';
}

// One job: attach the fields MatchItem needs to every match in a group.
export function addMatchItemFields(group: TodayMatchGroup): TodayMatchGroupWithItems {
    return {
        event_id: group.event_id,
        event_name: group.event_name,
        is_qualifier: group.is_qualifier,
        matches: group.matches.map((match) => ({
            ...match,
            type: 'match' as const,
            matchCategory: matchStatusToCategory(match.status_code),
        })),
    };
}

export const useTodayMatches = () => {
    const [groups, setGroups] = useState<TodayMatchGroupWithItems[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchTodayMatches = useCallback(async () => {
        try {
            const response = await getTodayMatches();
            setGroups(response.groups.map(addMatchItemFields));
        } catch (e) {
            // Silent failure by design — an old backend without this endpoint,
            // or a network hiccup, should never block or crash the rest of Home.
            logger.warn('[TodayMatches] Failed to fetch today\'s matches:', e);
        }
    }, []);

    useEffect(() => {
        fetchTodayMatches();
        intervalRef.current = setInterval(fetchTodayMatches, REFETCH_INTERVAL_MS);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchTodayMatches]);

    return { groups };
};
