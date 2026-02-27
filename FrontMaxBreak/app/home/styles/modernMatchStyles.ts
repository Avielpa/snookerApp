// app/home/styles/modernMatchStyles.ts
// Score-centered layout — NO LOGIC CHANGES

import { StyleSheet } from 'react-native';

export const createModernMatchStyles = (COLORS: any) => StyleSheet.create({
    // STATUS HEADER — subtle section label, not a big pill
    statusHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 12,
        marginBottom: 2,
        borderLeftWidth: 3,
        borderLeftColor: '#1A733A',
        marginHorizontal: 8,
    },
    statusHeaderText: {
        fontSize: 11,
        fontFamily: 'PoppinsBold',
        color: COLORS.textSecondary,
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },

    // ROUND HEADER — minimal divider
    roundHeaderItem: {
        paddingVertical: 4,
        paddingHorizontal: 16,
        marginTop: 4,
        marginBottom: 2,
        marginHorizontal: 8,
    },
    roundHeaderText: {
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textMuted,
        letterSpacing: 0.4,
    },

    // MATCH CARD CONTAINER
    matchItemContainer: {
        marginVertical: 4,
        marginHorizontal: 8,
    },

    // BADGE ROW — live/break badge at top of card
    badgeRow: {
        alignItems: 'flex-start',
        marginBottom: 8,
    },

    // SCORE ROW — player name | center score | player name
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    // PLAYER NAMES — flex 1 to take available space
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
        marginTop: 2,
        direction: 'ltr',
    },
    playerName: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textPrimary,
        flexShrink: 1,
    },

    // CENTER SCORE CONTAINER
    centerScore: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        minWidth: 90,
    },

    // INDIVIDUAL SCORE NUMBERS — big and bold
    scoreNumber: {
        fontSize: 24,
        fontFamily: 'PoppinsBold',
        color: '#FFB74D',
        minWidth: 28,
        textAlign: 'center',
    },

    // PLAYER SCORE — kept for compatibility (not used in new layout)
    playerScore: {
        fontSize: 22,
        fontFamily: 'PoppinsBold',
        color: '#FF8F00',
        minWidth: 28,
        textAlign: 'center',
    },

    // SCORE DASH / VS separator
    scoreDash: {
        fontSize: 16,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textMuted,
        marginHorizontal: 6,
    },

    // VS SEPARATOR — kept for compatibility
    vsSeparator: {
        fontSize: 11,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textMuted,
        marginHorizontal: 12,
    },

    // WINNER — bright amber for both name and score
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: '#FFB74D',
    },
    winnerScore: {
        color: '#FFB74D',
    },

    // DETAILS ROW — compact footer
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingTop: 6,
        borderTopColor: 'rgba(26, 115, 58, 0.25)',
        borderTopWidth: 1,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingRight: 6,
    },
    detailText: {
        fontSize: 10,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textSecondary,
        marginLeft: 4,
        flexShrink: 1,
        opacity: 0.8,
    },
});
