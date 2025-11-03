/**
 * Production-safe logging utility
 * Logs only in development mode, silent in production
 */

import Constants from 'expo-constants';

const IS_DEV = __DEV__ || Constants.expoConfig?.extra?.environment === 'development';
const FORCE_DEBUG = process.env.EXPO_PUBLIC_FORCE_DEBUG_LOGGING === 'true';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Smart logger that shows critical info in production for debugging
 * Shows all logs in development, but only errors and forced debug in production
 */
export const logger: Logger = {
  log: IS_DEV || FORCE_DEBUG ? console.log.bind(console) : () => {},
  info: IS_DEV || FORCE_DEBUG ? console.info.bind(console) : () => {},
  warn: console.warn.bind(console), // Always show warnings
  error: console.error.bind(console), // Always show errors
  debug: IS_DEV || FORCE_DEBUG ? console.debug.bind(console) : () => {},
};

/**
 * Always logs errors regardless of environment
 * Use for critical errors that should be tracked in production
 */
export const criticalLogger = {
  error: console.error.bind(console),
  warn: console.warn.bind(console),
};

export default logger;