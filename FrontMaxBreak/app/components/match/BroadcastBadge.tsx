// app/components/match/BroadcastBadge.tsx
import React from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface Broadcaster {
    name: string;
    url: string;
}

interface BroadcastBadgeProps {
    broadcasters: Broadcaster[];
}

const BRAND_COLORS: Record<string, string> = {
    'Eurosport': '#003DA5',
    'Discovery+': '#0079BF',
    'BBC': '#BB1919',
    'DAZN': '#F0FF00',
    'Huya': '#FF6600',
    'WST TV': '#1A1A1A',
    'Laola1': '#E30613',
    'Sport1': '#E2001A',
    'Viaplay': '#00C8C8',
};

export const BroadcastBadge = ({ broadcasters }: BroadcastBadgeProps) => {
    if (!broadcasters || broadcasters.length === 0) return null;

    const handlePress = (url: string) => {
        if (url) Linking.openURL(url).catch(() => {});
    };

    return (
        <View style={styles.row}>
            <Ionicons name="tv-outline" size={10} color="rgba(255,255,255,0.4)" style={styles.tvIcon} />
            {broadcasters.slice(0, 3).map((b) => {
                const bg = BRAND_COLORS[b.name] || 'rgba(255,255,255,0.15)';
                const textColor = b.name === 'DAZN' ? '#000000' : '#FFFFFF';
                return (
                    <Text
                        key={b.name}
                        style={[styles.badge, { backgroundColor: bg, color: textColor }]}
                        onPress={() => handlePress(b.url)}
                    >
                        {b.name}
                    </Text>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 4,
    },
    tvIcon: {
        marginRight: 2,
    },
    badge: {
        fontSize: 9,
        fontWeight: '700',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 3,
        overflow: 'hidden',
    },
});
