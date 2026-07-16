// app/NewsScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
    TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../contexts/ThemeContext';
import { NewsHeroCard } from './components/news/NewsHeroCard';
import { NewsCompactCard } from './components/news/NewsCompactCard';
import { HighlightCard } from './components/news/HighlightCard';
import { NewsArticle } from './components/news/newsUtils';
import {
    Highlight,
    fetchHighlights,
    fetchTNT,
    fetchAstley,
    fetchSASA,
    fetchShachar,
    fetchAfzaal,
    filterHighlightsByTournament,
} from '../services/highlightsService';
import { fetchAllNews } from '../services/newsService';

type Tab = 'news' | 'highlights' | 'creators';
type HighlightSubTab = 'wst' | 'tnt';
type CreatorsSubTab = 'astley' | 'sasa' | 'shachar' | 'afzaal';

const TAB_LABELS: Record<Tab, string> = { news: 'NEWS', highlights: 'HIGHLIGHTS', creators: 'CREATORS' };
const HIGHLIGHT_SUB_LABELS: Record<HighlightSubTab, string> = { wst: 'WST', tnt: 'TNT SPORTS' };
const CREATORS_SUB_LABELS: Record<CreatorsSubTab, string> = { astley: 'ASTLEY', sasa: 'SASA', shachar: 'SHACHAR', afzaal: 'AFZAAL' };
const CREATORS_BADGE: Record<CreatorsSubTab, string> = { astley: 'ASTLEY', sasa: 'SASA', shachar: 'SHACHAR', afzaal: 'AFZAAL' };

// ─── Static components ────────────────────────────────────────────────────────

const SectionHeader = ({ colors }: { colors: any }) => (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.cardBorder }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>LATEST NEWS</Text>
    </View>
);

const EmptyState = ({ text, colors }: { text: string; colors: any }) => (
    <View style={styles.emptyContainer}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>{text}</Text>
    </View>
);

