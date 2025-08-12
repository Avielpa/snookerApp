// services/tourServices.ts
import { api } from "./api";
import { logger } from "../utils/logger";

// TypeScript interfaces for better type safety
export interface Event {
    ID: number;
    Name?: string | null;
    StartDate?: string | null;
    EndDate?: string | null;
    Season?: number | null;
    Type?: string | null;
    Venue?: string | null;
    City?: string | null;
    Country?: string | null;
    Tour?: string | null;
    Sponsor?: string | null;
    Url?: string | null;
    Format?: number | null; // Real match format from your database (Best of X)
}

export interface Match {
    id: number;
    api_match_id?: number | null;
    event_id?: number;
    round?: number | null;
    number?: number | null;
    player1_id?: number | null;
    player2_id?: number | null;
    score1?: number | null;
    score2?: number | null;
    winner_id?: number | null;
    status_code?: number | null;
    status_display?: string | null;
    scheduled_date?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    player1_name?: string;
    player2_name?: string;
    frame_scores?: string | null;
    sessions_str?: string | null;
    on_break?: boolean | null;
    unfinished?: boolean | null;
    live_url?: string | null;
    details_url?: string | null;
    note?: string | null;
}

/**
 * Fetches the list of season events from the backend API.
 * @returns {Promise<Event[]>} An array of event objects, or empty array on error.
 */
