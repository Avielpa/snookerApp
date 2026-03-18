// app/components/stats/WinStreak.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WinStreakProps {
    streak: number; // positive = wins, negative = losses, 0 = none
}

export const WinStreak = ({ streak }: WinStreakProps) => {
    if (!streak) return null;

    const isWin = streak > 0;
    const count = Math.abs(streak);
    const color = isWin ? '#22C55E' : '#EF4444';
    const icon: keyof typeof Ionicons.glyphMap = isWin ? 'trending-up' : 'trending-down';
    const label = isWin ? `${count} Win Streak` : `${count} Loss Streak`;

    return (
        <View style={[styles.container, { borderColor: color }]}>
            <Ionicons name={icon} size={14} color={color} />
            <Text style={[styles.text, { color }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignSelf: 'flex-start',
        marginTop: 8,
    },
    text: {
        fontSize: 12,
        fontWeight: '700',
    },
});
