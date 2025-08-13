// app/home/hooks/useHomeData.tsx
import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentId, getTournamentDetails, getTournamentMatches, getActiveOtherTours, Event } from '../../../services/tourServices';
import { logger } from '../../../utils/logger';
import { Match, EventDetails, ListItem } from '../types';
import { processMatchesForList } from '../utils/matchProcessing';

export const useHomeData = () => {
    const [processedListData, setProcessedListData] = useState<ListItem[]>([]);
    const [tourName, setTourName] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeOtherTours, setActiveOtherTours] = useState<Event[]>([]);
    const [selectedOtherTour, setSelectedOtherTour] = useState<number | null>(null);

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

    return {
        processedListData,
        tourName,
        loading,
        refreshing,
        error,
        activeOtherTours,
        selectedOtherTour,
        loadTournamentInfo,
        handleOtherTourSelection
    };
};
