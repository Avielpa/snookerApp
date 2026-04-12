// app/compare/index.tsx — Player Comparison Screen
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    FlatList,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    StyleSheet,
    Platform,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../contexts/ThemeContext';
import { fetchCompareData, fetchRankedPlayerList, CompareData, ComparePlayer, RankedPlayer } from '../../services/compareService';
import { getNationalityFlag } from '../../utils/nationalityFlag';
import { logger } from '../../utils/logger';

// ---- Types -----------------------------------------------------------------

type Phase = 'pick' | 'comparing';
type Slot = 'p1' | 'p2';
type Winner = 'p1' | 'p2' | 'tie';

// ---- Helpers ---------------------------------------------------------------

const higherWins = (a: number | null | undefined, b: number | null | undefined): Winner => {
    if (a == null || b == null) return 'tie';
    if (a > b) return 'p1';
    if (b > a) return 'p2';
    return 'tie';
};

const lowerWins = (a: number | null | undefined, b: number | null | undefined): Winner => {
    if (a == null || b == null) return 'tie';
    if (a < b) return 'p1';
    if (b < a) return 'p2';
    return 'tie';
};

const fmt = (val: number | null | undefined, suffix = ''): string => {
    if (val == null) return '—';
    return `${val}${suffix}`;
};

const fmtPct = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return `${val}%`;
};

const fmtMoney = (val: number | null | undefined): string => {
    if (val == null) return '—';
    return `£${val.toLocaleString()}`;
};

// ---- Sub-components --------------------------------------------------------

const SectionCard = ({ title, icon, children, colors }: {
    title: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    children: React.ReactNode;
    colors: any;
}) => (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <View style={styles.cardHeader}>
            <Ionicons name={icon} size={16} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
        </View>
        {children}
    </View>
);

const StatRow = ({ label, p1Val, p2Val, winner, colors }: {
    label: string;
    p1Val: string;
    p2Val: string;
    winner: Winner;
    colors: any;
}) => (
    <View style={styles.statRow}>
        <Text style={[
            styles.statVal,
            styles.statValLeft,
            { color: winner === 'p1' ? colors.primary : colors.textSecondary },
            winner === 'p1' && styles.statValWinner,
        ]}>
            {p1Val}
        </Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[
            styles.statVal,
            styles.statValRight,
            { color: winner === 'p2' ? colors.primary : colors.textSecondary },
            winner === 'p2' && styles.statValWinner,
        ]}>
            {p2Val}
        </Text>
    </View>
);

const StatDivider = ({ colors }: { colors: any }) => (
    <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 4 }} />
);

const FormDot = ({ result, colors }: { result: string; colors: any }) => (
    <View style={[
        styles.formDot,
        { backgroundColor: result === 'W' ? colors.success : colors.error }
    ]} />
);

// ---- Player Slot -----------------------------------------------------------

