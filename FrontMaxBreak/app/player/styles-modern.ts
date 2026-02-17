// app/player/styles-modern.ts
// DARK, MODERN, PRACTICAL, COMFORTABLE PLAYER SCREEN
// ZERO LOGIC CHANGES - ONLY VISUAL IMPROVEMENTS
import { StyleSheet } from 'react-native';

export const createPlayerStyles = (COLORS: any) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
    },

    // HERO SECTION - DARK, COMPACT
    heroSection: {
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 143, 0, 0.2)',
    },
    heroContent: {
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 18,
        fontFamily: 'PoppinsBold',
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
        marginBottom: 4,
    },
    heroSubtitle: {
        fontSize: 11,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.65)',
        textAlign: 'center',
    },

    // TAB NAVIGATION - DARK, COMPACT
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 143, 0, 0.2)',
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 8,
        marginHorizontal: 3,
        borderRadius: 8,
        backgroundColor: 'transparent',
    },
    tabButtonActive: {
        backgroundColor: 'rgba(255, 143, 0, 0.25)',
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.5)',
    },
    tabText: {
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        color: 'rgba(255, 255, 255, 0.5)',
        marginLeft: 4,
    },
    tabTextActive: {
        color: '#FF8F00',
        fontFamily: 'PoppinsSemiBold',
    },

    // SCROLL CONTAINER
    scrollContainer: {
        flex: 1,
    },
    tabContent: {
        padding: 10,
    },

    // GLASS CARD - DARK, COMPACT
    glassCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.25)',
        padding: 10,
        marginBottom: 10,
    },

    // STATS GRID
    statsGrid: {
        flexDirection: 'row',
        marginBottom: 10,
        gap: 8,
    },

    // STAT CARD - DARK, COMPACT
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
    },
    statIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 143, 0, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    statContent: {
        flex: 1,
    },
    statTitle: {
        fontSize: 9,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.6)',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    statValue: {
        fontSize: 16,
        fontFamily: 'PoppinsBold',
        color: '#FF8F00',
        marginVertical: 1,
    },
    statSubtitle: {
        fontSize: 8,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.5)',
    },

    // INFO CARD
    infoCard: {
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 12,
        fontFamily: 'PoppinsSemiBold',
        color: 'rgba(255, 255, 255, 0.85)',
        marginBottom: 10,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 143, 0, 0.25)',
    },

    // INFO ROW - COMPACT
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 143, 0, 0.15)',
    },
    infoIconContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 143, 0, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 10,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 11,
        fontFamily: 'PoppinsMedium',
        color: 'rgba(255, 255, 255, 0.85)',
    },

    // ACHIEVEMENT CARD
    achievementCard: {
        marginBottom: 10,
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    achievementBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.3)',
    },
    badgeText: {
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        color: 'rgba(255, 255, 255, 0.7)',
        marginLeft: 5,
    },

    // TIMELINE CARD
    timelineCard: {
        marginBottom: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 10,
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FF8F00',
        marginRight: 10,
        marginTop: 3,
    },
    timelineContent: {
        flex: 1,
    },
    timelineYear: {
        fontSize: 11,
        fontFamily: 'PoppinsSemiBold',
        color: '#FF8F00',
    },
    timelineEvent: {
        fontSize: 10,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.7)',
        marginTop: 2,
    },

    // ERROR STATES - DARK, COMFORTABLE
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorTitle: {
        fontSize: 14,
        fontFamily: 'PoppinsSemiBold',
        color: 'rgba(255, 255, 255, 0.85)',
        textAlign: 'center',
        marginTop: 12,
        marginBottom: 6,
    },
    errorText: {
        fontSize: 11,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.65)',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 18,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 143, 0, 0.3)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.5)',
    },
    retryButtonText: {
        fontSize: 11,
        fontFamily: 'PoppinsSemiBold',
        color: '#FF8F00',
        marginLeft: 6,
    },

    // SKELETON STYLES - DARK VERSION
    skeletonCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.25)',
        padding: 10,
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    skeletonIcon: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        marginRight: 8,
    },
    skeletonContent: {
        flex: 1,
    },
    skeletonTitle: {
        height: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 5,
        marginBottom: 5,
        width: '60%',
    },
    skeletonValue: {
        height: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 5,
        width: '40%',
    },
    skeletonHeroTitle: {
        height: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 9,
        width: 160,
        marginBottom: 6,
    },
    skeletonHeroSubtitle: {
        height: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 5,
        width: 120,
    },
    skeletonTab: {
        flex: 1,
        height: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 14,
        marginHorizontal: 3,
    },
    skeletonInfoCard: {
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 143, 0, 0.25)',
        padding: 10,
        marginHorizontal: 10,
        marginTop: 10,
    },
    skeletonSectionTitle: {
        height: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 6,
        width: '50%',
        marginBottom: 10,
    },
    skeletonInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        marginBottom: 6,
    },
    skeletonInfoContent: {
        flex: 1,
    },
    skeletonInfoLabel: {
        height: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 5,
        width: '40%',
        marginBottom: 4,
    },
    skeletonInfoValue: {
        height: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 5,
        width: '60%',
    },

    // EMPTY STATES
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    emptyText: {
        fontSize: 13,
        fontFamily: 'PoppinsSemiBold',
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        marginTop: 10,
    },
    emptySubtext: {
        fontSize: 11,
        fontFamily: 'PoppinsRegular',
        color: 'rgba(255, 255, 255, 0.45)',
        textAlign: 'center',
        marginTop: 4,
    },
});
