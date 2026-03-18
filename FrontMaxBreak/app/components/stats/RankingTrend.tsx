// app/components/stats/RankingTrend.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface RankingTrendData {
    current: number | null;
    previous: number | null;
    delta: number | null;
}

interface RankingTrendProps {
    trend: RankingTrendData;
}

export const RankingTrend = ({ trend }: RankingTrendProps) => {
    if (!trend || trend.current == null) return null;

    const { current, delta } = trend;
    const improved = delta != null && delta > 0;
    const declined = delta != null && delta < 0;

    const deltaColor = improved ? '#22C55E' : declined ? '#EF4444' : 'rgba(255,255,255,0.5)';
    const deltaIcon: keyof typeof Ionicons.glyphMap = improved
        ? 'arrow-up'
        : declined
        ? 'arrow-down'
        : 'remove';

    return (
        <View style={styles.container}>
            <Text style={styles.rankText}>#{current}</Text>
            {delta != null && (
                <View style={styles.deltaRow}>
                    <Ionicons name={deltaIcon} size={12} color={deltaColor} />
                    <Text style={[styles.deltaText, { color: deltaColor }]}>
                        {Math.abs(delta)}
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    rankText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    deltaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    deltaText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
