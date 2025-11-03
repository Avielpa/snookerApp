// utils/emergencySync.ts
// Emergency sync trigger for immediate tournament data fix
// This will trigger sync for critical tournaments until permanent fix is deployed

import { logger } from './logger';

/**
 * Emergency sync for English Open tournaments
 * Triggers backend sync by making strategic API calls
 */
export async function triggerEmergencySync() {
  logger.log('[EmergencySync] Starting emergency sync for English Open tournaments...');
  
  const criticalTournaments = [
    { id: 2341, name: 'English Open Qualifiers', priority: 'critical' },
    { id: 2181, name: 'English Open Main', priority: 'high' },
    { id: 2183, name: 'Northern Ireland Open', priority: 'medium' },
    { id: 2182, name: 'British Open', priority: 'medium' }
  ];
  
  const results = [];
  
  for (const tournament of criticalTournaments) {
    try {
      logger.log(`[EmergencySync] Processing ${tournament.name} (ID: ${tournament.id})`);
      
      // Check current status
      const status = await checkTournamentStatus(tournament.id);
      
      if (!status.hasMatches && status.shouldHaveMatches) {
        logger.warn(`[EmergencySync] ${tournament.name} missing match data - attempting trigger`);
        
        // Try to trigger sync through various methods
        const syncResult = await attemptSyncTrigger(tournament.id, tournament.name);
        results.push({ tournament: tournament.name, success: syncResult, status });
      } else {
        logger.log(`[EmergencySync] ${tournament.name} already has match data or not ready yet`);
        results.push({ tournament: tournament.name, success: true, status, message: 'Already synced' });
      }
      
    } catch (error) {
      logger.error(`[EmergencySync] Failed to process ${tournament.name}:`, error);
      results.push({ tournament: tournament.name, success: false, error: error.message });
    }
  }
  
  logger.log('[EmergencySync] Emergency sync completed:', results);
  return results;
}

async function checkTournamentStatus(tournamentId: number) {
  try {
    const [eventResponse, matchesResponse] = await Promise.all([
      fetch(`https://snookerapp.up.railway.app/oneFourSeven/events/${tournamentId}/`),
      fetch(`https://snookerapp.up.railway.app/oneFourSeven/events/${tournamentId}/matches/`)
    ]);
    
    const event = await eventResponse.json();
    const matches = await matchesResponse.json();
    
    const hasMatches = Array.isArray(matches) && matches.length > 0;
    const startDate = new Date(event.StartDate);
    const endDate = new Date(event.EndDate);
    const today = new Date('2025-09-11');
    
    // Determine if should have matches
    const isActive = startDate <= today && today <= endDate;
    const isPast = endDate < today;
    const isUpcomingSoon = startDate > today && (startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    
    const shouldHaveMatches = isActive || isPast || isUpcomingSoon;
    
    return {
      hasMatches,
      shouldHaveMatches,
      isActive,
      isPast,
      isUpcomingSoon,
      matchCount: Array.isArray(matches) ? matches.length : 0,
      startDate: event.StartDate,
      endDate: event.EndDate
    };
  } catch (error) {
    logger.error(`[EmergencySync] Error checking tournament ${tournamentId} status:`, error);
    return { hasMatches: false, shouldHaveMatches: true, error: error.message };
  }
}

async function attemptSyncTrigger(tournamentId: number, tournamentName: string): Promise<boolean> {
  logger.log(`[EmergencySync] Attempting to trigger sync for ${tournamentName} (${tournamentId})`);
  
  // Method 1: Try cache invalidation to force refresh
  try {
    logger.log(`[EmergencySync] Method 1: Cache invalidation for ${tournamentName}`);
    
    // Multiple requests to different endpoints to trigger backend refresh
    const endpoints = [
      `https://snookerapp.up.railway.app/oneFourSeven/events/${tournamentId}/`,
      `https://snookerapp.up.railway.app/oneFourSeven/events/${tournamentId}/matches/`,
      `https://snookerapp.up.railway.app/oneFourSeven/prize-money/${tournamentId}/`
    ];
    
    // Rapid sequential requests to potentially trigger sync logic
    for (let i = 0; i < 3; i++) {
      await Promise.all(endpoints.map(url => 
        fetch(url, { 
          method: 'GET',
          headers: { 'Cache-Control': 'no-cache' }
        }).catch(() => {}) // Ignore failures
      ));
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
    
    // Check if sync was triggered
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    const postSyncStatus = await checkTournamentStatus(tournamentId);
    
    if (postSyncStatus.hasMatches) {
      logger.log(`[EmergencySync] ✅ Cache invalidation triggered sync for ${tournamentName}`);
      return true;
    }
    
  } catch (error) {
    logger.warn(`[EmergencySync] Method 1 failed for ${tournamentName}:`, error);
  }
  
  // Method 2: Try external data fetch to trigger backend update
  try {
    logger.log(`[EmergencySync] Method 2: External data fetch for ${tournamentName}`);
    
    // Call external event details endpoint that might trigger sync
    await fetch(`https://snookerapp.up.railway.app/oneFourSeven/external/event-details/${tournamentId}/`, {
      method: 'GET',
      headers: { 'User-Agent': 'SnookerApp-EmergencySync/1.0' }
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds for processing
    
    const postSyncStatus = await checkTournamentStatus(tournamentId);
    if (postSyncStatus.hasMatches) {
      logger.log(`[EmergencySync] ✅ External fetch triggered sync for ${tournamentName}`);
      return true;
    }
    
  } catch (error) {
    logger.warn(`[EmergencySync] Method 2 failed for ${tournamentName}:`, error);
  }
  
  logger.warn(`[EmergencySync] ❌ All sync trigger methods failed for ${tournamentName}`);
  return false;
}

/**
 * Monitor tournament sync status over time
 */
export async function monitorSyncStatus(durationMinutes: number = 10): Promise<void> {
  const endTime = Date.now() + (durationMinutes * 60 * 1000);
  const criticalTournaments = [2341, 2181]; // English Open tournaments
  
  logger.log(`[EmergencySync] Starting ${durationMinutes}-minute sync monitoring...`);
  
  while (Date.now() < endTime) {
    for (const tournamentId of criticalTournaments) {
      const status = await checkTournamentStatus(tournamentId);
      
      if (status.hasMatches && !status.error) {
        logger.log(`[EmergencySync] ✅ Tournament ${tournamentId} now has ${status.matchCount} matches`);
      } else if (status.shouldHaveMatches) {
        logger.warn(`[EmergencySync] ⏳ Tournament ${tournamentId} still missing matches`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 60000)); // Check every minute
  }
  
  logger.log('[EmergencySync] Monitoring completed');
}

/**
 * Quick status check for all critical tournaments
 */
export async function quickStatusCheck(): Promise<{ [key: string]: any }> {
  const tournaments = {
    'English Open Qualifiers': 2341,
    'English Open Main': 2181,
    'Northern Ireland Open': 2183,
    'British Open': 2182
  };
  
  const results: { [key: string]: any } = {};
  
  for (const [name, id] of Object.entries(tournaments)) {
    try {
      const status = await checkTournamentStatus(id);
      results[name] = {
        id,
        hasData: status.hasMatches,
        matchCount: status.matchCount,
        shouldHave: status.shouldHaveMatches,
        status: status.isActive ? 'active' : status.isPast ? 'past' : 'upcoming'
      };
    } catch (error) {
      results[name] = { id, error: error.message };
    }
  }
  
  return results;
}