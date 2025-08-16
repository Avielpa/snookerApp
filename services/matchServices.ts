// services/matchServices.ts
import { api } from "./api";
import { logger } from "../utils/logger";

// TypeScript interfaces for type safety
export interface Player {
    ID: number;
    FirstName?: string | null;
    MiddleName?: string | null;
    LastName?: string | null;
    ShortName?: string | null;
    Nationality?: string | null;
    Sex?: 'M' | 'F' | null;
    Born?: string | null;
    FirstSeasonAsPro?: number | null;
    LastSeasonAsPro?: number | null;
    NumRankingTitles?: number | null;
    NumMaximums?: number | null;
}

export interface Ranking {
    ID: number;
    Position?: number | null;
    Player?: number | null;
    player_name?: string;
    Season?: number | null;
    Sum?: number | null;
    Type?: string | null;
}

export interface Match {
    id: number;
    api_match_id?: number | null;
    event_id?: number;
    round?: number | null;
    number?: number | null;
    player1_id?: number | null;
    player2_id?: number | null;
    player1_name?: string;
    player2_name?: string;
    score1?: number | null;
    score2?: number | null;
    winner_id?: number | null;
    status_code?: number | null;
    status_display?: string | null;
    scheduled_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    frame_scores?: string | null;
    sessions_str?: string | null;
    on_break?: boolean | null;
    unfinished?: boolean | null;
    live_url?: string | null;
    details_url?: string | null;
    note?: string | null;
}

export interface MatchEventDetails {
    ID: number;
    Name?: string | null;
    StartDate?: string | null;
    EndDate?: string | null;
    Format?: number | null; // This is the real match format from your backend database
}

export interface HeadToHead {
    Player1ID: number;
    Player1Name?: string;
    Player2ID: number;
    Player2Name?: string;
    Player1Wins: number;
    Player2Wins: number;
    Draws?: number;
    TotalMeetings: number;
    LastMeeting?: string;
    LastResult?: string;
    Matches?: Match[];
}

// --- Player Functions ---

/**
 * Fetches player details specifically from the internal backend API.
 * Corresponds to player_by_id_view mapped to /players/detail/<id>/.
 * @param {number | string | undefined | null} playerId - The ID of the player.
 * @returns {Promise<Player|null>} Player data object or null if not found or error.
 */
export const getPlayerFromInternalAPI = async (playerId: number | string | undefined | null): Promise<Player | null> => {
    // Validate Player ID early
    const numericPlayerId = typeof playerId === 'string' ? parseInt(playerId, 10) : playerId;
    if (typeof numericPlayerId !== 'number' || isNaN(numericPlayerId) || numericPlayerId <= 0) {
        logger.warn("[MatchService] getPlayerFromInternalAPI called with invalid ID:", playerId);
        return null;
    }

    const urlPath = `players/detail/${numericPlayerId}/`; // Correct path based on urls.py
    logger.debug(`[MatchService] Requesting player details from internal API: ${urlPath}`);

    try {
        const response = await api.get<Player>(urlPath);

        // Check if response contains data and it's an object
        if (response.data && typeof response.data === 'object' && Object.keys(response.data).length > 0) {
            // Optional: Add a check if response.data.ID matches numericPlayerId for extra safety
            if (response.data.ID === numericPlayerId) {
                logger.debug(`[MatchService] Successfully received valid data for player ${numericPlayerId} (Status ${response.status}).`);
                return response.data; // Return the player data object
            } else {
                logger.warn(`[MatchService] Received data for player ${numericPlayerId}, but ID mismatch in response:`, response.data);
                return null; // ID mismatch is problematic
            }
        } else {
            logger.warn(`[MatchService] Received success status (${response.status}) but empty/invalid data for player ${numericPlayerId}:`, response.data);
            return null; // Treat empty or non-object data as not found
        }

    } catch (error: any) {
        const status = error.response?.status;
        if (status === 404) {
            logger.log(`[MatchService] Player ${numericPlayerId} not found in internal DB (404).`);
        } else {
            const errorMessage = error.response ? JSON.stringify(error.response.data) : error.message;
            logger.error(`[MatchService] Error fetching player ${numericPlayerId} from internal API (Status: ${status}): ${errorMessage}`);
        }
        return null; // Return null on any error (404 or other)
    }
};

/**
 * Fetches player details from the internal database.
 * This function now acts as a simple wrapper around getPlayerFromInternalAPI.
 * The complex external API fallback logic has been removed.
 * @param {number | string | undefined | null} playerId - The ID of the player.
 * @returns {Promise<Player|null>} Player data object or null.
 */
