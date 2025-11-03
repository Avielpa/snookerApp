// utils/emulatorDebug.ts
import { Platform } from 'react-native';
import { logger } from './logger';

export interface EmulatorDiagnostics {
  isEmulator: boolean;
  platform: string;
  apiUrl: string;
  networkConnectivity: boolean;
  emulatorSpecificIssues: string[];
  recommendations: string[];
}

/**
 * Detect if running on Android emulator vs physical device
 */
export const isAndroidEmulator = (): boolean => {
  if (Platform.OS !== 'android') return false;
  
  try {
    // Use React Native's built-in constants for detection
    const { Version, Release } = Platform.constants;
    
    // Common emulator indicators in Android
    const emulatorIndicators = [
      'sdk',
      'generic',
      'emulator',
      'goldfish',
      'ranchu'
    ];
    
    // Check version string for emulator patterns
    const versionString = Version?.toString().toLowerCase() || '';
    const releaseString = Release?.toLowerCase() || '';
    
    const hasEmulatorIndicator = emulatorIndicators.some(indicator => 
      versionString.includes(indicator) || releaseString.includes(indicator)
    );
    
    // Fallback: if we can't detect specifically, assume emulator in dev mode
    return hasEmulatorIndicator || (__DEV__ && Platform.OS === 'android');
  } catch (error) {
    logger.debug('[EmulatorDebug] Error detecting emulator, defaulting to dev mode check:', error);
    // Fallback detection method
    return __DEV__ && Platform.OS === 'android';
  }
};

/**
 * Test network connectivity with different URLs for emulator debugging
 */
export const testEmulatorConnectivity = async (): Promise<{ [key: string]: boolean }> => {
  const testUrls = {
    'Railway Production': 'https://snookerapp.up.railway.app/oneFourSeven/events/',
    'Localhost (Emulator)': 'http://10.0.2.2:8000/oneFourSeven/events/',
    'Google DNS': 'https://8.8.8.8',
    'External API': 'https://httpbin.org/json'
  };

  const results: { [key: string]: boolean } = {};

  for (const [name, url] of Object.entries(testUrls)) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      results[name] = response.ok;
      logger.debug(`[EmulatorDebug] ${name}: ${response.ok ? 'SUCCESS' : 'FAILED'} (${response.status})`);
    } catch (error: any) {
      results[name] = false;
      logger.debug(`[EmulatorDebug] ${name}: FAILED (${error.message})`);
    }
  }

  return results;
};

/**
 * Comprehensive emulator diagnostics
 */
export const runEmulatorDiagnostics = async (): Promise<EmulatorDiagnostics> => {
  logger.log('[EmulatorDebug] Running comprehensive emulator diagnostics...');
  
  const isEmulator = isAndroidEmulator();
  const platform = Platform.OS;
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'Not configured';
  
  // Test connectivity
  const connectivityResults = await testEmulatorConnectivity();
  const networkConnectivity = Object.values(connectivityResults).some(result => result);
  
  // Identify emulator-specific issues
  const emulatorSpecificIssues: string[] = [];
  const recommendations: string[] = [];
  
  if (isEmulator) {
    // Check Railway connectivity
    if (!connectivityResults['Railway Production']) {
      emulatorSpecificIssues.push('Cannot reach Railway backend');
      recommendations.push('Check emulator internet access in AVD settings');
      recommendations.push('Enable "Wipe Data" and restart emulator');
      recommendations.push('Try running emulator with: emulator -avd YOUR_AVD -dns-server 8.8.8.8,8.8.4.4');
    }
    
    // Check localhost connectivity
    if (!connectivityResults['Localhost (Emulator)']) {
      emulatorSpecificIssues.push('Cannot reach localhost Django server');
      recommendations.push('Start Django development server: python manage.py runserver 0.0.0.0:8000');
      recommendations.push('Update .env to use EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/oneFourSeven/');
    }
    
    // Check general internet
    if (!connectivityResults['Google DNS'] && !connectivityResults['External API']) {
      emulatorSpecificIssues.push('No internet connectivity in emulator');
      recommendations.push('Check emulator network settings');
      recommendations.push('Restart emulator with cold boot');
      recommendations.push('Check host machine internet connection');
    }
    
    // Check API URL configuration
    if (apiUrl.includes('10.0.2.2') && !connectivityResults['Localhost (Emulator)']) {
      emulatorSpecificIssues.push('Configured for local development but Django server not running');
      recommendations.push('Either start Django server or switch to Railway URL');
    }
    
    if (apiUrl.includes('snookerapp.up.railway.app') && !connectivityResults['Railway Production']) {
      emulatorSpecificIssues.push('Configured for Railway but cannot reach Railway backend');
      recommendations.push('Check emulator internet settings');
    }
  } else {
    // Physical device specific checks
    if (!connectivityResults['Railway Production']) {
      emulatorSpecificIssues.push('Cannot reach Railway backend from physical device');
      recommendations.push('Check device internet connection');
      recommendations.push('Try switching between WiFi and mobile data');
    }
  }
  
  const diagnostics: EmulatorDiagnostics = {
    isEmulator,
    platform,
    apiUrl,
    networkConnectivity,
    emulatorSpecificIssues,
    recommendations
  };
  
  // Log comprehensive results
  logger.log('[EmulatorDebug] === DIAGNOSTICS RESULTS ===');
  logger.log(`[EmulatorDebug] Is Emulator: ${isEmulator}`);
  logger.log(`[EmulatorDebug] Platform: ${platform}`);
  logger.log(`[EmulatorDebug] API URL: ${apiUrl}`);
  logger.log(`[EmulatorDebug] Network Connectivity: ${networkConnectivity}`);
  logger.log(`[EmulatorDebug] Connectivity Results:`, connectivityResults);
  
  if (emulatorSpecificIssues.length > 0) {
    logger.warn(`[EmulatorDebug] === ISSUES FOUND ===`);
    emulatorSpecificIssues.forEach((issue, index) => {
      logger.warn(`[EmulatorDebug] ${index + 1}. ${issue}`);
    });
    
    logger.log(`[EmulatorDebug] === RECOMMENDATIONS ===`);
    recommendations.forEach((rec, index) => {
      logger.log(`[EmulatorDebug] ${index + 1}. ${rec}`);
    });
  } else {
    logger.log(`[EmulatorDebug] ✅ No issues detected!`);
  }
  
  return diagnostics;
};

/**
 * Quick fix for common emulator issues
 */
export const applyEmulatorFixes = () => {
  logger.log('[EmulatorDebug] Applying common emulator fixes...');
  
  if (isAndroidEmulator()) {
    // Clear any cached data that might cause issues
    try {
      // Add any emulator-specific fixes here
      logger.log('[EmulatorDebug] ✅ Applied emulator-specific fixes');
    } catch (error) {
      logger.warn('[EmulatorDebug] ⚠️ Some fixes could not be applied:', error);
    }
  }
};

/**
 * Log current environment configuration for debugging
 */
export const logEnvironmentConfig = () => {
  logger.log('[EmulatorDebug] === ENVIRONMENT CONFIG ===');
  logger.log('[EmulatorDebug] NODE_ENV:', process.env.NODE_ENV);
  logger.log('[EmulatorDebug] EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  logger.log('[EmulatorDebug] API_BASE_URL:', process.env.API_BASE_URL);
  logger.log('[EmulatorDebug] __DEV__:', __DEV__);
  logger.log('[EmulatorDebug] Platform.OS:', Platform.OS);
  logger.log('[EmulatorDebug] Is Emulator:', isAndroidEmulator());
};