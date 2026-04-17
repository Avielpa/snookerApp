// services/compareService.ts
import { getPlayerDetails, getHeadToHead, getRanking, Player, HeadToHead, Ranking } from './matchServices';
import { fetchCenturies, CenturyEntry } from './statsService';
import { logger } from '../utils/logger';

// ---- Types ----------------------------------------------------------------

export interface CareerStats {
    ct_frames_played:      number | null;
    ct_frames_won:         number | null;
    ct_career_prize_total: number | null;
    ct_total_titles:       number | null;
    ct_ranking_titles:     number | null;
    ct_finals_reached:     number | null;
    ct_career_best_rank:   number | null;
    ct_total_50plus:       number | null;
    ct_total_centuries:    number | null;
    titles_verified:       boolean | null;
    ct_synced_at:          string | null;  // ISO string — null means no CueTracker data
}

export interface ComparePlayer extends Player {
    career_stats?: CareerStats | null;
    // Computed
    age?: number | null;
    years_as_pro?: number | null;
    career_win_pct?: number | null;
    // New backend fields
    frame_stats?: {
        frames_won: number;
        frames_lost: number;
        frames_played: number;
        frame_pct: number;
    } | null;
    finals_record?: {
        finals_reached: number;
        finals_won: number;
        finals_pct: number;
    } | null;
    deciding_frames?: {
        deciding_played: number;
        deciding_won: number;
        deciding_pct: number;
    } | null;
    semi_final_record?: { reached: number; won: number; pct: number } | null;
    career_best_ranking?: number | null;
    seasons_in_top16?: number | null;
    best_win_streak?: number | null;
    season_stats?: { matches: number; wins: number; season: number | null } | null;
    recent_win_pct?: number | null;
    // Derived
    centuries_per_match?: number | null;
    avg_frames_per_match?: number | null;
    prize_per_match?: number | null;
    titles_per_season?: number | null;
    matches_per_season?: number | null;
    // Century data merged from /stats/centuries/
    century_season_current?: number | null;
    century_season_prev1?: number | null;
    century_career_total?: number | null;
    century_career_147s?: number | null;
}

export interface CompareData {
    p1: ComparePlayer;
    p2: ComparePlayer;
    h2h: HeadToHead | null;
}

// ---- Helpers ---------------------------------------------------------------

function computeAge(born: string | null | undefined): number | null {
    if (!born) return null;
    const dob = new Date(born);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function computeYearsAsPro(firstSeason: number | null | undefined): number | null {
    if (!firstSeason) return null;
    return new Date().getFullYear() - firstSeason;
}

function mergeCentury(player: Player, centuries: CenturyEntry[]): Partial<ComparePlayer> {
    const entry = centuries.find((c) => c.player_id === player.ID);
    if (!entry) return {};
    return {
        century_season_current: entry.season_current,
        century_season_prev1: entry.season_prev1,
        century_career_total: entry.career_total,
        century_career_147s: entry.career_147s,
    };
}

function enrichPlayer(player: Player, centuries: CenturyEntry[]): ComparePlayer {
    const centuryData = mergeCentury(player, centuries);
    const years_as_pro = computeYearsAsPro(player.FirstSeasonAsPro);
    return {
        ...player,
        age: computeAge(player.Born),
        years_as_pro,
        // centuries_per_match removed — divisor was career_wins+losses from PlayerMatchHistory
        // (main tour only), while CT has 27% more matches. Would show inflated rate.
        ...centuryData,
    };
}

// ---- Main fetch ------------------------------------------------------------

export async function fetchCompareData(p1Id: number, p2Id: number): Promise<CompareData> {
    logger.log(`[CompareService] Fetching compare data for ${p1Id} vs ${p2Id}`);

    const [p1Raw, p2Raw, h2h, centuriesData] = await Promise.all([
        getPlayerDetails(p1Id),
        getPlayerDetails(p2Id),
        getHeadToHead(p1Id, p2Id),
        fetchCenturies('2025-26'),
    ]);

    const centuries = centuriesData?.results ?? [];

    if (!p1Raw || !p2Raw) {
        throw new Error('Could not load one or both players');
    }

    return {
        p1: enrichPlayer(p1Raw, centuries),
        p2: enrichPlayer(p2Raw, centuries),
        h2h,
    };
}

// ---- Player search list ----------------------------------------------------

export interface RankedPlayer {
    id: number;
    name: string;
    nationality: string | null;
    position: number | null;
}

export async function fetchRankedPlayerList(): Promise<RankedPlayer[]> {
    try {
        const { rankings } = await getRanking('MoneyRankings');
        return rankings
            .filter((r) => r.Player && r.Player > 0 && r.Player !== 376)
            .map((r) => ({
                id: r.Player as number,
                name: r.player_name || `Player ${r.Player}`,
                nationality: r.nationality ?? null,
                position: r.Position ?? null,
            }));
    } catch (e) {
        logger.error('[CompareService] fetchRankedPlayerList failed:', e);
        return [];
    }
}
