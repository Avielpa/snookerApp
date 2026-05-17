// app/player/[id].tsx - Modern Player Profile with Tabs
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    Platform,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { getPlayerDetails, getPlayerMatchHistory, PlayerMatchHistoryItem, PlayerMatchHistoryResponse } from '../../services/matchServices';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { logger } from '../../utils/logger';
import { useColors } from '../../contexts/ThemeContext';
import { createPlayerStyles } from './styles-modern';
import { getNationalityFlag } from '../../utils/nationalityFlag';
import { FormDots } from '../components/stats/FormDots';
import { WinStreak } from '../components/stats/WinStreak';
import { isPlayerFavouriteSync, isPlayerFavouriteAsync, togglePlayerFavourite } from '../../services/favoritesService';
import { useAuth } from '../../contexts/AuthContext';
import AuthCard from '../components/AuthCard';
import { shouldShowSignupNudge, markSignupNudgeShown } from '../../services/signupNudgeService';

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
    career_stats?: {
        ct_frames_played: number | null;
        ct_frames_won: number | null;
        ct_career_prize_total: number | null;
        ct_total_titles: number | null;
        ct_ranking_titles: number | null;
        ct_finals_reached: number | null;
        ct_career_best_rank: number | null;
        ct_total_50plus: number | null;
        ct_total_centuries: number | null;
        titles_verified: boolean | null;
        ct_synced_at: string | null;
    } | null;
    recent_form?: string[] | null;
    win_streak?: number | null;
    ranking_trend?: { current: number | null; previous: number | null; delta: number | null } | null;
    season_stats?: { matches: number; wins: number; season: number | null } | null;
    frame_stats?: { frames_won: number; frames_lost: number; frames_played: number; frame_pct: number } | null;
    finals_record?: { finals_reached: number; finals_won: number; finals_pct: number } | null;
    semi_final_record?: { reached: number; won: number; pct: number } | null;
    deciding_frames?: { deciding_played: number; deciding_won: number; deciding_pct: number } | null;
    career_best_ranking?: number | null;
    seasons_in_top16?: number | null;
    best_win_streak?: number | null;
    recent_win_pct?: number | null;
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
    const [isStarred, setIsStarred] = useState(
        playerId ? isPlayerFavouriteSync(playerId) : false
    );
    const [authVisible, setAuthVisible] = useState(false);
    const [nudgeVisible, setNudgeVisible] = useState(false);
    const { loggedIn } = useAuth();
    const COLORS = usePlayerColors();
    const router = useRouter();

    // Re-read from storage after async cache loads (fixes persistence across restarts)
    useEffect(() => {
        if (!playerId) return;
        let cancelled = false;
        isPlayerFavouriteAsync(playerId).then((val) => {
            if (!cancelled) setIsStarred(val);
        });
        return () => { cancelled = true; };
    }, [playerId]);

    const handleStarPress = useCallback(async () => {
        if (!playerId) return;
        const newVal = await togglePlayerFavourite(playerId);
        setIsStarred(newVal);
        if (newVal && !loggedIn) {
            const show = await shouldShowSignupNudge();
            if (show) {
                setNudgeVisible(true);
                markSignupNudgeShown().catch(() => {});
            }
        }
    }, [playerId, loggedIn]);

    // Create styles with dynamic colors
    const styles = createPlayerStyles(COLORS);

    // Small source attribution tag — tells users where the data comes from
    // snooker.org tags are hidden on iOS (App Store requirement)
    const PlayerSourceTag = ({ source }: { source: 'snooker.org' | 'cuetracker.net' | 'mixed' }) => {
        const allTags = source === 'mixed'
            ? [{ label: 'snooker.org', color: COLORS.primary }, { label: 'cuetracker.net', color: '#4CAF50' }]
            : source === 'cuetracker.net'
                ? [{ label: 'cuetracker.net', color: '#4CAF50' }]
                : [{ label: 'snooker.org', color: COLORS.primary }];
        const tags = allTags;
        if (tags.length === 0) return null;
        return (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8, gap: 4 }}>
                {tags.map(({ label, color }) => (
                    <View key={label} style={{
                        flexDirection: 'row', alignItems: 'center',
                        backgroundColor: color + '20', borderRadius: 6,
                        paddingHorizontal: 6, paddingVertical: 2,
                    }}>
                        <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color, marginRight: 3 }} />
                        <Text style={{ fontSize: 9, fontFamily: 'PoppinsRegular', color, opacity: 0.9 }}>{label}</Text>
                    </View>
                ))}
            </View>
        );
    };

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

    const calculateAge = (born: string | null | undefined): string => {
        if (!born) return 'N/A';
        const diff = Date.now() - new Date(born).getTime();
        const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        return isNaN(age) || age < 1 ? 'N/A' : `${age} years old`;
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
        if (!playerId) {
            setMatches([]);
            setMatchesLoading(false);
            return;
        }

        setMatchesLoading(true);
        setMatchesError(null);

        // Add a safety timeout to prevent infinite loading/freezing
        const timeoutId = setTimeout(() => {
            logger.error(`[PlayerProfile] Match history fetch timed out for player ${playerId}`);
            setMatchesLoading(false);
            setMatchesError(null); // Don't show error
            setMatches([]); // Show empty state instead
        }, 20000); // 20 second timeout

        try {
            logger.log(`[PlayerProfile] Fetching match history for player ${playerId}`);
            const matchData = await getPlayerMatchHistory(playerId, 20);

            clearTimeout(timeoutId); // Clear timeout if request completes

            // Always handle as safe - matchData should never be null from service
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

    // Fetch matches on mount so form dots and streak stay in sync with the Matches tab
    useEffect(() => {
        if (matches.length === 0 && !matchesLoading) {
            fetchPlayerMatches();
        }
    }, [fetchPlayerMatches, matches.length, matchesLoading]);

    // Derive recent form and win streak directly from the same matches array the Matches tab shows
    const recentForm = useMemo(() =>
        matches
            .filter(m => m.winner_id != null)
            .slice(0, 10)
            .map(m => (m.winner_id === playerId ? 'W' : 'L')),
        [matches, playerId]
    );

    const winStreak = useMemo(() => {
        const finished = matches.filter(m => m.winner_id != null);
        let streak = 0;
        for (const m of finished) {
            const isWin = m.winner_id === playerId;
            if (streak === 0) streak = isWin ? 1 : -1;
            else if (streak > 0 && isWin) streak++;
            else if (streak < 0 && !isWin) streak--;
            else break;
        }
        return streak;
    }, [matches, playerId]);

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
                    subtitle={
                        player?.ranking_trend?.delta != null
                            ? player.ranking_trend.delta > 0
                                ? `▲ ${player.ranking_trend.delta} vs last season`
                                : player.ranking_trend.delta < 0
                                ? `▼ ${Math.abs(player.ranking_trend.delta)} vs last season`
                                : 'Same as last season'
                            : 'Current season'
                    }
                />
                <StatCard
                    icon="cash-outline"
                    title="Prize Money"
                    value={player?.prize_money_this_year ? `£${(player.prize_money_this_year / 1000).toFixed(0)}k` : 'N/A'}
                    subtitle="This season"
                />
            </View>

            {/* Career Best & Top 16 */}
            <View style={styles.statsGrid}>
                <StatCard
                    icon="ribbon-outline"
                    title="Career Best Rank"
                    value={player?.career_best_ranking ? `#${player.career_best_ranking}` : 'N/A'}
                    subtitle="All time"
                />
                <StatCard
                    icon="star-outline"
                    title="Seasons in Top 16"
                    value={player?.seasons_in_top16 ?? 0}
                    subtitle="Elite seasons"
                />
            </View>

            {/* Personal Information */}
            <GlassCard style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <InfoRow
                    icon="calendar-outline"
                    label="Date of Birth"
                    value={formatValue(player?.Born, 'date')}
                />
                <InfoRow
                    icon="time-outline"
                    label="Age"
                    value={calculateAge(player?.Born)}
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
            {/* Current Form — derived from same matches the Matches tab shows */}
            {(recentForm.length > 0 || winStreak !== 0) && (
                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Current Form</Text>
                    <FormDots form={recentForm} />
                    <WinStreak streak={winStreak} />
                </GlassCard>
            )}

            {/* Current Season Stats */}
            {(player?.season_stats?.matches ?? 0) > 0 && (
                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>
                        {player?.season_stats?.season
                            ? `${player.season_stats.season} Season`
                            : 'This Season'}
                    </Text>
                    <InfoRow
                        icon="checkmark-circle-outline"
                        label="Wins"
                        value={String(player?.season_stats?.wins ?? 0)}
                    />
                    <InfoRow
                        icon="stats-chart-outline"
                        label="Matches Played"
                        value={String(player?.season_stats?.matches ?? 0)}
                    />
                    <InfoRow
                        icon="pie-chart-outline"
                        label="Win Rate"
                        value={(() => {
                            const w = player?.season_stats?.wins ?? 0;
                            const m = player?.season_stats?.matches ?? 0;
                            return m > 0 ? `${Math.round((w / m) * 100)}%` : 'N/A';
                        })()}
                    />
                </GlassCard>
            )}

            {/* Career W/L removed — snooker.org only covers main tour (~1161 matches for Ronnie)
                 while CueTracker shows 1582. Incomplete count misleads users. */}

            {/* Frame Stats */}
            {(player?.frame_stats?.frames_played ?? 0) > 0 && (
                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Frame Statistics</Text>
                    <InfoRow
                        icon="grid-outline"
                        label="Frames Played"
                        value={String(player?.frame_stats?.frames_played ?? 0)}
                    />
                    <InfoRow
                        icon="checkmark-circle-outline"
                        label="Frames Won"
                        value={String(player?.frame_stats?.frames_won ?? 0)}
                    />
                    <InfoRow
                        icon="close-circle-outline"
                        label="Frames Lost"
                        value={String(player?.frame_stats?.frames_lost ?? 0)}
                    />
                    <InfoRow
                        icon="pie-chart-outline"
                        label="Frame Win Rate"
                        value={`${(player?.frame_stats?.frame_pct ?? 0).toFixed(1)}%`}
                    />
                    <PlayerSourceTag source="cuetracker.net" />
                </GlassCard>
            )}

            {/* Finals & Semi-Finals Record */}
            {(player?.finals_record?.finals_reached ?? 0) > 0 && (
                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Finals Record</Text>
                    <InfoRow
                        icon="trophy-outline"
                        label="Finals Reached"
                        value={String(player?.finals_record?.finals_reached ?? 0)}
                    />
                    {(player?.semi_final_record?.reached ?? 0) > 0 && (
                        <>
                            <InfoRow
                                icon="medal-outline"
                                label="Semi-Finals Reached"
                                value={String(player?.semi_final_record?.reached ?? 0)}
                            />
                            <InfoRow
                                icon="pie-chart-outline"
                                label="Semi-Finals Win Rate"
                                value={`${(player?.semi_final_record?.pct ?? 0).toFixed(1)}%`}
                            />
                        </>
                    )}
                    <PlayerSourceTag source="cuetracker.net" />
                </GlassCard>
            )}

            {/* Ranking & Career */}
            {((player?.career_best_ranking ?? 0) > 0 || (player?.seasons_in_top16 ?? 0) > 0 || player?.recent_win_pct != null || player?.career_stats?.ct_career_prize_total != null) && (
                <GlassCard style={styles.infoCard}>
                    <Text style={styles.sectionTitle}>Ranking & Career</Text>
                    {(player?.career_best_ranking ?? 0) > 0 && (
                        <InfoRow
                            icon="star-outline"
                            label="Career Best Ranking"
                            value={`#${player?.career_best_ranking}`}
                        />
                    )}
                    {player?.career_stats?.ct_career_prize_total != null && (
                        <InfoRow
                            icon="cash-outline"
                            label="Career Prize Money"
                            value={`£${player.career_stats.ct_career_prize_total.toLocaleString()}`}
                        />
                    )}
                    {(player?.seasons_in_top16 ?? 0) > 0 && (
                        <InfoRow
                            icon="podium-outline"
                            label="Seasons in Top 16"
                            value={String(player?.seasons_in_top16)}
                        />
                    )}
                    {player?.recent_win_pct != null && (
                        <InfoRow
                            icon="trending-up-outline"
                            label="Recent Win % (3 seasons)"
                            value={`${(player.recent_win_pct).toFixed(1)}%`}
                        />
                    )}
                    <PlayerSourceTag source="mixed" />
                </GlassCard>
            )}

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
                // Backend returns only finished matches (status=3), already sorted by date
                matches.map((match, index) => {
                    const isPlayerOne = match.player1_id === playerId;
                    const playerScore = isPlayerOne ? match.score1 : match.score2;
                    const opponentScore = isPlayerOne ? match.score2 : match.score1;
                    const opponentName = isPlayerOne ? match.player2_name : match.player1_name;
                    const isWinner = match.winner_id === playerId;
                    const isFinished = match.status === 3;
                    const isLive = match.status === 1 || match.status === 2;

                    // Get round name or number
                    const getRoundDisplay = () => {
                        if (match.round_name) return match.round_name;
                        if (match.round_number) {
                            const roundNames: { [key: number]: string } = {
                                1: 'Qualifiers', 2: 'Qualifiers', 3: 'Qualifiers', 4: 'Qualifiers',
                                5: 'Last 128', 6: 'Last 64', 7: 'Last 32', 8: 'Last 16',
                                9: 'Quarter-Final', 10: 'Semi-Final', 11: 'Final'
                            };
                            return roundNames[match.round_number] || `Round ${match.round_number}`;
                        }
                        return null;
                    };

                    const resultColor = isWinner ? '#22C55E' : '#EF4444';
                    const dateStr = (match.scheduled_date || match.start_date)
                        ? new Date(match.scheduled_date || match.start_date!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
                        : null;

                    return (
                        <GlassCard key={`${match.api_match_id}-${index}`} style={{
                            marginBottom: 8,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderLeftWidth: 3,
                            borderLeftColor: isLive ? '#FF3B30' : isFinished ? resultColor : 'rgba(255,255,255,0.1)',
                        }}>
                            {/* Row 1: Tournament name + date */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <Text style={{ fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                                    {match.event_name || 'Unknown Event'}
                                </Text>
                                {dateStr && (
                                    <Text style={{ fontSize: 10, color: COLORS.textMuted, marginLeft: 8 }}>
                                        {dateStr}
                                    </Text>
                                )}
                            </View>

                            {/* Row 2: Score + opponent + round */}
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                {/* Result badge */}
                                <View style={{
                                    backgroundColor: isLive ? '#FF3B30' : isFinished ? resultColor : 'rgba(255,255,255,0.12)',
                                    paddingHorizontal: 6,
                                    paddingVertical: 3,
                                    borderRadius: 4,
                                    marginRight: 8,
                                    minWidth: 36,
                                    alignItems: 'center',
                                }}>
                                    <Text style={{ color: '#FFF', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>
                                        {isLive ? 'LIVE' : isFinished ? (isWinner ? 'W' : 'L') : 'UP'}
                                    </Text>
                                </View>

                                {/* Score */}
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: isFinished ? resultColor : '#FFF', marginRight: 6 }}>
                                    {playerScore ?? '-'}
                                </Text>
                                <Text style={{ fontSize: 13, color: COLORS.textMuted, marginRight: 6 }}>–</Text>
                                <Text style={{ fontSize: 20, fontWeight: 'bold', color: isFinished ? (isWinner ? '#EF4444' : '#22C55E') : '#FFF', marginRight: 10 }}>
                                    {opponentScore ?? '-'}
                                </Text>

                                {/* Opponent + round */}
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 12, color: COLORS.textPrimary, fontWeight: '600' }} numberOfLines={1}>
                                        vs {opponentName || 'Unknown'}
                                    </Text>
                                    {getRoundDisplay() && (
                                        <Text style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 1 }}>
                                            {getRoundDisplay()}
                                        </Text>
                                    )}
                                </View>
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
                            {player.Nationality && `${getNationalityFlag(player.Nationality)} ${player.Nationality} • `}
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
                    headerRight: () => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {playerId && playerId !== 376 ? (
                                <TouchableOpacity
                                    onPress={() => router.push(`/compare?p1=${playerId}`)}
                                    style={{
                                        borderWidth: 1,
                                        borderColor: COLORS.primary,
                                        borderRadius: 8,
                                        paddingHorizontal: 10,
                                        paddingVertical: 4,
                                        marginRight: 4,
                                    }}
                                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                                >
                                    <Text style={{ color: COLORS.primary, fontFamily: 'PoppinsBold', fontSize: 12 }}>VS</Text>
                                </TouchableOpacity>
                            ) : null}
                            <TouchableOpacity
                                onPress={handleStarPress}
                                style={{ paddingHorizontal: 8, paddingVertical: 8 }}
                                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                            >
                                <Ionicons
                                    name={isStarred ? 'star' : 'star-outline'}
                                    size={22}
                                    color={isStarred ? '#F59E0B' : COLORS.primary}
                                />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />
            {nudgeVisible && (
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: COLORS.cardBackground,
                    borderBottomWidth: 1,
                    borderBottomColor: COLORS.primary,
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    gap: 8,
                }}>
                    <Text style={{ flex: 1, fontSize: 13, color: COLORS.textPrimary }}>
                        Sign in to sync favorites across devices
                    </Text>
                    <TouchableOpacity
                        onPress={() => { setNudgeVisible(false); setAuthVisible(true); }}
                        style={{ backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
                    >
                        <Text style={{ fontSize: 12, fontFamily: 'PoppinsBold', color: '#121212' }}>Sign In</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setNudgeVisible(false)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={{ color: COLORS.textMuted, fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                </View>
            )}
            {content}
            <AuthCard visible={authVisible} onClose={() => setAuthVisible(false)} />
        </SafeAreaView>
    );
}