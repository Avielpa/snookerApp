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
    Photo?: string | null;
    current_ranking_position?: number | null;
    prize_money_this_year?: number | null;
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
        logger.debug(`[MatchService] getPlayerDetails did not find data for ID: ${playerId}. Trying external fallback...`);
        
        // EMERGENCY FALLBACK: Try to fetch from snooker.org directly
        try {
            const numericPlayerId = typeof playerId === 'string' ? parseInt(playerId, 10) : playerId;
            if (typeof numericPlayerId === 'number' && !isNaN(numericPlayerId) && numericPlayerId > 0) {
                // Basic player data structure for display
                // Create safe fallback player that won't cause crashes
                const fallbackPlayer: Player = {
                    ID: numericPlayerId,
                    FirstName: `Player`,
                    LastName: `${numericPlayerId}`,
                    MiddleName: '',
                    Nationality: 'Unknown',
                    Sex: 'M',
                    BirthDate: null,
                    Photo: '',
                    SurnameFirst: false,
                    License: '',
                    Club: '',
                    SponsorshipDeals: '',
                    Twitter: '',
                    ShortName: `P${numericPlayerId}`,
                    CommonName: `Player ${numericPlayerId}`,
                    TeamName: '',
                    WST: '',
                    Active: true,
                };
                
                logger.debug(`[MatchService] Using fallback player data for ID: ${playerId}`);
                return fallbackPlayer;
            }
        } catch (error) {
            logger.warn(`[MatchService] Fallback player creation failed for ID: ${playerId}`, error);
        }
        
        return null;
    }
};

// --- Ranking Function ---

// Ranking Types Constants
export const RANKING_TYPES = {
    MONEY_RANKINGS: 'MoneyRankings',
    MONEY_SEEDINGS: 'MoneySeedings', 
    ONE_YEAR_MONEY_RANKINGS: 'OneYearMoneyRankings',
    QT_RANKINGS: 'QTRankings',
    WOMENS_RANKINGS: 'WomensRankings',
    AMATEUR_RANKINGS: 'AmateurRankings'
} as const;

export type RankingType = typeof RANKING_TYPES[keyof typeof RANKING_TYPES];

/**
 * Fetches player ranking data from the backend API with comprehensive ranking type support.
 * @param {string} [rankingType] - Ranking type: 'MoneyRankings', 'MoneySeedings', etc., or legacy tab types
 * @returns {Promise<{ rankings: Ranking[], tab_name?: string, summary?: any, season?: number }>} Ranking data with tab info
 */
