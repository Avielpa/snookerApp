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
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ---- Sub-components --------------------------------------------------------

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
    <View style={sectionHeaderStyles.row}>
        <Ionicons name={icon} size={20} color={colors.primary} style={{ marginRight: 8 }} />
        <View>
            <Text style={[sectionHeaderStyles.title, { color: colors.text }]}>{title}</Text>
            {subtitle ? (
                <Text style={[sectionHeaderStyles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
            ) : null}
        </View>
    </View>
);

const sectionHeaderStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    title: { fontSize: 16, fontFamily: 'PoppinsBold' },
    subtitle: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 1 },
});

const Card = ({ children, colors }: { children: React.ReactNode; colors: any }) => (
    <View style={[cardStyles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        {children}
    </View>
);
const cardStyles = StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
});

const Divider = ({ colors }: { colors: any }) => (
    <View style={{ height: 1, backgroundColor: colors.cardBorder, marginVertical: 8 }} />
);

// ---- Section: Centuries Race -----------------------------------------------

const CenturiesSection = ({ data, colors }: { data: CenturiesData; colors: any }) => {
    const [expanded, setExpanded] = useState(false);
    const rows = expanded ? data.results : data.results.slice(0, 10);
    const top = data.results[0];

    return (
        <Card colors={colors}>
            <SectionHeader
                icon="trophy"
                title="Centuries Race"
                subtitle={`${data.season} season · ${data.count} players`}
                colors={colors}
            />

            {top && (
                <View style={[centuryStyles.goldRow, { backgroundColor: colors.filterButton }]}>
                    <Text style={[centuryStyles.goldRank, { color: '#FFA726' }]}>#1</Text>
                    <Text style={[centuryStyles.goldName, { color: colors.text }]}>
                        {getFlag(top.nationality)} {top.player_name}
                    </Text>
                    <Text style={[centuryStyles.goldCount, { color: '#FFA726' }]}>{top.season_current}</Text>
                </View>
            )}

            <View style={centuryStyles.headerRow}>
                <Text style={[centuryStyles.colRank, { color: colors.textMuted }]}>#</Text>
                <Text style={[centuryStyles.colName, { color: colors.textMuted }]}>Player</Text>
                <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>Season</Text>
                <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>Career</Text>
                <Text style={[centuryStyles.colNum, { color: colors.textMuted }]}>147s</Text>
            </View>

            {rows.map((r) => (
                <View key={r.rank} style={centuryStyles.row}>
                    <Text style={[centuryStyles.colRank, { color: colors.textSecondary }]}>{r.rank}</Text>
                    <Text style={[centuryStyles.colName, { color: colors.text }]} numberOfLines={1}>
                        {getFlag(r.nationality)} {r.player_name}
                    </Text>
                    <Text style={[centuryStyles.colNum, { color: colors.primary }]}>{r.season_current}</Text>
                    <Text style={[centuryStyles.colNum, { color: colors.textSecondary }]}>{r.career_total}</Text>
                    <Text style={[centuryStyles.colNum, { color: r.career_147s > 0 ? '#FFA726' : colors.textMuted }]}>
                        {r.career_147s > 0 ? r.career_147s : '—'}
                    </Text>
                </View>
            ))}

            {data.results.length > 10 && (
                <TouchableOpacity
                    onPress={() => setExpanded(!expanded)}
                    style={[centuryStyles.expandBtn, { borderTopColor: colors.cardBorder }]}
                >
                    <Text style={[centuryStyles.expandText, { color: colors.primary }]}>
                        {expanded ? 'Show less' : `Show all ${data.count} players`}
                    </Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.primary}
                    />
                </TouchableOpacity>
            )}
        </Card>
    );
};

