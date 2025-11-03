// utils/tournamentSyncFix.ts
// Emergency sync fix for tournaments missing match data
// Addresses the September 2025+ sync bug

import { logger } from './logger';

interface TournamentSyncData {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  hasMatches: boolean;
  shouldHaveMatches: boolean;
  status: 'active' | 'upcoming' | 'past';
}

/**
 * Analyzes tournament sync status and identifies missing data
 */
export async function analyzeTournamentSync(): Promise<TournamentSyncData[]> {
  try {
    const response = await fetch('https://snookerapp.up.railway.app/oneFourSeven/events/');
    const events = await response.json();
    
    const today = new Date('2025-09-11'); // Current date
    const analysisResults: TournamentSyncData[] = [];
    
    for (const event of events) {
      if (!event.StartDate || !event.StartDate.includes('2025')) continue;
      
      const startDate = new Date(event.StartDate);
      const endDate = new Date(event.EndDate);
      const totalMatches = (event.NumActive || 0) + (event.NumResults || 0) + (event.NumUpcoming || 0);
      
      // Determine if tournament should have matches
      let shouldHaveMatches = false;
      let status: 'active' | 'upcoming' | 'past' = 'upcoming';
      
      if (endDate < today) {
        status = 'past';
        shouldHaveMatches = true; // Past tournaments should have completed matches
      } else if (startDate <= today && today <= endDate) {
        status = 'active';
        shouldHaveMatches = true; // Active tournaments should have matches
      } else if (startDate > today) {
        status = 'upcoming';
        // Upcoming tournaments should have matches if within 7 days
        const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        shouldHaveMatches = daysUntilStart <= 7;
      }
      
      analysisResults.push({
        id: event.ID,
        name: event.Name,
        startDate: event.StartDate,
        endDate: event.EndDate,
        hasMatches: totalMatches > 0,
        shouldHaveMatches,
        status
      });
    }
    
    return analysisResults;
  } catch (error) {
    logger.error('[TournamentSync] Error analyzing tournament sync:', error);
    return [];
  }
}

/**
 * Identifies tournaments that need sync fix
 */
export async function identifyMissingSyncTournaments(): Promise<TournamentSyncData[]> {
  const analysis = await analyzeTournamentSync();
  
  // Find tournaments that should have matches but don't
  const missingSyncTournaments = analysis.filter(tournament => 
    tournament.shouldHaveMatches && !tournament.hasMatches
  );
  
  logger.log(`[TournamentSync] Found ${missingSyncTournaments.length} tournaments missing sync data`);
  
  return missingSyncTournaments;
}

/**
 * Fix for the September 2025+ sync bug
 * This identifies the date filtering logic error
 */
export function diagnoseeDateFilteringBug(): string {
  const workingTournaments = [
    'British Open Qualifiers (2025-06-25)',
    'Wuhan Open (2025-08-24)',
    'Saudi Arabia Masters (2025-08-08)'
  ];
  
  const brokenTournaments = [
    'Northern Ireland Open Qualifiers (2025-09-04)',
    'English Open Qualifiers (2025-09-11)',
    'English Open (2025-09-15)',
    'British Open (2025-09-22)'
  ];
  
  // Analysis suggests the bug occurs around September 1st, 2025
  // Likely causes:
  // 1. Date comparison using month numbers (8 vs 09)
  // 2. String comparison instead of Date comparison
  // 3. Timezone offset issues in September
  // 4. Hardcoded date cutoff before September
  
  return `
DATE FILTERING BUG ANALYSIS:
=========================

Working Sync (before Sept 1): ${workingTournaments.join(', ')}
Broken Sync (Sept 1+): ${brokenTournaments.join(', ')}

LIKELY BUG LOCATIONS:
1. Date string comparison: "2025-08" < "2025-09" logic
2. Hardcoded cutoff date before September
3. Month rollover logic error (Aug 31 -> Sept 1)
4. Timezone handling in September

RECOMMENDED FIX:
- Replace string date comparisons with Date object comparisons
- Remove any hardcoded date cutoffs
- Add proper timezone handling
- Test specifically around August 31 - September 1 transition
`;
}

/**
 * Emergency sync status check for critical tournaments
 */
export async function checkCriticalTournamentStatus(): Promise<{
  englishOpenQualifiers: boolean;
  englishOpenMain: boolean;
  needsImmediateFix: boolean;
}> {
  try {
    const [qualifiersResponse, mainResponse] = await Promise.all([
      fetch('https://snookerapp.up.railway.app/oneFourSeven/events/2341/matches/'),
      fetch('https://snookerapp.up.railway.app/oneFourSeven/events/2181/matches/')
    ]);
    
    const qualifiersMatches = await qualifiersResponse.json();
    const mainMatches = await mainResponse.json();
    
    const hasQualifiersData = Array.isArray(qualifiersMatches) && qualifiersMatches.length > 0;
    const hasMainData = Array.isArray(mainMatches) && mainMatches.length > 0;
    
    return {
      englishOpenQualifiers: hasQualifiersData,
      englishOpenMain: hasMainData,
      needsImmediateFix: !hasQualifiersData || !hasMainData
    };
  } catch (error) {
    logger.error('[TournamentSync] Error checking critical tournament status:', error);
    return {
      englishOpenQualifiers: false,
      englishOpenMain: false,
      needsImmediateFix: true
    };
  }
}