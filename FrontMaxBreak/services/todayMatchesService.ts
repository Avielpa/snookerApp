// services/todayMatchesService.ts
// One job: fetch every match scheduled for today, across every event/tour.
// See docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md.

import { api } from './api';
import { Match } from '../app/home/types';

export interface TodayMatchGroup {
    event_id: number;
    event_name: string | null;
    event_tour: string | null;
    is_qualifier: boolean;
    matches: Match[];
}

export interface TodayMatchesResponse {
    date: string;
    groups: TodayMatchGroup[];
}

export const getTodayMatches = async (): Promise<TodayMatchesResponse> => {
    const response = await api.get<TodayMatchesResponse>('matches/today/', { skipCache: true } as any);
    return response.data;
};
