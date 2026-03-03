import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../../contexts/ThemeContext';
import { NewsArticle, SOURCE_COLORS, timeAgo, openArticle } from './newsUtils';

interface Props {
    article: NewsArticle;
}

export const NewsHeroCard = ({ article }: Props) => {
    const colors = useColors();
    const [imageError, setImageError] = useState(false);
    const badgeColor = SOURCE_COLORS[article.source_name] ?? '#FFB74D';

    const handlePress = () => {
        openArticle(article.url);
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.85}
            style={[styles.container, { borderColor: colors.cardBorder }]}
        >
            {article.image_url && !imageError ? (
                <Image
                    source={{ uri: article.image_url }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    onError={() => setImageError(true)}
                />
            ) : (
                <View style={[StyleSheet.absoluteFill, styles.imagePlaceholder]} />
            )}

            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.92)']}
                style={styles.gradient}
            >
                <View style={styles.textContainer}>
                    <View style={[styles.sourceBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.sourceText}>{article.source_name}</Text>
                    </View>
                    <Text style={styles.title} numberOfLines={3}>
                        {article.title}
                    </Text>
                    <Text style={styles.time}>{timeAgo(article.published_at)}</Text>
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        borderRadius: 16,
        overflow: 'hidden',
        height: 220,
        borderWidth: 1,
    },
    imagePlaceholder: {
        backgroundColor: '#2C2C2C',
    },
    gradient: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '75%',
        justifyContent: 'flex-end',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 8,
    },
    textContainer: {
        gap: 6,
    },
    sourceBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        alignSelf: 'flex-start',
    },
    sourceText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'PoppinsBold',
        letterSpacing: 0.5,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'PoppinsBold',
        lineHeight: 24,
    },
    time: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
    },
});
