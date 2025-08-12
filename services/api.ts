// services/api.ts
import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

// --- Configuration ---
// Dynamic API URL based on environment
const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://snookerapp.up.railway.app/oneFourSeven/'
    : 'http://10.0.2.2:8000/oneFourSeven/');

// BACKUP URLs for debugging
/*
// Force production URL: 'https://snookerapp.up.railway.app/oneFourSeven/'
// Force local URL: 'http://10.0.2.2:8000/oneFourSeven/'
*/

logger.log(`[API Setup] Using API Base URL: ${API_BASE_URL}`);

// --- Create a single Axios instance ---
const api: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 8000, // Increased timeout slightly for potentially slower network/server
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// --- Optional: Add interceptors for handling tokens or errors globally ---
/*
api.interceptors.request.use(async (config) => {
    // Example: Automatically add JWT token to Authorization header
    const token = await AsyncStorage.getItem('userToken'); // Assuming you store the access token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

api.interceptors.response.use(
    (response) => {
        // Any status code that lie within the range of 2xx cause this function to trigger
        return response;
    },
    (error) => {
        // Any status codes that falls outside the range of 2xx cause this function to trigger
        // Example: Handle 401 Unauthorized globally (e.g., redirect to login)
        if (error.response && error.response.status === 401) {
            logger.error("Unauthorized request - potentially expired token:", error.response.data);
            // Add logic here to clear token and navigate to login screen
            // e.g., AsyncStorage.removeItem('userToken'); router.replace('/login');
        }
        // Log other errors
        logger.error("[API Interceptor Error]:", error.response?.data || error.message);
        return Promise.reject(error); // Pass the error along
    }
);
*/

// Export the configured instance
export { api };