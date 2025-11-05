// app/tour/[eventId].tsx - Enhanced Tournament Details Screen
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View, Text, StyleSheet, ActivityIndicator, FlatList,
    TouchableOpacity, ScrollView, Platform, RefreshControl,
    ImageBackground, Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

// Import service functions - Ensure paths are correct
// Service file is .js, use assertions if needed
import { getTournamentDetails, getTournamentMatches } from '../../services/tourServices';
import { logger } from '../../utils/logger';
import { useColors } from '../../contexts/ThemeContext';
import { getDeviceTabConfig } from '../../config/deviceTabConfig';
import { DeviceAwareFilterScrollView } from '../../components/DeviceAwareFilterScrollView';
import { DeviceAwareFilterButton } from '../../components/DeviceAwareFilterButton';

// --- Interfaces (Using snake_case for API fields) ---
interface Match {
    id: number;                  // Django PK
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
    Name: string; 
    StartDate?: string | null; 
    EndDate?: string | null;
    Venue?: string | null; 
    City?: string | null; 
    Country?: string | null;
    Note?: string | null; 
    CommonNote?: string | null;
    Season?: number | null;
    Type?: string | null;
    Tour?: string | null;
    Sponsor?: string | null;
}
// --- List Item Types ---
type MatchCategory = 'livePlaying' | 'onBreak' | 'upcoming' | 'finished';
interface MatchListItem extends Match { type: 'match'; matchCategory: MatchCategory; }
interface StatusHeaderListItem { type: 'statusHeader'; title: string; iconName: keyof typeof Ionicons.glyphMap; id: string; }
interface RoundHeaderListItem { type: 'roundHeader'; roundName: string; id: string; round?: number | null; }
type ListItem = MatchListItem | StatusHeaderListItem | RoundHeaderListItem;
type ActiveFilterType = MatchCategory | 'all';

// --- Type Definition for Ionicons Names ---
type IoniconName = keyof typeof Ionicons.glyphMap; // Defined type alias

const { width: screenWidth } = Dimensions.get('window');

// Compact Tournament Header Component
const TournamentHeader = ({ tournament, matchCount, prizeData }: { tournament: EventDetails; matchCount: number; prizeData?: any }) => {
    const colors = useColors();
    
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'TBD';
        try {
            return new Date(dateString).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short'
            });
        } catch {
            return 'Invalid';
        }
    };

    const getTourBadgeColor = (tour: string | null) => {
        switch (tour) {
            case 'main': return colors.primary;
            case 'seniors': return colors.warning;
            case 'womens': return colors.success;
            case 'other': return colors.info;
            default: return colors.textSecondary;
        }
    };

    return (
        <View style={[tournamentHeaderStyles.compactHeader, { backgroundColor: colors.cardBackground }]}>
            <LinearGradient
                colors={[colors.primary + '15', colors.cardBackground]}
                style={tournamentHeaderStyles.compactGradient}
            >
                {/* Title Row */}
                <View style={tournamentHeaderStyles.titleRow}>
                    <Text style={[tournamentHeaderStyles.compactTitle, { color: colors.textHeader }]} numberOfLines={2}>
                        {tournament.Name}
                    </Text>
                    {tournament.Tour && (
                        <View style={[tournamentHeaderStyles.compactBadge, { backgroundColor: getTourBadgeColor(tournament.Tour) }]}>
                            <Text style={tournamentHeaderStyles.compactBadgeText}>{tournament.Tour.toUpperCase()}</Text>
                        </View>
                    )}
                </View>
                
                {/* Info Row */}
                <View style={tournamentHeaderStyles.infoRow}>
                    <View style={tournamentHeaderStyles.infoItem}>
                        <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                        <Text style={[tournamentHeaderStyles.infoText, { color: colors.textSecondary }]}>
                            {formatDate(tournament.StartDate ?? null)} - {formatDate(tournament.EndDate ?? null)}
                        </Text>
                    </View>

                    {(tournament.City || tournament.Country) && (
                        <View style={tournamentHeaderStyles.infoItem}>
                            <Ionicons name="location-outline" size={11} color={colors.success} />
                            <Text style={[tournamentHeaderStyles.infoText, { color: colors.textSecondary }]} numberOfLines={1}>
                                {[tournament.City, tournament.Country].filter(Boolean).join(', ')}
                            </Text>
                        </View>
                    )}

                    <View style={tournamentHeaderStyles.infoItem}>
                        <Ionicons name="trophy-outline" size={11} color={colors.warning} />
                        <Text style={[tournamentHeaderStyles.infoText, { color: colors.textSecondary }]}>
                            {matchCount} matches
                        </Text>
                    </View>

                    {prizeData?.winner?.formatted && (
                        <View style={tournamentHeaderStyles.infoItem}>
                            <Ionicons name="diamond-outline" size={11} color={colors.warning} />
                            <Text style={[tournamentHeaderStyles.infoText, { color: colors.warning }]} numberOfLines={1}>
                                Winner: {prizeData.winner.formatted}
                            </Text>
                        </View>
                    )}
                </View>
            </LinearGradient>
        </View>
    );
};

