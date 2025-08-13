import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View, 
    Text, 
    FlatList, 
    StyleSheet, 
    TouchableOpacity,
    ActivityIndicator, 
    RefreshControl, 
    ScrollView,
    ImageBackground
} from 'react-native';
import { getActiveTournamentId, getTournamentDetails, getTournamentMatches, getActiveOtherTours, Event } from '../services/tourServices';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/logger';
import { useColors } from '../contexts/ThemeContext';
import { GlassCard } from './components/modern/GlassCard';
import { LiveIndicator } from './components/modern/LiveIndicator';

// --- Interfaces ---
interface Match {
    id: number;
    api_match_id: number | null;
    event_id?: number;
    player1_id: number | null;
    player2_id: number | null;
    score1: number | null;
    score2: number | null;
    note: string | null;
    scheduled_date: string | null;
    start_date?: string | null;
    end_date?: string | null;
    on_break?: boolean | null;
    unfinished?: boolean | null;
    status_code: number | null;
    status_display?: string | null;
    winner_id: number | null;
    round?: number | null;
    number?: number | null;
    player1_name?: string;
    player2_name?: string;
    frame_scores?: string | null;
    sessions_str?: string | null;
    live_url?: string | null;
    details_url?: string | null;
}

interface EventDetails { 
    ID: number; 
    Name?: string | null; 
}

type MatchCategory = 'livePlaying' | 'onBreak' | 'upcoming' | 'finished';

interface MatchListItem extends Match { 
    type: 'match'; 
    matchCategory: MatchCategory; 
}

interface StatusHeaderListItem { 
    type: 'statusHeader'; 
    title: string; 
    iconName: keyof typeof Ionicons.glyphMap; 
    id: string; 
}

interface RoundHeaderListItem { 
    type: 'roundHeader'; 
    roundName: string; 
    id: string; 
}

type ListItem = MatchListItem | StatusHeaderListItem | RoundHeaderListItem;
type ActiveFilterType = MatchCategory | 'all';
type IoniconName = keyof typeof Ionicons.glyphMap;

// --- Dynamic Colors Hook ---
const useHomeColors = () => {
    const colors = useColors();
    return {
        background: 'transparent',
        cardBackground: colors.cardBackground,
        cardBorder: colors.cardBorder,
        textHeader: colors.textHeader,
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        textMuted: colors.textMuted,
        score: colors.primary,
        accent: colors.primary,
        accentLight: colors.secondary,
        live: colors.live,
        onBreak: colors.onBreak,
        error: colors.error,
        white: colors.white,
        black: colors.black,
        filterButton: colors.filterButton,
        filterButtonActive: colors.filterButtonActive,
        filterText: colors.filterText,
        filterTextActive: colors.filterTextActive,
    };
};

const ICONS: { [key: string]: IoniconName } = {
    livePlaying: 'play-circle-outline',
    onBreak: 'pause-circle-outline',
    upcoming: 'time-outline',
    finished: 'checkmark-done-outline',
    calendar: 'calendar-outline',
    trophy: 'trophy-outline',
    loading: 'hourglass-outline',
    error: 'alert-circle-outline',
    empty: 'information-circle-outline',
    refresh: 'refresh-outline',
    filter: 'filter-outline',
    all: 'list-outline',
};

// --- Utility Functions ---
const formatDate = (dateString: string | null): string => {
    if (!dateString || dateString === "Invalid Date Format" || dateString === null) {
        return 'TBD';
    }
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        return date.toLocaleString('en-GB', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return 'Date Error';
    }
};

const getRoundName = (round: number | null | undefined): string => {
    if (round === null || round === undefined) return '';
    if (round >= 15) return 'Final';
    if (round === 14) return 'Semi-Finals';
    if (round === 13) return 'Quarter-Finals';
    if (round >= 8) return `Round ${16 - round + 1}`;
    if (round === 7) return 'Round 1 (L32)';
    return `Round ${round}`;
};

