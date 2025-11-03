// app/home/hooks/useHomeData.tsx
import { useState, useEffect, useCallback } from 'react';
import { getActiveTournamentId, getTournamentDetails, getTournamentMatches, getActiveOtherTours, getUpcomingMatchesFallback, Event } from '../../../services/tourServices';
import { logger } from '../../../utils/logger';
import { forceCacheRefresh } from '../../../services/api';
import { Match, EventDetails, ListItem } from '../types';
import { processMatchesForList } from '../utils/matchProcessing';
import { useLiveMatchDetection } from './useLiveMatchDetection';
import { notificationManager } from '../../../utils/notifications';
import { runNetworkDiagnostics, isBackendReachable } from '../../../utils/networkDiagnostics';
import { runEmulatorDiagnostics, logEnvironmentConfig, isAndroidEmulator } from '../../../utils/emulatorDebug';
import { triggerEmergencySync, quickStatusCheck } from '../../../utils/emergencySync';

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
        
        logger.log(`[HomeScreen] 🔄 ${isRefresh ? 'Refreshing' : 'Loading'} tournament info...`);
        logger.log(`[HomeScreen] 📱 Device Context:`, {
            isRefresh,
            specificTournamentId,
            timestamp: Date.now(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
        });
        
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
                
                // Data consistency validation for finished matches
                if (currentMatches.length > 0) {
                    const inconsistentMatches = currentMatches.filter(match => {
                        if (match.status_code === 3 && // Finished match
                            match.score1 != null && match.score2 != null && 
                            match.winner_id != null) {
                            const scoreWinner1 = match.score1 > match.score2;
                            const scoreWinner2 = match.score2 > match.score1;
                            const winnerIdWinner1 = match.winner_id === match.player1_id;
                            const winnerIdWinner2 = match.winner_id === match.player2_id;
                            
                            // Inconsistent if winner_id doesn't match scores
                            return (scoreWinner1 && !winnerIdWinner1) || (scoreWinner2 && !winnerIdWinner2);
                        }
                        return false;
                    });
                    
                    if (inconsistentMatches.length > 0) {
                        logger.error(`[HomeScreen] 🚨 ${inconsistentMatches.length} matches have inconsistent winner data (${isRefresh ? 'REFRESH' : 'INITIAL LOAD'}):`, 
                            inconsistentMatches.map(m => ({
                                api_match_id: m.api_match_id,
                                score: `${m.score1}-${m.score2}`,
                                winner_id: m.winner_id,
                                player1_id: m.player1_id,
                                player2_id: m.player2_id,
                                loadType: isRefresh ? 'REFRESH' : 'INITIAL'
                            }))
                        );
                    }
                }
                
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
                
                logger.log(`[HomeScreen] ✅ Data set complete (${isRefresh ? 'REFRESH' : 'INITIAL LOAD'}):`, {
                    matchCount: currentMatches.length,
                    processedItemCount: processedData.length,
                    timestamp: Date.now(),
                    loadType: isRefresh ? 'REFRESH' : 'INITIAL'
                });

                // Emergency sync detection for missing tournament data
                if (currentMatches.length === 0 && !isRefresh) {
                    logger.warn('[HomeScreen] 🚨 No matches found - checking for missing sync data');
                    
                    // Run quick status check for critical tournaments
                    quickStatusCheck().then(status => {
                        const missingTournaments = Object.entries(status).filter(
                            ([name, data]: [string, any]) => data.shouldHave && !data.hasData
                        );
                        
                        if (missingTournaments.length > 0) {
                            logger.warn(`[HomeScreen] Found ${missingTournaments.length} tournaments missing data:`, 
                                missingTournaments.map(([name, data]) => `${name} (${data.status})`));
                            
                            // Trigger emergency sync for critical tournaments
                            triggerEmergencySync().then(syncResults => {
                                logger.log('[HomeScreen] Emergency sync completed:', syncResults);
                                
                                // If sync was successful, refresh data
                                const successfulSyncs = syncResults.filter(r => r.success);
                                if (successfulSyncs.length > 0) {
                                    logger.log(`[HomeScreen] ${successfulSyncs.length} tournaments synced successfully - refreshing data`);
                                    setTimeout(() => {
                                        loadTournamentInfo(true, specificTournamentId);
                                    }, 3000); // Wait 3 seconds then refresh
                                }
                            }).catch(error => {
                                logger.error('[HomeScreen] Emergency sync failed:', error);
                            });
                        }
                    }).catch(error => {
                        logger.error('[HomeScreen] Status check failed:', error);
                    });
                }
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
            
            // Enhanced error handling with network diagnostics
            let errorMessage = 'Failed to load tournament data.';
            
            if (err.message.includes('Network Error') || err.message.includes('ERR_NETWORK')) {
                errorMessage = 'Network connection failed. Please check your internet connection and try again.';
                
                // Enhanced diagnostics for emulator vs physical device
                if (isAndroidEmulator()) {
                    errorMessage = 'Network Error on Android Emulator. This is often due to emulator network configuration issues.';
                    logger.log('[HomeScreen] 📱 Running emulator-specific diagnostics for Network Error...');
                    runEmulatorDiagnostics().then(emulatorDiag => {
                        logger.log('[HomeScreen] Emulator Diagnostics Results:', emulatorDiag);
                        
                        if (emulatorDiag.emulatorSpecificIssues.length > 0) {
                            logger.error('[HomeScreen] 🚨 EMULATOR ISSUES:', emulatorDiag.emulatorSpecificIssues);
                            logger.log('[HomeScreen] 💡 EMULATOR FIXES:', emulatorDiag.recommendations);
                        }
                    }).catch(diagErr => {
                        logger.error('[HomeScreen] Emulator diagnostics failed:', diagErr);
                    });
                } else {
                    // Run regular network diagnostics for physical devices
                    logger.log('[HomeScreen] Running network diagnostics due to Network Error...');
                    runNetworkDiagnostics().then(diagnostics => {
                        logger.log('[HomeScreen] Network Diagnostics Results:', diagnostics);
                        
                        if (!diagnostics.isConnected) {
                            logger.error('[HomeScreen] 🚨 NO INTERNET: Device has no internet connectivity');
                        } else if (!diagnostics.backendReachable) {
                            logger.error('[HomeScreen] 🚨 BACKEND UNREACHABLE: Railway backend not responding');
                        } else {
                            logger.error('[HomeScreen] 🚨 UNKNOWN NETWORK ISSUE: Internet works but API fails');
                        }
                    }).catch(diagErr => {
                        logger.error('[HomeScreen] Network diagnostics failed:', diagErr);
                    });
                }
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
        // Log environment configuration for debugging
        logEnvironmentConfig();
        
        // Run emulator diagnostics if on Android emulator
        if (isAndroidEmulator()) {
            logger.log('[HomeScreen] 📱 Android emulator detected - running diagnostics...');
            runEmulatorDiagnostics().then(diagnostics => {
                if (diagnostics.emulatorSpecificIssues.length > 0) {
                    logger.warn('[HomeScreen] 🚨 Emulator issues detected:', diagnostics.emulatorSpecificIssues);
                    logger.log('[HomeScreen] 💡 Recommendations:', diagnostics.recommendations);
                } else {
                    logger.log('[HomeScreen] ✅ Emulator configuration looks good');
                }
            }).catch(error => {
                logger.warn('[HomeScreen] Emulator diagnostics failed:', error);
            });
        }
        
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
    }, [selectedOtherTour]); // CRASH FIX: Remove loadTournamentInfo dependency to prevent infinite loop

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