// --- Constants & Icons (Ensure these are defined at the top level) ---
const COLORS = { background: 'transparent', cardBackground: 'rgba(255, 255, 255, 0.12)', cardBorder: 'rgba(255, 255, 255, 0.25)', textHeader: '#FFA726', textPrimary: '#FFFFFF', textSecondary: '#FFCC80', textMuted: '#E0E0E0', score: '#FFA726', accent: '#FFB74D', accentLight: '#FFCC80', live: '#4CAF50', onBreak: '#FF9800', error: '#F87171', white: '#FFFFFF', black: '#000000', filterButton: 'rgba(255, 167, 38, 0.2)', filterButtonActive: '#FFA726', filterText: '#FFCC80', filterTextActive: '#000000', };
const ICONS: { [key: string]: IoniconName } = { livePlaying: 'play-circle-outline', onBreak: 'pause-circle-outline', upcoming: 'time-outline', finished: 'checkmark-done-outline', calendar: 'calendar-outline', trophy: 'trophy-outline', loading: 'hourglass-outline', error: 'alert-circle-outline', empty: 'information-circle-outline', refresh: 'refresh-outline', filter: 'filter-outline', all: 'list-outline', location: 'location-outline', backArrow: 'arrow-back-outline', };

// --- Utility Functions (Moved outside component) ---
const formatDate = (dateString: string | null): string => { if (!dateString || dateString === "Invalid Date Format" || dateString === null) return 'TBD'; try { const d=new Date(dateString); if(isNaN(d.getTime())) return 'Invalid'; return d.toLocaleString('en-GB',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}); } catch{ return 'Error'; } };
const formatSimpleDate = (dateString: string | null): string => { if (!dateString || dateString === "Invalid Date Format" || dateString === null) return 'N/A'; try { const d=new Date(dateString); if(isNaN(d.getTime())) return 'Invalid'; return d.toLocaleDateString('en-GB',{month:'short',day:'numeric',year:'numeric'}); } catch { return 'Error'; } };
const getRoundName = (round: number | null | undefined): string => { if (round === null || round === undefined) return 'Unknown Round'; if (round >= 15) return "Final"; if (round === 14) return "Semi-Finals"; if (round === 13) return "Quarter-Finals"; if (round === 12) return "Last 16"; if (round === 11) return "Last 32"; if (round === 10) return "Last 64"; if (round === 9) return "Last 128"; return `Round ${round}`; };

