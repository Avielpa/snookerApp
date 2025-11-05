// services/api.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// --- Configuration ---
// Dynamic API URL based on environment
const getApiBaseUrl = () => {
  // If explicit environment variable is set, use it
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  
  // For development/debugging - check if running on emulator
  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to reach host machine
    // iOS simulator uses localhost/127.0.0.1
    const Platform = require('react-native').Platform;
    
    if (Platform.OS === 'android') {
      // Try local development server first for Android emulator
      return 'http://10.0.2.2:8000/oneFourSeven/';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      return 'http://localhost:8000/oneFourSeven/';
    }
  }
  
  // Production fallback
  return 'https://snookerapp.up.railway.app/oneFourSeven/';
};

const API_BASE_URL = getApiBaseUrl();

// Simple in-memory cache for API responses 
interface CacheEntry {
    data: any;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

class APICache {
    private cache = new Map<string, CacheEntry>();
    
    set(key: string, data: any, ttlMs: number = 30000) { // Default 30 second cache
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs
        });
        
        // Sync related match data between endpoints
        this.syncMatchData(key, data);
    }
    
    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data;
    }
    
    clear() {
        this.cache.clear();
    }
    
    // Sync match data between different endpoints to ensure consistency
    private syncMatchData(key: string, data: any) {
        // DISABLED - causes score swapping issues
        return;
        try {
            // If caching individual match details (REVERSE SYNC: individual → tournament)
            if (key.startsWith('get:matches/') && data && typeof data === 'object' && data.api_match_id) {
                logger.debug(`[Cache Sync] Individual match data received for API ID ${data.api_match_id}`);
                
                // Store a reference for tournament matches to use
                this.cache.set(`match_sync:${data.api_match_id}`, {
                    data: data,
                    timestamp: Date.now(),
                    ttl: 30000 // 30 second sync cache
                });
                
                // REVERSE SYNC: Update tournament match lists with newer individual match data
                for (const [cacheKey, cacheEntry] of this.cache.entries()) {
                    if (cacheKey.includes('/events/') && cacheKey.includes('/matches/') && Array.isArray(cacheEntry.data)) {
                        const tournamentMatches = cacheEntry.data;
                        let wasUpdated = false;
                        
                        for (let i = 0; i < tournamentMatches.length; i++) {
                            if (tournamentMatches[i] && tournamentMatches[i].api_match_id === data.api_match_id) {
                                // Check if individual match data is newer or has different scores
                                const oldScores = `${tournamentMatches[i].score1}-${tournamentMatches[i].score2}`;
                                const newScores = `${data.score1}-${data.score2}`;
                                
                                // CACHE SYNC: ALWAYS update with fresh individual match data
                                // Don't merge - REPLACE completely to avoid stale data
                                const isDevice = typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
                                const deviceType = isDevice ? 'DEVICE' : 'EMULATOR';

                                logger.log(`[${deviceType} Cache] 🔄 REVERSE SYNC: Match ${data.api_match_id} - Replacing with fresh data`);

                                // REPLACE the entire match with fresh data from individual match endpoint
                                tournamentMatches[i] = data;
                                wasUpdated = true;
                                break;
                            }
                        }
                        
                        if (wasUpdated) {
                            // Update the tournament matches cache with corrected data
                            this.cache.set(cacheKey, {
                                data: tournamentMatches,
                                timestamp: Date.now(),
                                ttl: cacheEntry.ttl
                            });
                            logger.log(`[Cache Sync] ✅ Updated tournament matches cache: ${cacheKey}`);
                        }
                    }
                }
            }
            
            // If caching tournament matches, sync individual matches (FORWARD SYNC: tournament → individual)
            if (key.includes('/matches/') && Array.isArray(data)) {
                const liveCount = data.filter(m => m && (m.status_code === 1 || m.status_code === 2)).length;
                logger.debug(`[Cache Sync] Forward syncing ${data.length} tournament matches (${liveCount} live)`);
                
                data.forEach((match: any) => {
                    if (match && match.api_match_id) {
                        // Update the individual match cache with tournament data only if no newer individual data exists
                        const matchKey = `get:matches/${match.api_match_id}/`;
                        const existingMatch = this.cache.get(matchKey);
                        const syncedMatch = this.cache.get(`match_sync:${match.api_match_id}`);
                        
                        // UPDATED: Allow sync but ensure data consistency from backend
                        // The real fix is in backend data validation to prevent inconsistent data
                        const shouldUpdate = !existingMatch;
                        
                        if (shouldUpdate) {
                            this.cache.set(matchKey, {
                                data: match,
                                timestamp: Date.now(),
                                ttl: 15000 // Short TTL for sync data
                            });
                            
                            if (match.status_code === 1 || match.status_code === 2) {
                                logger.debug(`[Cache Sync] Forward synced LIVE match cache for API ID ${match.api_match_id}`);
                            }
                        }
                    }
                });
            }
        } catch (error) {
            logger.warn('[Cache Sync] Error syncing match data:', error);
        }
    }
    
    // Clear cache entries older than their TTL
    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
    
    // Invalidate related match caches and call match service cache clearing
    invalidateMatchData(apiMatchId: number) {
        const keysToInvalidate = [];
        for (const key of this.cache.keys()) {
            if (key.includes(`matches/${apiMatchId}/`) || 
                key.includes('/matches/') || 
                key.includes(`match_sync:${apiMatchId}`)) {
                keysToInvalidate.push(key);
            }
        }
        
        keysToInvalidate.forEach(key => {
            this.cache.delete(key);
            logger.debug(`[Cache Invalidate] Cleared cache for ${key}`);
        });

        // Skip match service cache clearing to avoid circular dependency during EAS updates
        logger.debug(`[Cache Invalidate] Match service cache clearing skipped for EAS update compatibility`);
    }

    // Clear all tournament match caches to prevent stale score displays in production builds
    clearAllTournamentMatches() {
        const keysToInvalidate = [];
        for (const key of this.cache.keys()) {
            if (key.includes('/events/') && key.includes('/matches/')) {
                keysToInvalidate.push(key);
            }
        }
        
        keysToInvalidate.forEach(key => {
            this.cache.delete(key);
            logger.debug(`[Cache Clear Tournament] Cleared cache for ${key}`);
        });
        
        logger.log(`[Cache Clear Tournament] Cleared ${keysToInvalidate.length} tournament match cache entries`);
    }
}

