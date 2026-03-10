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
    NumCompetitors?: number | null;
    // Augmented by backend
    defending_champion_name?: string | null;
    winner_name?: string | null;
    winner_id?: number | null;
    winner_prize?: number | null;
    winner_prize_currency?: string | null;
    round_names?: Record<number, string>;
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
const TournamentHeader = ({ tournament, matchCount }: { tournament: EventDetails; matchCount: number }) => {
    const colors = useColors();

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'TBD';
        try {
            return new Date(dateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        } catch { return 'TBD'; }
    };

    const formatPrize = (amount: number | null | undefined, currency: string | null | undefined) => {
        if (!amount) return null;
        const sym = currency === 'GBP' ? '£' : (currency ?? '');
        if (amount >= 1000000) return `${sym}${(amount / 1000000).toFixed(1)}m`;
        if (amount >= 1000) return `${sym}${Math.round(amount / 1000)}k`;
        return `${sym}${amount}`;
    };

    const tourBadgeColor = () => {
        switch (tournament.Tour) {
            case 'main': return COLORS.accent;
            case 'seniors': return '#FF9800';
            case 'womens': return '#4CAF50';
            default: return COLORS.textSecondary;
        }
    };

    const prizeFormatted = formatPrize(tournament.winner_prize, tournament.winner_prize_currency);
    const location = [tournament.City, tournament.Country].filter(Boolean).join(', ');

    // Info rows: each row is icon + text
    const InfoLine = ({ icon, text, color }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string }) => (
        <View style={tournamentHeaderStyles.infoItem}>
            <Ionicons name={icon} size={12} color={color ?? COLORS.textSecondary} />
            <Text style={[tournamentHeaderStyles.infoText, { color: color ?? COLORS.textSecondary }]} numberOfLines={1}>
                {text}
            </Text>
        </View>
    );

    return (
        <View style={[tournamentHeaderStyles.compactHeader, { backgroundColor: COLORS.cardBackground }]}>
            <LinearGradient
                colors={[COLORS.accent + '18', COLORS.cardBackground]}
                style={tournamentHeaderStyles.compactGradient}
            >
                {/* Title + badges row */}
                <View style={tournamentHeaderStyles.titleRow}>
                    <Text style={[tournamentHeaderStyles.compactTitle, { color: COLORS.textHeader }]} numberOfLines={2}>
                        {tournament.Name}
                    </Text>
                    <View style={tournamentHeaderStyles.badgeGroup}>
                        {tournament.Type && (
                            <View style={[tournamentHeaderStyles.compactBadge, { backgroundColor: tourBadgeColor() + 'CC' }]}>
                                <Text style={tournamentHeaderStyles.compactBadgeText}>{tournament.Type.toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Sponsor */}
                {tournament.Sponsor && (
                    <Text style={tournamentHeaderStyles.sponsorText}>Sponsored by {tournament.Sponsor}</Text>
                )}

                {/* Info lines */}
                <View style={tournamentHeaderStyles.infoGrid}>
                    <InfoLine
                        icon="calendar-outline"
                        text={`${formatDate(tournament.StartDate)} – ${formatDate(tournament.EndDate)}`}
                    />
                    {location.length > 0 && (
                        <InfoLine icon="location-outline" text={location} />
                    )}
                    {tournament.NumCompetitors && (
                        <InfoLine icon="people-outline" text={`${tournament.NumCompetitors} players`} />
                    )}
                    {prizeFormatted && (
                        <InfoLine icon="cash-outline" text={`Winner: ${prizeFormatted}`} color={COLORS.accent} />
                    )}
                </View>

                {/* Winner / Defending champ — only show when we have the data */}
                {(tournament.winner_name || tournament.defending_champion_name) && (
                    <View style={tournamentHeaderStyles.champRow}>
                        {tournament.winner_name && (
                            <View style={tournamentHeaderStyles.champItem}>
                                <Ionicons name="trophy" size={13} color={COLORS.accent} />
                                <Text style={[tournamentHeaderStyles.champText, { color: COLORS.textPrimary }]} numberOfLines={1}>
                                    {tournament.winner_name}
                                </Text>
                            </View>
                        )}
                        {tournament.defending_champion_name && !tournament.winner_name && (
                            <View style={tournamentHeaderStyles.champItem}>
                                <Ionicons name="shield-outline" size={13} color={COLORS.textSecondary} />
                                <Text style={[tournamentHeaderStyles.champText, { color: COLORS.textSecondary }]} numberOfLines={1}>
                                    Defending: {tournament.defending_champion_name}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
            </LinearGradient>
        </View>
    );
};

// --- Constants & Icons (Ensure these are defined at the top level) ---
const COLORS = { background: '#121212', cardBackground: '#1E1E1E', cardBorder: 'rgba(255, 255, 255, 0.12)', textHeader: '#FFB74D', textPrimary: '#FFFFFF', textSecondary: '#9CA3AF', textMuted: '#6B7280', score: '#FFB74D', accent: '#FFB74D', accentLight: '#FFB74D', live: '#4CAF50', onBreak: '#FF9800', error: '#F87171', white: '#FFFFFF', black: '#000000', filterButton: 'rgba(255, 180, 77, 0.15)', filterButtonActive: '#FFB74D', filterText: '#9CA3AF', filterTextActive: '#121212', };
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
        
        scoreDisplay = `${item.score1} - ${item.score2}`;

        // Double-check against winner_id if available (for validation)
        if (item.winner_id) {
            const scoreBasedWinner = item.score1 > item.score2 ? item.player1_id : item.player2_id;
            if (scoreBasedWinner !== item.winner_id) {
                logger.warn(`[MatchItem] Score/Winner mismatch for match ${item.api_match_id}: Score says ${scoreBasedWinner}, API says ${item.winner_id}`);
            }
        }
    } else if (item.score1 !== null && item.score1 !== undefined &&
               item.score2 !== null && item.score2 !== undefined) {
        scoreDisplay = `${item.score1} - ${item.score2}`;
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
    const [roundPrizes, setRoundPrizes] = useState<Record<number, string>>({});

    const checkLoginStatus = useCallback(async () => { 
        // Empty function - no login check needed for now
    }, []);

    // Fetch round prizes for round header display
    const fetchRoundPrizes = useCallback(async (eventId: number) => {
        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app'}/oneFourSeven/round-prizes/${eventId}/`);
            if (response.ok) {
                const data = await response.json();
                setRoundPrizes(data);
            }
        } catch (error) {
            logger.warn('[PrizeData] Failed to fetch round prizes:', error);
        }
    }, []);

    // --- Process matches function (Using snake_case and corrected loop) ---
    const processMatchesForList = (matches: Match[], roundNames: Record<number, string> = {}): ListItem[] => {
        if (!matches || matches.length === 0) return [];

        // DEDUPLICATION FIX: Remove duplicate matches by api_match_id OR live_url/details_url
        // When duplicates exist, keep the one with higher priority status and round
        const uniqueMatches = new Map<string, Match>();

        matches.forEach((match: Match) => {
            // Create a unique key based on api_match_id, live_url, or details_url
            // This handles cases where the same physical match has different api_match_ids
            let matchKey: string;

            if (match.live_url && match.live_url.trim() !== '') {
                // Prefer live_url as the unique identifier
                matchKey = `url:${match.live_url}`;
            } else if (match.details_url && match.details_url.trim() !== '') {
                // Fall back to details_url
                matchKey = `url:${match.details_url}`;
            } else if (match.api_match_id) {
                // Fall back to api_match_id
                matchKey = `id:${match.api_match_id}`;
            } else {
                // Last resort: use internal database ID
                matchKey = `db:${match.id}`;
            }

            const existing = uniqueMatches.get(matchKey);

            if (!existing) {
                uniqueMatches.set(matchKey, match);
            } else {
                // Determine which match to keep based on priority:
                // 1. Live playing (status_code 1) has highest priority
                // 2. On break (status_code 2)
                // 3. Upcoming (status_code 0)
                // 4. Finished (status_code 3) has lowest priority
                // Also prefer higher round numbers (later stages of tournament)

                const currentStatus = match.status_code ?? -1;
                const existingStatus = existing.status_code ?? -1;

                const currentRound = match.round ?? -1;
                const existingRound = existing.round ?? -1;

                // Status priority: 1 (live) > 2 (break) > 0 (upcoming) > 3 (finished)
                const getStatusPriority = (status: number): number => {
                    if (status === 1) return 4; // live - highest
                    if (status === 2) return 3; // on break
                    if (status === 0) return 2; // upcoming
                    if (status === 3) return 1; // finished - lowest
                    return 0;
                };

                const currentPriority = getStatusPriority(currentStatus);
                const existingPriority = getStatusPriority(existingStatus);

                // SIMPLE FIX: Higher round wins, OR if same round then higher status wins
                const shouldReplace =
                    (currentRound > existingRound) ||
                    (currentRound === existingRound && currentPriority > existingPriority);

                if (shouldReplace) {
                    logger.log(`[TourScreen MatchProcessing] 🔄 Replacing duplicate [${matchKey}]: ` +
                        `Old(api_id=${existing.api_match_id}, status=${existingStatus}, round=${existingRound}) -> ` +
                        `New(api_id=${match.api_match_id}, status=${currentStatus}, round=${currentRound})`);
                    uniqueMatches.set(matchKey, match);
                } else {
                    logger.log(`[TourScreen MatchProcessing] ⏭️  Keeping [${matchKey}]: ` +
                        `Keep(api_id=${existing.api_match_id}, status=${existingStatus}, round=${existingRound}) over ` +
                        `Skip(api_id=${match.api_match_id}, status=${currentStatus}, round=${currentRound})`);
                }
            }
        });

        const deduplicatedMatches = Array.from(uniqueMatches.values());

        if (deduplicatedMatches.length < matches.length) {
            logger.warn(`[TourScreen MatchProcessing] ⚠️  Removed ${matches.length - deduplicatedMatches.length} duplicate matches`);
        }

        const categories: Record<MatchCategory, { title: string; icon: keyof typeof Ionicons.glyphMap; matches: MatchListItem[] }> = {
            livePlaying: { title: 'Playing Now', icon: ICONS.livePlaying, matches: [] },
            onBreak: { title: 'On Break', icon: ICONS.onBreak, matches: [] },
            upcoming: { title: 'Upcoming', icon: ICONS.upcoming, matches: [] },
            finished: { title: 'Results', icon: ICONS.finished, matches: [] }
        };

        deduplicatedMatches.forEach(match => {
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
                        const roundName = (currentRound != null && roundNames[currentRound])
                            ? roundNames[currentRound]
                            : getRoundName(currentRound);
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
            const processedData = processMatchesForList(currentMatches, detailsTyped.round_names ?? {});
            setProcessedListData(processedData);
            
            // Fetch round prizes for round headers (non-blocking)
            fetchRoundPrizes(eventId);
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
                                        logger.debug(`[TourFilter] Device-Aware: ${value}`);
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

// --- Tournament Header Styles ---
const tournamentHeaderStyles = StyleSheet.create({
    compactHeader: {
        marginHorizontal: 10,
        marginTop: 6,
        marginBottom: 2,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    compactGradient: {
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 6,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8,
    },
    compactTitle: {
        fontSize: 15,
        fontFamily: 'PoppinsBold',
        flex: 1,
        lineHeight: 20,
    },
    badgeGroup: {
        flexDirection: 'row',
        gap: 4,
        flexShrink: 0,
        paddingTop: 2,
    },
    compactBadge: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 4,
    },
    compactBadgeText: {
        color: '#000',
        fontSize: 9,
        fontFamily: 'PoppinsBold',
        letterSpacing: 0.3,
    },
    sponsorText: {
        fontSize: 10,
        fontFamily: 'PoppinsRegular',
        color: COLORS.textMuted,
        marginTop: -2,
    },
    infoGrid: {
        gap: 4,
        marginTop: 2,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoText: {
        fontSize: 11,
        fontFamily: 'PoppinsRegular',
        flexShrink: 1,
    },
    champRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    champItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flex: 1,
    },
    champText: {
        fontSize: 12,
        fontFamily: 'PoppinsSemiBold',
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
        fontSize: 12,
        fontFamily: 'PoppinsSemiBold',
        color: COLORS.textSecondary,
        flex: 1,
        letterSpacing: 0.3,
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
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
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
        fontSize: 13,
        fontFamily: 'PoppinsMedium',
        color: COLORS.textPrimary,
        flexShrink: 1,
        flexBasis: '38%',
    },
    playerLeft: {
        textAlign: 'left',
        marginRight: 6,
    },
    playerRight: {
        textAlign: 'right',
        marginLeft: 6,
    },
    winnerText: {
        fontFamily: 'PoppinsBold',
        color: COLORS.score,
    },
    score: {
        fontSize: 16,
        fontFamily: 'PoppinsBold',
        color: COLORS.score,
        textAlign: 'center',
        paddingHorizontal: 8,
        minWidth: 56,
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

