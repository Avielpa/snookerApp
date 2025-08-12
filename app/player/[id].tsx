// app/player/[id].tsx - Modern Player Profile with Tabs
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getPlayerDetails } from '../../services/matchServices';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { logger } from '../../utils/logger';
import { useColors } from '../../contexts/ThemeContext';


// Enhanced interfaces
interface PlayerData {
    ID: number;
    FirstName?: string | null;
    MiddleName?: string | null;
    LastName?: string | null;
    ShortName?: string | null;
    Nationality?: string | null;
    Sex?: string | null;
    Born?: string | null;
    FirstSeasonAsPro?: number | null;
    LastSeasonAsPro?: number | null;
    NumRankingTitles?: number | null;
    NumMaximums?: number | null;
}

interface TabConfig {
    id: string;
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
}

// Dynamic color scheme hook
const usePlayerColors = () => {
    const colors = useColors();
    return {
        background: colors.background,
        cardBackground: colors.cardBackground,
        cardBorder: colors.cardBorder,
        primary: colors.primary,
        primaryDark: colors.primaryDark,
        secondary: colors.secondary,
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        textMuted: colors.textMuted,
        success: colors.success,
        error: colors.error,
        skeleton: colors.skeleton,
        tabBackground: colors.tabBackground,
        tabActive: colors.tabActive,
        tabInactive: colors.tabInactive,
    };
};

// Tab configuration
const TABS: TabConfig[] = [
    { id: 'overview', title: 'Overview', icon: 'person-outline' },
    { id: 'stats', title: 'Statistics', icon: 'stats-chart-outline' },
    { id: 'career', title: 'Career', icon: 'trophy-outline' },
];

// Modern components









