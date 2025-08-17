// app/home/hooks/useHomeData.tsx
import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentId, getTournamentDetails, getTournamentMatches, getActiveOtherTours, getUpcomingMatchesFallback, Event } from '../../../services/tourServices';
import { logger } from '../../../utils/logger';
import { forceCacheRefresh } from '../../../services/api';
import { Match, EventDetails, ListItem } from '../types';
import { processMatchesForList } from '../utils/matchProcessing';
import { useLiveMatchDetection } from './useLiveMatchDetection';
import { notificationManager } from '../../../utils/notifications';

export const useHomeData = () => {
    const [processedListData, setProcessedListData] = useState<ListItem[]>([]);
    const [currentMatches, setCurrentMatches] = useState<Match[]>([]);
    const [tourName, setTourName] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeOtherTours, setActiveOtherTours] = useState<Event[]>([]);
    const [selectedOtherTour, setSelectedOtherTour] = useState<number | null>(null);
    const [liveUpdateCount, setLiveUpdateCount] = useState<number>(0);
    const [lastLiveUpdate, setLastLiveUpdate] = useState<number>(0);
    const [tournamentPrize, setTournamentPrize] = useState<string | null>(null);

    // Load tournament information
    const loadTournamentInfo = useCallback(async (isRefresh = false, specificTournamentId: number | null = null) => {
        if (!isRefresh) setLoading(true);
        setRefreshing(isRefresh);
        setError(null);
        
        logger.log(`[HomeScreen] ${isRefresh ? 'Refreshing' : 'Loading'} tournament info...`);
        
        try {
            // If a specific tournament is selected, use it; otherwise get the main active tournament
            let targetTournamentId = specificTournamentId;
            
            if (!targetTournamentId) {
                logger.log(`[HomeScreen] Fetching active tournament ID...`);
                targetTournamentId = await getActiveTournamentId();
                
                if (!targetTournamentId) {
                    logger.warn(`[HomeScreen] No active tournament found - this may indicate a network connectivity issue`);
                }
            }
            
            logger.log(`[HomeScreen] Target tournament ID: ${targetTournamentId}`);
            
            // Always load active other tours for the toolbar
            const otherTours = await getActiveOtherTours();
            setActiveOtherTours(otherTours);
            logger.log(`[HomeScreen] Found ${otherTours.length} active other tours`);
            
            if (targetTournamentId) {
                logger.log(`[HomeScreen] Fetching details and matches for tournament ${targetTournamentId}`);
                
                const [detailsData, matchesResult] = await Promise.all([
                    getTournamentDetails(targetTournamentId),
                    getTournamentMatches(targetTournamentId)
                ]);
                
                // Also fetch prize money data
                try {
                    const prizeResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app'}/oneFourSeven/prize-money/${targetTournamentId}/`);
                    if (prizeResponse.ok) {
                        const prizeData = await prizeResponse.json();
                        const prizeText = prizeData?.winner?.formatted || null;
                        setTournamentPrize(prizeText);
                        logger.log(`[HomeScreen] Prize money: ${prizeText}`);
                    } else {
                        setTournamentPrize(null);
                    }
                } catch (prizeError) {
                    logger.warn('[HomeScreen] Failed to fetch prize data:', prizeError);
                    setTournamentPrize(null);
                }
                
                logger.log(`[HomeScreen] Tournament details:`, detailsData);
                logger.log(`[HomeScreen] Raw matches received:`, {
                    type: typeof matchesResult,
                    isArray: Array.isArray(matchesResult),
                    length: Array.isArray(matchesResult) ? matchesResult.length : 'N/A',
                    sample: Array.isArray(matchesResult) ? matchesResult.slice(0, 2) : matchesResult
                });
                
                const eventDetails = detailsData as EventDetails | null;
                const tourDisplayName = eventDetails?.Name ?? 'Tournament';
                
                // Add tour type indicator for non-main tours
                const tourType = (detailsData as Event)?.Tour;
                const displayName = tourType && tourType !== 'main' 
                    ? `${tourDisplayName} (${tourType.toUpperCase()})`
                    : tourDisplayName;
                
                setTourName(displayName);
                
                const currentMatches = Array.isArray(matchesResult) ? matchesResult as Match[] : [];
                
                logger.log(`[HomeScreen] Processing ${currentMatches.length} matches...`);
                const processedData = processMatchesForList(currentMatches);
                logger.log(`[HomeScreen] Processed data:`, {
                    totalItems: processedData.length,
                    types: processedData.reduce((acc, item) => {
                        acc[item.type] = (acc[item.type] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>)
                });
                
                setCurrentMatches(currentMatches);
                setProcessedListData(processedData);
            } else {
                logger.warn(`[HomeScreen] No active tournament ID found - trying fallback upcoming matches`);
                
                // Try fallback upcoming matches when no active tournament exists
                try {
                    const fallbackData = await getUpcomingMatchesFallback('main', 7);
                    
                    if (fallbackData && fallbackData.success && fallbackData.total_matches > 0) {
                        logger.log(`[HomeScreen] Using fallback data: ${fallbackData.total_matches} upcoming matches`);
                        
                        // Convert fallback matches to our expected format
                        const allFallbackMatches = [
                            ...fallbackData.today_matches,
                            ...fallbackData.upcoming_matches
                        ];
                        
                        const convertedMatches: Match[] = allFallbackMatches.map((match: any) => ({
                            id: match.id,
                            api_match_id: match.api_match_id,
                            event_id: match.event_id,
                            round: match.round,
                            number: match.match_number,
                            player1_id: match.player1_id,
                            player2_id: match.player2_id,
                            player1_name: match.player1_name,
                            player2_name: match.player2_name,
                            score1: match.score1,
                            score2: match.score2,
                            winner_id: match.winner_id,
                            status_code: match.status_code,
                            status_display: match.status_display,
                            scheduled_date: match.scheduled_date,
                            start_date: match.scheduled_date,
                            end_date: null,
                            frame_scores: null,
                            sessions_str: null,
                            on_break: match.status_code === 2,
                            unfinished: match.status_code !== 3,
                            live_url: null,
                            details_url: null,
                            note: null
                        }));
                        
                        setTourName("Upcoming Matches");
                        setTournamentPrize(null);
                        setCurrentMatches(convertedMatches);
                        
                        const processedData = processMatchesForList(convertedMatches);
                        setProcessedListData(processedData);
                        
                        logger.log(`[HomeScreen] Fallback: Processed ${processedData.length} items from ${convertedMatches.length} upcoming matches`);
                    } else {
                        logger.warn(`[HomeScreen] Fallback data unavailable or empty`);
                        setTourName(null);
                        setTournamentPrize(null);
                        setProcessedListData([]);
                    }
                } catch (fallbackError: any) {
                    logger.error(`[HomeScreen] Fallback fetch failed:`, fallbackError);
                    setTourName(null);
                    setTournamentPrize(null);
                    setProcessedListData([]);
                }
            }
        } catch (err: any) {
            logger.error(`[HomeScreen] Error loading tournament info:`, err);
            
            // Enhanced error handling with network-specific messages
            let errorMessage = 'Failed to load tournament data.';
            
            if (err.message.includes('Network Error') || err.message.includes('ERR_NETWORK')) {
                errorMessage = 'Network connection failed. Please check your internet connection and try again.';
            } else if (err.message.includes('timeout')) {
                errorMessage = 'Request timed out. Please check your connection and try again.';
            } else if (err.response?.status >= 500) {
                errorMessage = 'Server is temporarily unavailable. Please try again in a moment.';
            } else if (err.message) {
                errorMessage = `Failed to load data: ${err.message}`;
            }
            
            setError(errorMessage);
            
            if (!isRefresh) {
                setProcessedListData([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        // Request notification permissions on first load
        notificationManager.requestPermissions();
        loadTournamentInfo();
    }, []); // Empty dependency array for initial load only
    
    // Handle other tour selection
    const handleOtherTourSelection = useCallback((tourId: number) => {
        if (tourId === selectedOtherTour) {
            // Deselect and go back to main tour
            setSelectedOtherTour(null);
            loadTournamentInfo(false, null);
        } else {
            // Select the other tour
            setSelectedOtherTour(tourId);
            loadTournamentInfo(false, tourId);
        }
    }, [selectedOtherTour, loadTournamentInfo]);

    // Optimized automatic live match detection with throttling
    const handleLiveMatchDetected = useCallback(() => {
        const now = Date.now();
        const timeSinceLastUpdate = now - lastLiveUpdate;
        
        // Only refresh if enough time has passed (minimum 2 minutes between updates)
        if (timeSinceLastUpdate >= 120000) { // 2 minutes = 120000ms
            logger.log(`[HomeScreen] 🔴 Live match detected - triggering update #${liveUpdateCount + 1}`);
            setLiveUpdateCount(prev => prev + 1);
            setLastLiveUpdate(now);
            
            // Force cache refresh for live data
            forceCacheRefresh(selectedOtherTour ?? undefined);
            
            loadTournamentInfo(true, selectedOtherTour); // Refresh current tournament
        } else {
            const remainingSeconds = Math.round((120000 - timeSinceLastUpdate) / 1000);
            logger.log(`[HomeScreen] ⏸️ Live match detected but throttled (${Math.round(timeSinceLastUpdate/1000)}s since last update, ${remainingSeconds}s remaining)`);
        }
    }, [selectedOtherTour, lastLiveUpdate, liveUpdateCount]);

    const handleMatchStartingSoon = useCallback(async (minutesUntilStart: number) => {
        logger.log(`[HomeScreen] ⏰ Match starting in ${minutesUntilStart} minutes - preparing for live updates`);
        
        // Find the match that's starting soon
        const upcomingMatch = currentMatches.find(match => {
            if (match.status_code !== 0) return false; // Only scheduled matches
            
            const matchTime = match.scheduled_date || match.start_date;
            if (!matchTime) return false;
            
            const now = new Date();
            const matchDate = new Date(matchTime);
            const timeDifferenceMs = matchDate.getTime() - now.getTime();
            const matchMinutesUntilStart = Math.round(timeDifferenceMs / (1000 * 60));
            
            return Math.abs(matchMinutesUntilStart - minutesUntilStart) <= 1; // Within 1 minute tolerance
        });
        
        if (upcomingMatch) {
            // Send push notification
            await notificationManager.scheduleMatchStartingSoon({
                matchId: String(upcomingMatch.id || upcomingMatch.api_match_id || 0),
                player1: upcomingMatch.player1_name || 'Player 1',
                player2: upcomingMatch.player2_name || 'Player 2',
                minutesUntilStart,
                tournamentName: tourName || undefined
            });
        }
    }, [currentMatches, tourName]);

    // Initialize live match detection with optimized intervals
    const { isMonitoring, nextMatchInfo } = useLiveMatchDetection({
        matches: currentMatches,
        onLiveMatchDetected: handleLiveMatchDetected,
        onMatchStartingSoon: handleMatchStartingSoon,
        updateInterval: 120000, // Check every 2 minutes (less aggressive)
        preStartNotificationMinutes: 5 // Alert 5 minutes before match starts
    });

    return {
        processedListData,
        tourName,
        tournamentPrize,
        loading,
        refreshing,
        error,
        activeOtherTours,
        selectedOtherTour,
        loadTournamentInfo,
        handleOtherTourSelection,
        // Live detection info
        isMonitoring,
        nextMatchInfo,
        liveUpdateCount
    };
};
