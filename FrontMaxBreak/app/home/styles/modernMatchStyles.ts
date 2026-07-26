// app/home/styles/modernMatchStyles.ts
// Score-centered layout — NO LOGIC CHANGES

import { StyleSheet } from 'react-native';
import { FONT_SIZE_PRIMARY } from '../../../constants/typography';

export const createModernMatchStyles = (COLORS: any) => StyleSheet.create({
    // STATUS HEADER — tappable section label with count + chevron
    statusHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 16,
        marginTop: 8,
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
    statusHeaderCount: {
        backgroundColor: 'rgba(26, 115, 58, 0.3)',
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
    },
    statusHeaderCountText: {
        fontSize: 10,
        fontFamily: 'PoppinsBold',
        color: COLORS.textSecondary,
    },

    // ROUND HEADER — centered divider  ─── Final ───
    roundHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginTop: 5,
        marginBottom: 2,
    },
    roundHeaderLine: {
        flex: 1,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(26, 115, 58, 0.35)',
    },
    roundHeaderText: {
        fontSize: 9,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textMuted,
        letterSpacing: 1.5,
        marginHorizontal: 10,
        textTransform: 'uppercase',
    },

    // MATCH CARD CONTAINER — generous bottom margin so cards have room to
    // breathe in the list instead of feeling stacked on top of each other.
    matchItemContainer: {
        marginTop: 2,
        marginBottom: 14,
        marginHorizontal: 8,
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
        marginBottom: 4,
        marginTop: 2,
        direction: 'ltr',
    },
    playerName: {
        flex: 1,
        fontSize: FONT_SIZE_PRIMARY,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textPrimary,
        flexShrink: 1,
        textAlign: 'center',
        paddingHorizontal: 6,
    },

    // CENTER SCORE CONTAINER
    centerScore: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        minWidth: 76,
    },

    // INDIVIDUAL SCORE NUMBERS — big and bold, the loudest thing on the card
    scoreNumber: {
        fontSize: 24,
        fontFamily: 'PoppinsBold',
        fontWeight: '900',
        color: '#FFB74D',
        minWidth: 24,
        textAlign: 'center',
    },

    // SCORE DASH / VS separator
    scoreDash: {
        fontSize: 15,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textMuted,
        marginHorizontal: 7,
    },

    // Prominent centered time/date shown instead of a score for upcoming
    // matches (0-0 would be meaningless) — muted vs the gold live/final score.
    upcomingTimeText: {
        fontSize: 13,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 17,
    },

    // WINNER — bright amber for both name and score
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: '#FFB74D',
    },
    winnerScore: {
        color: '#FFB74D',
    },

    // LOSER (finished matches only) — dimmed for immediate visual hierarchy
    // against the bolded winner.
    loserText: {
        opacity: 0.5,
    },

    // Whole-card treatment for finished matches — applied via the
    // ModernGlassCard `style` prop so it dims gradient + border + content
    // together, reading instantly as "past".
    finishedCard: {
        opacity: 0.6,
    },

    // Small "LIVE"/"BREAK" micro-badge, footer row (bottom-right) — avoids
    // the dead space a dedicated top row created above the player names.
    liveBadgeFooter: {
        marginRight: 8,
    },

    // Crisp "FT" (Full Time) badge for finished matches, in the footer row.
    ftBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 2,
        marginRight: 8,
    },
    ftBadgeText: {
        fontSize: 10,
        fontFamily: 'PoppinsBold',
        color: COLORS.textSecondary,
        letterSpacing: 0.5,
    },

    // DETAILS ROW — compact footer
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        paddingTop: 3,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
