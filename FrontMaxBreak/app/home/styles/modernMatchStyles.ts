// app/home/styles/modernMatchStyles.ts
// MODERN HOME SCREEN STYLES - Smaller, readable, snooker-themed
// NO LOGIC CHANGES - ONLY VISUAL IMPROVEMENTS

import { StyleSheet } from 'react-native';

export const createModernMatchStyles = (COLORS: any) => StyleSheet.create({
    // STATUS HEADER - "Playing Now", "Upcoming", "Results"
    // Made more attractive with snooker green accent
    statusHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,              // Reduced from 10 (smaller)
        paddingHorizontal: 12,           // Reduced from 14 (tighter)
        marginTop: 10,                   // Reduced from 12 (less space)
        marginBottom: 6,
        marginHorizontal: 12,            // Reduced from 14 (more screen space)
        backgroundColor: 'rgba(26, 115, 58, 0.12)',  // Snooker green tint
        borderRadius: 12,                // More rounded (modern)
        borderLeftWidth: 4,              // Thicker for emphasis
        borderLeftColor: '#1A733A',      // Snooker table green
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    statusHeaderText: {
        fontSize: 13,                    // Reduced from 14 (smaller)
        fontFamily: 'PoppinsBold',
        color: '#1A733A',                // Snooker green for headers
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.8,              // More spacing for readability
    },

    // ROUND HEADER - "Quarter-Finals", "Round 7"
    // Subtle but clear separation
    roundHeaderItem: {
        paddingVertical: 6,              // Slightly more padding
        paddingHorizontal: 12,           // Reduced from 14
        marginTop: 8,                    // Slightly more space
        marginBottom: 4,                 // Slightly more space
        marginHorizontal: 12,
        backgroundColor: 'rgba(218, 165, 32, 0.08)',  // Gold/yellow tint (snooker ball)
        borderRadius: 8,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(218, 165, 32, 0.5)',   // Gold accent
    },
    roundHeaderText: {
        fontSize: 12,                    // Reduced from 13 (smaller)
        fontFamily: 'PoppinsSemiBold',   // Changed from Medium to SemiBold (more readable)
        color: COLORS.textSecondary,
        marginLeft: 4,
        letterSpacing: 0.3,
        opacity: 0.9,
    },

    // MATCH CARD CONTAINER - Smaller with better spacing
    matchItemContainer: {
        marginVertical: 4,               // Slightly increased from 3 (breathing room)
        marginHorizontal: 12,            // Reduced from 14 (more screen space)
    },

    // PLAYER ROW - Cleaner, more readable
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,                 // Increased from 6 (better separation)
        marginTop: 4,                    // Increased from 2 (breathing room)
    },

    // PLAYER NAMES - Slightly smaller but VERY readable
    playerName: {
        fontSize: 13,                    // Reduced from 14 (smaller but still readable)
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textPrimary,
        flexShrink: 1,
        flexBasis: '40%',                // Slightly wider from 38% (more space for names)
        lineHeight: 17,                  // Reduced from 18 (tighter)
    },
    playerLeft: {
        textAlign: 'left',
        marginRight: 6
    },
    playerRight: {
        textAlign: 'right',
        marginLeft: 6,
    },

    // WINNER - Bright snooker green
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: '#1A733A',                // Snooker green instead of generic green
    },

    // SCORE - Clear and prominent
    score: {
        fontSize: 18,                    // Increased from 16 (more prominent)
        fontFamily: 'PoppinsBold',
        color: COLORS.score,
        textAlign: 'center',
        paddingHorizontal: 8,            // Increased from 6 (more breathing room)
        minWidth: 50,                    // Increased from 45 (better alignment)
    },

    // DETAILS ROW - Cleaner separator, smaller text
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,                    // Increased from 6 (more separation)
        paddingTop: 8,                   // Increased from 6 (clearer boundary)
        borderTopColor: 'rgba(218, 165, 32, 0.15)',  // Gold tint separator
        borderTopWidth: 1,               // Increased from 0.5 (more visible)
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingRight: 6,                 // Increased from 4 (better spacing)
    },

    // DETAIL TEXT - Smaller but very readable
    detailText: {
        fontSize: 11,                    // Reduced from 12 (smaller)
        fontFamily: 'PoppinsRegular',    // Changed from SemiBold (lighter weight)
        color: COLORS.textSecondary,     // Changed from textPrimary (softer)
        marginLeft: 4,
        flexShrink: 1,
        opacity: 0.85,                   // Reduced from 0.9 (softer)
    },
});