export const getSeasonEvents = async (): Promise<Event[]> => {
    const urlPath = 'events/';
    logger.debug(`[TourService] Fetching season events from: ${urlPath}`);
    
    try {
        const response = await api.get<Event[]>(urlPath);
        
        if (Array.isArray(response.data)) {
            logger.debug(`[TourService] Successfully fetched ${response.data.length} events.`);
            return response.data;
        } else {
            logger.warn(`[TourService] Received non-array data (${typeof response.data}) when fetching events. Returning empty array.`);
            return [];
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        logger.error(`[TourService] Error fetching season events (Status: ${status}):`, errorData || error.message);
        return [];
    }
};

/**
 * Finds the ID of the currently active tournament with main tour priority (Client-Side Logic).
 * @returns {Promise<number|null>} The ID (PK) of the active tournament or null if none found or error.
 */
export const getActiveTournamentId = async (): Promise<number | null> => {
    logger.debug("[TourService] Determining active tournament ID with main tour priority...");
    
    try {
        const events = await getSeasonEvents();
        
        if (!events || events.length === 0) {
            logger.log("[TourService] No events fetched, cannot determine active tournament.");
            return null;
        }
        
        const now = new Date();
        
        // Helper function to check if tournament is currently active
        const isActiveTournament = (tournament: Event): boolean => {
            if (!tournament.StartDate || !tournament.EndDate) return false;
            
            try {
                const start = new Date(tournament.StartDate);
                const end = new Date(tournament.EndDate);
                end.setHours(23, 59, 59, 999);
                
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
                
                return start <= now && now <= end;
            } catch {
                return false;
            }
        };
        
        // First priority: Find active main tour
        const activeMainTour = events.find(tournament => 
            isActiveTournament(tournament) && tournament.Tour === 'main'
        );
        
        if (activeMainTour) {
            logger.debug(`[TourService] Active MAIN tournament found: ID = ${activeMainTour.ID} ('${activeMainTour.Name}')`);
            return activeMainTour.ID;
        }
        
        // Second priority: Find any active tournament (if no main tour is active)
        const activeAnyTour = events.find(isActiveTournament);
        
        if (activeAnyTour) {
            logger.debug(`[TourService] Active tournament found (non-main): ID = ${activeAnyTour.ID} ('${activeAnyTour.Name}') - Tour: ${activeAnyTour.Tour}`);
            return activeAnyTour.ID;
        }
        
        // Third priority: Find upcoming main tour
        logger.log("[TourService] No active tournament found, looking for upcoming main tournaments...");
        
        const upcomingMainTour = events
            .filter(tournament => {
                if (!tournament.StartDate || tournament.Tour !== 'main') return false;
                try {
                    const start = new Date(tournament.StartDate);
                    return !isNaN(start.getTime()) && start > now;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => {
                const startA = new Date(a.StartDate!);
                const startB = new Date(b.StartDate!);
                return startA.getTime() - startB.getTime(); // Closest first
            })[0];
        
        if (upcomingMainTour) {
            logger.debug(`[TourService] Upcoming MAIN tournament found: ID = ${upcomingMainTour.ID} ('${upcomingMainTour.Name}')`);
            return upcomingMainTour.ID;
        }
        
        // Fourth priority: Find any upcoming tournament
        const upcomingAnyTour = events
            .filter(tournament => {
                if (!tournament.StartDate) return false;
                try {
                    const start = new Date(tournament.StartDate);
                    return !isNaN(start.getTime()) && start > now;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => {
                const startA = new Date(a.StartDate!);
                const startB = new Date(b.StartDate!);
                return startA.getTime() - startB.getTime(); // Closest first
            })[0];
        
        if (upcomingAnyTour) {
            logger.debug(`[TourService] Upcoming tournament found (non-main): ID = ${upcomingAnyTour.ID} ('${upcomingAnyTour.Name}') - Tour: ${upcomingAnyTour.Tour}`);
            return upcomingAnyTour.ID;
        }
        
        // Fifth priority: Recent main tournaments (within last 30 days)
        logger.log("[TourService] No upcoming tournaments found, looking for recent main tournaments...");
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentMainTour = events
            .filter(tournament => {
                if (!tournament.EndDate || tournament.Tour !== 'main') return false;
                try {
                    const end = new Date(tournament.EndDate);
                    return !isNaN(end.getTime()) && end >= thirtyDaysAgo && end < now;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => {
                const endA = new Date(a.EndDate!);
                const endB = new Date(b.EndDate!);
                return endB.getTime() - endA.getTime(); // Most recent first
            })[0];
        
        if (recentMainTour) {
            logger.debug(`[TourService] Recent MAIN tournament found: ID = ${recentMainTour.ID} ('${recentMainTour.Name}')`);
            return recentMainTour.ID;
        }
        
        // Sixth priority: Any recent tournament
        const recentAnyTour = events
            .filter(tournament => {
                if (!tournament.EndDate) return false;
                try {
                    const end = new Date(tournament.EndDate);
                    return !isNaN(end.getTime()) && end >= thirtyDaysAgo && end < now;
                } catch {
                    return false;
                }
            })
            .sort((a, b) => {
                const endA = new Date(a.EndDate!);
                const endB = new Date(b.EndDate!);
                return endB.getTime() - endA.getTime(); // Most recent first
            })[0];
        
        if (recentAnyTour) {
            logger.debug(`[TourService] Recent tournament found (fallback): ID = ${recentAnyTour.ID} ('${recentAnyTour.Name}') - Tour: ${recentAnyTour.Tour}`);
            return recentAnyTour.ID;
        }
        
        // Last resort: return the most recent main tournament regardless of date
        if (events.length > 0) {
            const latestMainTour = events
                .filter(tournament => tournament.StartDate && tournament.Tour === 'main')
                .sort((a, b) => {
                    const startA = new Date(a.StartDate!);
                    const startB = new Date(b.StartDate!);
                    return startB.getTime() - startA.getTime(); // Most recent first
                })[0];
            
            if (latestMainTour) {
                logger.debug(`[TourService] Latest MAIN tournament found (last resort): ID = ${latestMainTour.ID} ('${latestMainTour.Name}')`);
                return latestMainTour.ID;
            }
            
            // Final fallback: any tournament
            const latestAnyTour = events
                .filter(tournament => tournament.StartDate)
                .sort((a, b) => {
                    const startA = new Date(a.StartDate!);
                    const startB = new Date(b.StartDate!);
                    return startB.getTime() - startA.getTime(); // Most recent first
                })[0];
            
            if (latestAnyTour) {
                logger.debug(`[TourService] Latest tournament found (final fallback): ID = ${latestAnyTour.ID} ('${latestAnyTour.Name}') - Tour: ${latestAnyTour.Tour}`);
                return latestAnyTour.ID;
            }
        }
        
        logger.log("[TourService] No suitable tournament found.");
        return null;
        
    } catch (error: any) {
        logger.error("[TourService] Error occurred while determining active tournament ID:", error);
        return null;
    }
};

/**
 * Gets active "other" tours (non-main tours) that are currently running.
 * @returns {Promise<Event[]>} Array of active other tour events, or empty array on error.
 */
export const getActiveOtherTours = async (): Promise<Event[]> => {
    logger.debug("[TourService] Getting active other tours...");
    
    try {
        const events = await getSeasonEvents();
        
        if (!events || events.length === 0) {
            logger.log("[TourService] No events fetched, cannot determine active other tours.");
            return [];
        }
        
        const now = new Date();
        
        // Helper function to check if tournament is currently active
        const isActiveTournament = (tournament: Event): boolean => {
            if (!tournament.StartDate || !tournament.EndDate) return false;
            
            try {
                const start = new Date(tournament.StartDate);
                const end = new Date(tournament.EndDate);
                end.setHours(23, 59, 59, 999);
                
                if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
                
                return start <= now && now <= end;
            } catch {
                return false;
            }
        };
        
        // Find all active non-main tours
        const activeOtherTours = events.filter(tournament => 
            isActiveTournament(tournament) && tournament.Tour !== 'main' && tournament.Tour !== null
        );
        
        // Sort by start date (earliest first)
        activeOtherTours.sort((a, b) => {
            if (!a.StartDate || !b.StartDate) return 0;
            const startA = new Date(a.StartDate);
            const startB = new Date(b.StartDate);
            return startA.getTime() - startB.getTime();
        });
        
        logger.debug(`[TourService] Found ${activeOtherTours.length} active other tours:`, 
            activeOtherTours.map(t => ({ ID: t.ID, Name: t.Name, Tour: t.Tour }))
        );
        
        return activeOtherTours;
        
    } catch (error: any) {
        logger.error("[TourService] Error occurred while getting active other tours:", error);
        return [];
    }
};

/**
 * Fetches details for a specific event (tournament) from the internal backend API.
 * @param {number | string | undefined | null} eventId - The ID (PK) of the event.
 * @returns {Promise<Event|null>} Event details object or null if not found or error.
 */
export const getTournamentDetails = async (eventId: number | string | undefined | null): Promise<Event | null> => {
    const numericEventId = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
    
    if (typeof numericEventId !== 'number' || isNaN(numericEventId) || numericEventId <= 0) {
        logger.error("[TourService] Invalid Event ID provided to getTournamentDetails:", eventId);
        return null;
    }
    
    const urlPath = `events/${numericEventId}/`;
    logger.debug(`[TourService] Fetching tournament details from: ${urlPath}`);
    
    try {
        const response = await api.get<Event>(urlPath);
        
        if (response.data && typeof response.data === 'object' && response.data.ID === numericEventId) {
            logger.debug(`[TourService] Successfully fetched details for event ${numericEventId}.`);
            return response.data;
        } else {
            logger.warn(`[TourService] Unexpected data format or ID mismatch for event ${numericEventId}:`, response.data);
            return null;
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        if (status === 404) {
            logger.log(`[TourService] Event ${numericEventId} not found (404).`);
        } else {
            logger.error(`[TourService] Error fetching tournament details for ID ${numericEventId} (Status: ${status}):`, errorData || error.message);
        }
        
        return null;
    }
};

/**
 * Fetches all matches for a specific event (tournament) from the internal backend API.
 * @param {number | string | undefined | null} eventId - The ID (PK) of the event.
 * @returns {Promise<Match[]>} An array of match objects, or empty array on error.
 */
export const getTournamentMatches = async (eventId: number | string | undefined | null): Promise<Match[]> => {
    const numericEventId = typeof eventId === 'string' ? parseInt(eventId, 10) : eventId;
    
    if (typeof numericEventId !== 'number' || isNaN(numericEventId) || numericEventId <= 0) {
        logger.error("[TourService] Invalid Event ID provided to getTournamentMatches:", eventId);
        return [];
    }
    
    const urlPath = `events/${numericEventId}/matches/`;
    logger.debug(`[TourService] Fetching tournament matches from: ${urlPath}`);
    
    try {
        const response = await api.get<Match[]>(urlPath);
        
        if (Array.isArray(response.data)) {
            logger.debug(`[TourService] Successfully fetched ${response.data.length} matches for event ${numericEventId}.`);
            
            if (response.data.length === 0) {
                logger.warn(`[TourService] ⚠️  No matches found for event ${numericEventId}`);
            } else {
                logger.debug(`[TourService] Match details:`, response.data.slice(0, 3)); // Log first 3 matches
                
                // Log match status breakdown for debugging
                const statusCounts: Record<number, number> = {};
                response.data.forEach(match => {
                    const status = match.status_code ?? -1;
                    statusCounts[status] = (statusCounts[status] || 0) + 1;
                });
                
                logger.debug(`[TourService] Match status breakdown:`, statusCounts);
            }
            
            return response.data;
        } else {
            logger.warn(`[TourService] Received non-array data (${typeof response.data}) when fetching matches. Returning empty array.`);
            logger.debug(`[TourService] Response data:`, response.data);
            return [];
        }
    } catch (error: any) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        if (status === 404) {
            logger.warn(`[TourService] ⚠️  Event ${numericEventId} not found or has no matches (404)`);
        } else if (status >= 500) {
            logger.error(`[TourService] ❌ Server error fetching matches for ID ${numericEventId} (Status: ${status}):`, errorData || error.message);
        } else {
            logger.error(`[TourService] ❌ Error fetching tournament matches for ID ${numericEventId} (Status: ${status}):`, errorData || error.message);
        }
        
        return [];
    }
};