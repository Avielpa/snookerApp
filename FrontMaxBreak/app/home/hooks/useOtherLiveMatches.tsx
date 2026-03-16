// app/home/hooks/useOtherLiveMatches.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../../services/api';
import { logger } from '../../../utils/logger';
import { MatchListItem } from '../types';

export interface OtherLiveMatch extends MatchListItem {
    event_name: string;
    event_tour: string;
}

export const useOtherLiveMatches = (excludeEventId: number | null) => {
    const [matches, setMatches] = useState<OtherLiveMatch[]>([]);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchMatches = useCallback(async () => {
        try {
            const params = excludeEventId != null ? `?exclude_event_id=${excludeEventId}` : '';
            const response = await api.get<any[]>(`all-live-matches/${params}`, { skipCache: true } as any);
            if (Array.isArray(response.data)) {
                const mapped: OtherLiveMatch[] = response.data.map((m: any) => ({
                    ...m,
                    type: 'match' as const,
                    matchCategory: m.status_code === 1 ? 'livePlaying' : 'onBreak',
                }));
                setMatches(mapped);
            }
        } catch (e) {
            logger.warn('[OtherLive] Failed to fetch other live matches:', e);
        }
    }, [excludeEventId]);

    useEffect(() => {
        fetchMatches();
        intervalRef.current = setInterval(fetchMatches, 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchMatches]);

    return { matches };
};
