// services/api.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// --- Configuration ---
// Dynamic API URL based on environment
const API_BASE_URL = 'https://snookerapp.up.railway.app/oneFourSeven/'; // Default to local development

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
        try {
            // If caching individual match details
            if (key.startsWith('get:matches/') && data && typeof data === 'object' && data.api_match_id) {
                logger.debug(`[Cache Sync] Syncing individual match data for API ID ${data.api_match_id}`);
                // Store a reference for tournament matches to use
                this.cache.set(`match_sync:${data.api_match_id}`, {
                    data: data,
                    timestamp: Date.now(),
                    ttl: 15000 // 15 second sync cache
                });
            }
            
            // If caching tournament matches, sync individual matches
            if (key.includes('/matches/') && Array.isArray(data)) {
                const liveCount = data.filter(m => m && (m.status_code === 1 || m.status_code === 2)).length;
                logger.debug(`[Cache Sync] Syncing ${data.length} matches (${liveCount} live)`);
                data.forEach((match: any) => {
                    if (match && match.api_match_id) {
                        // Update the individual match cache with consistent data
                        const matchKey = `get:matches/${match.api_match_id}/`;
                        const existingMatch = this.cache.get(matchKey);
                        
                        if (!existingMatch || existingMatch.timestamp < Date.now() - 15000) {
                            // Only update if no cache or cache is older than 15 seconds
                            this.cache.set(matchKey, {
                                data: match,
                                timestamp: Date.now(),
                                ttl: 15000 // Short TTL for sync data
                            });
                            // Only log for live matches to reduce spam
                            if (match.status_code === 1 || match.status_code === 2) {
                                logger.debug(`[Cache Sync] Updated LIVE match cache for API ID ${match.api_match_id}`);
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

        // Also clear the match service cache for this match ID
        try {
            // Dynamic import to avoid circular dependency
            import('./matchServices').then(({ clearMatchCache }) => {
                clearMatchCache(apiMatchId);
            });
        } catch (error) {
            logger.debug(`[Cache Invalidate] Could not clear match service cache: ${error}`);
        }
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
    timeout: 15000, // Increased timeout for mobile networks
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
    
    // Check cache for GET requests only
    if (config.method?.toLowerCase() === 'get' && config.url) {
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
        
        // Cache GET responses for future use
        if (response.config.method?.toLowerCase() === 'get' && response.config.url) {
            const cacheKey = `${response.config.method}:${response.config.url}`;
            
            // Use different TTL based on endpoint type
            let ttl = 30000; // Default 30 seconds
            
            if (response.config.url.includes('/events/')) {
                ttl = 60000; // Tournament details: 1 minute
            } else if (response.config.url.includes('/matches/')) {
                ttl = 15000; // Match details: 15 seconds (more dynamic)
            } else if (response.config.url.includes('/rankings/')) {
                ttl = 300000; // Rankings: 5 minutes (less dynamic)
            }
            
            apiCache.set(cacheKey, response.data, ttl);
            logger.debug(`[API Cache] Cached response for ${cacheKey} (TTL: ${ttl}ms)`);
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

// Export the configured instance and cache
export { api, apiCache };