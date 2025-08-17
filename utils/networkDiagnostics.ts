// utils/networkDiagnostics.ts
import { logger } from './logger';

interface NetworkDiagnostics {
    isConnected: boolean;
    connectionType: string;
    backendReachable: boolean;
    errorDetails?: string;
}

/**
 * Comprehensive network diagnostics for mobile connectivity issues
 */
export const runNetworkDiagnostics = async (): Promise<NetworkDiagnostics> => {
    const diagnostics: NetworkDiagnostics = {
        isConnected: false,
        connectionType: 'unknown',
        backendReachable: false
    };

    try {
        // Step 1: Check basic network connectivity
        logger.log('[NetworkDiagnostics] Checking basic connectivity...');
        
        // Try a simple fetch to detect network availability with timeout
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('https://httpbin.org/json', { 
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            diagnostics.isConnected = response.ok;
            diagnostics.connectionType = 'internet-available';
        } catch (error) {
            diagnostics.isConnected = false;
            diagnostics.connectionType = 'no-internet';
            diagnostics.errorDetails = `Basic connectivity failed: ${error}`;
        }

        // Step 2: Test backend specifically
        logger.log('[NetworkDiagnostics] Testing Railway backend connectivity...');
        
        try {
            const backendController = new AbortController();
            const backendTimeoutId = setTimeout(() => backendController.abort(), 10000);
            
            const backendResponse = await fetch('https://snookerapp.up.railway.app/oneFourSeven/events/', {
                method: 'HEAD', // Just check if reachable
                signal: backendController.signal
            });
            
            clearTimeout(backendTimeoutId);
            diagnostics.backendReachable = backendResponse.ok;
            
            if (!backendResponse.ok) {
                diagnostics.errorDetails = `Backend returned: ${backendResponse.status} ${backendResponse.statusText}`;
            }
        } catch (backendError: any) {
            diagnostics.backendReachable = false;
            diagnostics.errorDetails = `Backend unreachable: ${backendError.message}`;
        }

        // Step 3: Log comprehensive results
        logger.log('[NetworkDiagnostics] Results:', {
            isConnected: diagnostics.isConnected,
            connectionType: diagnostics.connectionType,
            backendReachable: diagnostics.backendReachable,
            errorDetails: diagnostics.errorDetails
        });

        return diagnostics;

    } catch (error: any) {
        logger.error('[NetworkDiagnostics] Diagnostic check failed:', error);
        return {
            isConnected: false,
            connectionType: 'error',
            backendReachable: false,
            errorDetails: `Diagnostics failed: ${error.message}`
        };
    }
};

/**
 * Quick connectivity check for immediate use
 */
export const isNetworkAvailable = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('https://httpbin.org/json', { 
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
};

/**
 * Backend-specific connectivity check
 */
export const isBackendReachable = async (): Promise<boolean> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch('https://snookerapp.up.railway.app/oneFourSeven/events/', { 
            method: 'HEAD',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok;
    } catch {
        return false;
    }
};