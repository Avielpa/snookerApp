// utils/mobileDebug.ts
/**
 * Mobile-specific debugging utilities for touch events and navigation
 */

import { logger } from './logger';

export const MobileDebug = {
  /**
   * Log touch events for debugging mobile vs emulator differences
   */
  logTouch: (component: string, action: string, data?: any) => {
    if (__DEV__) {
      logger.log(`[MOBILE_TOUCH] ${component}: ${action}`, data ? JSON.stringify(data) : '');
    }
  },

  /**
   * Log navigation events
   */
  logNavigation: (from: string, to: string, method: 'tab' | 'card' | 'button' = 'button') => {
    if (__DEV__) {
      logger.log(`[MOBILE_NAV] ${method}: ${from} -> ${to}`);
    }
  },

  /**
   * Log API calls for mobile debugging
   */
  logAPI: (endpoint: string, status: 'start' | 'success' | 'error', data?: any) => {
    if (__DEV__) {
      logger.log(`[MOBILE_API] ${endpoint}: ${status}`, data ? JSON.stringify(data).substring(0, 100) : '');
    }
  },

  /**
   * Log component lifecycle for mobile debugging
   */
  logComponent: (component: string, lifecycle: 'mount' | 'update' | 'unmount', data?: any) => {
    if (__DEV__) {
      logger.log(`[MOBILE_COMP] ${component}: ${lifecycle}`, data ? JSON.stringify(data) : '');
    }
  },

  /**
   * Test if running on real device vs emulator
   */
  isRealDevice: (): boolean => {
    // Simple heuristic - real devices have different characteristics
    return !(
      // Common emulator indicators
      typeof navigator !== 'undefined' && 
      (navigator.userAgent?.includes('simulator') || 
       navigator.userAgent?.includes('emulator'))
    );
  }
};

export default MobileDebug;