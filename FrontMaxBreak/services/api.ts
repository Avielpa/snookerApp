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
        });
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
        });
    }
}

const apiCache = new APICache();

// Clean up cache every 5 minutes
setInterval(() => apiCache.cleanup(), 300000);

logger.log(`[API Setup] Using API Base URL: ${API_BASE_URL}`);

// --- Create a single Axios instance ---
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
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

// Cache management functions
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
// NOTE: This function is now a no-op because the syncMatchData method was disabled due to score swapping issues
// The caller immediately clears tournament caches after this call anyway, so no sync is needed
export const syncMatchDataToTournamentCache = (matchData: any) => {
    // No-op: sync was causing issues and cache is cleared by caller anyway
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