// Dynamic Styles Function (moved up to be available to components)
const createStyles = (COLORS: any) => StyleSheet.create({
    container: { 
        flex: 1, 
    },
    backgroundImage: {
        flex: 1,
    },
    headerContainer: { 
        paddingBottom: 6, 
        paddingHorizontal: 16 
    },
    screenTitle: { 
        fontSize: 26, 
        fontFamily: 'PoppinsBold', 
        textAlign: 'center', 
        color: COLORS.textHeader, 
        marginTop: 8, 
        marginBottom: 2,
        textShadowColor: 'rgba(255, 167, 38, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        letterSpacing: 0.3,
    },
    tourTitle: { 
        fontSize: 15, 
        fontFamily: 'PoppinsMedium', 
        textAlign: 'center', 
        color: COLORS.textSecondary, 
        marginBottom: 8,
        letterSpacing: 0.2,
        opacity: 0.9,
    },
    filterContainer: { 
        paddingVertical: 4, 
        paddingHorizontal: 14, 
    },
    filterScrollView: { 
        flexDirection: 'row', 
        alignItems: 'center', 
    },
    filterButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: COLORS.filterButton, 
        paddingVertical: 6, 
        paddingHorizontal: 10, 
        borderRadius: 16, 
        marginRight: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.25)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    filterButtonActive: { 
        backgroundColor: COLORS.filterButtonActive,
        borderColor: COLORS.accent,
        elevation: 2,
        shadowOpacity: 0.15,
    },
    filterText: { 
        color: COLORS.filterText, 
        fontSize: 12, 
        fontFamily: 'PoppinsMedium', 
        marginLeft: 4,
        letterSpacing: 0.1,
    },
    filterTextActive: { 
        color: COLORS.filterTextActive, 
        fontFamily: 'PoppinsBold',
    },
    listArea: { 
        flex: 1, 
    },
    centerContent: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        padding: 24 
    },
    messageText: { 
        textAlign: 'center', 
        fontSize: 14, 
        fontFamily: 'PoppinsRegular', 
        color: COLORS.textMuted, 
        marginTop: 12,
        lineHeight: 20,
    },
    retryButton: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 8, 
        paddingHorizontal: 16, 
        backgroundColor: COLORS.accent, 
        borderRadius: 6, 
        marginTop: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    retryButtonText: { 
        color: COLORS.white, 
        fontSize: 14, 
        fontFamily: 'PoppinsMedium', 
        marginLeft: 6 
    },
    listContentContainer: { 
        paddingBottom: 16 
    },
    statusHeaderItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 10, 
        paddingHorizontal: 14, 
        marginTop: 12, 
        marginBottom: 6,
        marginHorizontal: 14,
        backgroundColor: 'rgba(255, 167, 38, 0.08)',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.textHeader,
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
    },
    statusHeaderText: { 
        fontSize: 14, 
        fontFamily: 'PoppinsBold', 
        color: COLORS.textHeader, 
        marginLeft: 8, 
        textTransform: 'uppercase', 
        letterSpacing: 0.5,
    },
    roundHeaderItem: { 
        paddingVertical: 4, 
        paddingHorizontal: 14, 
        marginTop: 6, 
        marginBottom: 2,
        marginHorizontal: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 6,
    },
    roundHeaderText: { 
        fontSize: 13, 
        fontFamily: 'PoppinsMedium', 
        color: COLORS.textSecondary, 
        marginLeft: 4,
        letterSpacing: 0.2,
        opacity: 0.8,
    },
    matchItemContainer: { 
        marginVertical: 3, 
        marginHorizontal: 14,
    },
    playerRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: 6, 
        marginTop: 2 
    },
    playerName: { 
        fontSize: 14, 
        fontFamily: 'PoppinsSemiBold', 
        color: COLORS.textPrimary, 
        flexShrink: 1, 
        flexBasis: '38%',
        lineHeight: 18,
    },
    playerLeft: { 
        textAlign: 'left', 
        marginRight: 6 
    },
    playerRight: { 
        textAlign: 'right', 
        marginLeft: 6, 
    },
    winnerText: { 
        fontFamily: 'PoppinsBold', 
        color: '#4CAF50',
    },
    score: { 
        fontSize: 16, 
        fontFamily: 'PoppinsBold', 
        color: COLORS.score, 
        textAlign: 'center', 
        paddingHorizontal: 6,
        minWidth: 45,
    },
    detailsRow: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginTop: 6, 
        paddingTop: 6, 
        borderTopColor: 'rgba(255, 255, 255, 0.15)', 
        borderTopWidth: 0.5 
    },
    detailItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        flexShrink: 1, 
        paddingRight: 4 
    },
    detailText: { 
        fontSize: 12, 
        fontFamily: 'PoppinsSemiBold', 
        color: COLORS.textPrimary, 
        marginLeft: 4, 
        flexShrink: 1,
        opacity: 0.9,
    },
    otherToursContainer: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    otherToursScrollView: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    otherTourChip: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 14,
        marginRight: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 167, 38, 0.2)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    otherTourChipActive: {
        backgroundColor: COLORS.accent,
        borderColor: COLORS.accent,
        elevation: 2,
        shadowOpacity: 0.1,
    },
    otherTourText: {
        fontSize: 11,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textSecondary,
        letterSpacing: 0.1,
    },
    otherTourTextActive: {
        color: COLORS.white,
        fontFamily: 'PoppinsBold',
    },
});

