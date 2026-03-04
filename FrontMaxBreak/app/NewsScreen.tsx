// app/NewsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
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
import { Highlight, fetchHighlights, filterHighlightsByTournament } from '../services/highlightsService';
import { fetchAllNews } from '../services/newsService';

type Tab = 'news' | 'highlights';

const SectionHeader = ({ colors }: { colors: any }) => (
    <View style={[styles.sectionHeader, { borderBottomColor: colors.cardBorder }]}>
        <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            LATEST NEWS
        </Text>
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
        {(['news', 'highlights'] as Tab[]).map(tab => (
            <TouchableOpacity
                key={tab}
                style={[
                    styles.toggleBtn,
                    activeTab === tab && { borderBottomColor: colors.primary },
                ]}
                onPress={() => onPress(tab)}
                activeOpacity={0.7}
            >
                <Text style={[
                    styles.toggleText,
                    { color: activeTab === tab ? colors.primary : colors.textMuted },
                    activeTab === tab && styles.toggleTextActive,
                ]}>
                    {tab === 'news' ? 'NEWS' : 'HIGHLIGHTS'}
                </Text>
            </TouchableOpacity>
        ))}
    </View>
);

export default function NewsScreen() {
    const colors = useColors();
    const [activeTab, setActiveTab] = useState<Tab>('news');

    // News state
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [newsLoading, setNewsLoading] = useState(true);
    const [newsRefreshing, setNewsRefreshing] = useState(false);

    // Highlights state
    const [highlights, setHighlights] = useState<Highlight[]>([]);
    const [filterName, setFilterName] = useState<string | null>(null);
    const [filterActive, setFilterActive] = useState(false);
    const [highlightsLoading, setHighlightsLoading] = useState(false);
    const [highlightsRefreshing, setHighlightsRefreshing] = useState(false);
    const [highlightsFetched, setHighlightsFetched] = useState(false);

    const loadNews = useCallback(async (isRefresh = false) => {
        if (isRefresh) setNewsRefreshing(true);
        try {
            const data = await fetchAllNews();
            setArticles(data);
        } finally {
            setNewsLoading(false);
            setNewsRefreshing(false);
        }
    }, []);

    const loadHighlights = useCallback(async (isRefresh = false) => {
        if (isRefresh) setHighlightsRefreshing(true);
        else if (!highlightsFetched) setHighlightsLoading(true);
        try {
            const result = await fetchHighlights();
            setHighlights(result.highlights);
            setFilterName(result.filterName);
            setHighlightsFetched(true);
        } finally {
            setHighlightsLoading(false);
            setHighlightsRefreshing(false);
        }
    }, [highlightsFetched]);

    useEffect(() => { loadNews(); }, [loadNews]);

    const handleTabPress = useCallback((tab: Tab) => {
        setActiveTab(tab);
        if (tab === 'highlights' && !highlightsFetched) {
            loadHighlights();
        }
    }, [highlightsFetched, loadHighlights]);

    const heroArticle = articles[0] ?? null;
    const compactArticles = articles.slice(1);

    // Apply filter only if active — otherwise show all
    const displayedHighlights = filterActive && filterName
        ? filterHighlightsByTournament(highlights, filterName)
        : highlights;

    const isLoading = activeTab === 'news' ? newsLoading : highlightsLoading;
    const isRefreshing = activeTab === 'news' ? newsRefreshing : highlightsRefreshing;
    const onRefresh = () => activeTab === 'news' ? loadNews(true) : loadHighlights(true);

    const HighlightsHeader = () => {
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
                    <Ionicons
                        name="funnel"
                        size={11}
                        color={filterActive ? '#fff' : colors.textMuted}
                        style={styles.filterIcon}
                    />
                    <Text style={[styles.filterChipText, { color: filterActive ? '#fff' : colors.textMuted }]}>
                        {filterName}
                    </Text>
                    {filterActive && (
                        <Ionicons name="close" size={13} color="#fff" style={styles.filterClose} />
                    )}
                </TouchableOpacity>
            </View>
        );
    };

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
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <FlatList
                    data={displayedHighlights}
                    keyExtractor={(item) => item.videoId}
                    renderItem={({ item }) => <HighlightCard highlight={item} />}
                    ListHeaderComponent={<HighlightsHeader />}
                    ListEmptyComponent={<EmptyState text="No highlights available" colors={colors} />}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
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
    filterIcon: {
        marginRight: 5,
    },
    filterChipText: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
    },
    filterClose: {
        marginLeft: 5,
    },
    listContent: {
        paddingBottom: 16,
    },
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
    emptyContainer: {
        paddingTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
    },
});
