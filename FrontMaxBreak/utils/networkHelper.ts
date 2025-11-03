// utils/networkHelper.ts
import { logger } from './logger';

/**
 * Network connectivity and retry helper utilities
 * Provides standardized network error handling and retry logic across the app
 */

export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

export interface NetworkError {
    isNetworkError: boolean;
    isTimeoutError: boolean;
    isServerError: boolean;
    status?: number;
    message: string;
    userFriendlyMessage: string;
}

/**
 * Default retry configuration for different types of requests
 */
export const RETRY_CONFIGS = {
    CRITICAL: { maxRetries: 5, baseDelay: 1000, maxDelay: 10000, backoffFactor: 2 },
    STANDARD: { maxRetries: 3, baseDelay: 1000, maxDelay: 5000, backoffFactor: 1.5 },
    LIGHTWEIGHT: { maxRetries: 2, baseDelay: 500, maxDelay: 2000, backoffFactor: 1.2 },
} as const;

/**
 * Analyze an error to determine if it's a network, timeout, or server error
 */
export const analyzeNetworkError = (error: any): NetworkError => {
    const status = error.response?.status;
    const isNetworkError = !error.response && (
        error.code === 'NETWORK_ERROR' || 
        error.message.includes('Network Error') ||
        error.message.includes('ERR_NETWORK') ||
        error.message.includes('ERR_INTERNET_DISCONNECTED')
    );
    const isTimeoutError = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    const isServerError = status >= 500;

    let userFriendlyMessage = error.message;

    if (isNetworkError) {
        userFriendlyMessage = 'Network connection failed. Please check your internet connection and try again.';
    } else if (isTimeoutError) {
        userFriendlyMessage = 'Request timed out. Please check your connection and try again.';
    } else if (isServerError) {
        userFriendlyMessage = 'Server is temporarily unavailable. Please try again in a moment.';
    } else if (status === 404) {
        userFriendlyMessage = 'Requested data not found.';
    } else if (status === 401 || status === 403) {
        userFriendlyMessage = 'Access denied. Please check your permissions.';
    }

    return {
        isNetworkError,
        isTimeoutError,
        isServerError,
        status,
        message: error.message,
        userFriendlyMessage
    };
};

/**
 * Determine if an error should trigger a retry
 */
export const shouldRetry = (networkError: NetworkError): boolean => {
    return networkError.isNetworkError || 
           networkError.isTimeoutError || 
           networkError.isServerError;
};

/**
 * Calculate retry delay with exponential backoff
 */
export const calculateRetryDelay = (
    attemptNumber: number, 
    config: RetryConfig
): number => {
    const delay = config.baseDelay * Math.pow(config.backoffFactor, attemptNumber);
    return Math.min(delay, config.maxDelay);
};

/**
 * Generic retry wrapper for async functions
 */
export const withRetry = async <T>(
    operation: () => Promise<T>,
    config: RetryConfig = RETRY_CONFIGS.STANDARD,
    operationName: string = 'operation'
): Promise<T> => {
    let lastError: any;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            const result = await operation();
            if (attempt > 0) {
                logger.log(`[NetworkHelper] ${operationName} succeeded after ${attempt} retries`);
            }
            return result;
        } catch (error) {
            lastError = error;
            const networkError = analyzeNetworkError(error);

            if (attempt === config.maxRetries) {
                logger.error(`[NetworkHelper] ${operationName} failed after ${config.maxRetries + 1} attempts:`, networkError.message);
                throw error;
            }

            if (!shouldRetry(networkError)) {
                logger.log(`[NetworkHelper] ${operationName} failed with non-retryable error:`, networkError.message);
                throw error;
            }

            const delay = calculateRetryDelay(attempt, config);
            logger.log(`[NetworkHelper] ${operationName} attempt ${attempt + 1}/${config.maxRetries + 1} failed, retrying in ${delay}ms...`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
};

/**
 * Network connectivity checker
 */
export const checkNetworkConnectivity = async (): Promise<boolean> => {
    try {
        // Try to reach a reliable endpoint (Google DNS)
        const response = await fetch('https://dns.google/resolve?name=google.com&type=A', {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
        });
        return true;
    } catch (error) {
        logger.warn('[NetworkHelper] Network connectivity check failed:', error);
        return false;
    }
};

/**
 * Enhanced error handler that provides user-friendly messages
 */
export const handleNetworkError = (error: any, context: string): never => {
    const networkError = analyzeNetworkError(error);
    
    logger.error(`[NetworkHelper] ${context} failed:`, {
        status: networkError.status,
        message: networkError.message,
        isNetworkError: networkError.isNetworkError,
        isTimeoutError: networkError.isTimeoutError,
        isServerError: networkError.isServerError
    });

    // Create a standardized error object
    const enhancedError = new Error(networkError.userFriendlyMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).networkError = networkError;
    (enhancedError as any).context = context;

    throw enhancedError;
};

/**
 * Preemptive connection test for critical operations
 */
export const ensureConnection = async (endpointUrl: string): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(endpointUrl, {
            method: 'HEAD', // Lightweight request
            signal: controller.signal,
            cache: 'no-cache',
        });

        clearTimeout(timeoutId);
        return response.ok;
    } catch (error) {
        logger.warn(`[NetworkHelper] Connection test failed for ${endpointUrl}:`, error);
        return false;
    }
};

/**
 * Network status monitoring (for future enhancement)
 */
export const createNetworkMonitor = () => {
    let isOnline = true;
    const listeners: ((online: boolean) => void)[] = [];

    const updateStatus = (online: boolean) => {
        if (isOnline !== online) {
            isOnline = online;
            logger.log(`[NetworkHelper] Network status changed: ${online ? 'ONLINE' : 'OFFLINE'}`);
            listeners.forEach(listener => listener(online));
        }
    };

    // Listen for network events (if available)
    if (typeof window !== 'undefined') {
        window.addEventListener('online', () => updateStatus(true));
        window.addEventListener('offline', () => updateStatus(false));
        isOnline = navigator.onLine;
    }

    return {
        isOnline: () => isOnline,
        addListener: (listener: (online: boolean) => void) => {
            listeners.push(listener);
        },
        removeListener: (listener: (online: boolean) => void) => {
            const index = listeners.indexOf(listener);
            if (index > -1) listeners.splice(index, 1);
        }
    };
};

// Export a singleton network monitor
export const networkMonitor = createNetworkMonitor();