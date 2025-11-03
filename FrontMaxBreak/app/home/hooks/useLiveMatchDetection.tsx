// app/home/hooks/useLiveMatchDetection.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { logger } from '../../../utils/logger';
import { Match } from '../types';

interface LiveMatchDetectionOptions {
  matches: Match[];
  onLiveMatchDetected: () => void;
  onMatchStartingSoon: (minutesUntilStart: number) => void;
  updateInterval?: number; // milliseconds
  preStartNotificationMinutes?: number; // minutes before match starts
}

export const useLiveMatchDetection = ({
  matches,
  onLiveMatchDetected,
  onMatchStartingSoon,
  updateInterval = 30000, // 30 seconds (faster refresh for live score updates)
  preStartNotificationMinutes = 5 // 5 minutes before
}: LiveMatchDetectionOptions) => {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [nextMatchInfo, setNextMatchInfo] = useState<{
    match: Match;
    minutesUntilStart: number;
  } | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const notificationSentRef = useRef<Set<number>>(new Set());

  // Get current UTC time
  const getCurrentUTCTime = useCallback(() => {
    return new Date(); // JavaScript Date is always in UTC when working with timestamps
  }, []);

  // Parse match scheduled time and convert to Date
  const parseMatchTime = useCallback((match: Match): Date | null => {
    if (!match.scheduled_date && !match.start_date) return null;
    
    const timeString = match.scheduled_date || match.start_date;
    if (!timeString) return null;
    
    try {
      // Handle different date formats from your API
      const date = new Date(timeString);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      logger.warn(`[LiveDetection] Failed to parse match time: ${timeString}`);
      return null;
    }
  }, []);

  // Check if a match is starting soon or live
  const analyzeMatches = useCallback(() => {
    const now = getCurrentUTCTime();
    
    logger.debug(`[LiveDetection] Analyzing matches at ${now.toISOString()} UTC`);
    
    let foundLiveMatch = false;
    let nextUpcomingMatch: { match: Match; minutesUntilStart: number } | null = null;
    let shortestTimeToStart = Infinity;

    for (const match of matches) {
      // Check if match is already live (status_code 1 = running, 2 = on break)
      if (match.status_code === 1 || match.status_code === 2) {
        foundLiveMatch = true;
        logger.debug(`[LiveDetection] Found live match: ${match.player1_name} vs ${match.player2_name}`);
        continue;
      }
      
      // Check upcoming matches (status_code 0 = scheduled)
      if (match.status_code === 0) {
        const matchTime = parseMatchTime(match);
        if (!matchTime) continue;
        
        const timeDifferenceMs = matchTime.getTime() - now.getTime();
        const minutesUntilStart = Math.round(timeDifferenceMs / (1000 * 60));
        
        logger.debug(`[LiveDetection] Match ${match.player1_name} vs ${match.player2_name} starts in ${minutesUntilStart} minutes (UTC)`);
        
        // Check if match is starting within our notification window
        if (minutesUntilStart > 0 && minutesUntilStart <= preStartNotificationMinutes) {
          if (minutesUntilStart < shortestTimeToStart) {
            shortestTimeToStart = minutesUntilStart;
            nextUpcomingMatch = { match, minutesUntilStart };
          }
          
          // Send notification if not already sent for this match
          const matchKey = match.id || match.api_match_id || 0;
          if (!notificationSentRef.current.has(matchKey)) {
            notificationSentRef.current.add(matchKey);
            onMatchStartingSoon(minutesUntilStart);
            logger.log(`[LiveDetection] 🔔 Match starting soon: ${match.player1_name} vs ${match.player2_name} in ${minutesUntilStart} minutes`);
          }
        }
        
        // Check if match should have started (within 2 minutes of start time)
        if (minutesUntilStart >= -2 && minutesUntilStart <= 0) {
          foundLiveMatch = true;
          logger.log(`[LiveDetection] 🔥 Match should be live now: ${match.player1_name} vs ${match.player2_name}`);
        }
      }
    }
    
    setNextMatchInfo(nextUpcomingMatch);
    
    // Only trigger client refresh if we actually found live matches or matches that should be live
    // The server-side scheduler handles the actual API updates to snooker.org
    if (foundLiveMatch) {
      logger.log(`[LiveDetection] 🎯 Live matches detected - refreshing client data`);
      onLiveMatchDetected();
    }
    
    return { foundLiveMatch, nextUpcomingMatch };
  }, [matches, getCurrentUTCTime, parseMatchTime, preStartNotificationMinutes, onLiveMatchDetected, onMatchStartingSoon]);

  // Start monitoring for live matches
  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    
    logger.log(`[LiveDetection] 🚀 Starting live match monitoring (interval: ${updateInterval}ms)`);
    setIsMonitoring(true);
    
    // Initial check
    analyzeMatches();
    
    // Set up interval for continuous monitoring
    intervalRef.current = setInterval(() => {
      analyzeMatches();
    }, updateInterval);
    
  }, [isMonitoring, updateInterval, analyzeMatches]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;
    
    logger.log(`[LiveDetection] ⏹️ Stopping live match monitoring`);
    setIsMonitoring(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isMonitoring]);

  // Handle app state changes (pause monitoring when app is in background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        logger.log(`[LiveDetection] 📱 App became active - resuming monitoring`);
        startMonitoring();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        logger.log(`[LiveDetection] 📱 App went to background - pausing monitoring`);
        stopMonitoring();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription?.remove();
    };
  }, [startMonitoring, stopMonitoring]);

  // Auto-start monitoring when component mounts and matches are available
  useEffect(() => {
    if (matches.length > 0 && !isMonitoring) {
      startMonitoring();
    }
    
    return () => {
      stopMonitoring();
    };
  }, [matches.length, isMonitoring, startMonitoring, stopMonitoring]);

  // Clear sent notifications when matches change (new tournament loaded)
  useEffect(() => {
    notificationSentRef.current.clear();
  }, [matches]);

  return {
    isMonitoring,
    nextMatchInfo,
    startMonitoring,
    stopMonitoring,
    analyzeMatches
  };
};