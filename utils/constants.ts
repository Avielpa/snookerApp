// utils/constants.ts
export const APP_CONSTANTS = {
  // Touch and interaction constants
  TOUCH_SLOP: {
    SMALL: 10,
    MEDIUM: 15,
    LARGE: 20,
  },
  
  // Animation durations (ms)
  ANIMATIONS: {
    FAST: 200,
    NORMAL: 300,
    SLOW: 500,
  },
  
  // Component dimensions
  DIMENSIONS: {
    BUTTON_HEIGHT: 48,
    BUTTON_MIN_WIDTH: 100,
    CARD_BORDER_RADIUS: 12,
    FILTER_BUTTON_HEIGHT: 48,
    FILTER_BUTTON_MIN_WIDTH: 100,
  },
  
  // API and cache settings
  API: {
    TIMEOUT: 8000,
    CACHE_TTL: 30 * 60 * 1000, // 30 minutes
    MAX_RETRIES: 3,
  },
  
  // Player and match constants
  MATCH: {
    UNKNOWN_PLAYER_ID: 376,
    PLAYER_NAME_FALLBACK: 'TBD',
    STATUS: {
      SCHEDULED: 0,
      RUNNING: 1,
      ON_BREAK: 2,
      FINISHED: 3,
    },
  },
  
  // Typography
  FONT: {
    SIZE: {
      SMALL: 12,
      MEDIUM: 14,
      LARGE: 16,
      XLARGE: 18,
      TITLE: 28,
    },
  },
  
  // Layout spacing
  SPACING: {
    XS: 4,
    SM: 8,
    MD: 16,
    LG: 24,
    XL: 32,
  },
} as const;

// Export specific sections for easier importing
export const TOUCH_SLOP = APP_CONSTANTS.TOUCH_SLOP;
export const ANIMATIONS = APP_CONSTANTS.ANIMATIONS;
export const DIMENSIONS = APP_CONSTANTS.DIMENSIONS;
export const MATCH_STATUS = APP_CONSTANTS.MATCH.STATUS;
export const MATCH_CONSTANTS = APP_CONSTANTS.MATCH;
export const FONT_SIZE = APP_CONSTANTS.FONT.SIZE;
export const SPACING = APP_CONSTANTS.SPACING;