// app/StatsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useColors } from '../contexts/ThemeContext';
import { logger } from '../utils/logger';
import {
    fetchCenturies,
    fetchTourWinners,
    fetchTitleLeaders,
    CenturiesData,
    TourWinnersData,
    TitleLeadersData,
} from '../services/statsService';

// ---- Helpers ---------------------------------------------------------------

const COUNTRY_FLAGS: Record<string, string> = {
    'England': '🇬🇧', 'Scotland': '🇬🇧', 'Wales': '🇬🇧', 'Northern Ireland': '🇬🇧',
    'Ireland': '🇮🇪', 'United Kingdom': '🇬🇧',
    'China': '🇨🇳', 'Hong Kong': '🇭🇰', 'Thailand': '🇹🇭', 'India': '🇮🇳',
    'Pakistan': '🇵🇰', 'Malaysia': '🇲🇾', 'Singapore': '🇸🇬', 'Philippines': '🇵🇭',
    'Australia': '🇦🇺', 'New Zealand': '🇳🇿',
    'Belgium': '🇧🇪', 'Germany': '🇩🇪', 'Netherlands': '🇳🇱', 'France': '🇫🇷',
    'Spain': '🇪🇸', 'Portugal': '🇵🇹', 'Italy': '🇮🇹', 'Greece': '🇬🇷',
    'Malta': '🇲🇹', 'Cyprus': '🇨🇾', 'Poland': '🇵🇱', 'Czech Republic': '🇨🇿',
    'Romania': '🇷🇴', 'Bulgaria': '🇧🇬', 'Ukraine': '🇺🇦', 'Russia': '🇷🇺',
    'Canada': '🇨🇦', 'United States': '🇺🇸', 'USA': '🇺🇸', 'Brazil': '🇧🇷',
    'South Africa': '🇿🇦', 'Egypt': '🇪🇬', 'Nigeria': '🇳🇬',
    'Saudi Arabia': '🇸🇦', 'Iran': '🇮🇷', 'Kazakhstan': '🇰🇿',
    'Myanmar': '🇲🇲', 'Vietnam': '🇻🇳',
};

const getFlag = (country?: string | null): string =>
    country ? (COUNTRY_FLAGS[country] || '') : '';

const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

// ---- Shared sub-components -------------------------------------------------

