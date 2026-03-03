// app/NewsScreen.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { useColors } from '../contexts/ThemeContext';
import { NewsHeroCard } from './components/news/NewsHeroCard';
import { NewsCompactCard } from './components/news/NewsCompactCard';
import { NewsArticle } from './components/news/newsUtils';
import { fetchAllNews } from '../services/newsService';

const SectionHeader = () => {
    const colors = useColors();
    return (
        <View style={[styles.sectionHeader, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
                LATEST NEWS
            </Text>
        </View>
    );
};

export default function NewsScreen() {
    const colors = useColors();
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const loadNews = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        try {
            const data = await fetchAllNews();
            setArticles(data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadNews();
    }, [loadNews]);

    const heroArticle = articles[0] ?? null;
    const compactArticles = articles.slice(1);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <FlatList
                data={compactArticles}
                keyExtractor={(item) => String(item.id)}
                renderItem={({ item }) => <NewsCompactCard article={item} />}
                ListHeaderComponent={
                    <>
                        {heroArticle && <NewsHeroCard article={heroArticle} />}
                        {articles.length > 0 && <SectionHeader />}
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                            No news available
                        </Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => loadNews(true)}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />
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