export const getPlayerDetails = async (playerId: number | string | undefined | null): Promise<Player | null> => {
    logger.debug(`[MatchService] getPlayerDetails called for ID: ${playerId}`);
    // Directly call the internal API fetch function
    const internalData = await getPlayerFromInternalAPI(playerId);

    if (internalData) {
        logger.debug(`[MatchService] getPlayerDetails returning data for ID: ${playerId}`);
        return internalData;
    } else {
        logger.debug(`[MatchService] getPlayerDetails did not find data for ID: ${playerId}. Returning null.`);
        return null;
    }
    // Removed external API fallback (getPlayerFromExternalAPI and queue logic)
};

// --- Ranking Function ---

// Ranking Types Constants
export const RANKING_TYPES = {
    MONEY_RANKINGS: 'MoneyRankings',
    MONEY_SEEDINGS: 'MoneySeedings', 
    ONE_YEAR_MONEY_RANKINGS: 'OneYearMoneyRankings',
    QT_RANKINGS: 'QTRankings',
    WOMENS_RANKINGS: 'WomensRankings'
} as const;

export type RankingType = typeof RANKING_TYPES[keyof typeof RANKING_TYPES];

/**
 * Fetches player ranking data from the backend API with comprehensive ranking type support.
 * @param {string} [rankingType] - Ranking type: 'MoneyRankings', 'MoneySeedings', etc., or legacy tab types
 * @returns {Promise<{ rankings: Ranking[], tab_name?: string, summary?: any, season?: number }>} Ranking data with tab info
 */
