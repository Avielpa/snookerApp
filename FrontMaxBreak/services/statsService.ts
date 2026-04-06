// services/statsService.ts
import { api } from './api';
import { logger } from '../utils/logger';

// ---- Types ----------------------------------------------------------------

export interface CenturyEntry {
    rank: number;
    player_name: string;
    player_id: number | null;
    nationality: string | null;
    season_current: number;
    season_prev1: number;
    season_prev2: number;
    career_total: number;
    career_147s: number;
}

export interface CenturiesData {
    season: string;
    count: number;
    scraped_at: string | null;
    results: CenturyEntry[];
}

export interface TourWinner {
    event_id: number;
    event_name: string;
    event_type: string;
    start_date: string | null;
    end_date: string | null;
    venue: string | null;
    city: string | null;
    country: string | null;
    winner_id: number | null;
    winner_name: string;
    winner_nationality: string | null;
    runner_up_id: number | null;
    runner_up_name: string;
    score: string;
}

export interface TourWinnersData {
    season: number;
    count: number;
    results: TourWinner[];
}

export interface TitleLeader {
    rank: number;
    player_id: number | null;
    player_name: string;
    nationality: string | null;
    titles: number;
    events: { event_id: number; event_name: string; event_type: string; end_date: string | null }[];
}

export interface TitleLeadersData {
    season: number;
    count: number;
    results: TitleLeader[];
}

// ---- Fetch functions -------------------------------------------------------
// TTL is managed by the api.ts interceptor (1 hour for /stats/ routes)

export async function fetchCenturies(season = '2025-26'): Promise<CenturiesData | null> {
    try {
        const resp = await api.get(`stats/centuries/?season=${season}`);
        return resp.data as CenturiesData;
    } catch (e) {
        logger.warn(`[Stats] fetchCenturies failed: ${e}`);
        return null;
    }
}

export async function fetchTourWinners(season = 2025): Promise<TourWinnersData | null> {
    try {
        const resp = await api.get(`stats/tour-winners/?season=${season}`);
        return resp.data as TourWinnersData;
    } catch (e) {
        logger.warn(`[Stats] fetchTourWinners failed: ${e}`);
        return null;
    }
}

export async function fetchTitleLeaders(season = 2025): Promise<TitleLeadersData | null> {
    try {
        const resp = await api.get(`stats/title-leaders/?season=${season}`);
        return resp.data as TitleLeadersData;
    } catch (e) {
        logger.warn(`[Stats] fetchTitleLeaders failed: ${e}`);
        return null;
    }
}