const PlayerSlot = ({ player, label, onPress, colors }: {
    player: ComparePlayer | null;
    label: string;
    onPress: () => void;
    colors: any;
}) => (
    <TouchableOpacity
        style={[styles.slot, { borderColor: player ? colors.primary : colors.cardBorder, backgroundColor: colors.cardBackground }]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        {player ? (
            <>
                {player.Photo ? (
                    <Image source={{ uri: player.Photo }} style={styles.slotPhoto} />
                ) : (
                    <View style={[styles.slotPhotoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                        <Ionicons name="person" size={22} color={colors.primary} />
                    </View>
                )}
                <View style={{ flex: 1 }}>
                    <Text style={[styles.slotName, { color: colors.text }]} numberOfLines={1}>
                        {getNationalityFlag(player.Nationality || '')} {player.FirstName} {player.LastName}
                    </Text>
                    <Text style={[styles.slotSub, { color: colors.textSecondary }]}>
                        {player.current_ranking_position ? `Rank #${player.current_ranking_position}` : 'Unranked'}
                    </Text>
                </View>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </>
        ) : (
            <>
                <View style={[styles.slotPhotoPlaceholder, { backgroundColor: colors.cardBorder }]}>
                    <Ionicons name="add" size={22} color={colors.textMuted} />
                </View>
                <Text style={[styles.slotName, { color: colors.textSecondary }]}>{label}</Text>
            </>
        )}
    </TouchableOpacity>
);

// ---- Picker ----------------------------------------------------------------

const PlayerPicker = ({ players, onSelect, colors }: {
    players: RankedPlayer[];
    onSelect: (p: RankedPlayer) => void;
    colors: any;
}) => {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search.trim()) return players;
        const q = search.toLowerCase();
        return players.filter((p) => p.name.toLowerCase().includes(q));
    }, [search, players]);

    return (
        <View style={{ flex: 1 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search player..."
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                    autoCorrect={false}
                />
                {search ? (
                    <TouchableOpacity onPress={() => setSearch('')}>
                        <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                ) : null}
            </View>
            <FlatList
                data={filtered}
                keyExtractor={(item) => String(item.id)}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.pickerRow, { borderBottomColor: colors.cardBorder }]}
                        onPress={() => onSelect(item)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.pickerRank, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                            <Text style={[styles.pickerRankText, { color: colors.textSecondary }]}>
                                {item.position ?? '—'}
                            </Text>
                        </View>
                        <Text style={[styles.pickerName, { color: colors.text }]} numberOfLines={1}>
                            {getNationalityFlag(item.nationality || '')} {item.name}
                        </Text>
                        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

// ---- Comparison View -------------------------------------------------------

const ComparisonView = ({ data, onChangeP1, onChangeP2, colors }: {
    data: CompareData;
    onChangeP1: () => void;
    onChangeP2: () => void;
    colors: any;
}) => {
    const { p1, p2, h2h } = data;

    const p1Name = `${p1.FirstName || ''} ${p1.LastName || ''}`.trim();
    const p2Name = `${p2.FirstName || ''} ${p2.LastName || ''}`.trim();

    const p1Wins = h2h?.Player1ID === p1.ID ? (h2h?.Player1Wins ?? 0) : (h2h?.Player2Wins ?? 0);
    const p2Wins = h2h?.Player1ID === p1.ID ? (h2h?.Player2Wins ?? 0) : (h2h?.Player1Wins ?? 0);
    const totalMeetings = h2h?.TotalMeetings ?? 0;

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.compareContent}
            showsVerticalScrollIndicator={false}
        >
            {/* Player header */}
            <View style={styles.playerHeader}>
                <TouchableOpacity style={styles.headerPlayer} onPress={onChangeP1} activeOpacity={0.8}>
                    {p1.Photo ? (
                        <Image source={{ uri: p1.Photo }} style={styles.headerPhoto} />
                    ) : (
                        <View style={[styles.headerPhotoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                            <Ionicons name="person" size={30} color={colors.primary} />
                        </View>
                    )}
                    <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={2}>
                        {getNationalityFlag(p1.Nationality || '')} {p1Name}
                    </Text>
                    <Text style={[styles.headerChange, { color: colors.textMuted }]}>tap to change</Text>
                </TouchableOpacity>

                <View style={styles.vsContainer}>
                    <Text style={[styles.vsText, { color: colors.primary }]}>VS</Text>
                </View>

                <TouchableOpacity style={styles.headerPlayer} onPress={onChangeP2} activeOpacity={0.8}>
                    {p2.Photo ? (
                        <Image source={{ uri: p2.Photo }} style={styles.headerPhoto} />
                    ) : (
                        <View style={[styles.headerPhotoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                            <Ionicons name="person" size={30} color={colors.primary} />
                        </View>
                    )}
                    <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={2}>
                        {getNationalityFlag(p2.Nationality || '')} {p2Name}
                    </Text>
                    <Text style={[styles.headerChange, { color: colors.textMuted }]}>tap to change</Text>
                </TouchableOpacity>
            </View>

            {/* Column labels */}
            <View style={styles.columnLabels}>
                <Text style={[styles.columnName, { color: colors.primary }]} numberOfLines={1}>{p1Name}</Text>
                <View style={{ width: 120 }} />
                <Text style={[styles.columnName, { color: colors.primary }]} numberOfLines={1}>{p2Name}</Text>
            </View>

            {/* Section 1: Profile */}
            <SectionCard title="Profile" icon="person-outline" colors={colors}>
                <StatRow label="Age" p1Val={fmt(p1.age)} p2Val={fmt(p2.age)} winner="tie" colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Nationality" p1Val={p1.Nationality || '—'} p2Val={p2.Nationality || '—'} winner="tie" colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Years as Pro" p1Val={fmt(p1.years_as_pro)} p2Val={fmt(p2.years_as_pro)} winner={higherWins(p1.years_as_pro, p2.years_as_pro)} colors={colors} />
            </SectionCard>

            {/* Section 2: Rankings & Titles */}
            <SectionCard title="Rankings & Titles" icon="podium-outline" colors={colors}>
                <StatRow
                    label="World Ranking"
                    p1Val={p1.current_ranking_position ? `#${p1.current_ranking_position}` : '—'}
                    p2Val={p2.current_ranking_position ? `#${p2.current_ranking_position}` : '—'}
                    winner={lowerWins(p1.current_ranking_position, p2.current_ranking_position)}
                    colors={colors}
                />
                <StatDivider colors={colors} />
                <StatRow
                    label="Ranking Trend"
                    p1Val={p1.ranking_trend?.delta != null ? (p1.ranking_trend.delta > 0 ? `↑${p1.ranking_trend.delta}` : p1.ranking_trend.delta < 0 ? `↓${Math.abs(p1.ranking_trend.delta)}` : '→') : '—'}
                    p2Val={p2.ranking_trend?.delta != null ? (p2.ranking_trend.delta > 0 ? `↑${p2.ranking_trend.delta}` : p2.ranking_trend.delta < 0 ? `↓${Math.abs(p2.ranking_trend.delta)}` : '→') : '—'}
                    winner={higherWins(p1.ranking_trend?.delta, p2.ranking_trend?.delta)}
                    colors={colors}
                />
                <StatDivider colors={colors} />
                <StatRow label="Ranking Titles" p1Val={fmt(p1.NumRankingTitles)} p2Val={fmt(p2.NumRankingTitles)} winner={higherWins(p1.NumRankingTitles, p2.NumRankingTitles)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Prize (Season)" p1Val={fmtMoney(p1.prize_money_this_year)} p2Val={fmtMoney(p2.prize_money_this_year)} winner={higherWins(p1.prize_money_this_year, p2.prize_money_this_year)} colors={colors} />
            </SectionCard>

            {/* Section 3: Career Record */}
            <SectionCard title="Career Record" icon="trophy-outline" colors={colors}>
                <StatRow label="Career Wins" p1Val={fmt(p1.career_wins)} p2Val={fmt(p2.career_wins)} winner={higherWins(p1.career_wins, p2.career_wins)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Career Losses" p1Val={fmt(p1.career_losses)} p2Val={fmt(p2.career_losses)} winner={lowerWins(p1.career_losses, p2.career_losses)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Win %" p1Val={fmtPct(p1.career_win_pct)} p2Val={fmtPct(p2.career_win_pct)} winner={higherWins(p1.career_win_pct, p2.career_win_pct)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Frames Won" p1Val={fmt(p1.frame_stats?.frames_won)} p2Val={fmt(p2.frame_stats?.frames_won)} winner={higherWins(p1.frame_stats?.frames_won, p2.frame_stats?.frames_won)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Frame Win %" p1Val={fmtPct(p1.frame_stats?.frame_pct)} p2Val={fmtPct(p2.frame_stats?.frame_pct)} winner={higherWins(p1.frame_stats?.frame_pct, p2.frame_stats?.frame_pct)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Finals Reached" p1Val={fmt(p1.finals_record?.finals_reached)} p2Val={fmt(p2.finals_record?.finals_reached)} winner={higherWins(p1.finals_record?.finals_reached, p2.finals_record?.finals_reached)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Finals Won" p1Val={fmt(p1.finals_record?.finals_won)} p2Val={fmt(p2.finals_record?.finals_won)} winner={higherWins(p1.finals_record?.finals_won, p2.finals_record?.finals_won)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow
                    label="Deciding Frames %"
                    p1Val={fmtPct(p1.deciding_frames?.deciding_pct)}
                    p2Val={fmtPct(p2.deciding_frames?.deciding_pct)}
                    winner={higherWins(p1.deciding_frames?.deciding_pct, p2.deciding_frames?.deciding_pct)}
                    colors={colors}
                />
            </SectionCard>

            {/* Section 4: Breaks & Centuries */}
            <SectionCard title="Breaks & Centuries" icon="flash-outline" colors={colors}>
                <StatRow label="Career 147s" p1Val={fmt(p1.NumMaximums)} p2Val={fmt(p2.NumMaximums)} winner={higherWins(p1.NumMaximums, p2.NumMaximums)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Career Centuries" p1Val={fmt(p1.century_career_total)} p2Val={fmt(p2.century_career_total)} winner={higherWins(p1.century_career_total, p2.century_career_total)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="This Season" p1Val={fmt(p1.century_season_current)} p2Val={fmt(p2.century_season_current)} winner={higherWins(p1.century_season_current, p2.century_season_current)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Last Season" p1Val={fmt(p1.century_season_prev1)} p2Val={fmt(p2.century_season_prev1)} winner={higherWins(p1.century_season_prev1, p2.century_season_prev1)} colors={colors} />
            </SectionCard>

            {/* Section 5: This Season */}
            <SectionCard title="This Season" icon="calendar-outline" colors={colors}>
                <StatRow label="Matches Played" p1Val={fmt(p1.season_stats?.matches)} p2Val={fmt(p2.season_stats?.matches)} winner="tie" colors={colors} />
                <StatDivider colors={colors} />
                <StatRow label="Wins" p1Val={fmt(p1.season_stats?.wins)} p2Val={fmt(p2.season_stats?.wins)} winner={higherWins(p1.season_stats?.wins, p2.season_stats?.wins)} colors={colors} />
                <StatDivider colors={colors} />
                <StatRow
                    label="Win %"
                    p1Val={fmtPct(
                        p1.season_stats?.matches
                            ? Math.round(((p1.season_stats.wins ?? 0) / p1.season_stats.matches) * 1000) / 10
                            : null
                    )}
                    p2Val={fmtPct(
                        p2.season_stats?.matches
                            ? Math.round(((p2.season_stats.wins ?? 0) / p2.season_stats.matches) * 1000) / 10
                            : null
                    )}
                    winner={higherWins(
                        p1.season_stats?.matches ? (p1.season_stats.wins ?? 0) / p1.season_stats.matches : null,
                        p2.season_stats?.matches ? (p2.season_stats.wins ?? 0) / p2.season_stats.matches : null,
                    )}
                    colors={colors}
                />
            </SectionCard>

            {/* Section 6: Form */}
            <SectionCard title="Current Form" icon="pulse-outline" colors={colors}>
                <View style={styles.formRow}>
                    <View style={styles.formDots}>
                        {(p1.recent_form ?? []).slice(0, 10).map((r, i) => (
                            <FormDot key={i} result={r} colors={colors} />
                        ))}
                        {(p1.recent_form ?? []).length === 0 && <Text style={[styles.noData, { color: colors.textMuted }]}>—</Text>}
                    </View>
                    <Text style={[styles.formLabel, { color: colors.textMuted }]}>Last 10</Text>
                    <View style={[styles.formDots, { justifyContent: 'flex-end' }]}>
                        {(p2.recent_form ?? []).slice(0, 10).map((r, i) => (
                            <FormDot key={i} result={r} colors={colors} />
                        ))}
                        {(p2.recent_form ?? []).length === 0 && <Text style={[styles.noData, { color: colors.textMuted }]}>—</Text>}
                    </View>
                </View>
                <StatDivider colors={colors} />
                <StatRow
                    label="Win Streak"
                    p1Val={p1.win_streak != null ? (p1.win_streak > 0 ? `${p1.win_streak}W` : p1.win_streak < 0 ? `${Math.abs(p1.win_streak)}L` : '—') : '—'}
                    p2Val={p2.win_streak != null ? (p2.win_streak > 0 ? `${p2.win_streak}W` : p2.win_streak < 0 ? `${Math.abs(p2.win_streak)}L` : '—') : '—'}
                    winner={higherWins(p1.win_streak, p2.win_streak)}
                    colors={colors}
                />
            </SectionCard>

            {/* Section 7: Head to Head */}
            <SectionCard title="Head to Head" icon="git-compare-outline" colors={colors}>
                {totalMeetings === 0 ? (
                    <Text style={[styles.noData, { color: colors.textMuted, textAlign: 'center', paddingVertical: 8 }]}>
                        No meetings recorded
                    </Text>
                ) : (
                    <>
                        <View style={styles.h2hRow}>
                            <Text style={[styles.h2hWins, { color: p1Wins > p2Wins ? colors.primary : colors.textSecondary }]}>{p1Wins}</Text>
                            <View style={{ flex: 1, alignItems: 'center' }}>
                                <Text style={[styles.h2hLabel, { color: colors.textMuted }]}>{totalMeetings} meetings</Text>
                                <View style={styles.h2hBar}>
                                    <View style={[styles.h2hBarFill, {
                                        flex: totalMeetings ? p1Wins : 1,
                                        backgroundColor: colors.primary,
                                        borderTopLeftRadius: 3, borderBottomLeftRadius: 3,
                                    }]} />
                                    <View style={[styles.h2hBarFill, {
                                        flex: totalMeetings ? p2Wins : 1,
                                        backgroundColor: colors.textMuted,
                                        borderTopRightRadius: 3, borderBottomRightRadius: 3,
                                    }]} />
                                </View>
                            </View>
                            <Text style={[styles.h2hWins, { color: p2Wins > p1Wins ? colors.primary : colors.textSecondary }]}>{p2Wins}</Text>
                        </View>
                        {h2h?.LastResult ? (
                            <Text style={[styles.h2hLastResult, { color: colors.textSecondary }]}>
                                Last: {h2h.LastResult}
                            </Text>
                        ) : null}
                    </>
                )}
            </SectionCard>
        </ScrollView>
    );
};

// ---- Main Screen -----------------------------------------------------------

export default function CompareScreen() {
    const colors = useColors();
    const router = useRouter();
    const params = useLocalSearchParams<{ p1?: string }>();

    const [phase, setPhase] = useState<Phase>('pick');
    const [activeSlot, setActiveSlot] = useState<Slot>('p1');
    const [p1Id, setP1Id] = useState<number | null>(params.p1 ? parseInt(params.p1, 10) : null);
    const [p2Id, setP2Id] = useState<number | null>(null);

    const [p1Player, setP1Player] = useState<ComparePlayer | null>(null);
    const [p2Player, setP2Player] = useState<ComparePlayer | null>(null);
    const [compareData, setCompareData] = useState<CompareData | null>(null);

    const [playerList, setPlayerList] = useState<RankedPlayer[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [comparing, setComparing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load player list on mount
    useEffect(() => {
        fetchRankedPlayerList().then((list) => {
            setPlayerList(list);
            setListLoading(false);
        });
    }, []);

    // If p1 pre-filled via URL param, load its name
    useEffect(() => {
        if (p1Id && playerList.length > 0) {
            const found = playerList.find((p) => p.id === p1Id);
            if (found) {
                // pre-populate slot, move to p2 pick
                setActiveSlot('p2');
            }
        }
    }, [p1Id, playerList]);

    // Trigger comparison when both IDs set
    useEffect(() => {
        if (p1Id && p2Id) {
            setComparing(true);
            setError(null);
            fetchCompareData(p1Id, p2Id)
                .then((data) => {
                    setCompareData(data);
                    setP1Player(data.p1);
                    setP2Player(data.p2);
                    setPhase('comparing');
                })
                .catch((e) => {
                    logger.error('[CompareScreen] fetchCompareData error:', e);
                    setError('Failed to load comparison data. Please try again.');
                })
                .finally(() => setComparing(false));
        }
    }, [p1Id, p2Id]);

    const handleSelectPlayer = useCallback((p: RankedPlayer) => {
        if (activeSlot === 'p1') {
            setP1Id(p.id);
            if (p2Id) { /* already have p2, do nothing — effect triggers compare */ }
            else setActiveSlot('p2');
        } else {
            setP2Id(p.id);
        }
    }, [activeSlot, p2Id]);

    const handleChangeP1 = useCallback(() => {
        setP1Id(null);
        setP1Player(null);
        setCompareData(null);
        setPhase('pick');
        setActiveSlot('p1');
    }, []);

    const handleChangeP2 = useCallback(() => {
        setP2Id(null);
        setP2Player(null);
        setCompareData(null);
        setPhase('pick');
        setActiveSlot('p2');
    }, []);

    const p1FromList = useMemo(() => playerList.find((p) => p.id === p1Id) ?? null, [playerList, p1Id]);
    const p2FromList = useMemo(() => playerList.find((p) => p.id === p2Id) ?? null, [playerList, p2Id]);

    // Build stub ComparePlayer for slot display when full data not loaded
    const toStubPlayer = (rp: RankedPlayer | null): ComparePlayer | null => {
        if (!rp) return null;
        return { ID: rp.id, FirstName: rp.name, Nationality: rp.nationality, Active: true };
    };

    const displayP1 = p1Player ?? toStubPlayer(p1FromList);
    const displayP2 = p2Player ?? toStubPlayer(p2FromList);

    const pickerTitle = activeSlot === 'p1' ? 'Select Player 1' : 'Select Player 2';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom', 'left', 'right']}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: 'Compare Players',
                    headerStyle: { backgroundColor: colors.background },
                    headerTintColor: colors.primary,
                    headerTitleStyle: { color: colors.text, fontFamily: 'PoppinsSemiBold', fontSize: 18 },
                    headerBackTitle: '',
                }}
            />

            {/* Slot headers — always visible */}
            <View style={[styles.slots, { borderBottomColor: colors.cardBorder }]}>
                <PlayerSlot
                    player={displayP1}
                    label="Select Player 1"
                    onPress={() => { setActiveSlot('p1'); if (phase === 'comparing') handleChangeP1(); }}
                    colors={colors}
                />
                <View style={styles.slotDivider}>
                    <Text style={[styles.vsSmall, { color: colors.primary }]}>VS</Text>
                </View>
                <PlayerSlot
                    player={displayP2}
                    label="Select Player 2"
                    onPress={() => { setActiveSlot('p2'); if (phase === 'comparing') handleChangeP2(); }}
                    colors={colors}
                />
            </View>

            {/* Content area */}
            {comparing ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading comparison...</Text>
                </View>
            ) : error ? (
                <View style={styles.center}>
                    <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                    <TouchableOpacity
                        style={[styles.retryBtn, { borderColor: colors.primary }]}
                        onPress={() => { if (p1Id && p2Id) { setP2Id(null); setTimeout(() => setP2Id(p2Id), 50); } }}
                    >
                        <Text style={{ color: colors.primary, fontFamily: 'PoppinsMedium' }}>Retry</Text>
                    </TouchableOpacity>
                </View>
            ) : phase === 'pick' ? (
                <View style={{ flex: 1, padding: 16 }}>
                    <Text style={[styles.pickerTitle, { color: colors.textSecondary }]}>{pickerTitle}</Text>
                    {listLoading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : (
                        <PlayerPicker players={playerList} onSelect={handleSelectPlayer} colors={colors} />
                    )}
                </View>
            ) : compareData ? (
                <ComparisonView
                    data={compareData}
                    onChangeP1={handleChangeP1}
                    onChangeP2={handleChangeP2}
                    colors={colors}
                />
            ) : null}
        </SafeAreaView>
    );
}

// ---- Styles ----------------------------------------------------------------

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    loadingText: { fontFamily: 'PoppinsRegular', fontSize: 14 },
    errorText: { fontFamily: 'PoppinsRegular', fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
    retryBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8, marginTop: 8 },

    // Slots
    slots: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 8,
        borderBottomWidth: 1,
    },
    slot: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
    },
    slotPhoto: { width: 36, height: 36, borderRadius: 18 },
    slotPhotoPlaceholder: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    slotName: { flex: 1, fontSize: 12, fontFamily: 'PoppinsMedium' },
    slotSub: { fontSize: 10, fontFamily: 'PoppinsRegular' },
    slotDivider: { alignItems: 'center', width: 32 },
    vsSmall: { fontSize: 12, fontFamily: 'PoppinsBold' },

    // Picker
    pickerTitle: { fontSize: 13, fontFamily: 'PoppinsMedium', marginBottom: 12 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: 'PoppinsRegular', padding: 0 },
    pickerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 10,
    },
    pickerRank: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    pickerRankText: { fontSize: 11, fontFamily: 'PoppinsMedium' },
    pickerName: { flex: 1, fontSize: 14, fontFamily: 'PoppinsMedium' },

    // Comparison header
    playerHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
    headerPlayer: { flex: 1, alignItems: 'center', gap: 6 },
    headerPhoto: { width: 72, height: 72, borderRadius: 36 },
    headerPhotoPlaceholder: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    headerName: { fontSize: 13, fontFamily: 'PoppinsBold', textAlign: 'center' },
    headerChange: { fontSize: 10, fontFamily: 'PoppinsRegular' },
    vsContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 24 },
    vsText: { fontSize: 20, fontFamily: 'PoppinsBold' },

    // Column labels
    columnLabels: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, justifyContent: 'space-between' },
    columnName: { fontSize: 11, fontFamily: 'PoppinsBold', flex: 1, textAlign: 'center' },

    // Compare content
    compareContent: { paddingBottom: 40 },

    // Cards
    card: { margin: 16, marginBottom: 0, borderRadius: 16, borderWidth: 1, padding: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    cardTitle: { fontSize: 14, fontFamily: 'PoppinsBold' },

    // Stat rows
    statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    statVal: { width: 80, fontSize: 14, fontFamily: 'PoppinsMedium' },
    statValLeft: { textAlign: 'left' },
    statValRight: { textAlign: 'right' },
    statValWinner: { fontFamily: 'PoppinsBold', fontSize: 15 },
    statLabel: { flex: 1, fontSize: 12, fontFamily: 'PoppinsRegular', textAlign: 'center' },
    noData: { fontSize: 13, fontFamily: 'PoppinsRegular' },

    // Form
    formRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
    formDots: { flex: 1, flexDirection: 'row', gap: 3 },
    formLabel: { width: 48, fontSize: 11, fontFamily: 'PoppinsRegular', textAlign: 'center' },
    formDot: { width: 10, height: 10, borderRadius: 5 },

    // H2H
    h2hRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
    h2hWins: { fontSize: 32, fontFamily: 'PoppinsBold', width: 48, textAlign: 'center' },
    h2hLabel: { fontSize: 11, fontFamily: 'PoppinsRegular', marginBottom: 6 },
    h2hBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
    h2hBarFill: { height: 6 },
    h2hLastResult: { fontSize: 12, fontFamily: 'PoppinsRegular', textAlign: 'center', marginTop: 4 },
});