const apiCache = new APICache();

// Clean up cache every 5 minutes
setInterval(() => apiCache.cleanup(), 300000);

// : string = process.env.EXPO_PUBLIC_API_URL || 
//   (process.env.NODE_ENV === 'production' 
//     ? 'https://snookerapp.up.railway.app/oneFourSeven/'
//     : 'http://10.0.2.2:8000/oneFourSeven/');

// BACKUP URLs for debugging
/*
// Force production URL: 'https://snookerapp.up.railway.app/oneFourSeven/'
// Force local URL: 'http://10.0.2.2:8000/oneFourSeven/'
*/

logger.log(`[API Setup] Using API Base URL: ${API_BASE_URL}`);
logger.log(`[API Setup] Environment Variables:`, {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  NODE_ENV: process.env.NODE_ENV,
  __DEV__: __DEV__
});

// --- Create a single Axios instance ---
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // Increased to 30 seconds for slow mobile networks
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache', // Prevent mobile browser caching issues
        'Pragma': 'no-cache',
    },
    // Add retry configuration
    validateStatus: function (status) {
        return status >= 200 && status < 300; // default
    },
});

// --- Add interceptors for caching and debugging ---
api.interceptors.request.use(async (config) => {
    logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    logger.debug(`[API Request] Base URL: ${config.baseURL}`);

    // Check cache for GET requests only (UNLESS skipCache is set)
    if (config.method?.toLowerCase() === 'get' && config.url && !(config as any).skipCache) {
        const cacheKey = `${config.method}:${config.url}`;
        const cachedData = apiCache.get(cacheKey);

        if (cachedData) {
            logger.debug(`[API Cache] Cache HIT for ${cacheKey}`);
            // Return cached response by creating a fake response object
            return Promise.reject({
                __cached__: true,
                data: cachedData,
                status: 200,
                statusText: 'OK (Cached)',
                config
            });
        } else {
            logger.debug(`[API Cache] Cache MISS for ${cacheKey}`);
        }
    } else if ((config as any).skipCache) {
        logger.log(`[API Cache] SKIPPING cache for ${config.url} (skipCache=true)`);
    }

    return config;
}, (error) => {
    logger.error("[API Request Error]:", error);
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => {
        logger.debug(`[API Response] ${response.status} ${response.config.url}`);
        logger.debug(`[API Response] Data length: ${JSON.stringify(response.data).length} characters`);

        // Cache GET responses for future use (UNLESS skipCache is set)
        if (response.config.method?.toLowerCase() === 'get' && response.config.url && !(response.config as any).skipCache) {
            const cacheKey = `${response.config.method}:${response.config.url}`;

            // Use different TTL based on endpoint type
            let ttl = 30000; // Default 30 seconds

            if (response.config.url.includes('/events/')) {
                ttl = 45000; // Tournament details: 45 seconds (slightly shorter for better consistency)
            } else if (response.config.url.includes('/matches/')) {
                ttl = 8000; // Match details: 8 seconds (longer to prevent initial load race conditions)
            } else if (response.config.url.includes('/rankings/')) {
                ttl = 300000; // Rankings: 5 minutes (unchanged)
            }

            apiCache.set(cacheKey, response.data, ttl);
            logger.debug(`[API Cache] Cached response for ${cacheKey} (TTL: ${ttl}ms)`);
        } else if ((response.config as any).skipCache) {
            logger.log(`[API Cache] NOT caching response for ${response.config.url} (skipCache=true)`);
        }

        return response;
    },
    (error) => {
        // Handle cached responses (from request interceptor)
        if (error.__cached__) {
            logger.debug(`[API Cache] Returning cached data`);
            return Promise.resolve({
                data: error.data,
                status: error.status,
                statusText: error.statusText,
                config: error.config,
                headers: {}
            });
        }
        
        // Enhanced error handling for mobile networks
        const status = error.response?.status;
        const isNetworkError = !error.response && (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error'));
        const isTimeoutError = error.code === 'ECONNABORTED' || error.message.includes('timeout');
        
        let userFriendlyMessage = error.message;
        
        if (isNetworkError) {
            userFriendlyMessage = 'Network connection failed. Please check your internet connection.';
        } else if (isTimeoutError) {
            userFriendlyMessage = 'Request timed out. Please try again.';
        } else if (status >= 500) {
            userFriendlyMessage = 'Server error. Please try again later.';
        } else if (status === 404) {
            userFriendlyMessage = 'Requested data not found.';
        }
        
        // Always log detailed error information
        logger.error("[API Error]:", {
            status,
            statusText: error.response?.statusText,
            url: error.config?.url,
            baseURL: error.config?.baseURL,
            data: error.response?.data,
            message: error.message,
            userFriendlyMessage,
            isNetworkError,
            isTimeoutError
        });
        
        // Add user-friendly message to error object
        error.userFriendlyMessage = userFriendlyMessage;
        
        return Promise.reject(error);
    }
);

// Cache management functions for live match updates
export const clearLiveMatchCache = () => {
    logger.log('[API Cache] Clearing live match cache for real-time updates');
    apiCache.clear();
};

export const forceCacheRefresh = (tournamentId?: number) => {
    logger.log(`[API Cache] Force refreshing cache for tournament ${tournamentId || 'all'}`);
    
    // Clear tournament-specific caches
    if (tournamentId) {
        const keysToInvalidate = [];
        for (const [key] of (apiCache as any).cache.entries()) {
            if (key.includes(`/${tournamentId}/`) || key.includes(`events/`) || key.includes(`matches/`)) {
                keysToInvalidate.push(key);
            }
        }
        keysToInvalidate.forEach(key => (apiCache as any).cache.delete(key));
        logger.log(`[API Cache] Invalidated ${keysToInvalidate.length} tournament-specific cache entries`);
    } else {
        apiCache.clear();
    }
};

// Trigger cache sync when returning from match details to ensure score consistency
export const syncMatchDataToTournamentCache = (matchData: any) => {
    if (matchData && matchData.api_match_id) {
        logger.log(`[API Cache] Manual sync triggered for match ${matchData.api_match_id}`);
        (apiCache as any).syncMatchData(`get:matches/${matchData.api_match_id}/`, matchData);
    }
};

// Enhanced API wrapper with mobile-optimized retry logic
export const apiWithRetry = {
    async get<T = any>(url: string, retries: number = 2): Promise<T> {
        for (let attempt = 1; attempt <= retries + 1; attempt++) {
            try {
                const response = await api.get<T>(url);
                if (attempt > 1) {
                    logger.log(`[API Retry] Success on attempt ${attempt} for ${url}`);
                }
                return response.data;
            } catch (error: any) {
                const isLastAttempt = attempt === retries + 1;
                const isNetworkError = !error.response && (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error'));
                const isTimeoutError = error.code === 'ECONNABORTED' || error.message.includes('timeout');
                
                if (isLastAttempt || (!isNetworkError && !isTimeoutError)) {
                    // Don't retry non-network errors or if max retries reached
                    throw error;
                }
                
                const waitTime = Math.min(1000 * attempt, 5000); // Exponential backoff, max 5 seconds
                logger.warn(`[API Retry] Attempt ${attempt} failed for ${url}, retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        // This should never be reached, but TypeScript needs it
        throw new Error('Unexpected error in retry logic');
    }
};

// Export the configured instance and cache
export { api, apiCache };