export default function PlayerDetailsScreen(): React.ReactElement {
    const params = useLocalSearchParams<{ id: string }>();
    const playerId = useMemo(() => {
        const id = params.id ? parseInt(params.id, 10) : NaN;
        return !isNaN(id) ? id : null;
    }, [params.id]);

    const [player, setPlayer] = useState<PlayerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<string>('overview');
    const COLORS = usePlayerColors();

    // Create styles with dynamic colors
    const styles = createPlayerStyles(COLORS);

    // Modern components
    const GlassCard = ({ children, style }: { children: React.ReactNode; style?: any }) => (
        <View style={[styles.glassCard, style]}>
            {children}
        </View>
    );

    const StatCard = ({ icon, title, value, subtitle }: { 
        icon: keyof typeof Ionicons.glyphMap; 
        title: string; 
        value: string | number; 
        subtitle?: string;
    }) => (
        <GlassCard style={styles.statCard}>
            <View style={styles.statIconContainer}>
                <Ionicons name={icon} size={24} color={COLORS.primary} />
            </View>
            <View style={styles.statContent}>
                <Text style={styles.statTitle}>{title}</Text>
                <Text style={styles.statValue}>{value}</Text>
                {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
            </View>
        </GlassCard>
    );

    const InfoRow = ({ icon, label, value }: { 
        icon: keyof typeof Ionicons.glyphMap; 
        label: string; 
        value: string; 
    }) => (
        <View style={styles.infoRow}>
            <View style={styles.infoIconContainer}>
                <Ionicons name={icon} size={20} color={COLORS.secondary} />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );

    const SkeletonCard = () => (
        <View style={styles.skeletonCard}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonContent}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonValue} />
            </View>
        </View>
    );

    const TabButton = ({ 
        tab, 
        isActive, 
        onPress 
    }: { 
        tab: TabConfig; 
        isActive: boolean; 
        onPress: () => void; 
    }) => (
        <TouchableOpacity 
            style={[styles.tabButton, isActive && styles.tabButtonActive]} 
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Ionicons 
                name={tab.icon} 
                size={20} 
                color={isActive ? COLORS.tabActive : COLORS.tabInactive} 
            />
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.title}
            </Text>
        </TouchableOpacity>
    );

    // Helper functions
    const formatPlayerName = (playerData: PlayerData | null): string => {
        if (!playerData) return 'Unknown Player';
        const fullName = `${playerData.FirstName || ''} ${playerData.LastName || ''}`.trim();
        return fullName || playerData.ShortName || `Player ${playerData.ID}`;
    };

    const formatValue = (value: any, type?: string): string => {
        if (value === null || value === undefined || value === '') return 'N/A';
        
        if (type === 'date' && typeof value === 'string') {
            try {
                const date = new Date(value);
                return date.toLocaleDateString('en-GB', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            } catch {
                return 'Unknown Date';
            }
        }
        
        if (type === 'nationality') {
            // Add flag emoji mapping if needed
            return value;
        }
        
        return String(value);
    };

    // Data fetching
    const fetchPlayerData = useCallback(async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        setRefreshing(isRefresh);
        setError(null);

        if (playerId === null) {
            setError("Player ID is missing or invalid.");
            setLoading(false);
            setRefreshing(false);
            return;
        }

        try {
            logger.log(`[PlayerProfile] Fetching data for player ${playerId}`);
            const playerData = await getPlayerDetails(playerId) as PlayerData | null;
            
            if (playerData && typeof playerData === 'object' && playerData.ID === playerId) {
                setPlayer(playerData);
                setError(null);
                logger.log(`[PlayerProfile] Successfully loaded player data`);
            } else {
                setError(`Player details could not be retrieved for ID: ${playerId}.`);
                setPlayer(null);
            }
        } catch (err: any) {
            logger.error(`[PlayerProfile] Error loading player ${playerId}:`, err);
            setError(err.message || 'Failed to load player details.');
            setPlayer(null);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [playerId]);

    useEffect(() => {
        fetchPlayerData();
    }, [fetchPlayerData]);

    // Tab content renderers
    const renderOverviewContent = () => (
        <View style={styles.tabContent}>
            {/* Player Info Cards */}
            <View style={styles.statsGrid}>
                <StatCard
                    icon="trophy-outline"
                    title="Ranking Titles"
                    value={player?.NumRankingTitles || 0}
                />
                <StatCard
                    icon="flash-outline"
                    title="Maximum Breaks"
                    value={player?.NumMaximums || 0}
                    subtitle="147 breaks"
                />
            </View>

            {/* Personal Information */}
            <GlassCard style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <InfoRow
                    icon="flag-outline"
                    label="Nationality"
                    value={formatValue(player?.Nationality, 'nationality')}
                />
                <InfoRow
                    icon="calendar-outline"
                    label="Date of Birth"
                    value={formatValue(player?.Born, 'date')}
                />
                <InfoRow
                    icon="male-female-outline"
                    label="Gender"
                    value={player?.Sex === 'M' ? 'Male' : player?.Sex === 'F' ? 'Female' : 'Not specified'}
                />
            </GlassCard>
        </View>
    );

    const renderStatsContent = () => (
        <View style={styles.tabContent}>
            <GlassCard style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Career Statistics</Text>
                <InfoRow
                    icon="trophy-outline"
                    label="Ranking Titles Won"
                    value={String(player?.NumRankingTitles || 0)}
                />
                <InfoRow
                    icon="flash-outline"
                    label="Maximum Breaks (147s)"
                    value={String(player?.NumMaximums || 0)}
                />
                <InfoRow
                    icon="trending-up-outline"
                    label="First Season as Pro"
                    value={formatValue(player?.FirstSeasonAsPro)}
                />
                <InfoRow
                    icon="trending-down-outline"
                    label="Last Season as Pro"
                    value={formatValue(player?.LastSeasonAsPro) || 'Current'}
                />
            </GlassCard>

            {/* Achievement Badges */}
            <GlassCard style={styles.achievementCard}>
                <Text style={styles.sectionTitle}>Achievements</Text>
                <View style={styles.badgeContainer}>
                    {(player?.NumRankingTitles || 0) > 0 && (
                        <View style={styles.achievementBadge}>
                            <Ionicons name="trophy" size={20} color={COLORS.success} />
                            <Text style={styles.badgeText}>Title Winner</Text>
                        </View>
                    )}
                    {(player?.NumMaximums || 0) > 0 && (
                        <View style={styles.achievementBadge}>
                            <Ionicons name="flash" size={20} color={COLORS.primary} />
                            <Text style={styles.badgeText}>Maximum Break</Text>
                        </View>
                    )}
                    {player?.FirstSeasonAsPro && (
                        <View style={styles.achievementBadge}>
                            <Ionicons name="star" size={20} color={COLORS.secondary} />
                            <Text style={styles.badgeText}>Professional</Text>
                        </View>
                    )}
                </View>
            </GlassCard>
        </View>
    );

    const renderCareerContent = () => (
        <View style={styles.tabContent}>
            <GlassCard style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Professional Career</Text>
                <InfoRow
                    icon="play-circle-outline"
                    label="Career Start"
                    value={player?.FirstSeasonAsPro ? `${player.FirstSeasonAsPro} Season` : 'Not specified'}
                />
                <InfoRow
                    icon="pause-circle-outline"
                    label="Career Status"
                    value={player?.LastSeasonAsPro ? `Retired ${player.LastSeasonAsPro}` : 'Active Professional'}
                />
                <InfoRow
                    icon="time-outline"
                    label="Career Duration"
                    value={
                        player?.FirstSeasonAsPro 
                            ? `${((player?.LastSeasonAsPro || new Date().getFullYear()) - player.FirstSeasonAsPro + 1)} seasons`
                            : 'N/A'
                    }
                />
            </GlassCard>

            {/* Career Timeline placeholder */}
            <GlassCard style={styles.timelineCard}>
                <Text style={styles.sectionTitle}>Career Timeline</Text>
                <View style={styles.timelineItem}>
                    <View style={styles.timelineDot} />
                    <View style={styles.timelineContent}>
                        <Text style={styles.timelineYear}>{player?.FirstSeasonAsPro || 'Unknown'}</Text>
                        <Text style={styles.timelineEvent}>Turned Professional</Text>
                    </View>
                </View>
                {(player?.NumRankingTitles || 0) > 0 && (
                    <View style={styles.timelineItem}>
                        <View style={[styles.timelineDot, { backgroundColor: COLORS.success }]} />
                        <View style={styles.timelineContent}>
                            <Text style={styles.timelineYear}>Career</Text>
                            <Text style={styles.timelineEvent}>{player?.NumRankingTitles} Ranking Title{(player?.NumRankingTitles || 0) > 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                )}
            </GlassCard>
        </View>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverviewContent();
            case 'stats':
                return renderStatsContent();
            case 'career':
                return renderCareerContent();
            default:
                return renderOverviewContent();
        }
    };

    // Main content based on state
    let content;

    if (error) {
        content = (
            <View style={styles.centerContent}>
                <Ionicons name="alert-circle-outline" size={64} color={COLORS.error} />
                <Text style={styles.errorTitle}>Unable to Load Player</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity onPress={() => fetchPlayerData()} style={styles.retryButton}>
                    <Ionicons name="refresh-outline" size={20} color={COLORS.textPrimary} />
                    <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>
            </View>
        );
    } else if (loading && !player) {
        content = (
            <View style={styles.container}>
                {/* Hero Section Skeleton */}
                <LinearGradient
                    colors={[COLORS.primary + '30', COLORS.background]}
                    style={styles.heroSection}
                >
                    <View style={styles.heroContent}>
                        <View style={styles.skeletonHeroTitle} />
                        <View style={styles.skeletonHeroSubtitle} />
                    </View>
                </LinearGradient>

                {/* Tabs Skeleton */}
                <View style={styles.tabContainer}>
                    {TABS.map((_, index) => (
                        <View key={index} style={styles.skeletonTab} />
                    ))}
                </View>

                {/* Content Skeleton */}
                <ScrollView style={styles.scrollContainer}>
                    <View style={styles.statsGrid}>
                        <SkeletonCard />
                        <SkeletonCard />
                    </View>
                    <View style={styles.skeletonInfoCard}>
                        <View style={styles.skeletonSectionTitle} />
                        {Array.from({ length: 3 }).map((_, index) => (
                            <View key={index} style={styles.skeletonInfoRow}>
                                <View style={styles.skeletonIcon} />
                                <View style={styles.skeletonInfoContent}>
                                    <View style={styles.skeletonInfoLabel} />
                                    <View style={styles.skeletonInfoValue} />
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
        );
    } else if (player) {
        content = (
            <View style={styles.container}>
                {/* Hero Section */}
                <LinearGradient
                    colors={[COLORS.primary + '30', COLORS.background]}
                    style={styles.heroSection}
                >
                    <View style={styles.heroContent}>
                        <Text style={styles.heroTitle}>{formatPlayerName(player)}</Text>
                        <Text style={styles.heroSubtitle}>
                            {player.Nationality && `${player.Nationality} • `}
                            Professional Snooker Player
                        </Text>
                    </View>
                </LinearGradient>

                {/* Tab Navigation */}
                <View style={styles.tabContainer}>
                    {TABS.map((tab) => (
                        <TabButton
                            key={tab.id}
                            tab={tab}
                            isActive={activeTab === tab.id}
                            onPress={() => setActiveTab(tab.id)}
                        />
                    ))}
                </View>

                {/* Tab Content */}
                <ScrollView 
                    style={styles.scrollContainer}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => fetchPlayerData(true)}
                            tintColor={COLORS.primary}
                            colors={[COLORS.primary]}
                        />
                    }
                >
                    {renderTabContent()}
                </ScrollView>
            </View>
        );
    }

    const headerTitle = player ? formatPlayerName(player) : (loading ? 'Loading...' : 'Player Details');

    return (
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: headerTitle,
                    headerStyle: { backgroundColor: COLORS.background },
                    headerTintColor: COLORS.primary,
                    headerTitleStyle: { 
                        color: COLORS.primary, 
                        fontFamily: 'PoppinsSemiBold',
                        fontSize: 18,
                    },
                    headerBackTitle: '',
                }}
            />
            {content}
        </SafeAreaView>
    );
}