// --- Components ---
const MatchItem = React.memo(({ 
    item, 
    tourName, 
    navigation 
}: { 
    item: MatchListItem; 
    tourName: string | null; 
    navigation: any; 
}) => {
    const COLORS = useHomeColors();
    const styles = createStyles(COLORS);
    
    const player1Name = item.player1_name || (item.player1_id && item.player1_id !== 376 ? `P${item.player1_id}` : 'TBD');
    const player2Name = item.player2_name || (item.player2_id && item.player2_id !== 376 ? `P${item.player2_id}` : 'TBD');
    
    // Enhanced score validation and consistent display
    const hasValidScores = (
        item.score1 !== null && item.score1 !== undefined && 
        item.score2 !== null && item.score2 !== undefined &&
        typeof item.score1 === 'number' && typeof item.score2 === 'number'
    );
    
    const scoreDisplay = hasValidScores ? `${item.score1} - ${item.score2}` : 'vs';
    
    const scheduledDate = formatDate(item.scheduled_date);
    // Enhanced winner validation - check both winner_id and scores for consistency
    const isMatchFinished = item.status_code === 3;
    const hasWinnerId = item.winner_id != null && item.winner_id !== undefined;
    
    let isPlayer1Winner = false;
    let isPlayer2Winner = false;
    
    if (isMatchFinished) {
        if (hasWinnerId) {
            // Use winner_id if available
            isPlayer1Winner = item.winner_id === item.player1_id;
            isPlayer2Winner = item.winner_id === item.player2_id;
        } else if (hasValidScores) {
            // Fallback to score comparison if no winner_id
            isPlayer1Winner = item.score1! > item.score2!;
            isPlayer2Winner = item.score2! > item.score1!;
        }
    }
    
    const handlePlayerPress = (playerId: number | null) => {
        if (playerId) {
            navigation.push(`/player/${playerId}`);
        }
    };
    
    const handleMatchPress = (apiMatchId: number | null) => {
        if (apiMatchId) {
            navigation.push(`/match/${apiMatchId}`);
        } else {
            logger.warn("Cannot navigate: missing api_match_id");
        }
    };

    return (
        <TouchableOpacity 
            onPress={() => handleMatchPress(item.api_match_id)} 
            disabled={!item.api_match_id} 
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            delayPressIn={0}
        >
            <GlassCard style={styles.matchItemContainer}>
                {item.matchCategory === 'livePlaying' && <LiveIndicator />}
                <View style={styles.playerRow}>
                    <Text 
                        style={[styles.playerName, styles.playerLeft, isPlayer1Winner && styles.winnerText]} 
                        onPress={() => handlePlayerPress(item.player1_id)} 
                        disabled={!item.player1_id} 
                        numberOfLines={1}
                    >
                        {player1Name}
                    </Text>
                    
                    <Text style={styles.score}>{scoreDisplay}</Text>
                    
                    <Text 
                        style={[styles.playerName, styles.playerRight, isPlayer2Winner && styles.winnerText]} 
                        onPress={() => handlePlayerPress(item.player2_id)} 
                        disabled={!item.player2_id} 
                        numberOfLines={1}
                    >
                        {player2Name}
                    </Text>
                </View>
                
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}>
                        <Ionicons name={ICONS.calendar} size={11} color={COLORS.textSecondary} />
                        <Text style={styles.detailText}>{scheduledDate}</Text>
                    </View>
                    
                    {tourName && (
                        <View style={[styles.detailItem, { justifyContent: 'flex-end' }]}>
                            <Ionicons name={ICONS.trophy} size={11} color={COLORS.textSecondary} />
                            <Text style={[styles.detailText, { textAlign: 'right' }]} numberOfLines={1}>
                                {tourName}
                            </Text>
                        </View>
                    )}
                </View>
            </GlassCard>
        </TouchableOpacity>
    );
}, (prevProps, nextProps) => {
    // Custom comparison for React.memo to ensure re-render when scores change
    const prevItem = prevProps.item;
    const nextItem = nextProps.item;
    
    return (
        prevItem.id === nextItem.id &&
        prevItem.score1 === nextItem.score1 &&
        prevItem.score2 === nextItem.score2 &&
        prevItem.status_code === nextItem.status_code &&
        prevItem.winner_id === nextItem.winner_id &&
        prevItem.player1_name === nextItem.player1_name &&
        prevItem.player2_name === nextItem.player2_name &&
        prevProps.tourName === nextProps.tourName
    );
});