export const getRanking = async (rankingType?: string): Promise<{ rankings: Ranking[], tab_name?: string, summary?: any, season?: number }> => {
    console.log(`[MatchService] === getRanking CALLED ===`);
    console.log(`[MatchService] rankingType: ${rankingType}`);
    
    // Use the backend database endpoints directly - no complex API logic needed
    const isRankingTypeEndpoint = Object.values(RANKING_TYPES).includes(rankingType as RankingType);
    
    let urlPath: string;
    
    if (isRankingTypeEndpoint) {
        // Use backend ranking-types endpoint that serves from database
        urlPath = `ranking-types/${rankingType}/`;
    } else {
        // Use legacy tab endpoint for backwards compatibility
        urlPath = `rankings/${rankingType || 'mens'}/`;
    }
    
    console.log(`[MatchService] isRankingTypeEndpoint: ${isRankingTypeEndpoint}`);
    console.log(`[MatchService] urlPath: ${urlPath}`);
    logger.debug(`[MatchService] Fetching rankings from backend database: ${urlPath}`);
    
    try {
        console.log(`[MatchService] Making API call to: ${urlPath}`);
        const response = await api.get<any>(urlPath);
        console.log(`[MatchService] API response received:`, {
            hasResponse: !!response,
            status: response?.status,
            hasData: !!response?.data,
            dataKeys: response?.data ? Object.keys(response.data) : 'NO DATA'
        });
        
        if (response.data) {
            console.log(`[MatchService] Response data structure:`, {
                hasRankings: !!response.data.rankings,
                rankingsLength: response.data.rankings?.length || 0,
                rankingsIsArray: Array.isArray(response.data.rankings),
                otherKeys: Object.keys(response.data).filter(k => k !== 'rankings')
            });
            
            if (isRankingTypeEndpoint) {
                // Backend ranking-types endpoint response format
                if (response.data.rankings && Array.isArray(response.data.rankings)) {
                    console.log(`[MatchService] SUCCESS: ${response.data.rankings.length} rankings from ranking-types endpoint`);
                    logger.debug(`[MatchService] Successfully fetched ${response.data.rankings.length} ${rankingType} rankings from database.`);
                    return {
                        rankings: response.data.rankings,
                        tab_name: response.data.ranking_name || rankingType,
                        summary: response.data.summary,
                        season: response.data.season
                    };
                } else {
                    console.log(`[MatchService] WARNING: No rankings in ranking-types response`, response.data);
                    logger.warn(`[MatchService] No rankings data in response for ${rankingType}:`, response.data);
                    return { rankings: [], tab_name: rankingType };
                }
            } else {
                // Legacy tab endpoint response format
                if (response.data.rankings && Array.isArray(response.data.rankings)) {
                    console.log(`[MatchService] SUCCESS: ${response.data.rankings.length} rankings from legacy endpoint`);
                    logger.debug(`[MatchService] Successfully fetched ${response.data.rankings.length} ${rankingType} rankings from database.`);
                    return {
                        rankings: response.data.rankings,
                        tab_name: response.data.tab_name || rankingType,
                        summary: response.data.summary,
                        season: response.data.season
                    };
                } else {
                    console.log(`[MatchService] WARNING: No rankings in legacy response`, response.data);
                    logger.warn(`[MatchService] No rankings data in legacy response for ${rankingType}:`, response.data);
                    return { rankings: [], tab_name: rankingType };
                }
            }
        } else {
            console.log(`[MatchService] WARNING: Empty response data`);
            logger.warn(`[MatchService] Empty response for ${rankingType} rankings`);
            return { rankings: [], tab_name: rankingType };
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        console.error(`[MatchService] ERROR in getRanking:`, {
            status,
            errorData,
            errorMessage: error.message,
            networkError: !error.response,
            fullError: error
        });
        
        logger.error(`[MatchService] Error fetching ${rankingType} rankings from database (Status: ${status}):`, errorData || error.message);
        
        // Return empty rankings instead of throwing to prevent UI crashes
        console.error(`[MatchService] Failed to load ${rankingType} rankings:`, error.message);
        return { 
            rankings: [], 
            tab_name: rankingType
        };
    }
};

// --- Match Functions ---

// Match ID cache for retry logic and memoization
const matchIdCache = new Map<number, Match | null>();
const matchIdRetryAttempts = new Map<number, number>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Clear cache entry for a specific match ID (used during live updates)
 */
export const clearMatchCache = (apiMatchId: number) => {
    matchIdCache.delete(apiMatchId);
    matchIdRetryAttempts.delete(apiMatchId);
    logger.debug(`[MatchService] Cache cleared for match ${apiMatchId}`);
};

/**
 * Fetches details for a specific match from the internal database using its API ID.
 * Enhanced with auto-retry logic for handling match ID changes during breaks.
 * Corresponds to match_detail_view mapped to /matches/<api_match_id>/.
 * @param {number | string | undefined | null} apiMatchId - The API ID of the match (from snooker.org).
 * @param {boolean} bypassCache - Whether to bypass the memoization cache
 * @returns {Promise<Match|null>} Match details object or null if not found or error.
 */
export const getMatchDetails = async (apiMatchId: number | string | undefined | null, bypassCache: boolean = false): Promise<Match | null> => {
    // Validate Match API ID
    const numericMatchId = typeof apiMatchId === 'string' ? parseInt(apiMatchId, 10) : apiMatchId;
    if (typeof numericMatchId !== 'number' || isNaN(numericMatchId) || numericMatchId <= 0) {
        logger.error("[MatchService] Invalid API Match ID provided to getMatchDetails:", apiMatchId);
        return null;
    }

    // Check cache first (memoization for stability)
    if (!bypassCache && matchIdCache.has(numericMatchId)) {
        const cachedResult = matchIdCache.get(numericMatchId);
        logger.debug(`[MatchService] Returning cached result for match ${numericMatchId}`);
        return cachedResult || null;
    }

    const urlPath = `matches/${numericMatchId}/`;
    logger.debug(`[MatchService] Fetching match details from: ${urlPath}`);

    try {
        const response = await api.get<Match>(urlPath);

        // Expecting a single match object
        if (response.data && typeof response.data === 'object' && response.data.api_match_id === numericMatchId) {
            logger.debug(`[MatchService] Successfully fetched details for match API ID ${numericMatchId}`);
            
            // Cache successful result
            matchIdCache.set(numericMatchId, response.data);
            matchIdRetryAttempts.delete(numericMatchId); // Reset retry count on success
            
            // Clear cache after duration
            setTimeout(() => {
                matchIdCache.delete(numericMatchId);
            }, CACHE_DURATION);
            
            return response.data;
        } else {
            logger.warn(`[MatchService] Unexpected data format or API ID mismatch for match API ID ${numericMatchId}:`, response.data);
            return null;
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        if (status === 404) {
            // Handle 404 with auto-retry logic for match ID changes during breaks
            logger.log(`[MatchService] Match with API ID ${numericMatchId} not found in internal DB (404). Attempting auto-retry...`);
            
            // Get current retry attempts
            const currentAttempts = matchIdRetryAttempts.get(numericMatchId) || 0;
            
            if (currentAttempts < MAX_RETRY_ATTEMPTS) {
                // Increment retry attempts
                matchIdRetryAttempts.set(numericMatchId, currentAttempts + 1);
                
                logger.log(`[MatchService] Auto-retry attempt ${currentAttempts + 1}/${MAX_RETRY_ATTEMPTS} for match ${numericMatchId}`);
                
                // Try different match ID patterns that could result from session breaks
                const retryMatchIds = [
                    numericMatchId + 1,    // Often ID increments by 1
                    numericMatchId - 1,    // Sometimes decrements
                    numericMatchId + 2,    // Could increment by 2
                    numericMatchId - 2,    // Could decrement by 2
                ];
                
                for (const retryId of retryMatchIds) {
                    try {
                        logger.debug(`[MatchService] Trying alternative match ID: ${retryId}`);
                        const retryResponse = await api.get<Match>(`matches/${retryId}/`);
                        
                        if (retryResponse.data && typeof retryResponse.data === 'object') {
                            // Check if this might be the same match (same players, event, round)
                            const originalAttempt = await api.get<Match>(`matches/${numericMatchId}/`).catch(() => null);
                            
                            logger.log(`[MatchService] ✅ Found alternative match ID ${retryId} for original ${numericMatchId}`);
                            
                            // Cache both IDs to the same result for future stability
                            matchIdCache.set(numericMatchId, retryResponse.data);
                            matchIdCache.set(retryId, retryResponse.data);
                            matchIdRetryAttempts.delete(numericMatchId);
                            
                            // Clear cache after duration
                            setTimeout(() => {
                                matchIdCache.delete(numericMatchId);
                                matchIdCache.delete(retryId);
                            }, CACHE_DURATION);
                            
                            return retryResponse.data;
                        }
                    } catch (retryError) {
                        // Continue to next retry ID
                        logger.debug(`[MatchService] Retry ID ${retryId} also failed, continuing...`);
                    }
                }
                
                // If all retries failed, cache null to prevent repeated attempts
                logger.warn(`[MatchService] All retry attempts failed for match ${numericMatchId}. Caching null result.`);
                matchIdCache.set(numericMatchId, null);
                
                // Clear null cache after shorter duration to allow future retries
                setTimeout(() => {
                    matchIdCache.delete(numericMatchId);
                    matchIdRetryAttempts.delete(numericMatchId);
                }, CACHE_DURATION / 2); // 2.5 minutes for null results
                
                return null;
            } else {
                // Max retries reached
                logger.warn(`[MatchService] Max retry attempts (${MAX_RETRY_ATTEMPTS}) reached for match ${numericMatchId}`);
                matchIdCache.set(numericMatchId, null);
                return null;
            }
        } else {
            logger.error(`[MatchService] Error fetching match details for API ID ${numericMatchId} (Status: ${status}):`, errorData || error.message);
            return null;
        }
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
 * Fetches calendar data by tab type from the backend API with auto-retry logic.
 * Corresponds to calendar_tabs_view mapped to /calendar/<tab_type>/.
 * @param {string} tabType - Tab type: 'main', 'others', or 'all'
 * @param {number} retryAttempts - Number of retry attempts (for internal use)
 * @returns {Promise<any>} Calendar data with tab info or null on error
 */
export const getCalendarByTab = async (tabType: string = 'main', retryAttempts: number = 0): Promise<any> => {
    const urlPath = `calendar/${tabType}/`;
    const maxRetries = 3;
    const retryDelay = 1000 * (retryAttempts + 1); // Progressive delay: 1s, 2s, 3s
    
    logger.debug(`[MatchService] Fetching calendar data from ${urlPath} (attempt ${retryAttempts + 1}/${maxRetries + 1})...`);
    
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
        const isNetworkError = !error.response && (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error'));
        const isTimeoutError = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        const userFriendlyMessage = error.userFriendlyMessage || `Failed to load ${tabType} tournaments`;
        
        logger.error(`[MatchService] Error fetching ${tabType} calendar (status: ${status}) ${error.message}`);
        
        // Retry logic for network and timeout errors
        if ((isNetworkError || isTimeoutError || status >= 500) && retryAttempts < maxRetries) {
            logger.log(`[MatchService] Retrying calendar fetch in ${retryDelay}ms... (attempt ${retryAttempts + 1}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return getCalendarByTab(tabType, retryAttempts + 1);
        }
        
        // Log final error after all retries exhausted
        if (retryAttempts >= maxRetries) {
            logger.error(`[MatchService] All ${maxRetries + 1} attempts failed for ${tabType} calendar. Final error:`, error.message);
        }
        
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
        typeof p2Numeric !== 'number' || isNaN(p2Numeric) || p2Numeric <= 0 ||
        p1Numeric === 376 || p2Numeric === 376) { // Avoid H2H for unknown players
        logger.warn("[MatchService] Both valid player IDs are required for getHeadToHead (excluding unknown player ID 376).", { player1Id, player2Id });
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

// ===================== PLAYER MATCH HISTORY =====================

export interface PlayerMatchHistoryItem {
    api_match_id: number;
    event_id?: number | null;
    event_name?: string | null;
    round_number?: number | null;
    round_name?: string | null;
    player1_id?: number | null;
    player1_name?: string | null;
    score1?: number | null;
    player2_id?: number | null;
    player2_name?: string | null;
    score2?: number | null;
    winner_id?: number | null;
    status: number;
    scheduled_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    season?: number | null;
}

export interface PlayerMatchHistoryResponse {
    player_id: number;
    player_name: string;
    matches: PlayerMatchHistoryItem[];
}

/**
 * Fetches match history for a specific player
 * @param playerId - The ID of the player
 * @param limit - Number of matches to return (default: 20)
 * @returns Player match history response or null if error
 */
export const getPlayerMatchHistory = async (
    playerId: number | string,
    limit: number = 20
): Promise<PlayerMatchHistoryResponse | null> => {
    try {
        const playerIdNum = typeof playerId === 'string' ? parseInt(playerId, 10) : playerId;

        if (isNaN(playerIdNum) || playerIdNum <= 0) {
            logger.error(`[MatchService] Invalid player ID for match history: ${playerId}`);
            return {
                player_id: playerIdNum,
                player_name: 'Unknown',
                matches: []
            };
        }

        logger.log(`[MatchService] Fetching match history for player ${playerIdNum}, limit=${limit}`);

        const response = await api.get<PlayerMatchHistoryResponse>(
            `/players/${playerIdNum}/matches/`,
            {
                params: { limit },
                timeout: 15000 // 15 second timeout for match history
            }
        );

        if (response.data && Array.isArray(response.data.matches)) {
            logger.log(`[MatchService] Successfully fetched ${response.data.matches.length} matches for player ${playerIdNum}`);
            return response.data;
        } else {
            logger.warn(`[MatchService] Unexpected data format for player ${playerIdNum} match history:`, response.data);
            // Return empty instead of null to prevent crash
            return {
                player_id: playerIdNum,
                player_name: 'Unknown',
                matches: []
            };
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');

        // Handle all error cases gracefully - return empty matches instead of null
        if (status === 404 || !status) {
            logger.log(`[MatchService] Match history endpoint not available or player ${playerId} not found (404/Network error). Returning empty matches.`);
            return {
                player_id: typeof playerId === 'number' ? playerId : parseInt(playerId, 10),
                player_name: 'Unknown',
                matches: []
            };
        } else if (isTimeout) {
            logger.error(`[MatchService] Timeout fetching match history for player ${playerId}`);
            return {
                player_id: typeof playerId === 'number' ? playerId : parseInt(playerId, 10),
                player_name: 'Unknown',
                matches: []
            };
        } else {
            logger.error(`[MatchService] Error fetching match history for player ${playerId} (Status: ${status}):`, errorData || error.message);
            // Still return empty matches to prevent crash
            return {
                player_id: typeof playerId === 'number' ? playerId : parseInt(playerId, 10),
                player_name: 'Unknown',
                matches: []
            };
        }
    }
};