// Dynamic styles function
const createPlayerStyles = (COLORS: any) => StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    container: {
        flex: 1,
    },
    heroSection: {
        paddingHorizontal: 20,
        paddingVertical: 24,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    heroContent: {
        alignItems: 'center',
    },
    heroTitle: {
        fontSize: 28,
        fontFamily: 'PoppinsBold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginBottom: 8,
        textShadowColor: 'rgba(255, 167, 38, 0.3)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 4,
    },
    heroSubtitle: {
        fontSize: 16,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.tabBackground,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    tabButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginHorizontal: 4,
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
    tabButtonActive: {
        backgroundColor: COLORS.cardBackground,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    tabText: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        color: COLORS.tabInactive,
        marginLeft: 6,
    },
    tabTextActive: {
        color: COLORS.tabActive,
        fontFamily: 'PoppinsBold',
    },
    scrollContainer: {
        flex: 1,
    },
    tabContent: {
        padding: 16,
    },
    glassCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    statsGrid: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    statIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: COLORS.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    statContent: {
        flex: 1,
    },
    statTitle: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 24,
        fontFamily: 'PoppinsBold',
        color: COLORS.textPrimary,
        marginVertical: 2,
    },
    statSubtitle: {
        fontSize: 11,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textMuted,
    },
    infoCard: {
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontFamily: 'PoppinsBold',
        color: COLORS.textPrimary,
        marginBottom: 16,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.cardBorder + '50',
    },
    infoIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.secondary + '20',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textSecondary,
        marginBottom: 2,
    },
    infoValue: {
        fontSize: 16,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textPrimary,
    },
    achievementCard: {
        marginBottom: 16,
    },
    badgeContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    achievementBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.cardBackground,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
    },
    badgeText: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textSecondary,
        marginLeft: 6,
    },
    timelineCard: {
        marginBottom: 16,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: COLORS.primary,
        marginRight: 12,
        marginTop: 4,
    },
    timelineContent: {
        flex: 1,
    },
    timelineYear: {
        fontSize: 14,
        fontFamily: 'PoppinsBold',
        color: COLORS.primary,
    },
    timelineEvent: {
        fontSize: 14,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    errorTitle: {
        fontSize: 20,
        fontFamily: 'PoppinsBold',
        color: COLORS.textPrimary,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 8,
    },
    errorText: {
        fontSize: 16,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
    },
    retryButtonText: {
        fontSize: 16,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textPrimary,
        marginLeft: 8,
    },
    // Skeleton styles
    skeletonCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    skeletonIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: COLORS.skeleton,
        marginRight: 12,
    },
    skeletonContent: {
        flex: 1,
    },
    skeletonTitle: {
        height: 12,
        backgroundColor: COLORS.skeleton,
        borderRadius: 6,
        marginBottom: 6,
        width: '60%',
    },
    skeletonValue: {
        height: 20,
        backgroundColor: COLORS.skeleton,
        borderRadius: 6,
        width: '40%',
    },
    skeletonHeroTitle: {
        height: 28,
        backgroundColor: COLORS.skeleton,
        borderRadius: 14,
        width: 200,
        marginBottom: 8,
    },
    skeletonHeroSubtitle: {
        height: 16,
        backgroundColor: COLORS.skeleton,
        borderRadius: 8,
        width: 150,
    },
    skeletonTab: {
        flex: 1,
        height: 36,
        backgroundColor: COLORS.skeleton,
        borderRadius: 18,
        marginHorizontal: 4,
    },
    skeletonInfoCard: {
        backgroundColor: COLORS.cardBackground,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        padding: 20,
        marginHorizontal: 16,
        marginTop: 16,
    },
    skeletonSectionTitle: {
        height: 18,
        backgroundColor: COLORS.skeleton,
        borderRadius: 9,
        width: '50%',
        marginBottom: 16,
    },
    skeletonInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 8,
    },
    skeletonInfoContent: {
        flex: 1,
    },
    skeletonInfoLabel: {
        height: 14,
        backgroundColor: COLORS.skeleton,
        borderRadius: 7,
        width: '40%',
        marginBottom: 6,
    },
    skeletonInfoValue: {
        height: 16,
        backgroundColor: COLORS.skeleton,
        borderRadius: 8,
        width: '60%',
    },
});