import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '../../../contexts/ThemeContext';
import { NewsArticle, SOURCE_COLORS, timeAgo, openArticle } from './newsUtils';

interface Props {
    article: NewsArticle;
}

export const NewsCompactCard = ({ article }: Props) => {
    const colors = useColors();
    const [imageError, setImageError] = useState(false);
    const badgeColor = SOURCE_COLORS[article.source_name] ?? '#FFB74D';

    const handlePress = () => {
        openArticle(article.url);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.65}
            style={[styles.container, { borderBottomColor: colors.cardBorder, backgroundColor: colors.backgroundSecondary }]}
        >
            {article.image_url && !imageError ? (
                <Image
                    source={{ uri: article.image_url }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <View style={[styles.thumbnail, styles.thumbnailPlaceholder]} />
            )}

            <View style={styles.textContainer}>
                <Text
                    style={[styles.title, { color: colors.textPrimary }]}
                    numberOfLines={3}
                >
                    {article.title}
                </Text>
                <View style={styles.meta}>
                    <View style={[styles.sourceBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.sourceText}>{article.source_name}</Text>
                    </View>
                    <Text style={[styles.time, { color: colors.textMuted }]}>
                        {timeAgo(article.published_at)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        gap: 12,
        alignItems: 'flex-start',
    },
    thumbnail: {
        width: 82,
        height: 82,
        borderRadius: 10,
        flexShrink: 0,
    },
    thumbnailPlaceholder: {
        backgroundColor: '#2C2C2C',
    },
    textContainer: {
        flex: 1,
        justifyContent: 'space-between',
        gap: 8,
        minHeight: 82,
    },
    title: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        lineHeight: 21,
        flex: 1,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sourceBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
    },
    sourceText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontFamily: 'PoppinsBold',
        letterSpacing: 0.5,
    },
    time: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
    },
});