// --- Reusable Components ---
// MatchItem: Accessing properties using snake_case with consistent winner/score logic
const MatchItem = React.memo(({ item, navigation }: { item: MatchListItem; navigation: any; }) => {
    const p1=item.player1_name||(item.player1_id?`P${item.player1_id}`:'TBD');
    const p2=item.player2_name||(item.player2_id?`P${item.player2_id}`:'TBD');
    
    // Ensure consistent winner and score logic
    let isP1Win = false;
    let isP2Win = false;
    let scoreDisplay = 'vs';
    
    // If match is finished, determine winner consistently
    if (item.status_code === 3 && 
        item.score1 !== null && item.score1 !== undefined && 
        item.score2 !== null && item.score2 !== undefined) {
        
        // Use score to determine winner (most reliable)
        if (item.score1 > item.score2) {
            isP1Win = true;
        } else if (item.score2 > item.score1) {
            isP2Win = true;
        }
        
        // CORRECT WORKING LOGIC: Use the order that shows correct scores initially
        scoreDisplay = `${item.score2} - ${item.score1}`;
        
        // Double-check against winner_id if available (for validation)
        if (item.winner_id) {
            const scoreBasedWinner = item.score1 > item.score2 ? item.player1_id : item.player2_id;
            if (scoreBasedWinner !== item.winner_id) {
                logger.warn(`[MatchItem] Score/Winner mismatch for match ${item.api_match_id}: Score says ${scoreBasedWinner}, API says ${item.winner_id}`);
            }
        }
    } else if (item.score1 !== null && item.score1 !== undefined && 
               item.score2 !== null && item.score2 !== undefined) {
        // CORRECT WORKING LOGIC: Use the order that shows correct scores initially
        scoreDisplay = `${item.score2} - ${item.score1}`;
    }
    
    const date=formatDate(item.scheduled_date);
    const navP = (id: number | null) => { if(id && typeof id === 'number' && id > 0 && id !== 376) navigation.push(`/player/${id}`); };
    const navM = (apiMatchId: number | null) => { if(apiMatchId && typeof apiMatchId === 'number' && apiMatchId > 0) { navigation.push(`/match/${apiMatchId}`); } else { logger.warn("Cannot navigate: missing api_match_id"); }};
    let ind: React.ReactNode=null;
    if (item.matchCategory === 'livePlaying') ind=(<View style={[styles.statusIndicator, {backgroundColor: COLORS.live}]}><Text style={styles.statusIndicatorText}>LIVE</Text></View>);
    else if (item.matchCategory === 'onBreak') ind=(<View style={[styles.statusIndicator, {backgroundColor: COLORS.onBreak}]}><Text style={styles.statusIndicatorText}>BREAK</Text></View>);

    return (
        <TouchableOpacity style={styles.matchItemContainer} onPress={()=>navM(item.api_match_id)} disabled={!item.api_match_id} activeOpacity={0.8}>
            {ind && <View style={styles.statusIndicatorWrapper}>{ind}</View>}
            <View style={styles.matchItemContent}>
                <View style={styles.playerRow}>
                    <Text style={[styles.playerName, styles.playerLeft, isP1Win && styles.winnerText]} onPress={()=>navP(item.player1_id)} disabled={!item.player1_id} numberOfLines={1}>{p1}</Text>
                    <Text style={styles.score}>{scoreDisplay}</Text>
                    <Text style={[styles.playerName, styles.playerRight, isP2Win && styles.winnerText]} onPress={()=>navP(item.player2_id)} disabled={!item.player2_id} numberOfLines={1}>{p2}</Text>
                </View>
                <View style={styles.detailsRow}>
                    <View style={styles.detailItem}><Ionicons name={ICONS.calendar} size={14} color={COLORS.textSecondary} /><Text style={styles.detailText}>{date}</Text></View>
                </View>
            </View>
        </TouchableOpacity>
    );
});
MatchItem.displayName = 'MatchItem';
const StatusHeaderItem = ({ title, iconName }: { title: string, iconName: keyof typeof Ionicons.glyphMap }) => ( <View style={styles.statusHeaderItem}><Ionicons name={iconName} size={24} color={COLORS.textHeader} /><Text style={styles.statusHeaderText}>{title}</Text></View> );
const RoundHeaderItem = ({ roundName, prizeAmount }: { roundName: string; prizeAmount?: string }) => ( 
    <View style={styles.roundHeaderItem}>
        <View style={styles.roundHeaderContent}>
            <Text style={styles.roundHeaderText}>{roundName}</Text>
            {prizeAmount && (
                <Text style={styles.prizeText}>Prize: {prizeAmount}</Text>
            )}
        </View>
    </View> 
);