// Add displayName for debugging
MatchItem.displayName = 'MatchItem';

const StatusHeaderItem = ({ title, iconName, colors, styles }: { 
    title: string; 
    iconName: IoniconName; 
    colors: any; 
    styles: any; 
}) => (
    <View style={styles.statusHeaderItem}>
        <Ionicons name={iconName} size={18} color={colors.textHeader} />
        <Text style={styles.statusHeaderText}>{title}</Text>
    </View>
);
StatusHeaderItem.displayName = 'StatusHeaderItem';

const RoundHeaderItem = ({ roundName, styles }: { roundName: string; styles: any; }) => (
    <View style={styles.roundHeaderItem}>
        <Text style={styles.roundHeaderText}>{roundName}</Text>
    </View>
);
RoundHeaderItem.displayName = 'RoundHeaderItem';

// --- HomeScreen Component ---
const HomeScreen = (): React.ReactElement | null => {
    // Removed unused rawMatches state
    const [processedListData, setProcessedListData] = useState<ListItem[]>([]);
    const [activeFilter, setActiveFilter] = useState<ActiveFilterType>('all');
    const [tourName, setTourName] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [activeOtherTours, setActiveOtherTours] = useState<Event[]>([]);
    const [selectedOtherTour, setSelectedOtherTour] = useState<number | null>(null);
    const navigation = useRouter();
    const COLORS = useHomeColors();


    // Process matches for list display
    const processMatchesForList = (matches: Match[]): ListItem[] => {
        logger.log(`[HomeScreen processMatches] Processing ${matches?.length || 0} matches...`);
        
        if (!matches || matches.length === 0) return [];
        
        const categories: Record<MatchCategory, { title: string; icon: IoniconName; matches: MatchListItem[] }> = {
            livePlaying: { title: 'Playing Now', icon: ICONS.livePlaying, matches: [] },
            onBreak: { title: 'On Break', icon: ICONS.onBreak, matches: [] },
            upcoming: { title: 'Upcoming', icon: ICONS.upcoming, matches: [] },
            finished: { title: 'Results', icon: ICONS.finished, matches: [] }
        };

        matches.forEach((match: Match) => {
            let cat: MatchCategory = 'upcoming';
            const status = match.status_code;
            
            if (status === 1) cat = 'livePlaying';
            else if (status === 2) cat = 'onBreak';
            else if (status === 3) cat = 'finished';
            else if (status === 0) cat = 'upcoming';
            
            const matchItem: MatchListItem = { ...match, type: 'match', matchCategory: cat };
            
            if (categories[cat]) {
                categories[cat].matches.push(matchItem);
            } else {
                categories.upcoming.matches.push({ ...matchItem, matchCategory: 'upcoming' });
            }
        });

        // Sorting functions
        const sortByRoundThenDate = (a: Match, b: Match): number => {
            const rA = a.round ?? 999;
            const rB = b.round ?? 999;
            if (rA !== rB) return rA - rB;
            
            const dA = new Date(a.scheduled_date || 0).getTime();
            const dB = new Date(b.scheduled_date || 0).getTime();
            if (dA !== dB) return dA - dB;
            
            return (a.number ?? 999) - (b.number ?? 999);
        };

        const sortByRoundThenEndDateDesc = (a: Match, b: Match): number => {
            const rA = a.round ?? -1;
            const rB = b.round ?? -1;
            if (rA !== rB) return rB - rA;
            
            const dA = new Date(a.end_date || a.start_date || a.scheduled_date || 0).getTime();
            const dB = new Date(b.end_date || b.start_date || b.scheduled_date || 0).getTime();
            if (dA !== dB) return dB - dA;
            
            return (a.number ?? 999) - (b.number ?? 999);
        };

        categories.livePlaying.matches.sort(sortByRoundThenDate);
        categories.onBreak.matches.sort(sortByRoundThenDate);
        categories.upcoming.matches.sort(sortByRoundThenDate);
        categories.finished.matches.sort(sortByRoundThenEndDateDesc);

        const processedList: ListItem[] = [];
        const categoryOrder: MatchCategory[] = ['livePlaying', 'onBreak', 'upcoming', 'finished'];
        let roundHeaderIndex = 0;

        categoryOrder.forEach((key: MatchCategory) => {
            const category = categories[key];
            
            if (category.matches.length > 0) {
                processedList.push({
                    type: 'statusHeader',
                    title: category.title,
                    iconName: category.icon,
                    id: `statusHeader-${key}`
                });
                
                let currentRound: number | null | undefined = -999;
                
                category.matches.forEach((match: MatchListItem) => {
                    const matchRound = match.round ?? null;
                    
                    if (matchRound !== currentRound) {
                        currentRound = matchRound;
                        const roundName = getRoundName(currentRound);
                        const uniqueRoundHeaderId = `roundHeader-${key}-${currentRound ?? 'unknown'}-${roundHeaderIndex++}`;
                        
                        processedList.push({
                            type: 'roundHeader',
                            roundName: roundName,
                            id: uniqueRoundHeaderId
                        });
                    }
                    
                    processedList.push(match);
                });
            }
        });
        
        return processedList;
    };

    // Load tournament information
    const loadTournamentInfo = useCallback(async (isRefresh = false, specificTournamentId: number | null = null) => {
        if (!isRefresh) setLoading(true);
        setRefreshing(isRefresh);
        setError(null);
        
        logger.log(`[HomeScreen] ${isRefresh ? 'Refreshing' : 'Loading'} tournament info...`);
        
        try {
            // If a specific tournament is selected, use it; otherwise get the main active tournament
            let targetTournamentId = specificTournamentId;
            
            if (!targetTournamentId) {
                targetTournamentId = await getActiveTournamentId();
            }
            
            logger.log(`[HomeScreen] Target tournament ID: ${targetTournamentId}`);
            
            // Always load active other tours for the toolbar
            const otherTours = await getActiveOtherTours();
            setActiveOtherTours(otherTours);
            logger.log(`[HomeScreen] Found ${otherTours.length} active other tours`);
            
            if (targetTournamentId) {
                logger.log(`[HomeScreen] Fetching details and matches for tournament ${targetTournamentId}`);
                
                const [detailsData, matchesResult] = await Promise.all([
                    getTournamentDetails(targetTournamentId),
                    getTournamentMatches(targetTournamentId)
                ]);
                
                logger.log(`[HomeScreen] Tournament details:`, detailsData);
                logger.log(`[HomeScreen] Raw matches received:`, {
                    type: typeof matchesResult,
                    isArray: Array.isArray(matchesResult),
                    length: Array.isArray(matchesResult) ? matchesResult.length : 'N/A',
                    sample: Array.isArray(matchesResult) ? matchesResult.slice(0, 2) : matchesResult
                });
                
                const eventDetails = detailsData as EventDetails | null;
                const tourDisplayName = eventDetails?.Name ?? 'Tournament';
                
                // Add tour type indicator for non-main tours
                const tourType = (detailsData as Event)?.Tour;
                const displayName = tourType && tourType !== 'main' 
                    ? `${tourDisplayName} (${tourType.toUpperCase()})`
                    : tourDisplayName;
                
                setTourName(displayName);
                
                const currentMatches = Array.isArray(matchesResult) ? matchesResult as Match[] : [];
                
                logger.log(`[HomeScreen] Processing ${currentMatches.length} matches...`);
                const processedData = processMatchesForList(currentMatches);
                logger.log(`[HomeScreen] Processed data:`, {
                    totalItems: processedData.length,
                    types: processedData.reduce((acc, item) => {
                        acc[item.type] = (acc[item.type] || 0) + 1;
                        return acc;
                    }, {} as Record<string, number>)
                });
                
                setProcessedListData(processedData);
            } else {
                logger.warn(`[HomeScreen] No active tournament ID found`);
                setTourName(null);
                setProcessedListData([]);
            }
        } catch (err: any) {
            logger.error(`[HomeScreen] Error loading tournament info:`, err);
            setError(`Failed to load data. ${err.message || ''}`.trim());
            
            if (!isRefresh) {
                setProcessedListData([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadTournamentInfo();
    }, [loadTournamentInfo]);
    
    // Handle other tour selection
    const handleOtherTourSelection = useCallback((tourId: number) => {
        if (tourId === selectedOtherTour) {
            // Deselect and go back to main tour
            setSelectedOtherTour(null);
            loadTournamentInfo(false, null);
        } else {
            // Select the other tour
            setSelectedOtherTour(tourId);
            loadTournamentInfo(false, tourId);
        }
    }, [selectedOtherTour, loadTournamentInfo]);

    // Filtering logic
    const filteredListData = useMemo(() => {
        if (activeFilter === 'all') return processedListData;
        
        const filtered: ListItem[] = [];
        let includeItems = false;
        let currentStatusHeader: StatusHeaderListItem | null = null;
        
        for (const item of processedListData) {
            if (item.type === 'statusHeader') {
                includeItems = (item.id === `statusHeader-${activeFilter}`);
                
                if (includeItems) {
                    currentStatusHeader = item;
                    filtered.push(item);
                } else {
                    currentStatusHeader = null;
                }
            } else if (includeItems && currentStatusHeader) {
                filtered.push(item);
            }
        }
        
        return filtered;
    }, [processedListData, activeFilter]);

    // Create styles with dynamic colors
    const styles = createStyles(COLORS);

    // Render list item function
    const renderListItem = ({ item }: { item: ListItem }): React.ReactElement | null => {
        if (item.type === 'statusHeader') {
            return <StatusHeaderItem title={item.title} iconName={item.iconName} colors={COLORS} styles={styles} />;
        }
        if (item.type === 'roundHeader') {
            return <RoundHeaderItem roundName={item.roundName} styles={styles} />;
        }
        if (item.type === 'match') {
            return <MatchItem item={item} tourName={tourName} navigation={navigation} />;
        }
        return null;
    };

    // Components for states
    const LoadingComponent = (): React.ReactElement => (
        <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={COLORS.accentLight}/>
            <Text style={styles.messageText}>Loading...</Text>
        </View>
    );

    const ErrorComponent = (): React.ReactElement => (
        <View style={styles.centerContent}>
            <Ionicons name={ICONS.error} size={36} color={COLORS.error} />
            <Text style={[styles.messageText, { color: COLORS.error }]}>Error: {error}</Text>
            <TouchableOpacity onPress={() => loadTournamentInfo()} style={styles.retryButton}>
                <Ionicons name={ICONS.refresh} size={16} color={COLORS.white} />
                <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );

    const EmptyComponent = (): React.ReactElement => (
        <View style={styles.centerContent}>
            <GlassCard>
                <Ionicons name={ICONS.empty} size={36} color={COLORS.textMuted} />
                <Text style={styles.messageText}>
                    {tourName ? 'No matches found for the selected filter.' : 'No active tournament.'}
                </Text>
            </GlassCard>
        </View>
    );

    const filterButtons: { label: string; value: ActiveFilterType; icon: keyof typeof Ionicons.glyphMap }[] = [
        { label: 'All', value: 'all', icon: ICONS.all },
        { label: 'Live', value: 'livePlaying', icon: ICONS.livePlaying },
        { label: 'Break', value: 'onBreak', icon: ICONS.onBreak },
        { label: 'Upcoming', value: 'upcoming', icon: ICONS.upcoming },
        { label: 'Results', value: 'finished', icon: ICONS.finished },
    ];

    // Main Render structure
    return (
        <ImageBackground source={require('../assets/snooker_background.jpg')} style={styles.backgroundImage}>
            <SafeAreaView style={styles.container}>
                <View style={styles.headerContainer}>
                    <Text style={styles.screenTitle}>Snooker Live</Text>
                    {tourName && <Text style={styles.tourTitle}>{tourName}</Text>}
                </View>
                
                <View style={styles.filterContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScrollView}>
                        {filterButtons.map((filter) => (
                            <TouchableOpacity
                                key={filter.value}
                                style={[
                                    styles.filterButton,
                                    activeFilter === filter.value && styles.filterButtonActive
                                ]}
                                onPress={() => setActiveFilter(filter.value)}
                                activeOpacity={0.6}
                                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                delayPressIn={0}
                            >
                                <Ionicons 
                                    name={filter.icon} 
                                    size={14} 
                                    color={activeFilter === filter.value ? COLORS.filterTextActive : COLORS.filterText} 
                                />
                                <Text style={[
                                    styles.filterText,
                                    activeFilter === filter.value && styles.filterTextActive
                                ]}>
                                    {filter.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
                
                {/* Other Tours Toolbar */}
                {activeOtherTours.length > 0 && (
                    <View style={styles.otherToursContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.otherToursScrollView}>
                            {activeOtherTours.map((tour) => (
                                <TouchableOpacity
                                    key={tour.ID}
                                    style={[
                                        styles.otherTourChip,
                                        selectedOtherTour === tour.ID && styles.otherTourChipActive
                                    ]}
                                    onPress={() => handleOtherTourSelection(tour.ID)}
                                    activeOpacity={0.6}
                                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                                    delayPressIn={0}
                                >
                                    <Text style={[
                                        styles.otherTourText,
                                        selectedOtherTour === tour.ID && styles.otherTourTextActive
                                    ]} numberOfLines={1}>
                                        {tour.Name || `${tour.Tour?.toUpperCase()} Tour`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}
                
                <View style={styles.listArea}>
                    {loading && filteredListData.length === 0 ? <LoadingComponent /> :
                    error ? <ErrorComponent /> :
                    (
                        <FlatList
                            data={filteredListData}
                            renderItem={renderListItem}
                            keyExtractor={(item: ListItem) => {
                                if (item.type === 'match') {
                                    // Include score data in key to force re-render when scores change
                                    const scoreKey = `${item.score1 || 0}-${item.score2 || 0}-${item.status_code || 0}`;
                                    return `match-${item.id}-${scoreKey}`;
                                }
                                return item.id;
                            }}
                            ListEmptyComponent={!loading ? <EmptyComponent /> : null}
                            contentContainerStyle={styles.listContentContainer}
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={() => loadTournamentInfo(true, selectedOtherTour)}
                                    tintColor={COLORS.accentLight}
                                    colors={[COLORS.accentLight]}
                                />
                            }
                            initialNumToRender={15}
                            maxToRenderPerBatch={10}
                            windowSize={11}
                        />
                    )}
                </View>
            </SafeAreaView>
        </ImageBackground>
    );
};

// Add displayName for debugging
HomeScreen.displayName = 'HomeScreen';

export default HomeScreen;