const centuryStyles = StyleSheet.create({
    goldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 10,
        padding: 10,
        marginBottom: 12,
    },
    goldRank: { fontSize: 14, fontFamily: 'PoppinsBold', width: 30 },
    goldName: { flex: 1, fontSize: 14, fontFamily: 'PoppinsBold' },
    goldCount: { fontSize: 22, fontFamily: 'PoppinsBold', minWidth: 40, textAlign: 'right' },
    headerRow: { flexDirection: 'row', paddingBottom: 4, marginBottom: 4 },
    row: { flexDirection: 'row', paddingVertical: 6 },
    colRank: { width: 28, fontSize: 12, fontFamily: 'PoppinsMedium' },
    colName: { flex: 1, fontSize: 13, fontFamily: 'PoppinsMedium' },
    colNum: { width: 46, textAlign: 'right', fontSize: 13, fontFamily: 'PoppinsMedium' },
    expandBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 12,
        marginTop: 4,
        borderTopWidth: 1,
        gap: 4,
    },
    expandText: { fontSize: 13, fontFamily: 'PoppinsMedium' },
});

// ---- Section: 147s Leaders -------------------------------------------------

const MaxBreaksSection = ({ data, colors }: { data: CenturiesData; colors: any }) => {
    // Players who have at least 1 career 147, sorted by season count then career
    const players147 = data.results
        .filter((r) => r.career_147s > 0)
        .sort((a, b) => b.career_147s - a.career_147s)
        .slice(0, 10);

    return (
        <Card colors={colors}>
            <SectionHeader
                icon="flash"
                title="Maximum Breaks — 147"
                subtitle="Career 147s by player"
                colors={colors}
            />

            {players147.length === 0 ? (
                <Text style={{ color: colors.textMuted, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                    No 147s recorded yet this season
                </Text>
            ) : (
                <>
                    <View style={maxStyles.headerRow}>
                        <Text style={[maxStyles.colRank, { color: colors.textMuted }]}>#</Text>
                        <Text style={[maxStyles.colName, { color: colors.textMuted }]}>Player</Text>
                        <Text style={[maxStyles.colNum, { color: colors.textMuted }]}>Career 147s</Text>
                    </View>
                    {players147.map((r, idx) => (
                        <View key={r.player_name} style={maxStyles.row}>
                            <Text style={[maxStyles.colRank, { color: colors.textSecondary }]}>{idx + 1}</Text>
                            <Text style={[maxStyles.colName, { color: colors.text }]} numberOfLines={1}>
                                {getFlag(r.nationality)} {r.player_name}
                            </Text>
                            <Text style={[maxStyles.colNum, { color: '#FFA726' }]}>{r.career_147s}</Text>
                        </View>
                    ))}
                </>
            )}
        </Card>
    );
};

const maxStyles = StyleSheet.create({
    headerRow: { flexDirection: 'row', paddingBottom: 4, marginBottom: 4 },
    row: { flexDirection: 'row', paddingVertical: 6 },
    colRank: { width: 28, fontSize: 12, fontFamily: 'PoppinsMedium' },
    colName: { flex: 1, fontSize: 13, fontFamily: 'PoppinsMedium' },
    colNum: { width: 80, textAlign: 'right', fontSize: 14, fontFamily: 'PoppinsBold' },
});

// ---- Section: Title Leaders ------------------------------------------------

const TitleLeadersSection = ({ data, colors }: { data: TitleLeadersData; colors: any }) => (
    <Card colors={colors}>
        <SectionHeader
            icon="medal"
            title="Title Leaders"
            subtitle={`${data.season}-${String(data.season + 1).slice(2)} season`}
            colors={colors}
        />
        {data.results.map((leader, idx) => (
            <View key={leader.player_name}>
                {idx > 0 && <Divider colors={colors} />}
                <View style={titleStyles.row}>
                    <View style={[titleStyles.rankBadge, { backgroundColor: idx === 0 ? '#FFA72622' : colors.filterButton }]}>
                        <Text style={[titleStyles.rankText, { color: idx === 0 ? '#FFA726' : colors.textSecondary }]}>
                            {leader.titles}
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[titleStyles.name, { color: colors.text }]}>
                            {getFlag(leader.nationality)} {leader.player_name}
                        </Text>
                        <Text style={[titleStyles.events, { color: colors.textMuted }]} numberOfLines={2}>
                            {leader.events.map((e) => e.event_name).join(' · ')}
                        </Text>
                    </View>
                </View>
            </View>
        ))}
    </Card>
);

const titleStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
    rankBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: { fontSize: 16, fontFamily: 'PoppinsBold' },
    name: { fontSize: 14, fontFamily: 'PoppinsBold' },
    events: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 2 },
});