// --- Main Screen Component ---
const TournamentDetailsScreen = () => {
    const params = useLocalSearchParams<{ eventId: string }>();
    const eventId = useMemo(() => { 
        const id = params.eventId ? parseInt(params.eventId, 10) : NaN; 
        return !isNaN(id) ? id : null; 
    }, [params.eventId]);
    
    const router = useRouter();
    const [tournamentDetails, setTournamentDetails] = useState<EventDetails | null>(null);
    // Raw matches data - keep for future use
    const [processedListData, setProcessedListData] = useState<ListItem[]>([]);
    const [activeFilter, setActiveFilter] = useState<ActiveFilterType>('all');
    const [loading, setLoading] = useState<boolean>(true);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [prizeData, setPrizeData] = useState<any>(null);
    const [roundPrizes, setRoundPrizes] = useState<Record<number, string>>({});

    const checkLoginStatus = useCallback(async () => { 
        // Empty function - no login check needed for now
    }, []);

    // Fetch prize money data
    const fetchPrizeData = useCallback(async (eventId: number) => {
        try {
            // Fetch tournament prize breakdown
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app'}/oneFourSeven/prize-money/${eventId}/`);
            if (response.ok) {
                const data = await response.json();
                setPrizeData(data);
                
                // Also fetch round-specific prize amounts
                const roundResponse = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app'}/oneFourSeven/round-prizes/${eventId}/`);
                if (roundResponse.ok) {
                    const roundData = await roundResponse.json();
                    setRoundPrizes(roundData);
                }
            }
        } catch (error) {
            logger.warn('[PrizeData] Failed to fetch prize data:', error);
        }
    }, []);

    // --- Process matches function (Using snake_case and corrected loop) ---
    const processMatchesForList = (matches: Match[]): ListItem[] => {
        if (!matches || matches.length === 0) return [];
        
        const categories: Record<MatchCategory, { title: string; icon: keyof typeof Ionicons.glyphMap; matches: MatchListItem[] }> = { 
            livePlaying: { title: 'Playing Now', icon: ICONS.livePlaying, matches: [] }, 
            onBreak: { title: 'On Break', icon: ICONS.onBreak, matches: [] }, 
            upcoming: { title: 'Upcoming', icon: ICONS.upcoming, matches: [] }, 
            finished: { title: 'Results', icon: ICONS.finished, matches: [] } 
        };

        matches.forEach(match => {
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
                            id: uniqueRoundHeaderId,
                            round: currentRound
                        });
                    }
                    processedList.push(match);
                });
            }
        });
        return processedList;
    };

    // --- Fetching Data ---
    const loadData = useCallback(async (refreshing = false) => {
        if (eventId === null || eventId === undefined) { 
            return; 
        }
        if (!refreshing) setLoading(true); 
        setIsRefreshing(refreshing); 
        setError(null);
        logger.log(`[TourScreen] ${refreshing ? 'Refreshing' : 'Loading'} data for Event ID: ${eventId}`);
        
        try {
            const [detailsData, matchesData] = await Promise.all([
                getTournamentDetails(eventId), 
                getTournamentMatches(eventId)
            ]);
            
            const detailsTyped = detailsData as EventDetails | null;
            if (detailsTyped && typeof detailsTyped === 'object' && detailsTyped.ID === eventId) { 
                setTournamentDetails(detailsTyped); 
            } else { 
                throw new Error(`Tournament details not found or invalid for event ${eventId}.`); 
            }
            
            const currentMatches = Array.isArray(matchesData) ? matchesData as Match[] : [];
            const processedData = processMatchesForList(currentMatches);
            setProcessedListData(processedData);
            
            // Also fetch prize data
            await fetchPrizeData(eventId);
        } catch (err: any) {
            setError(err.message || "Failed to load tournament data."); 
            setTournamentDetails(null); 
            setProcessedListData([]);
        } finally { 
            setLoading(false); 
            setIsRefreshing(false); 
        }
    }, [eventId]);

    // --- Effects (Fixed to prevent infinite loops) ---
    useEffect(() => { checkLoginStatus(); }, [checkLoginStatus]);
    useEffect(() => { 
        if (eventId !== null) { 
            loadData(); 
        } else { 
            setError("Invalid Event ID provided."); 
        } 
    }, [eventId]); // CRASH FIX: Remove loadData dependency to prevent infinite loop

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

    // Render list item function (Corrected return type and potential issue)
    const renderListItem = ({ item }: { item: ListItem }): React.ReactElement | null => { // Explicit return type
        if (item.type === 'statusHeader') return <StatusHeaderItem title={item.title} iconName={item.iconName} />;
        if (item.type === 'roundHeader') {
            const prizeAmount = item.round !== null && item.round !== undefined ? roundPrizes[item.round] : undefined;
            return <RoundHeaderItem roundName={item.roundName} prizeAmount={prizeAmount} />;
        }
        if (item.type === 'match') return <MatchItem item={item} navigation={router} />;
        return null; // Explicitly return null for invalid item types
    };

    // --- Corrected Helper Component Definitions ---
    const LoadingComponent = (): React.ReactElement => ( // Return JSX element
        <View style={styles.centerContent}><ActivityIndicator size="large" color={COLORS.accentLight}/><Text style={styles.messageText}>Loading Tournament...</Text></View>
    );
    const ErrorComponent = (): React.ReactElement => ( // Return JSX element
         <View style={styles.centerContent}>
            <Ionicons name={ICONS.error} size={48} color={COLORS.error} />
            <Text style={[styles.messageText, { color: COLORS.error }]}>Error: {error}</Text>
            {eventId !== null && <TouchableOpacity onPress={() => loadData()} style={styles.retryButton}><Ionicons name={ICONS.refresh} size={18} color={COLORS.white} /><Text style={styles.retryButtonText}>Retry</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtnError}><Text style={styles.retryButtonText}>Go Back</Text></TouchableOpacity>
        </View>
    );
    const EmptyMatchesComponent = (): React.ReactElement => ( // Return JSX element
        <View style={styles.centerContent}>
            <Ionicons name={ICONS.empty} size={48} color={COLORS.textMuted} />
            <Text style={styles.messageText}>No matches found for the selected filter.</Text>
        </View>
    );
    const filterButtons: { label: string; value: ActiveFilterType; icon: keyof typeof Ionicons.glyphMap }[] = [
        { label: 'All', value: 'all', icon: ICONS.all }, 
        { label: 'Live', value: 'livePlaying', icon: ICONS.livePlaying }, 
        { label: 'Break', value: 'onBreak', icon: ICONS.onBreak }, 
        { label: 'Upcoming', value: 'upcoming', icon: ICONS.upcoming }, 
        { label: 'Results', value: 'finished', icon: ICONS.finished }
    ];

    // --- Main Display Logic ---
    if (loading && !tournamentDetails) return <SafeAreaView style={styles.container}><LoadingComponent /></SafeAreaView>;
    if (error && !tournamentDetails) return <SafeAreaView style={styles.container}><ErrorComponent /></SafeAreaView>;
    if (!tournamentDetails) return ( <SafeAreaView style={styles.container}><View style={styles.centerContent}><Text style={styles.messageText}>Tournament not found or ID is invalid.</Text><TouchableOpacity onPress={() => router.back()} style={styles.backBtnError}><Text style={styles.retryButtonText}>Go Back</Text></TouchableOpacity></View></SafeAreaView> );

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />
            {/* Custom Header */}
            <View style={styles.customHeader}>
                 <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                     <Ionicons name={ICONS.backArrow} size={26} color={COLORS.textHeader} />
                 </TouchableOpacity>
                 <Text style={styles.customHeaderTitle} numberOfLines={1}>Tournament Details</Text>
                 <View style={styles.headerPlaceholder} />
            </View>
            
            {/* Compact Tournament Header */}
            <TournamentHeader 
                tournament={tournamentDetails} 
                matchCount={processedListData.filter(item => item.type === 'match').length}
                prizeData={prizeData}
            />
            
            {/* Integrated Match List with Sticky Filters */}
            <View style={styles.integratedListArea}>
                {/* Conditional Rendering Logic */}
                {loading && filteredListData.length === 0 ? <LoadingComponent />
                : error ? <ErrorComponent />
                : (
                    <FlatList
                        data={filteredListData}
                        renderItem={renderListItem}
                        keyExtractor={(item: ListItem) => {
                             if (item.type === 'match') { return `match-${item.id}`; }
                             return item.id;
                         }}
                        ListHeaderComponent={() => (
                            <View style={styles.stickyFilterContainer}>
                                <DeviceAwareFilterScrollView
                                    options={filterButtons.map(filter => ({
                                        id: filter.value,
                                        label: filter.label,
                                        icon: filter.icon
                                    }))}
                                    selectedValue={activeFilter}
                                    onSelectionChange={(value) => {
                                        console.log(`[TourFilter] Device-Aware: ${value}`);
                                        setActiveFilter(value as ActiveFilterType);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    colors={COLORS}
                                    containerStyle={styles.stickyFilterScrollView}
                                />
                            </View>
                        )}
                        stickyHeaderIndices={[0]}
                        ListEmptyComponent={!loading ? <EmptyMatchesComponent /> : null}
                        contentContainerStyle={styles.integratedListContentContainer}
                        initialNumToRender={15} 
                        maxToRenderPerBatch={10} 
                        windowSize={11}
                        refreshControl={
                            <RefreshControl 
                                refreshing={isRefreshing} 
                                onRefresh={() => loadData(true)} 
                                tintColor={COLORS.accentLight} 
                                colors={[COLORS.accentLight]} 
                            />
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}; // End TournamentDetailsScreen

// --- Compact Tournament Header Styles ---
const tournamentHeaderStyles = StyleSheet.create({
    compactHeader: {
        marginHorizontal: 10,
        marginVertical: 4,
        borderRadius: 8,
        overflow: 'hidden',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 2,
    },
    compactGradient: {
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
    },
    compactTitle: {
        fontSize: 14,
        fontFamily: 'PoppinsBold',
        flex: 1,
        marginRight: 8,
        lineHeight: 18,
    },
    compactBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    compactBadgeText: {
        color: '#FFFFFF',
        fontSize: 8,
        fontFamily: 'PoppinsBold',
        letterSpacing: 0.3,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 4,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        flex: 1,
        minWidth: 70,
    },
    infoText: {
        fontSize: 9,
        fontFamily: 'PoppinsRegular',
        flexShrink: 1,
    },
});

// --- Improved Styles ---
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: Platform.OS === 'android' ? 12 : 8,
        paddingHorizontal: 4,
        paddingBottom: 6,
        borderBottomColor: COLORS.cardBorder,
        borderBottomWidth: 1,
        backgroundColor: 'transparent',
    },
    backButton: {
        padding: 8,
    },
    customHeaderTitle: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textHeader,
        textAlign: 'center',
        marginHorizontal: 4,
    },
    headerPlaceholder: {
        width: 36,
    },
    integratedListArea: {
        flex: 1,
        marginTop: 2,
    },
    stickyFilterContainer: {
        backgroundColor: COLORS.cardBackground,
        borderBottomColor: COLORS.cardBorder,
        borderBottomWidth: 1,
        paddingVertical: 6,
        marginBottom: 4,
    },
    stickyFilterScrollView: {
        paddingHorizontal: 10,
        paddingRight: 16,
    },
    stickyFilterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.filterButton,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 12,
        marginRight: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 167, 38, 0.2)',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 1,
    },
    stickyFilterButtonActive: {
        backgroundColor: COLORS.filterButtonActive,
        borderColor: COLORS.filterButtonActive,
        elevation: 1,
        shadowOpacity: 0.08,
    },
    stickyFilterText: {
        color: COLORS.filterText,
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        marginLeft: 3,
        letterSpacing: 0,
    },
    stickyFilterTextActive: {
        color: COLORS.filterTextActive,
        fontFamily: 'PoppinsSemiBold',
    },
    integratedListContentContainer: {
        paddingHorizontal: 10,
        paddingBottom: 16,
    },
    centerContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    messageText: {
        textAlign: 'center',
        fontSize: 16,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textMuted,
        marginTop: 15,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: COLORS.accent,
        borderRadius: 8,
        marginTop: 20,
    },
    retryButtonText: {
        color: COLORS.white,
        fontSize: 16,
        fontFamily: 'PoppinsMedium',
        marginLeft: 8,
    },
    backBtnError: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#4b5563',
        borderRadius: 5,
    },
    statusHeaderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        marginTop: 8,
        marginBottom: 4,
    },
    statusHeaderText: {
        fontSize: 13,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textHeader,
        marginLeft: 8,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    roundHeaderItem: {
        paddingVertical: 4,
        paddingHorizontal: 4,
        marginTop: 2,
        marginBottom: 2,
    },
    roundHeaderContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginLeft: 8,
        marginRight: 4,
    },
    roundHeaderText: {
        fontSize: 11,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textSecondary,
        flex: 1,
    },
    prizeText: {
        fontSize: 9,
        fontFamily: 'PoppinsMedium',
        color: COLORS.accent,
        marginLeft: 8,
    },
    matchItemContainer: {
        marginVertical: 3,
        borderRadius: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    matchItemContent: {
        backgroundColor: COLORS.cardBackground,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        overflow: 'hidden',
    },
    statusIndicatorWrapper: {
        position: 'absolute',
        top: 6,
        right: 6,
        zIndex: 1,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 4,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    statusIndicatorText: {
        color: COLORS.white,
        fontSize: 8,
        fontFamily: 'PoppinsBold',
    },
    playerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 5,
        marginTop: 2,
    },
    playerName: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textPrimary,
        flexShrink: 1,
        flexBasis: '40%',
    },
    playerLeft: {
        textAlign: 'left',
        marginRight: 4,
    },
    playerRight: {
        textAlign: 'right',
        marginLeft: 4,
        paddingRight: 40,
    },
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: COLORS.score,
    },
    score: {
        fontSize: 14,
        fontFamily: 'PoppinsBold',
        color: COLORS.score,
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 5,
        paddingTop: 5,
        borderTopColor: COLORS.cardBorder,
        borderTopWidth: 1,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 1,
        paddingRight: 4,
    },
    detailText: {
        fontSize: 10,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textSecondary,
        marginLeft: 4,
        flexShrink: 1,
    },
});

export default TournamentDetailsScreen;

