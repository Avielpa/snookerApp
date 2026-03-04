import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../contexts/ThemeContext';
import { timeAgo } from './newsUtils';
import { Highlight } from '../../../services/highlightsService';

interface Props {
    highlight: Highlight;
}

export const HighlightCard = ({ highlight }: Props) => {
    const colors = useColors();

    return (
        <TouchableOpacity
            onPress={() => Linking.openURL(highlight.url).catch(() => {})}
            activeOpacity={0.75}
            style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}
        >
            <View style={styles.thumbnailWrapper}>
                <Image
                    source={{ uri: highlight.thumbnail_url }}
                    style={styles.thumbnail}
                    resizeMode="cover"
                />
                <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={52} color="rgba(255,255,255,0.88)" />
                </View>
            </View>
            <View style={styles.info}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                    {highlight.title}
                </Text>
                <View style={styles.meta}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>WST</Text>
                    </View>
                    <Text style={[styles.time, { color: colors.textMuted }]}>
                        {timeAgo(highlight.published_at)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 12,
        overflow: 'hidden',
    },
    thumbnailWrapper: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#1a1a1a',
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    playOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.22)',
    },
    info: {
        padding: 12,
    },
    title: {
        fontSize: 14,
        fontFamily: 'PoppinsMedium',
        lineHeight: 21,
        marginBottom: 8,
    },
    meta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        backgroundColor: '#CC0000',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeText: {
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