const TabToggle = ({
    activeTab,
    onPress,
    colors,
}: {
    activeTab: Tab;
    onPress: (tab: Tab) => void;
    colors: any;
}) => (
    <View style={[styles.toggleRow, { backgroundColor: colors.cardBackground, borderBottomColor: colors.cardBorder }]}>
        {(['news', 'highlights', 'creators'] as Tab[]).map(tab => (
            <TouchableOpacity
                key={tab}
                style={[styles.toggleBtn, activeTab === tab && { borderBottomColor: colors.primary }]}
                onPress={() => onPress(tab)}
                activeOpacity={0.7}
            >
                <Text style={[
                    styles.toggleText,
                    { color: activeTab === tab ? colors.primary : colors.textMuted },
                    activeTab === tab && styles.toggleTextActive,
                ]}>
                    {TAB_LABELS[tab]}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
);

function SubTabRow<T extends string>({
    tabs,
    labels,
    activeTab,
    onPress,
    colors,
}: {
    tabs: T[];
    labels: Record<T, string>;
    activeTab: T;
    onPress: (tab: T) => void;
    colors: any;
}) {
    return (
        <View style={[styles.subToggleRow, { backgroundColor: colors.background, borderBottomColor: colors.cardBorder }]}>
            {tabs.map(tab => (
                <TouchableOpacity
                    key={tab}
                    style={[styles.subToggleBtn, activeTab === tab && { borderBottomColor: colors.primary }]}
                    onPress={() => onPress(tab)}
                    activeOpacity={0.7}
                >
                    <Text style={[
                        styles.subToggleText,
                        { color: activeTab === tab ? colors.primary : colors.textMuted },
                        activeTab === tab && styles.subToggleTextActive,
                    ]}>
                        {labels[tab]}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function NewsScreen() {
    const colors = useColors();

    // Top-level tab
    const [activeTab, setActiveTab] = useState<Tab>('news');

    // Sub-tab selection
    const [highlightSubTab, setHighlightSubTab] = useState<HighlightSubTab>('wst');
    const [creatorsSubTab, setCreatorsSubTab] = useState<CreatorsSubTab>('astley');

    // Fetched tracking via ref — avoids stale closure issues in useCallback
    const fetched = useRef({ wst: false, tnt: false, astley: false, sasa: false, shachar: false, afzaal: false });

    // ── News ─────────────────────────────────────────────────────────────────
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsRefreshing, setNewsRefreshing] = useState(false);

    // ── Highlights: WST ──────────────────────────────────────────────────────
    const [wstHighlights, setWstHighlights] = useState<Highlight[]>([]);
    const [filterName, setFilterName] = useState<string | null>(null);
    const [filterActive, setFilterActive] = useState(false);
    const [wstLoading, setWstLoading] = useState(false);
    const [wstRefreshing, setWstRefreshing] = useState(false);

    // ── Highlights: TNT ──────────────────────────────────────────────────────
    const [tntHighlights, setTntHighlights] = useState<Highlight[]>([]);
    const [tntLoading, setTntLoading] = useState(false);
    const [tntRefreshing, setTntRefreshing] = useState(false);

    // ── Creators: Astley ─────────────────────────────────────────────────────
    const [astleyHighlights, setAstleyHighlights] = useState<Highlight[]>([]);
    const [astleyLoading, setAstleyLoading] = useState(false);
    const [astleyRefreshing, setAstleyRefreshing] = useState(false);

    // ── Creators: SASA ───────────────────────────────────────────────────────
    const [sasaHighlights, setSasaHighlights] = useState<Highlight[]>([]);
    const [sasaLoading, setSasaLoading] = useState(false);
    const [sasaRefreshing, setSasaRefreshing] = useState(false);

    // ── Creators: Shachar ────────────────────────────────────────────────────
    const [shacharHighlights, setShacharHighlights] = useState<Highlight[]>([]);
    const [shacharLoading, setShacharLoading] = useState(false);
    const [shacharRefreshing, setShacharRefreshing] = useState(false);

    // ── Creators: Afzaal ─────────────────────────────────────────────────────
    const [afzaalHighlights, setAfzaalHighlights] = useState<Highlight[]>([]);
    const [afzaalLoading, setAfzaalLoading] = useState(false);
    const [afzaalRefreshing, setAfzaalRefreshing] = useState(false);

    // ── Load functions ───────────────────────────────────────────────────────

    const loadNews = useCallback(async (isRefresh = false) => {
        if (isRefresh) setNewsRefreshing(true);
        try {
            setArticles(await fetchAllNews());
        } finally {
            setNewsLoading(false);
            setNewsRefreshing(false);
        }
    }, []);

    const loadWst = useCallback(async (isRefresh = false) => {
        if (isRefresh) setWstRefreshing(true); else setWstLoading(true);
        try {
            const result = await fetchHighlights();
            setWstHighlights(result.highlights);
            setFilterName(result.filterName);
            fetched.current.wst = true;
        } finally {
            setWstLoading(false);
            setWstRefreshing(false);
        }
    }, []);

    const loadTnt = useCallback(async (isRefresh = false) => {
        if (isRefresh) setTntRefreshing(true); else setTntLoading(true);
        try {
            setTntHighlights(await fetchTNT());
            fetched.current.tnt = true;
        } finally {
            setTntLoading(false);
            setTntRefreshing(false);
        }
    }, []);

    const loadAstley = useCallback(async (isRefresh = false) => {
        if (isRefresh) setAstleyRefreshing(true); else setAstleyLoading(true);
        try {
            setAstleyHighlights(await fetchAstley());
            fetched.current.astley = true;
        } finally {
            setAstleyLoading(false);
            setAstleyRefreshing(false);
        }
    }, []);

    const loadSasa = useCallback(async (isRefresh = false) => {
        if (isRefresh) setSasaRefreshing(true); else setSasaLoading(true);
        try {
            setSasaHighlights(await fetchSASA());
            fetched.current.sasa = true;
        } finally {
            setSasaLoading(false);
            setSasaRefreshing(false);
        }
    }, []);

    const loadShachar = useCallback(async (isRefresh = false) => {
        if (isRefresh) setShacharRefreshing(true); else setShacharLoading(true);
        try {
            setShacharHighlights(await fetchShachar());
            fetched.current.shachar = true;
        } finally {
            setShacharLoading(false);
            setShacharRefreshing(false);
        }
    }, []);

    const loadAfzaal = useCallback(async (isRefresh = false) => {
        if (isRefresh) setAfzaalRefreshing(true); else setAfzaalLoading(true);
        try {
            setAfzaalHighlights(await fetchAfzaal());
            fetched.current.afzaal = true;
        } finally {
            setAfzaalLoading(false);
            setAfzaalRefreshing(false);
        }
    }, []);

    useEffect(() => { loadNews(); }, [loadNews]);

    // ── Tab navigation ───────────────────────────────────────────────────────

    const handleTabPress = useCallback((tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'highlights' && !fetched.current.wst) loadWst();
        if (tab === 'creators' && !fetched.current.astley) loadAstley();
    }, [loadWst, loadAstley]);

    const handleHighlightSubTabPress = useCallback((sub: HighlightSubTab) => {
        setHighlightSubTab(sub);
        if (sub === 'wst' && !fetched.current.wst) loadWst();
        if (sub === 'tnt' && !fetched.current.tnt) loadTnt();
    }, [loadWst, loadTnt]);

    const handleCreatorsSubTabPress = useCallback((sub: CreatorsSubTab) => {
        setCreatorsSubTab(sub);
        if (sub === 'astley' && !fetched.current.astley) loadAstley();
        if (sub === 'sasa'   && !fetched.current.sasa)   loadSasa();
        if (sub === 'shachar' && !fetched.current.shachar) loadShachar();
        if (sub === 'afzaal' && !fetched.current.afzaal) loadAfzaal();
    }, [loadAstley, loadSasa, loadShachar, loadAfzaal]);

    // ── Derived state ────────────────────────────────────────────────────────

    const displayedWst = filterActive && filterName
        ? filterHighlightsByTournament(wstHighlights, filterName)
        : wstHighlights;

    const highlightLoading = highlightSubTab === 'wst' ? wstLoading : tntLoading;
    const highlightRefreshing = highlightSubTab === 'wst' ? wstRefreshing : tntRefreshing;
    const onHighlightRefresh = highlightSubTab === 'wst' ? () => loadWst(true) : () => loadTnt(true);

    const creatorsLoading = creatorsSubTab === 'astley' ? astleyLoading
        : creatorsSubTab === 'sasa' ? sasaLoading
        : creatorsSubTab === 'shachar' ? shacharLoading : afzaalLoading;
    const creatorsRefreshing = creatorsSubTab === 'astley' ? astleyRefreshing
        : creatorsSubTab === 'sasa' ? sasaRefreshing
        : creatorsSubTab === 'shachar' ? shacharRefreshing : afzaalRefreshing;
    const onCreatorsRefresh = creatorsSubTab === 'astley' ? () => loadAstley(true)
        : creatorsSubTab === 'sasa' ? () => loadSasa(true)
        : creatorsSubTab === 'shachar' ? () => loadShachar(true) : () => loadAfzaal(true);

    const isLoading = activeTab === 'news' ? newsLoading
        : activeTab === 'highlights' ? highlightLoading : creatorsLoading;
    const isRefreshing = activeTab === 'news' ? newsRefreshing
        : activeTab === 'highlights' ? highlightRefreshing : creatorsRefreshing;
    const onRefresh = activeTab === 'news' ? () => loadNews(true)
        : activeTab === 'highlights' ? onHighlightRefresh : onCreatorsRefresh;

    const heroArticle = articles[0] ?? null;
    const compactArticles = articles.slice(1);

    // ── Sub-headers ──────────────────────────────────────────────────────────

    const WstHeader = () => {
        if (!filterName) return null;
        return (
            <View style={styles.filterRow}>
                <TouchableOpacity
                    onPress={() => setFilterActive(prev => !prev)}
                    activeOpacity={0.7}
                    style={[
                        styles.filterChip,
                        filterActive
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: 'transparent', borderColor: colors.cardBorder },
                    ]}
                >
                    <Ionicons name="funnel" size={11} color={filterActive ? '#fff' : colors.textMuted} style={styles.filterIcon} />
                    <Text style={[styles.filterChipText, { color: filterActive ? '#fff' : colors.textMuted }]}>
                        {filterName}
                    </Text>
                    {filterActive && <Ionicons name="close" size={13} color="#fff" style={styles.filterClose} />}
                </TouchableOpacity>
            </View>
        );
    };

    // ── Render ───────────────────────────────────────────────────────────────

    const refreshControl = (
        <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
        />
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <TabToggle activeTab={activeTab} onPress={handleTabPress} colors={colors} />

            {isLoading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : activeTab === 'news' ? (
                <FlatList
                    data={compactArticles}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => <NewsCompactCard article={item} />}
                    ListHeaderComponent={
                        <>
                            {heroArticle && <NewsHeroCard article={heroArticle} />}
                            {articles.length > 0 && <SectionHeader colors={colors} />}
                        </>
                    }
                    ListEmptyComponent={<EmptyState text="No news available" colors={colors} />}
                    refreshControl={refreshControl}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : activeTab === 'highlights' ? (
                <View style={styles.flex}>
                    <SubTabRow
                        tabs={['wst', 'tnt'] as HighlightSubTab[]}
                        labels={HIGHLIGHT_SUB_LABELS}
                        activeTab={highlightSubTab}
                        onPress={handleHighlightSubTabPress}
                        colors={colors}
                    />
                    {highlightSubTab === 'wst' ? (
                        <FlatList
                            data={displayedWst}
                            keyExtractor={(item) => item.videoId}
                            renderItem={({ item }) => <HighlightCard highlight={item} />}
                            ListHeaderComponent={<WstHeader />}
                            ListEmptyComponent={<EmptyState text="No highlights available" colors={colors} />}
                            refreshControl={refreshControl}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <FlatList
                            data={tntHighlights}
                            keyExtractor={(item) => item.videoId}
                            renderItem={({ item }) => <HighlightCard highlight={item} badge="TNT" />}
                            ListEmptyComponent={<EmptyState text="No TNT highlights available" colors={colors} />}
                            refreshControl={refreshControl}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                        />
                    )}
                </View>
            ) : (
                <View style={styles.flex}>
                    <SubTabRow
                        tabs={['astley', 'sasa', 'shachar', 'afzaal'] as CreatorsSubTab[]}
                        labels={CREATORS_SUB_LABELS}
                        activeTab={creatorsSubTab}
                        onPress={handleCreatorsSubTabPress}
                        colors={colors}
                    />
                    <FlatList
                        data={
                            creatorsSubTab === 'astley' ? astleyHighlights
                            : creatorsSubTab === 'sasa'  ? sasaHighlights
                            : creatorsSubTab === 'shachar' ? shacharHighlights
                            : afzaalHighlights
                        }
                        keyExtractor={(item) => item.videoId}
                        renderItem={({ item }) => (
                            <HighlightCard highlight={item} badge={CREATORS_BADGE[creatorsSubTab]} />
                        )}
                        ListEmptyComponent={<EmptyState text="No videos available" colors={colors} />}
                        refreshControl={refreshControl}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Main tab toggle
    toggleRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    toggleBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    toggleText: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
        letterSpacing: 1.2,
    },
    toggleTextActive: {
        fontFamily: 'PoppinsBold',
    },

    // Sub-tab toggle (secondary, smaller)
    subToggleRow: {
        flexDirection: 'row',
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    subToggleBtn: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 9,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    subToggleText: {
        fontSize: 10,
        fontFamily: 'PoppinsMedium',
        letterSpacing: 1,
    },
    subToggleTextActive: {
        fontFamily: 'PoppinsBold',
    },

    // Tour filter chip (WST sub-tab)
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    filterIcon: { marginRight: 5 },
    filterChipText: { fontSize: 12, fontFamily: 'PoppinsMedium' },
    filterClose: { marginLeft: 5 },

    listContent: { paddingBottom: 16 },

    sectionHeader: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        marginBottom: 4,
    },
    sectionHeaderText: {
        fontSize: 11,
        fontFamily: 'PoppinsBold',
        letterSpacing: 1.5,
    },

    emptyContainer: { paddingTop: 60, alignItems: 'center' },
    emptyText: { fontSize: 14, fontFamily: 'PoppinsMedium' },
});
