// constants/modernPolish.ts
// Final Polish - Apply modern design to remaining screens
// This file provides ready-to-use style improvements for home, tournament, and ranking screens

import { ModernDesign } from './modernDesign';

/**
 * HOME SCREEN POLISH
 * Improvements: Slightly smaller cards, better spacing, softer colors
 */
export const HomeScreenPolish = {
  // Reduce card size by 10%
  matchCard: {
    paddingReduction: 2,  // Reduce padding from 16 to 14
    marginReduction: 2,   // Reduce margin slightly
  },

  // Better filter button spacing
  filterButton: {
    paddingVertical: ModernDesign.spacing.sm,      // 8px (was inconsistent)
    paddingHorizontal: ModernDesign.spacing.sm,    // 8px
    marginRight: ModernDesign.spacing.xs,          // 8px
    borderRadius: 12,                              // Consistent
  },

  // Softer colors (reduce saturation)
  colors: {
    liveReduceSaturation: 0.9,     // Slightly less bright red
    upcomingReduceSaturation: 0.9, // Slightly less bright green
  },
};

/**
 * TOURNAMENT SCREEN POLISH
 * Improvements: Collapsible info, grouped matches, cleaner cards
 */
export const TournamentScreenPolish = {
  // Tournament header
  header: {
    paddingVertical: ModernDesign.spacing.md,
    paddingHorizontal: ModernDesign.spacing.md,
    backgroundColor: 'transparent',
  },

  // Tournament info (collapsible)
  infoSection: {
    ...ModernDesign.cards.compact,
    marginBottom: ModernDesign.spacing.sm,
  },

  // Match grouping headers
  groupHeader: {
    ...ModernDesign.typography.heading,
    paddingVertical: ModernDesign.spacing.sm,
    paddingHorizontal: ModernDesign.spacing.md,
    backgroundColor: 'transparent',
  },

  // Match cards in tournament
  matchCard: {
    ...ModernDesign.cards.compact,
    marginBottom: ModernDesign.spacing.xs,  // Closer together
  },
};

/**
 * RANKING SCREEN POLISH
 * Improvements: Table format, flags, abbreviated numbers
 */
export const RankingScreenPolish = {
  // Ranking row (table-like)
  rankingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: ModernDesign.spacing.sm,
    paddingHorizontal: ModernDesign.spacing.md,
    borderBottomWidth: 1,
  },

  // Rank number (left)
  rankNumber: {
    ...ModernDesign.typography.bodyBold,
    width: 40,
    textAlign: 'left' as const,
  },

  // Player name (center, flex)
  playerName: {
    ...ModernDesign.typography.body,
    flex: 1,
    marginLeft: ModernDesign.spacing.sm,
  },

  // Points (right, bold)
  points: {
    ...ModernDesign.typography.bodyBold,
    width: 80,
    textAlign: 'right' as const,
  },

  // Flag emoji size
  flag: {
    fontSize: 20,
    marginRight: ModernDesign.spacing.xs,
  },
};

/**
 * GLOBAL POLISH SETTINGS
 * Apply these across all screens for consistency
 */
export const GlobalPolish = {
  // Reduce card elevation slightly (softer shadows)
  cardElevation: 2,  // Was 3 in many places

  // Consistent border radius
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
    xlarge: 20,
  },

  // Consistent spacing between sections
  sectionSpacing: ModernDesign.spacing.lg,  // 24px

  // Consistent card spacing
  cardSpacing: ModernDesign.spacing.sm,     // 12px

  // Consistent icon sizes
  iconSizes: {
    small: 16,
    medium: 20,
    large: 24,
    xlarge: 32,
  },

  // Pull to refresh tint (matches brand)
  refreshTintColor: '#FF8F00',

  // Loading indicator size
  loadingSize: 'large' as const,
};

/**
 * ANIMATION IMPROVEMENTS
 * Smooth transitions for better feel
 */
export const AnimationPolish = {
  // Card press animation
  cardPress: {
    activeOpacity: 0.7,
    scaleDown: 0.98,
  },

  // Filter button animation
  filterPress: {
    activeOpacity: 0.8,
  },

  // Tab switch animation
  tabSwitch: {
    duration: ModernDesign.animations.duration.fast,
  },

  // Pull to refresh
  refreshControl: {
    tintColor: '#FF8F00',
    colors: ['#FF8F00'],
  },
};

/**
 * TYPOGRAPHY IMPROVEMENTS
 * Better text hierarchy across all screens
 */
export const TypographyPolish = {
  // Screen titles
  screenTitle: {
    ...ModernDesign.typography.title,
    marginBottom: ModernDesign.spacing.md,
  },

  // Section headers
  sectionHeader: {
    ...ModernDesign.typography.heading,
    marginTop: ModernDesign.spacing.lg,
    marginBottom: ModernDesign.spacing.sm,
  },

  // Card titles
  cardTitle: {
    ...ModernDesign.typography.bodyBold,
    marginBottom: ModernDesign.spacing.xs,
  },

  // Card subtitles
  cardSubtitle: {
    ...ModernDesign.typography.caption,
  },

  // Labels
  label: {
    ...ModernDesign.typography.label,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
};

/**
 * COLOR ADJUSTMENTS
 * Softer, more professional colors
 */
export const ColorPolish = {
  // Reduce opacity for backgrounds
  backgroundOverlay: 'rgba(0, 0, 0, 0.5)',   // Softer overlay
  cardBackground: 'rgba(255, 255, 255, 0.95)',  // Slightly transparent

  // Status colors (slightly muted)
  status: {
    live: 'rgba(255, 59, 48, 0.9)',      // 90% opacity
    upcoming: 'rgba(52, 199, 89, 0.9)',  // 90% opacity
    finished: 'rgba(142, 142, 147, 0.9)', // 90% opacity
  },

  // Border colors (subtle)
  border: {
    light: 'rgba(0, 0, 0, 0.08)',
    medium: 'rgba(0, 0, 0, 0.12)',
    dark: 'rgba(0, 0, 0, 0.16)',
  },
};

/**
 * HELPER: Apply polish to existing styles
 * Use this to quickly upgrade any component
 */
export const applyPolish = (baseStyles: any, colors: any) => {
  return {
    ...baseStyles,

    // If it has cards, reduce elevation
    ...(baseStyles.card && {
      card: {
        ...baseStyles.card,
        elevation: GlobalPolish.cardElevation,
        shadowOpacity: 0.08,
      },
    }),

    // If it has spacing, use consistent values
    ...(baseStyles.container && {
      container: {
        ...baseStyles.container,
        paddingHorizontal: ModernDesign.spacing.md,
      },
    }),
  };
};

export default {
  home: HomeScreenPolish,
  tournament: TournamentScreenPolish,
  ranking: RankingScreenPolish,
  global: GlobalPolish,
  animation: AnimationPolish,
  typography: TypographyPolish,
  color: ColorPolish,
  applyPolish,
};