export const getRanking = async (rankingType?: string): Promise<{ rankings: Ranking[], tab_name?: string, summary?: any, season?: number }> => {
    // Determine endpoint type
    const isRankingTypeEndpoint = Object.values(RANKING_TYPES).includes(rankingType as RankingType);
    const isLegacyTabEndpoint = ['mens', 'womens', 'amateur'].includes(rankingType || '');
    
    let urlPath: string;
    
    if (isRankingTypeEndpoint) {
        // Use new ranking-types endpoint
        urlPath = `ranking-types/${rankingType}/`;
    } else if (isLegacyTabEndpoint) {
        // Use legacy tab endpoint for backwards compatibility
        urlPath = `rankings/${rankingType}/`;
    } else {
        // Default to rankings list endpoint
        urlPath = 'rankings/';
    }
    
    logger.debug(`[MatchService] Fetching rankings from ${urlPath}...`);
    
    // Helper function to try current and previous seasons
    const tryFetchWithFallback = async (currentSeason: number): Promise<any> => {
        for (let seasonOffset = 0; seasonOffset <= 2; seasonOffset++) {
            const season = currentSeason - seasonOffset;
            try {
                logger.debug(`[MatchService] Trying ${rankingType} for season ${season}...`);
                const response = await api.get<any>(urlPath, {
                    params: isRankingTypeEndpoint ? { season } : undefined
                });
                
                if (response.data && 
                    ((isRankingTypeEndpoint && Array.isArray(response.data.rankings) && response.data.rankings.length > 0) ||
                     (isLegacyTabEndpoint && Array.isArray(response.data.rankings) && response.data.rankings.length > 0) ||
                     (!isRankingTypeEndpoint && !isLegacyTabEndpoint && Array.isArray(response.data) && response.data.length > 0))) {
                    logger.debug(`[MatchService] Found ${rankingType} data for season ${season}`);
                    return { ...response.data, season };
                }
            } catch (error) {
                logger.debug(`[MatchService] No data for ${rankingType} in season ${season}, trying previous season...`);
            }
        }
        throw new Error(`No ${rankingType} data found for current or previous seasons`);
    };
    
    try {
        const currentYear = new Date().getFullYear();
        const currentSeason = currentYear; // Assuming season = year
        const responseData = await tryFetchWithFallback(currentSeason);

        if (isRankingTypeEndpoint) {
            // New ranking-types endpoint returns { ranking_type, ranking_name, rankings, summary, season }
            if (responseData && Array.isArray(responseData.rankings)) {
                logger.debug(`[MatchService] Successfully fetched ${responseData.rankings.length} ${rankingType} rankings from season ${responseData.season}.`);
                return {
                    rankings: responseData.rankings,
                    tab_name: responseData.ranking_name || rankingType,
                    summary: responseData.summary,
                    season: responseData.season
                };
            } else {
                logger.warn(`[MatchService] Invalid ranking-type response format for ${rankingType}:`, responseData);
                return { rankings: [] };
            }
        } else if (isLegacyTabEndpoint) {
            // Legacy tab endpoints return { tab_name, rankings, summary }
            if (responseData && Array.isArray(responseData.rankings)) {
                logger.debug(`[MatchService] Successfully fetched ${responseData.rankings.length} ${rankingType} rankings.`);
                return {
                    rankings: responseData.rankings,
                    tab_name: responseData.tab_name,
                    summary: responseData.summary,
                    season: responseData.season
                };
            } else {
                logger.warn(`[MatchService] Invalid tab response format for ${rankingType}:`, responseData);
                return { rankings: [] };
            }
        } else {
            // Legacy endpoint returns array directly
            if (Array.isArray(responseData)) {
                logger.debug(`[MatchService] Successfully fetched ${responseData.length} legacy ranking entries.`);
                return { rankings: responseData, season: responseData.season };
            } else {
                logger.warn(`[MatchService] Received non-array data (${typeof responseData}) when fetching rankings.`);
                return { rankings: [] };
            }
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const userFriendlyMessage = error.userFriendlyMessage || `Failed to load ${rankingType} rankings`;
        logger.error(`[MatchService] Error fetching ${rankingType} rankings (Status: ${status}):`, errorData || error.message);
        
        // Re-throw error with user-friendly message for UI
        throw new Error(userFriendlyMessage);
    }
};

// --- Match Functions ---

/**
 * Fetches details for a specific match from the internal database using its API ID.
 * Corresponds to match_detail_view mapped to /matches/<api_match_id>/.
 * @param {number | string | undefined | null} apiMatchId - The API ID of the match (from snooker.org).
 * @returns {Promise<Match|null>} Match details object or null if not found or error.
 */
export const getMatchDetails = async (apiMatchId: number | string | undefined | null): Promise<Match | null> => {
    // Validate Match API ID
    const numericMatchId = typeof apiMatchId === 'string' ? parseInt(apiMatchId, 10) : apiMatchId;
     if (typeof numericMatchId !== 'number' || isNaN(numericMatchId) || numericMatchId <= 0) {
        logger.error("[MatchService] Invalid API Match ID provided to getMatchDetails:", apiMatchId);
        return null;
    }

    const urlPath = `matches/${numericMatchId}/`; // Path uses api_match_id as defined in urls.py
    logger.debug(`[MatchService] Fetching match details from: ${urlPath}`);
    try {
        const response = await api.get<Match>(urlPath);

        // Expecting a single match object like:
        // { id (django pk), api_match_id, event_id, round, number, player1_id, player1_name, ... }
        if (response.data && typeof response.data === 'object' && response.data.api_match_id === numericMatchId) {
            logger.debug(`[MatchService] Successfully fetched details for match API ID ${numericMatchId}`);
            return response.data; // Return the match details object
        } else {
            logger.warn(`[MatchService] Unexpected data format or API ID mismatch for match API ID ${numericMatchId}:`, response.data);
            // If the API returns 200 OK but with bad data or wrong ID
             if (response.status === 200) {
                 // Treat as not found if data is invalid despite 200 OK
                 return null;
             }
             // Otherwise, the error will be caught below
             return null; // Fallback
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
         if (status === 404) {
            logger.log(`[MatchService] Match with API ID ${numericMatchId} not found in internal DB (404).`);
         } else {
            logger.error(`[MatchService] Error fetching match details for API ID ${numericMatchId} (Status: ${status}):`, errorData || error.message);
         }
        return null; // Return null on any error
    }
};

// --- Match Format Function ---

export const getMatchFormat = async (roundId: number | null, season: number | null): Promise<string> => {
    if (roundId === null || season === null) {
        logger.warn("[MatchService] getMatchFormat called with null roundId or season. Returning 'Format TBD'.");
        return "Format TBD";
    }

    const urlPath = `match-format/${roundId}/${season}/`;
    logger.debug(`[MatchService] Fetching match format from: ${urlPath}`);

    try {
        const response = await api.get<any[]>(urlPath); // Expecting an array of objects

        if (Array.isArray(response.data) && response.data.length > 0) {
            // Assuming the first object in the array contains the 'Distance' key
            const formatData = response.data[0]; 
            if (formatData && typeof formatData.Distance === 'number') {
                const bestOfFrames = (formatData.Distance * 2) - 1;
                logger.debug(`[MatchService] Successfully fetched match format: Distance ${formatData.Distance} = Best of ${bestOfFrames}`);
                return `Best of ${bestOfFrames}`;
            } else {
                logger.warn(`[MatchService] 'Distance' key not found or not a number in response for roundId ${roundId}, season ${season}:`, formatData);
                return "Format TBD";
            }
        } else {
            logger.warn(`[MatchService] Received empty or non-array data when fetching match format for roundId ${roundId}, season ${season}:`, response.data);
            return "Format TBD";
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        logger.error(`[MatchService] Error fetching match format for roundId ${roundId}, season ${season} (Status: ${status}):`, errorData || error.message);
        return "Format TBD";
    }
};

// --- Calendar Tab Function ---

/**
 * Fetches calendar data by tab type from the backend API.
 * Corresponds to calendar_tabs_view mapped to /calendar/<tab_type>/.
 * @param {string} tabType - Tab type: 'main', 'others', or 'all'
 * @returns {Promise<any>} Calendar data with tab info or null on error
 */
export const getCalendarByTab = async (tabType: string = 'main'): Promise<any> => {
    const urlPath = `calendar/${tabType}/`;
    logger.debug(`[MatchService] Fetching calendar data from ${urlPath}...`);
    
    try {
        const response = await api.get<any>(urlPath);
        
        if (response.data && typeof response.data === 'object') {
            logger.debug(`[MatchService] Successfully fetched ${tabType} calendar data.`);
            return response.data;
        } else {
            logger.warn(`[MatchService] Invalid calendar response format for ${tabType}:`, response.data);
            return null;
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const userFriendlyMessage = error.userFriendlyMessage || `Failed to load ${tabType} tournaments`;
        logger.error(`[MatchService] Error fetching ${tabType} calendar (Status: ${status}):`, errorData || error.message);
        
        // Re-throw error with user-friendly message for UI
        throw new Error(userFriendlyMessage);
    }
};

// --- Head-to-Head Function ---

/**
 * Fetches Head-to-Head statistics between two players from the backend proxy endpoint.
 * Corresponds to h2h_view mapped to /h2h/<p1_id>/<p2_id>/.
 * @param {number | string | undefined | null} player1Id - The ID of the first player.
 * @param {number | string | undefined | null} player2Id - The ID of the second player.
 * @returns {Promise<HeadToHead|null>} H2H statistics object or null on error.
 */
export const getHeadToHead = async (player1Id: number | string | undefined | null, player2Id: number | string | undefined | null): Promise<HeadToHead | null> => {
    // Validate IDs
    const p1Numeric = typeof player1Id === 'string' ? parseInt(player1Id, 10) : player1Id;
    const p2Numeric = typeof player2Id === 'string' ? parseInt(player2Id, 10) : player2Id;

    if (typeof p1Numeric !== 'number' || isNaN(p1Numeric) || p1Numeric <= 0 ||
        typeof p2Numeric !== 'number' || isNaN(p2Numeric) || p2Numeric <= 0) {
        logger.warn("[MatchService] Both valid player IDs are required for getHeadToHead.", { player1Id, player2Id });
        return null;
    }
    if (p1Numeric === p2Numeric) {
         logger.warn("[MatchService] Cannot fetch H2H for the same player ID:", p1Numeric);
         return null; // Or return a default object { Player1Wins: 0, Player2Wins: 0 }?
    }

    const urlPath = `h2h/${p1Numeric}/${p2Numeric}/`; // Use the H2H endpoint defined in urls.py
    logger.debug(`[MatchService] Fetching H2H data from backend proxy: ${urlPath}`);
    try {
        const response = await api.get<HeadToHead>(urlPath);
        // Expecting an object like { Player1Wins: X, Player2Wins: Y, Matches: [...] } from backend view
        if (response.data && typeof response.data === 'object') {
            logger.debug(`[MatchService] H2H data received for ${p1Numeric} vs ${p2Numeric}:`, response.data);
            return response.data;
        } else {
            logger.warn(`[MatchService] Unexpected data format for H2H ${p1Numeric} vs ${p2Numeric}:`, response.data);
            return null;
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        // H2H might return 404 if no history exists, treat as valid empty data?
        if (status === 404) {
             logger.log(`[MatchService] No H2H data found for ${p1Numeric} vs ${p2Numeric} (404). Returning null.`);
             return null; // Or return default object: { Player1Wins: 0, Player2Wins: 0, Matches: [] }
        } else {
             logger.error(`[MatchService] Error fetching H2H for ${p1Numeric} vs ${p2Numeric} (Status: ${status}):`, errorData || error.message);
             return null; // Return null on other errors
        }
    }
};