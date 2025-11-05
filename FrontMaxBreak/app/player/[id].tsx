// app/player/[id].tsx - Modern Player Profile with Tabs
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { getPlayerDetails, getPlayerMatchHistory, PlayerMatchHistoryItem, PlayerMatchHistoryResponse } from '../../services/matchServices';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { logger } from '../../utils/logger';
import { useColors } from '../../contexts/ThemeContext';
import { createPlayerStyles } from './styles-modern';


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
    current_ranking_position?: number | null;
    prize_money_this_year?: number | null;
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
    { id: 'matches', title: 'Matches', icon: 'tennisball-outline' },
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
    const [matches, setMatches] = useState<PlayerMatchHistoryItem[]>([]);
    const [matchesLoading, setMatchesLoading] = useState(false);
    const [matchesError, setMatchesError] = useState<string | null>(null);
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

    // Fetch player match history
    const fetchPlayerMatches = useCallback(async () => {
        if (!playerId) return;

        setMatchesLoading(true);
        setMatchesError(null);

        // Add a safety timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            logger.error(`[PlayerProfile] Match history fetch timed out for player ${playerId}`);
            setMatchesLoading(false);
            setMatchesError('Request timed out. Please check your connection and try again.');
            setMatches([]);
        }, 35000); // 35 second timeout (slightly longer than API timeout)

        try {
            logger.log(`[PlayerProfile] Fetching match history for player ${playerId}`);
            const matchData = await getPlayerMatchHistory(playerId, 20);

            clearTimeout(timeoutId); // Clear timeout if request completes

            // matchData will always be an object with matches array, never null
            if (matchData && matchData.matches && Array.isArray(matchData.matches)) {
                setMatches(matchData.matches);
                setMatchesError(null);
                logger.log(`[PlayerProfile] Successfully loaded ${matchData.matches.length} matches`);
            } else {
                // Fallback to empty if something unexpected happens
                logger.warn(`[PlayerProfile] Unexpected match data format for player ${playerId}`);
                setMatches([]);
                setMatchesError(null);
            }
        } catch (err: any) {
            // This should rarely happen now since getPlayerMatchHistory handles errors
            clearTimeout(timeoutId);
            logger.error(`[PlayerProfile] Unexpected error loading matches for player ${playerId}:`, err);
            setMatches([]);
            setMatchesError(null); // Don't show error, just show empty state
        } finally {
            setMatchesLoading(false);
        }
    }, [playerId]);

    // Fetch matches when matches tab is active
    useEffect(() => {
        if (activeTab === 'matches' && matches.length === 0 && !matchesLoading) {
            fetchPlayerMatches();
        }
    }, [activeTab, fetchPlayerMatches, matches.length, matchesLoading]);

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

            {/* Ranking & Money Cards */}
            <View style={styles.statsGrid}>
                <StatCard
                    icon="podium-outline"
                    title="World Ranking"
                    value={player?.current_ranking_position ? `#${player.current_ranking_position}` : 'N/A'}
                    subtitle="Current season"
                />
                <StatCard
                    icon="cash-outline"
                    title="Prize Money"
                    value={player?.prize_money_this_year ? `£${(player.prize_money_this_year / 1000).toFixed(0)}k` : 'N/A'}
                    subtitle="This season"
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

    const renderMatchesContent = () => (
        <View style={styles.tabContent}>
            {matchesLoading ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>Loading matches...</Text>
                </View>
            ) : matchesError ? (
                <View style={styles.emptyState}>
                    <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
                    <Text style={styles.emptyText}>Failed to load matches</Text>
                    <Text style={styles.emptySubtext}>{matchesError}</Text>
                    <TouchableOpacity
                        onPress={() => fetchPlayerMatches()}
                        style={{ marginTop: 12, padding: 8, backgroundColor: COLORS.primary, borderRadius: 8 }}
                    >
                        <Text style={{ color: COLORS.textPrimary }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : matches.length === 0 ? (
                <View style={styles.emptyState}>
                    <Ionicons name="calendar-outline" size={40} color="rgba(255, 255, 255, 0.5)" />
                    <Text style={styles.emptyText}>No recent matches found</Text>
                    <Text style={styles.emptySubtext}>Match history will appear here</Text>
                </View>
            ) : (
                // Sort matches: Live/On Break first, then by date
                [...matches].sort((a, b) => {
                    // Live (1) and On Break (2) matches first
                    if ((a.status === 1 || a.status === 2) && b.status !== 1 && b.status !== 2) return -1;
                    if ((b.status === 1 || b.status === 2) && a.status !== 1 && a.status !== 2) return 1;

                    // Then sort by date (newest first)
                    const dateA = a.scheduled_date || a.start_date || '';
                    const dateB = b.scheduled_date || b.start_date || '';
                    return dateB.localeCompare(dateA);
                }).map((match, index) => {
                    const isPlayerOne = match.player1_id === playerId;
                    const playerScore = isPlayerOne ? match.score1 : match.score2;
                    const opponentScore = isPlayerOne ? match.score2 : match.score1;
                    const opponentName = isPlayerOne ? match.player2_name : match.player1_name;
                    const isWinner = match.winner_id === playerId;
                    const isFinished = match.status === 3;
                    const isLive = match.status === 1 || match.status === 2;

                    return (
                        <GlassCard key={`${match.api_match_id}-${index}`} style={{
                            marginBottom: 12,
                            borderLeftWidth: isLive ? 3 : 0,
                            borderLeftColor: isLive ? '#FF3B30' : 'transparent'
                        }}>
                            {/* Event Name with Live Badge */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                {isLive && (
                                    <View style={{
                                        backgroundColor: '#FF3B30',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        marginRight: 8
                                    }}>
                                        <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>LIVE</Text>
                                    </View>
                                )}
                                <Text style={[styles.sectionTitle, { fontSize: 12, marginBottom: 0, flex: 1 }]} numberOfLines={1}>
                                    {match.event_name || 'Unknown Event'}
                                </Text>
                            </View>

                            {/* Opponent Name */}
                            <Text style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 }}>
                                vs {opponentName || 'Unknown'}
                            </Text>

                            {/* Score Display */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                padding: 12,
                                borderRadius: 8,
                                marginBottom: 8
                            }}>
                                <Text style={[
                                    styles.statValue,
                                    { fontSize: 24, fontWeight: 'bold' },
                                    isFinished && isWinner && { color: COLORS.success },
                                    isLive && { color: '#FF3B30' }
                                ]}>
                                    {playerScore ?? '-'}
                                </Text>
                                <Text style={{ fontSize: 16, color: COLORS.textMuted, fontWeight: 'bold' }}>-</Text>
                                <Text style={[
                                    styles.statValue,
                                    { fontSize: 24, fontWeight: 'bold' },
                                    isFinished && !isWinner && { color: COLORS.textMuted }
                                ]}>
                                    {opponentScore ?? '-'}
                                </Text>
                            </View>

                            {/* Match Info */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{
                                    backgroundColor: match.status === 1 ? '#FF3B30' :
                                                   match.status === 2 ? '#FF9500' :
                                                   match.status === 0 ? COLORS.primary :
                                                   'rgba(255, 255, 255, 0.1)',
                                    paddingHorizontal: 8,
                                    paddingVertical: 4,
                                    borderRadius: 4
                                }}>
                                    <Text style={{
                                        color: '#FFF',
                                        fontSize: 10,
                                        fontWeight: '600'
                                    }}>
                                        {match.status === 0 ? 'Scheduled' :
                                         match.status === 1 ? 'LIVE' :
                                         match.status === 2 ? 'On Break' :
                                         isWinner ? 'Won' : 'Lost'}
                                    </Text>
                                </View>
                                {match.scheduled_date && (
                                    <Text style={{ fontSize: 11, color: COLORS.textMuted }}>
                                        {new Date(match.scheduled_date).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'short'
                                        })}
                                    </Text>
                                )}
                            </View>
                        </GlassCard>
                    );
                })
            )}
        </View>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return renderOverviewContent();
            case 'matches':
                return renderMatchesContent();
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