// ---- Section: Tour Champions -----------------------------------------------

const TourChampionsSection = ({ data, colors }: { data: TourWinnersData; colors: any }) => {
    const [expanded, setExpanded] = useState(false);
    const rows = expanded ? data.results : data.results.slice(0, 8);

    return (
        <Card colors={colors}>
            <SectionHeader
                icon="ribbon"
                title="Tour Champions"
                subtitle={`${data.season}-${String(data.season + 1).slice(2)} season · ${data.count} events`}
                colors={colors}
            />
            {rows.map((w, idx) => (
                <View key={w.event_id}>
                    {idx > 0 && <Divider colors={colors} />}
                    <View style={champStyles.row}>
                        <View style={{ flex: 1 }}>
                            <Text style={[champStyles.eventName, { color: colors.text }]}>{w.event_name}</Text>
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
            {data.results.length > 8 && (
                <TouchableOpacity
                    onPress={() => setExpanded(!expanded)}
                    style={[centuryStyles.expandBtn, { borderTopColor: colors.cardBorder }]}
                >
                    <Text style={[centuryStyles.expandText, { color: colors.primary }]}>
                        {expanded ? 'Show less' : `Show all ${data.count} events`}
                    </Text>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.primary}
                    />
                </TouchableOpacity>
            )}
        </Card>
    );
};

const champStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
    eventName: { fontSize: 13, fontFamily: 'PoppinsBold', marginBottom: 2 },
    winner: { fontSize: 13, fontFamily: 'PoppinsMedium' },
    runnerUp: { fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 2 },
    date: { fontSize: 11, fontFamily: 'PoppinsRegular', marginLeft: 8, marginTop: 2 },
});

// ---- Main Screen -----------------------------------------------------------

export default function StatsScreen() {
    const colors = useColors();
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
        logger.log('[Stats] Loaded — centuries:', centuries?.count, 'winners:', winners?.count);
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
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={colors.primary}
                    colors={[colors.primary]}
                />
            }
        >
            <View style={styles.pageHeader}>
                <Text style={styles.pageTitle}>Season Stats</Text>
                <Text style={styles.pageSubtitle}>2025-26 season</Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading stats...
                    </Text>
                </View>
            ) : (
                <>
                    {titleLeadersData && titleLeadersData.count > 0 && (
                        <TitleLeadersSection data={titleLeadersData} colors={colors} />
                    )}
                    {centuriesData && centuriesData.count > 0 && (
                        <CenturiesSection data={centuriesData} colors={colors} />
                    )}
                    {centuriesData && centuriesData.count > 0 && (
                        <MaxBreaksSection data={centuriesData} colors={colors} />
                    )}
                    {tourWinnersData && tourWinnersData.count > 0 && (
                        <TourChampionsSection data={tourWinnersData} colors={colors} />
                    )}

                    {!centuriesData && !tourWinnersData && (
                        <View style={styles.errorContainer}>
                            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
                            <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                                Could not load stats. Pull down to retry.
                            </Text>
                        </View>
                    )}
                </>
            )}
        </ScrollView>
    );
}

const createStyles = (colors: any) =>
    StyleSheet.create({
        container: { flex: 1 },
        content: { padding: 16, paddingBottom: 32 },
        pageHeader: { marginBottom: 20 },
        pageTitle: {
            fontSize: 24,
            fontFamily: 'PoppinsBold',
            color: colors.text,
        },
        pageSubtitle: {
            fontSize: 13,
            fontFamily: 'PoppinsRegular',
            color: colors.textSecondary,
            marginTop: 2,
        },
        loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: 12 },
        loadingText: { fontFamily: 'PoppinsRegular', fontSize: 14 },
        errorContainer: { alignItems: 'center', paddingTop: 80, gap: 16 },
        errorText: { fontFamily: 'PoppinsRegular', fontSize: 14, textAlign: 'center' },
    });
