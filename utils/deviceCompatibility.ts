// utils/deviceCompatibility.ts
import { Platform, Dimensions } from 'react-native';
import { logger } from './logger';

/**
 * Device Compatibility Utilities
 * 
 * Addresses specific compatibility issues with Samsung Galaxy S23/S24/S25 devices
 * and provides debugging information for tab interaction issues.
 */

interface DeviceInfo {
  platform: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  fontScale: number;
  isTablet: boolean;
  deviceType: 'phone' | 'tablet' | 'unknown';
}

interface TouchConfig {
  hitSlop: { top: number; bottom: number; left: number; right: number };
  pressRetentionOffset: { top: number; bottom: number; left: number; right: number };
  delayPressIn: number;
  delayPressOut: number;
  activeOpacity: number;
}

/**
 * Get device information for debugging
 */
export const getDeviceInfo = (): DeviceInfo => {
  const { width, height } = Dimensions.get('window');
  const pixelRatio = require('react-native').PixelRatio.get();
  const fontScale = require('react-native').PixelRatio.getFontScale();
  
  const isTablet = width >= 768 || height >= 768;
  const deviceType = isTablet ? 'tablet' : 'phone';
  
  return {
    platform: Platform.OS,
    screenWidth: width,
    screenHeight: height,
    pixelRatio,
    fontScale,
    isTablet,
    deviceType,
  };
};

/**
 * Get optimized touch configuration based on device
 * Samsung Galaxy S23+ devices need larger hit areas and different timing
 */
export const getOptimizedTouchConfig = (): TouchConfig => {
  const deviceInfo = getDeviceInfo();
  
  // Enhanced touch areas for Samsung devices
  if (Platform.OS === 'android') {
    return {
      hitSlop: { top: 25, bottom: 25, left: 25, right: 25 },
      pressRetentionOffset: { top: 50, bottom: 50, left: 50, right: 50 },
      delayPressIn: 0,
      delayPressOut: 100, // Longer delay for Samsung
      activeOpacity: 0.7,
    };
  }
  
  // iOS default
  return {
    hitSlop: { top: 15, bottom: 15, left: 15, right: 15 },
    pressRetentionOffset: { top: 20, bottom: 20, left: 20, right: 20 },
    delayPressIn: 0,
    delayPressOut: 50,
    activeOpacity: 0.6,
  };
};

/**
 * Log device compatibility information for debugging
 */
export const logDeviceCompatibility = () => {
  const deviceInfo = getDeviceInfo();
  const touchConfig = getOptimizedTouchConfig();
  
  logger.log('[DeviceCompatibility] Device Information:', {
    ...deviceInfo,
    touchConfig,
    timestamp: new Date().toISOString(),
  });
  
  // Special logging for potential Samsung Galaxy S23+ detection
  if (Platform.OS === 'android') {
    const { width, height } = deviceInfo;
    
    // Galaxy S23 series common resolutions
    const isLikelyS23Series = 
      (width === 393 && height === 851) || // S23
      (width === 412 && height === 915) || // S23+
      (width === 411 && height === 890) || // S23 Ultra
      (width === 384 && height === 854) || // S24
      (width === 412 && height === 919) || // S24+
      (width === 411 && height === 890);   // S24 Ultra
    
    if (isLikelyS23Series) {
      logger.warn('[DeviceCompatibility] Detected potential Galaxy S23+ series device - using enhanced touch handling');
    }
  }
};

/**
 * Enhanced touch handler that works better with Samsung devices
 */
export const createSamsungCompatibleHandler = (originalHandler: () => void) => {
  return () => {
    // Add small delay to prevent touch event conflicts on Samsung devices
    if (Platform.OS === 'android') {
      setTimeout(originalHandler, 50);
    } else {
      originalHandler();
    }
  };
};

/**
 * Check if the device needs special handling for tabs
 */
export const needsEnhancedTabHandling = (): boolean => {
  if (Platform.OS !== 'android') return false;
  
  const { screenWidth, screenHeight, pixelRatio } = getDeviceInfo();
  
  // Check for high-end Samsung devices that might have touch sensitivity issues
  return pixelRatio >= 3.0 && (screenWidth >= 393 || screenHeight >= 850);
};