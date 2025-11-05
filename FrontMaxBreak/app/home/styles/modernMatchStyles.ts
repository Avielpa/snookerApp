// app/home/styles/modernMatchStyles.ts
// COMPACT & COLORFUL - Small cards, white/orange text for background readability
// NO LOGIC CHANGES - ONLY VISUAL IMPROVEMENTS

import { StyleSheet } from 'react-native';

export const createModernMatchStyles = (COLORS: any) => StyleSheet.create({
    // STATUS HEADER - "Playing Now", "Upcoming", "Results"
    // Compact with white text
    statusHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,              // SMALLER (was 10)
        paddingHorizontal: 12,           // SMALLER (was 16)
        marginTop: 8,                    // SMALLER (was 14)
        marginBottom: 4,                 // SMALLER (was 8)
        marginHorizontal: 8,             // SMALLER (was 10)
        backgroundColor: '#1A733A',      // Snooker green
        borderRadius: 10,                // SMALLER (was 16)
        elevation: 2,
        shadowColor: '#1A733A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    statusHeaderText: {
        fontSize: 11,                    // SMALLER (was 14)
        fontFamily: 'PoppinsBold',
        color: '#FFFFFF',                // WHITE for readability
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    // ROUND HEADER - "Quarter-Finals", "Round 7"
    // Compact with white/orange text
    roundHeaderItem: {
        paddingVertical: 5,              // SMALLER (was 8)
        paddingHorizontal: 10,           // SMALLER (was 14)
        marginTop: 6,                    // SMALLER (was 12)
        marginBottom: 3,                 // SMALLER (was 6)
        marginHorizontal: 8,             // SMALLER (was 10)
        backgroundColor: 'rgba(255, 143, 0, 0.15)',  // Orange tint instead of green
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#FF8F00',      // Orange accent
    },
    roundHeaderText: {
        fontSize: 11,                    // SMALLER (was 13)
        fontFamily: 'PoppinsSemiBold',
        color: '#FFFFFF',                // WHITE text (not dark!)
        marginLeft: 5,
        letterSpacing: 0.4,
    },

    // MATCH CARD CONTAINER - MUCH smaller margins
    matchItemContainer: {
        marginVertical: 3,               // SMALLER (was 6)
        marginHorizontal: 8,             // SMALLER (was 10)
    },

    // PLAYER ROW - Compact
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,                 // SMALLER (was 10)
        marginTop: 2,                    // SMALLER (was 4)
        direction: 'ltr',                // FORCE LEFT-TO-RIGHT
    },

    // PLAYER NAMES - Clean, readable
    playerName: {
        fontSize: 13,
        fontFamily: 'PoppinsSemiBold',
        color: '#FFFFFF',
        flexShrink: 1,
        maxWidth: '70%',
    },

    // PLAYER SCORE - Bold and prominent, clearly separated
    playerScore: {
        fontSize: 18,
        fontFamily: 'PoppinsBold',
        color: '#FF8F00',
        minWidth: 28,
        textAlign: 'center',
    },

    // WINNER - BRIGHT ORANGE for both name and score
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: '#FF8F00',
    },

    // VS SEPARATOR - Small and subtle
    vsSeparator: {
        fontSize: 11,
        fontFamily: 'PoppinsSemiBold',
        color: 'rgba(255, 255, 255, 0.4)',
        marginHorizontal: 12,
    },

    // DETAILS ROW - Compact with subtle separator
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 6,                    // SMALLER (was 10)
        paddingTop: 6,                   // SMALLER (was 10)
        borderTopColor: 'rgba(255, 255, 255, 0.15)',  // White separator (not black!)
        borderTopWidth: 1,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingRight: 6,
    },

    // DETAIL TEXT - SMALLER, WHITE color (no grey!)
    detailText: {
        fontSize: 10,                    // SMALLER (was 11.5)
        fontFamily: 'PoppinsRegular',
        color: '#FFFFFF',                // WHITE (not grey!) for readability
        marginLeft: 4,
        flexShrink: 1,
        opacity: 0.8,                    // Slightly transparent for hierarchy
    },
});