const SectionHeader = ({
    icon,
    title,
    subtitle,
    colors,
}: {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    subtitle?: string;
    colors: any;
}) => (
    <View style={sharedStyles.sectionRow}>
        <Ionicons name={icon} size={18} color={colors.primary} style={{ marginRight: 8 }} />
        <View>
            <Text style={[sharedStyles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
            {subtitle ? (
                <Text style={[sharedStyles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
        </View>
    </View>
);

const Card = ({ children, colors }: { children: React.ReactNode; colors: any }) => (
    <View style={[sharedStyles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        {children}
    </View>
);

const Divider = ({ colors }: { colors: any }) => (
    <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 6 }} />
);

const sharedStyles = StyleSheet.create({
    sectionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontFamily: 'PoppinsBold' },
    sectionSubtitle: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 1 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 14 },
});

// ---- Tab: Centuries --------------------------------------------------------

const CenturiesTab = ({
    data,
    refreshing,
    onRefresh,
    colors,
}: {
    data: CenturiesData | null;
    refreshing: boolean;
    onRefresh: () => void;
    colors: any;
}) => {
    const [expanded, setExpanded] = useState(false);

    if (!data) return <EmptyState colors={colors} />;

    const rows = expanded ? data.results : data.results.slice(0, 15);
    const top = data.results[0];

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={tabContentStyle}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                    tintColor={colors.primary} colors={[colors.primary]} />
            }
        >
            {/* Gold leader card */}
            {top && (
                <View style={[centuryStyles.leaderCard, { backgroundColor: '#FFA72618', borderColor: '#FFA72640' }]}>
                    <View>
                        <Text style={[centuryStyles.leaderLabel, { color: colors.textSecondary }]}>Season Leader</Text>
                        <Text style={[centuryStyles.leaderName, { color: colors.textPrimary }]}>
                            {getFlag(top.nationality)} {top.player_name}
                        </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={centuryStyles.leaderCount}>{top.season_current}</Text>
                        <Text style={[centuryStyles.leaderLabel, { color: colors.textSecondary }]}>centuries</Text>
                    </View>
                </View>
            )}

            <Card colors={colors}>
                <SectionHeader
                    icon="trophy"
                    title="Centuries Race"
                    subtitle={`${data.season} · ${data.count} players`}
                    colors={colors}
                />
                <View style={centuryStyles.headerRow}>
                    <Text style={[centuryStyles.colRank, { color: colors.textMuted }]}>#</Text>
                    <Text style={[centuryStyles.colName, { color: colors.textMuted }]}>Player</Text>
                    <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>Season</Text>
                    <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>Career</Text>
                    <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>147s</Text>
                </View>
                {rows.map((r) => (
                    <View key={r.rank} style={centuryStyles.dataRow}>
                        <Text style={[centuryStyles.colRank, { color: colors.textSecondary }]}>{r.rank}</Text>
                        <Text style={[centuryStyles.colName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {getFlag(r.nationality)} {r.player_name}
                        </Text>
                        <Text style={[centuryStyles.colNum, { color: colors.primary }]}>{r.season_current}</Text>
                        <Text style={[centuryStyles.colNum, { color: colors.textSecondary }]}>{r.career_total}</Text>
                        <Text style={[centuryStyles.colNum, { color: r.career_147s > 0 ? '#FFA726' : colors.textMuted }]}>
                            {r.career_147s > 0 ? r.career_147s : '—'}
                        </Text>
                    </View>
                ))}
                {data.results.length > 15 && (
                    <TouchableOpacity
                        onPress={() => setExpanded(!expanded)}
                        style={[centuryStyles.expandBtn, { borderTopColor: colors.cardBorder }]}
                    >
                        <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'PoppinsMedium' }}>
                            {expanded ? 'Show less' : `Show all ${data.count} players`}
                        </Text>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </Card>
        </ScrollView>
    );
};

const centuryStyles = StyleSheet.create({
    leaderCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
        marginBottom: 14,
    },
    leaderLabel: { fontSize: 11, fontFamily: 'PoppinsRegular' },
    leaderName: { fontSize: 16, fontFamily: 'PoppinsBold', marginTop: 2 },
    leaderCount: { fontSize: 32, fontFamily: 'PoppinsBold', color: '#FFA726' },
    headerRow: { flexDirection: 'row', paddingBottom: 6, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
    dataRow: { flexDirection: 'row', paddingVertical: 7 },
    colRank: { width: 28, fontSize: 12, fontFamily: 'PoppinsMedium' },
    colName: { flex: 1, fontSize: 13, fontFamily: 'PoppinsMedium' },
    colNum: { width: 48, textAlign: 'right', fontSize: 13, fontFamily: 'PoppinsMedium' },
    expandBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingTop: 10, marginTop: 6, borderTopWidth: 1, gap: 4,
    },
});

// ---- Tab: Titles -----------------------------------------------------------

const TitlesTab = ({
    winners,
    leaders,
    refreshing,
    onRefresh,
    colors,
}: {
    winners: TourWinnersData | null;
    leaders: TitleLeadersData | null;
    refreshing: boolean;
    onRefresh: () => void;
    colors: any;
}) => {
    const [champExpanded, setChampExpanded] = useState(false);

    if (!winners && !leaders) return <EmptyState colors={colors} />;

    const champRows = winners
        ? champExpanded ? winners.results : winners.results.slice(0, 10)
        : [];

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={tabContentStyle}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                    tintColor={colors.primary} colors={[colors.primary]} />
            }
        >
            {/* Title leaders */}
            {leaders && leaders.count > 0 && (
                <Card colors={colors}>
                    <SectionHeader
                        icon="medal"
                        title="Title Leaders"
                        subtitle={`Most titles in ${leaders.season}-${String(leaders.season + 1).slice(2)}`}
                        colors={colors}
                    />
                    {leaders.results.map((leader, idx) => (
                        <View key={leader.player_name}>
                            {idx > 0 && <Divider colors={colors} />}
                            <View style={titleStyles.row}>
                                <View style={[
                                    titleStyles.badge,
                                    { backgroundColor: idx === 0 ? '#FFA72622' : colors.backgroundTertiary }
                                ]}>
                                    <Text style={[titleStyles.badgeNum, { color: idx === 0 ? '#FFA726' : colors.textSecondary }]}>
                                        {leader.titles}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[titleStyles.name, { color: colors.textPrimary }]}>
                                        {getFlag(leader.nationality)} {leader.player_name}
                                    </Text>
                                    <Text style={[titleStyles.eventList, { color: colors.textMuted }]} numberOfLines={2}>
                                        {leader.events.map((e) => e.event_name).join(' · ')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </Card>
            )}

            {/* Tour champions list */}
            {winners && winners.count > 0 && (
                <Card colors={colors}>
                    <SectionHeader
                        icon="ribbon"
                        title="Tour Champions"
                        subtitle={`${winners.count} events completed`}
                        colors={colors}
                    />
                    {champRows.map((w, idx) => (
                        <View key={w.event_id}>
                            {idx > 0 && <Divider colors={colors} />}
                            <View style={champStyles.row}>
                                <View style={{ flex: 1 }}>
                                    <Text style={[champStyles.eventName, { color: colors.textPrimary }]}>{w.event_name}</Text>
                                    <Text style={[champStyles.winner, { color: colors.primary }]}>
                                        {getFlag(w.winner_nationality)} {w.winner_name}
                                    </Text>
                                    {w.runner_up_name ? (
                                        <Text style={[champStyles.runnerUp, { color: colors.textMuted }]}>
                                            def. {w.runner_up_name}  {w.score}
                                        </Text>
                                    ) : null}
                                </View>
                                {w.end_date ? (
                                    <Text style={[champStyles.date, { color: colors.textMuted }]}>
                                        {formatDate(w.end_date)}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                    {winners.results.length > 10 && (
                        <TouchableOpacity
                            onPress={() => setChampExpanded(!champExpanded)}
                            style={[centuryStyles.expandBtn, { borderTopColor: colors.cardBorder }]}
                        >
                            <Text style={{ color: colors.primary, fontSize: 13, fontFamily: 'PoppinsMedium' }}>
                                {champExpanded ? 'Show less' : `Show all ${winners.count} events`}
                            </Text>
                            <Ionicons name={champExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </Card>
            )}
        </ScrollView>
    );
};

const titleStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    badgeNum: { fontSize: 16, fontFamily: 'PoppinsBold' },
    name: { fontSize: 14, fontFamily: 'PoppinsBold' },
    eventList: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 2 },
});

const champStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 7 },
    eventName: { fontSize: 13, fontFamily: 'PoppinsBold', marginBottom: 2 },
    winner: { fontSize: 13, fontFamily: 'PoppinsMedium' },
    runnerUp: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 1 },
    date: { fontSize: 11, fontFamily: 'PoppinsRegular', marginLeft: 10, marginTop: 2 },
});

// ---- Tab: Records ----------------------------------------------------------

const RecordsTab = ({
    data,
    refreshing,
    onRefresh,
    colors,
}: {
    data: CenturiesData | null;
    refreshing: boolean;
    onRefresh: () => void;
    colors: any;
}) => {
    if (!data) return <EmptyState colors={colors} />;

    const players147 = data.results
        .filter((r) => r.career_147s > 0)
        .sort((a, b) => b.career_147s - a.career_147s);

    const careerTop = data.results
        .slice()
        .sort((a, b) => b.career_total - a.career_total)
        .slice(0, 10);

    return (
        <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={tabContentStyle}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
                    tintColor={colors.primary} colors={[colors.primary]} />
            }
        >
            {/* 147 leaders */}
            <Card colors={colors}>
                <SectionHeader
                    icon="flash"
                    title="Maximum Breaks — 147"
                    subtitle="Career all-time leaders"
                    colors={colors}
                />
                {players147.length === 0 ? (
                    <Text style={{ color: colors.textMuted, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                        No 147s recorded in this dataset
                    </Text>
                ) : (
                    <>
                        <View style={recordStyles.headerRow}>
                            <Text style={[recordStyles.colRank, { color: colors.textMuted }]}>#</Text>
                            <Text style={[recordStyles.colName, { color: colors.textMuted }]}>Player</Text>
                            <Text style={[recordStyles.colNum, { color: colors.textMuted }]}>147s</Text>
                        </View>
                        {players147.map((r, idx) => (
                            <View key={r.player_name} style={recordStyles.dataRow}>
                                <Text style={[recordStyles.colRank, { color: colors.textSecondary }]}>{idx + 1}</Text>
                                <Text style={[recordStyles.colName, { color: colors.textPrimary }]} numberOfLines={1}>
                                    {getFlag(r.nationality)} {r.player_name}
                                </Text>
                                <Text style={[recordStyles.colNum, { color: '#FFA726' }]}>{r.career_147s}</Text>
                            </View>
                        ))}
                    </>
                )}
            </Card>

            {/* Career centuries leaders */}
            <Card colors={colors}>
                <SectionHeader
                    icon="stats-chart"
                    title="Career Centuries"
                    subtitle="All-time leaders"
                    colors={colors}
                />
                <View style={recordStyles.headerRow}>
                    <Text style={[recordStyles.colRank, { color: colors.textMuted }]}>#</Text>
                    <Text style={[recordStyles.colName, { color: colors.textMuted }]}>Player</Text>
                    <Text style={[recordStyles.colNum, { color: colors.textMuted }]}>Total</Text>
                </View>
                {careerTop.map((r, idx) => (
                    <View key={r.player_name} style={recordStyles.dataRow}>
                        <Text style={[recordStyles.colRank, { color: colors.textSecondary }]}>{idx + 1}</Text>
                        <Text style={[recordStyles.colName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {getFlag(r.nationality)} {r.player_name}
                        </Text>
                        <Text style={[recordStyles.colNum, { color: colors.primary }]}>{r.career_total}</Text>
                    </View>
                ))}
            </Card>
        </ScrollView>
    );
};

const recordStyles = StyleSheet.create({
    headerRow: { flexDirection: 'row', paddingBottom: 6, marginBottom: 2, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
    dataRow: { flexDirection: 'row', paddingVertical: 7 },
    colRank: { width: 28, fontSize: 12, fontFamily: 'PoppinsMedium' },
    colName: { flex: 1, fontSize: 13, fontFamily: 'PoppinsMedium' },
    colNum: { width: 56, textAlign: 'right', fontSize: 14, fontFamily: 'PoppinsBold' },
});

// ---- Shared tab content style and EmptyState --------------------------------

const tabContentStyle = { padding: 16, paddingBottom: 32 };

const EmptyState = ({ colors }: { colors: any }) => (
    <View style={{ flex: 1, alignItems: 'center', paddingTop: 80, gap: 16 }}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={{ color: colors.textSecondary, fontFamily: 'PoppinsRegular', fontSize: 14, textAlign: 'center' }}>
            Could not load data.{'\n'}Pull down to retry.
        </Text>
    </View>
);

// ---- Tab bar ---------------------------------------------------------------

type TabKey = 'centuries' | 'titles' | 'records' | 'compare';

const TABS: { key: TabKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
    { key: 'centuries', label: 'Centuries', icon: 'trophy-outline' },
    { key: 'titles',    label: 'Titles',    icon: 'medal-outline' },
    { key: 'records',   label: 'Records',   icon: 'flash-outline' },
    { key: 'compare',   label: 'Compare',   icon: 'people-outline' },
];

// ---- Main Screen -----------------------------------------------------------

export default function StatsScreen() {
    const colors = useColors();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabKey>('centuries');
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const [centuriesData, setCenturiesData] = useState<CenturiesData | null>(null);
    const [tourWinnersData, setTourWinnersData] = useState<TourWinnersData | null>(null);
    const [titleLeadersData, setTitleLeadersData] = useState<TitleLeadersData | null>(null);

    const loadAll = useCallback(async () => {
        logger.log('[Stats] Loading all stats data...');
        const [centuries, winners, leaders] = await Promise.all([
            fetchCenturies('2025-26'),
            fetchTourWinners(2025),
            fetchTitleLeaders(2025),
        ]);
        setCenturiesData(centuries);
        setTourWinnersData(winners);
        setTitleLeadersData(leaders);
    }, []);

    useEffect(() => {
        setLoading(true);
        loadAll().finally(() => setLoading(false));
    }, [loadAll]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    }, [loadAll]);

    const styles = createStyles(colors);

    return (
        <View style={styles.container}>
            {/* Page header */}
            <View style={styles.header}>
                <Text style={styles.title}>Season Stats</Text>
                <Text style={styles.subtitle}>2025-26 season</Text>
            </View>

            {/* Tab bar */}
            <View style={[styles.tabBar, { borderBottomColor: colors.cardBorder }]}>
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabItem, isActive && styles.tabItemActive]}
                            onPress={() => {
                                if (tab.key === 'compare') {
                                    router.push('/compare');
                                } else {
                                    setActiveTab(tab.key);
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name={isActive ? tab.icon.replace('-outline', '') as any : tab.icon}
                                size={16}
                                color={isActive ? colors.primary : colors.textSecondary}
                            />
                            <Text style={[styles.tabLabel, isActive && { color: colors.primary, fontFamily: 'PoppinsBold' }]}>
                                {tab.label}
                            </Text>
                            {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Content */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading stats...</Text>
                </View>
            ) : (
                <>
                    {activeTab === 'centuries' && (
                        <CenturiesTab data={centuriesData} refreshing={refreshing} onRefresh={onRefresh} colors={colors} />
                    )}
                    {activeTab === 'titles' && (
                        <TitlesTab winners={tourWinnersData} leaders={titleLeadersData} refreshing={refreshing} onRefresh={onRefresh} colors={colors} />
                    )}
                    {activeTab === 'records' && (
                        <RecordsTab data={centuriesData} refreshing={refreshing} onRefresh={onRefresh} colors={colors} />
                    )}
                </>
            )}
        </View>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 12,
        },
        title: {
            fontSize: 22,
            fontFamily: 'PoppinsBold',
            color: colors.textPrimary,
        },
        subtitle: {
            fontSize: 12,
            fontFamily: 'PoppinsRegular',
            color: colors.textSecondary,
            marginTop: 2,
        },
        tabBar: {
            flexDirection: 'row',
            borderBottomWidth: 1,
            paddingHorizontal: 8,
        },
        tabItem: {
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 12,
            gap: 6,
            position: 'relative',
        },
        tabItemActive: {},
        tabLabel: {
            fontSize: 13,
            fontFamily: 'PoppinsMedium',
            color: colors.textSecondary,
        },
        tabUnderline: {
            position: 'absolute',
            bottom: 0,
            left: 12,
            right: 12,
            height: 2,
            borderRadius: 2,
        },
        loadingContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
        },
        loadingText: {
            fontFamily: 'PoppinsRegular',
            fontSize: 14,
        },
    });
