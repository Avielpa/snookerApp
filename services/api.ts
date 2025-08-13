// services/api.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// --- Configuration ---
// Dynamic API URL based on environment
const API_BASE_URL = 'https://snookerapp.up.railway.app/oneFourSeven/';

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

// --- Add interceptors for better debugging ---
api.interceptors.request.use(async (config) => {
    logger.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
    logger.debug(`[API Request] Base URL: ${config.baseURL}`);
    return config;
}, (error) => {
    logger.error("[API Request Error]:", error);
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => {
        logger.debug(`[API Response] ${response.status} ${response.config.url}`);
        logger.debug(`[API Response] Data length: ${JSON.stringify(response.data).length} characters`);
        return response;
    },
    (error) => {
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

// Export the configured instance
export { api };