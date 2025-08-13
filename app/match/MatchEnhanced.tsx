// app/match/MatchEnhanced.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

// Import services
import { getMatchDetails, getHeadToHead, getMatchFormat as getApiMatchFormat } from '../../services/matchServices';
import { getTournamentDetails } from '../../services/tourServices';
import { apiCache } from '../../services/api';
import { logger } from '../../utils/logger';
import { useColors } from '../../contexts/ThemeContext';

// Import types and modular components
import { MatchDetails, EventDetails, FrameScore, MatchStats, H2HData, H2HResponse, TabType } from './types';
import { 
  PlayerScoreHeader, 
  TabNavigation, 
  OverviewTab, 
  FramesTab, 
  StatsTab, 
  H2HTab 
} from './components';
import { createMatchStyles } from './styles';
import { parseFrameScoresString } from './utils/frameScoreParser';


/**
 * Enhanced Match Details Screen with interactive features and modern design
 * Features:
 * - Real-time live match updates
 * - Interactive frame-by-frame scoreboard
 * - Match prediction and statistics
 * - Head-to-head comparison
 * - Social sharing capabilities
 * - Modern glassmorphism design
 */
export default function MatchEnhanced() {
  const params = useLocalSearchParams<{ matchId: string }>();
  const apiMatchId = useMemo(() => {
    const id = params.matchId ? parseInt(params.matchId, 10) : NaN;
    return !isNaN(id) ? id : null;
  }, [params.matchId]);

  const colors = useColors();

  // State management
  const [matchDetails, setMatchDetails] = useState<MatchDetails | null>(null);
  const [tournamentName, setTournamentName] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<TabType>('overview');
  const [userPrediction, setUserPrediction] = useState<1 | 2 | null>(null);
  const [h2hData, setH2hData] = useState<H2HData | null>(null);
  const [h2hLoading, setH2hLoading] = useState<boolean>(false);
  const [realMatchFormat, setRealMatchFormat] = useState<string | null>(null);

  // Helper functions (must be defined before useMemo calls)
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  const parseTimeString = (timeStr: string): number => {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    
    // Handle formats like "2h 30m", "45m", "1h", etc.
    const hourMatch = timeStr.match(/(\d+)h/);
    const minuteMatch = timeStr.match(/(\d+)m/);
    
    const hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
    const minutes = minuteMatch ? parseInt(minuteMatch[1], 10) : 0;
    
    return hours * 60 + minutes;
  };

  

  const loadRealMatchFormat = useCallback(async (roundId: number | null, season: number | null) => {
    logger.debug(`[MatchEnhanced] Loading real match format for roundId: ${roundId}, season: ${season}`);
    
    if (!roundId || !season) {
      setRealMatchFormat("Format TBD");
      return;
    }
    
    try {
      const format = await getApiMatchFormat(roundId, season);
      setRealMatchFormat(format);
      logger.log(`[MatchEnhanced] ✅ Loaded real match format: "${format}" for round ${roundId}`);
    } catch (error) {
      logger.error("[MatchEnhanced] ❌ Error loading real match format:", error);
      setRealMatchFormat("Format TBD"); // Fallback to TBD on error
      logger.log(`[MatchEnhanced] Using fallback format: "Format TBD"`);
    }
  }, []);

  // Helper function to extract number from format string like "Best of 7" -> 7
  const extractFormatNumber = (formatString: string): number | null => {
    if (!formatString) return null;
    const match = formatString.match(/Best of (\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  const getRoundName = (round: number | null): string => {
    if (!round) return 'Qualifying';
    if (round >= 15) return 'Final';
    if (round === 14) return 'Semi-Finals';
    if (round === 13) return 'Quarter-Finals';
    if (round === 12) return 'Round 1 (L16)';
    if (round === 11) return 'Round 1 (L16)';
    if (round === 10) return 'Round 1 (L16)';
    if (round === 9) return 'Round 2 (L32)';
    if (round === 8) return 'Round 2 (L32)';
    if (round === 7) return 'Round 1 (L32)';
    return `Round ${round}`;
  };

  // Computed data
  const frameScores = useMemo((): FrameScore[] => {
    if (!matchDetails) return [];
    
    try {
      const player1Score = matchDetails.score1 || 0;
      const player2Score = matchDetails.score2 || 0;
      const totalPlayedFrames = player1Score + player2Score;
      
      // Determine match format (best of how many frames)
      const realFormatNumber = extractFormatNumber(realMatchFormat || '');
      const matchFormat = realFormatNumber || 0; // Default to 0 if not available
      
      const framesToWin = Math.ceil(matchFormat / 2);
      const maxPossibleFrames = Math.min(matchFormat, (framesToWin * 2) - 1);
      
      // Parse frame scores if available
      let parsedFrameScores: FrameScore[] = [];
      
      if (matchDetails.frame_scores && matchDetails.frame_scores.trim()) {
        // Use the new HTML frame score parser for real data
        logger.log(`[MatchEnhanced] Parsing real frame scores for match ${matchDetails.api_match_id}`);
        logger.log(`[MatchEnhanced] Frame scores data: "${matchDetails.frame_scores}"`);
        parsedFrameScores = parseFrameScoresString(matchDetails.frame_scores);
        
        if (parsedFrameScores.length > 0) {
          logger.log(`[MatchEnhanced] SUCCESS: Parsed ${parsedFrameScores.length} real frame scores:`, parsedFrameScores);
        } else {
          logger.log(`[MatchEnhanced] WARNING: Frame score parser returned empty array for: "${matchDetails.frame_scores}"`);
          
          // Fallback to legacy parsing methods if HTML parser fails
          try {
            // Try to parse frame_scores JSON or string format
            const frameData = JSON.parse(matchDetails.frame_scores);
            if (Array.isArray(frameData)) {
              parsedFrameScores = frameData.map((frame, index) => ({
                frameNumber: index + 1,
                player1Score: frame.player1_score || frame.score1 || 0,
                player2Score: frame.player2_score || frame.score2 || 0,
                winner: frame.winner === 1 ? 1 : frame.winner === 2 ? 2 : null,
                isComplete: frame.is_complete || frame.complete || true,
              }));
            }
          } catch {
            // If frame_scores is not JSON, try to parse as semicolon-separated
            const frameStrings = matchDetails.frame_scores.split(';').filter(f => f.trim());
            parsedFrameScores = frameStrings.map((frameStr, index) => {
              const scores = frameStr.trim().split('-').map(s => parseInt(s.trim()));
              const player1FrameScore = scores[0] || 0;
              const player2FrameScore = scores[1] || 0;
              
              return {
                frameNumber: index + 1,
                player1Score: player1FrameScore,
                player2Score: player2FrameScore,
                winner: player1FrameScore > player2FrameScore ? 1 : player2FrameScore > player1FrameScore ? 2 : null,
                isComplete: true,
              };
            });
          }
        }
      }
      
      // If no parsed frames, create frames based on match scores
      if (parsedFrameScores.length === 0 && totalPlayedFrames > 0) {
        parsedFrameScores = [];
        let p1Wins = 0;
        let p2Wins = 0;
        
        logger.log(`[MatchEnhanced] FALLING BACK TO FICTIVE: Creating ${totalPlayedFrames} fictive frames from match scores: ${matchDetails.score1}-${matchDetails.score2}`);
        logger.log(`[MatchEnhanced] Reason: parsedFrameScores.length = ${parsedFrameScores.length}`);
        
        // Simulate frame results based on final scores
        for (let i = 1; i <= totalPlayedFrames; i++) {
          const needP1Win = p1Wins < player1Score;
          const needP2Win = p2Wins < player2Score;
          
          let winner: 1 | 2 | null = null;
          if (needP1Win && needP2Win) {
            // Both need wins, alternate or random
            winner = i % 2 === 1 ? 1 : 2;
          } else if (needP1Win) {
            winner = 1;
          } else if (needP2Win) {
            winner = 2;
          }
          
          if (winner === 1) p1Wins++;
          if (winner === 2) p2Wins++;
          
          const winnerName = winner === 1 
            ? matchDetails.player1_name 
            : winner === 2 
              ? matchDetails.player2_name 
              : null;

          parsedFrameScores.push({
            frameNumber: i,
            player1Score: 0, // No real scores available
            player2Score: 0,
            winner,
            isComplete: true,
            winnerName: winnerName || 'Unknown',
            showWinnerOnly: true, // Flag to show winner name instead of fake scores
          });
        }
      }
      
      // Add upcoming frames if match is not finished
      const isMatchFinished = matchDetails.status_code === 3;
      if (!isMatchFinished && totalPlayedFrames < maxPossibleFrames) {
        const remainingFrames = Math.min(3, maxPossibleFrames - totalPlayedFrames); // Show next 3 frames
        for (let i = 1; i <= remainingFrames; i++) {
          parsedFrameScores.push({
            frameNumber: totalPlayedFrames + i,
            player1Score: 0,
            player2Score: 0,
            winner: null,
            isComplete: false,
          });
        }
      }
      
      return parsedFrameScores.slice(0, Math.min(15, parsedFrameScores.length)); // Limit to 15 frames max
    } catch (error) {
      logger.error('[MatchEnhanced] Error parsing frame scores:', error);
      return [];
    }
  }, [matchDetails, realMatchFormat]);

  const matchStats = useMemo((): MatchStats => {
    if (!matchDetails) {
      return {
        totalFrames: 0,
        completedFrames: 0,
        progress: 0,
      };
    }

    const totalFrames = frameScores.length;
    const completedFrames = frameScores.filter(f => f.isComplete).length;
    const progress = totalFrames > 0 ? completedFrames / totalFrames : 0;
    
    // Calculate time statistics based on match data
    let timeElapsed: string | undefined;
    let estimatedTimeRemaining: string | undefined;
    
    if (matchDetails.start_date) {
      const startTime = new Date(matchDetails.start_date);
      const now = new Date();
      
      if (matchDetails.status_code === 3 && matchDetails.end_date) {
        // Match finished
        const endTime = new Date(matchDetails.end_date);
        const totalMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        timeElapsed = formatDuration(totalMinutes);
      } else if (matchDetails.status_code === 1 || matchDetails.status_code === 2) {
        // Match ongoing
        const elapsedMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
        timeElapsed = formatDuration(elapsedMinutes);
        
        // Estimate remaining time based on average frame time
        if (completedFrames > 0 && totalFrames > completedFrames) {
          const averageFrameTime = elapsedMinutes / completedFrames;
          const remainingFrames = totalFrames - completedFrames;
          const estimatedMinutes = Math.round(remainingFrames * averageFrameTime);
          estimatedTimeRemaining = formatDuration(estimatedMinutes);
        }
      }
    }
    
    // Use real format if available, otherwise fallback
    const realFormatNumber = extractFormatNumber(realMatchFormat || '');
    const actualFormat = realFormatNumber || 0; // Default to 0 if not available
    const actualFramesToWin = Math.ceil(actualFormat / 2);
    
    // Debug logging
    logger.debug(`[MatchEnhanced] Format calculation: realMatchFormat="${realMatchFormat}", realFormatNumber=${realFormatNumber}, actualFormat=${actualFormat}, framesToWin=${actualFramesToWin}`);

    return {
      totalFrames,
      completedFrames,
      progress,
      timeElapsed,
      estimatedTimeRemaining,
      // Additional stats
      player1Score: matchDetails.score1 || 0,
      player2Score: matchDetails.score2 || 0,
      matchFormat: actualFormat, // Use real format number for calculations
      framesToWin: actualFramesToWin, // Use real frames to win calculation
      isLive: matchDetails.status_code === 1,
      isOnBreak: matchDetails.status_code === 2,
      isFinished: matchDetails.status_code === 3,
      roundName: getRoundName(matchDetails.round),
    };
  }, [frameScores, matchDetails, realMatchFormat]); // Add realMatchFormat to dependency


  // Check login status
  const checkLoginStatus = useCallback(async () => {
  }, []);

  // Load H2H data
  const loadH2HData = useCallback(async (player1Id: number, player2Id: number) => {
    // Prevent duplicate H2H requests
    if (h2hLoading) {
      logger.debug("[MatchEnhanced] H2H request already in progress, skipping");
      return;
    }
    
    setH2hLoading(true);
    logger.log(`[MatchEnhanced] Loading H2H data for players ${player1Id} vs ${player2Id}`);
    
    try {
      const h2hResponse = await getHeadToHead(player1Id, player2Id) as unknown as H2HResponse;
      
      if (h2hResponse) {
        const h2hData: H2HData = {
          Player1Wins: h2hResponse.Player1Wins || 0,
          Player2Wins: h2hResponse.Player2Wins || 0,
          totalMeetings: (h2hResponse.Player1Wins || 0) + (h2hResponse.Player2Wins || 0),
          lastMeeting: h2hResponse.lastMeeting || undefined,
          matches: h2hResponse.Matches || [],
        };
        
        setH2hData(h2hData);
        logger.log(`[MatchEnhanced] H2H data loaded:`, h2hData);
      } else {
        // Create empty H2H data if no response
        setH2hData({
          Player1Wins: 0,
          Player2Wins: 0,
          totalMeetings: 0,
        });
      }
    } catch (error) {
      logger.error('[MatchEnhanced] Error loading H2H data:', error);
      setH2hData({
        Player1Wins: 0,
        Player2Wins: 0,
        totalMeetings: 0,
      });
    } finally {
      setH2hLoading(false);
    }
  }, [h2hLoading]);

  // Load match data
  const loadData = useCallback(async (refreshing = false) => {
    if (apiMatchId === null) {
      setError("Invalid Match ID provided in URL.");
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    if (!refreshing) setLoading(true);
    setIsRefreshing(refreshing);
    setError(null);
    
    logger.log(`[MatchEnhanced] ${refreshing ? 'Refreshing' : 'Loading'} data for API Match ID: ${apiMatchId}`);

    // Clear cache for this match when explicitly refreshing to ensure fresh data
    if (refreshing) {
      apiCache.invalidateMatchData(apiMatchId);
      logger.log(`[MatchEnhanced] Cache invalidated for match ${apiMatchId}`);
    }

    try {
      const details = await getMatchDetails(apiMatchId);
      if (!details) {
        throw new Error(`Match details not found for API ID: ${apiMatchId}.`);
      }
      
      const matchDetailsTyped = details as MatchDetails;
      setMatchDetails(matchDetailsTyped);
      logger.log("[MatchEnhanced] Match Details Received:", matchDetailsTyped);

      // Load H2H data if both players are available
      // Load if: no H2H data exists, or refreshing, or different players than current H2H
      const needsH2H = matchDetailsTyped.player1_id && matchDetailsTyped.player2_id && (
        !h2hData || 
        refreshing ||
        // Different players than current H2H data
        (h2hData && (
          !h2hData.totalMeetings || 
          h2hData.totalMeetings === 0
        ))
      );
      
      if (needsH2H) {
        logger.debug(`[MatchEnhanced] Loading H2H for ${matchDetailsTyped.player1_id} vs ${matchDetailsTyped.player2_id}`);
        if (
          typeof matchDetailsTyped.player1_id === 'number' &&
          typeof matchDetailsTyped.player2_id === 'number'
        ) {
          loadH2HData(matchDetailsTyped.player1_id, matchDetailsTyped.player2_id);
        }
      }

      

      // Fetch tournament details if available
      if (matchDetailsTyped.event_id && (!tournamentName || refreshing)) {
        try {
          const tourDetails = await getTournamentDetails(matchDetailsTyped.event_id);
          const eventDetailsTyped = tourDetails as EventDetails | null;
          setTournamentName(eventDetailsTyped?.Name ?? 'Unknown Tournament');

          // Load real match format from API using round ID instead of event ID
          const season = eventDetailsTyped?.Season ?? null;
          const roundId = matchDetailsTyped.round ?? null;
          if (!refreshing || !realMatchFormat) {
            await loadRealMatchFormat(roundId, season);
          }
        } catch (tourError: any) {
          logger.warn(`[MatchEnhanced] Failed to fetch tournament name: ${tourError.message}`);
          if (!tournamentName) setTournamentName('Tournament Name Unavailable');
        }
      }
    } catch (err: any) {
      logger.error("[MatchEnhanced] Error loading match data:", err);
      setError(err.message || "Failed to load match details.");
      setMatchDetails(null);
      setTournamentName(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [apiMatchId, h2hData, loadH2HData, loadRealMatchFormat, realMatchFormat, tournamentName]);

  // Auto-refresh for live matches - simplified to prevent infinite loops
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    const isLiveMatch = matchDetails?.status_code === 1 || matchDetails?.status_code === 2;

    if (isLiveMatch && apiMatchId !== null) {
      logger.log(`[MatchEnhanced] Starting live updates for match ${apiMatchId}`);
      intervalId = setInterval(async () => {
        try {
          // Clear cache before live update to ensure fresh data
          apiCache.invalidateMatchData(apiMatchId);
          
          const updatedDetails = await getMatchDetails(apiMatchId);
          if (updatedDetails && matchDetails) {
            // Only update if the data actually changed to prevent unnecessary re-renders
            const updated = updatedDetails as MatchDetails;
            if (updated.score1 !== matchDetails.score1 || 
                updated.score2 !== matchDetails.score2 || 
                updated.status_code !== matchDetails.status_code) {
              setMatchDetails(updated);
              logger.log(`[MatchEnhanced] Live update: Score changed to ${updated.score1}-${updated.score2}, status: ${updated.status_code}`);
              
              // Invalidate related caches to sync home screen data
              logger.log(`[MatchEnhanced] Invalidating related caches for consistency`);
            }
          }
        } catch (err: any) {
          logger.warn(`[MatchEnhanced] Live update error:`, err.message);
        }
      }, 30000); // Every 30 seconds
    }

    return () => {
      if (intervalId) {
        logger.log(`[MatchEnhanced] Stopping live updates for match ${apiMatchId}`);
        clearInterval(intervalId);
      }
    };
  }, [matchDetails?.status_code, apiMatchId, matchDetails?.score1, matchDetails?.score2, matchDetails]);

  useEffect(() => {
    checkLoginStatus();
  }, [checkLoginStatus]);

  useEffect(() => {
    if (apiMatchId !== null) {
      loadData();
    } else {
      setError("Invalid Match ID.");
      setLoading(false);
    }
  }, [apiMatchId, loadData]); // Add loadData dependency

  // Handle player prediction
  const handlePrediction = useCallback((player: 1 | 2) => {
    setUserPrediction(player);
  }, []);

  // Handle share match
  const handleShare = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert(
      "Share Match 📤",
      "Sharing functionality would be implemented here",
      [{ text: "Cancel", style: "cancel" }]
    );
  };

  // Handle tab change
  const handleTabChange = useCallback((tab: TabType) => {
    setSelectedTab(tab);
  }, []);

  // Prepare display data
  const p1Name = matchDetails?.player1_name ?? 'TBD';
  const p2Name = matchDetails?.player2_name ?? 'TBD';
  const isFinished = matchDetails?.status_code === 3;

  // Create styles with dynamic colors
  const styles = useMemo(() => createMatchStyles(colors), [colors]);

  // Render content based on selected tab
  const renderTabContent = () => {
    if (!matchDetails) return null;

    switch (selectedTab) {
      case 'overview':
        return (
          <OverviewTab
            matchDetails={matchDetails}
            matchStats={matchStats}
            tournamentName={tournamentName}
            colors={colors}
            styles={styles}
          />
        );

      case 'frames':
        return (
          <FramesTab
            frameScores={frameScores}
            matchStats={matchStats}
            styles={styles}
          />
        );

      case 'stats':
        return (
          <StatsTab
            frameScores={frameScores}
            matchStats={matchStats}
            realMatchFormat={realMatchFormat}
            userPrediction={userPrediction}
            onPredictionChange={handlePrediction}
            p1Name={p1Name}
            p2Name={p2Name}
            isFinished={isFinished}
            parseTimeString={parseTimeString}
            formatDuration={formatDuration}
            styles={styles}
          />
        );

      case 'h2h':
        return (
          <H2HTab
            h2hData={h2hData}
            h2hLoading={h2hLoading}
            p1Name={p1Name}
            p2Name={p2Name}
            styles={styles}
          />
        );

      default:
        return null;
    }
  };

  // Loading state
  if (loading && !matchDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading Match Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !matchDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={[styles.loadingText, { color: colors.error }]}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadData()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!matchDetails) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Match data could not be loaded.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: true,
          title: `${p1Name} vs ${p2Name}`,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.primary,
          headerTitleStyle: { 
            color: colors.primary, 
            fontFamily: 'PoppinsSemiBold', 
            fontSize: 16 
          },
          headerRight: () => (
            <TouchableOpacity onPress={handleShare} style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Score Header */}
      <PlayerScoreHeader 
        matchDetails={matchDetails} 
        styles={styles} 
      />

      {/* Tab Navigation */}
      <TabNavigation
        selectedTab={selectedTab}
        onTabChange={handleTabChange}
        colors={colors}
        styles={styles}
      />

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => loadData(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        >
          {renderTabContent()}
        </RefreshControl>
      </View>
    </SafeAreaView>
  );
}

// Add displayName for debugging
MatchEnhanced.displayName = 'MatchEnhanced';

