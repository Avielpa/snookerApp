/**
 * Production-safe logging utility
 * Logs only in development mode, silent in production
 */

import Constants from 'expo-constants';

const IS_DEV = __DEV__ || Constants.expoConfig?.extra?.environment === 'development';

interface Logger {
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Development-only logger
 * In production builds, all methods are no-ops
 */
export const logger: Logger = {
  log: IS_DEV ? console.log.bind(console) : () => {},
  info: IS_DEV ? console.info.bind(console) : () => {},
  warn: IS_DEV ? console.warn.bind(console) : () => {},
  error: IS_DEV ? console.error.bind(console) : () => {},
  debug: IS_DEV ? console.debug.bind(console) : () => {},
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