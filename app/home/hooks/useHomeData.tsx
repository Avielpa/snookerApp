// app/home/hooks/useHomeData.tsx
import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentId, getTournamentDetails, getTournamentMatches, getActiveOtherTours, Event } from '../../../services/tourServices';
import { logger } from '../../../utils/logger';
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
                targetTournamentId = await getActiveTournamentId();
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
                logger.warn(`[HomeScreen] No active tournament ID found`);
                setTourName(null);
                setProcessedListData([]);
            }
        } catch (err: any) {
            logger.error(`[HomeScreen] Error loading tournament info:`, err);
            setError(`Failed to load data. ${err.message || ''}`.trim());
            
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
    }, [loadTournamentInfo]);
    
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

    // Automatic live match detection
    const handleLiveMatchDetected = useCallback(() => {
        logger.log(`[HomeScreen] 🔴 Live match detected - triggering automatic update #${liveUpdateCount + 1}`);
        setLiveUpdateCount(prev => prev + 1);
        loadTournamentInfo(true, selectedOtherTour); // Refresh current tournament
    }, [loadTournamentInfo, selectedOtherTour, liveUpdateCount]);

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

    // Initialize live match detection
    const { isMonitoring, nextMatchInfo } = useLiveMatchDetection({
        matches: currentMatches,
        onLiveMatchDetected: handleLiveMatchDetected,
        onMatchStartingSoon: handleMatchStartingSoon,
        updateInterval: 60000, // Check every 60 seconds
        preStartNotificationMinutes: 5 // Alert 5 minutes before match starts
    });

    return {
        processedListData,
        tourName,
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
