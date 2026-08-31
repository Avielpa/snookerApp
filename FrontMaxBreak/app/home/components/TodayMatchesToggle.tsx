// app/home/components/TodayMatchesToggle.tsx
// One job: the small sticky row that shows/hides Today's Matches. The
// actual matches render as normal rows further down the same list (see
// todayMatchesListItems.ts) — this component holds no match content itself,
// so it stays a small, cheap sticky header.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface TodayMatchesToggleProps {
    COLORS: any;
    totalMatches: number;
    isExpanded: boolean;
    onToggle: () => void;
    label?: string;
    iconName?: keyof typeof Ionicons.glyphMap;
    accentColor?: string;
}

export const TodayMatchesToggle = ({
    COLORS,
    totalMatches,
    isExpanded,
    onToggle,
    label = "Today's Matches",
    iconName = 'today-outline',
    accentColor,
}: TodayMatchesToggleProps) => {
    if (totalMatches === 0) return null;
    const color = accentColor ?? COLORS.accentLight;

    return (
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 12,
                marginTop: 4,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.05)',
                gap: 6,
            }}
        >
            <View style={{ width: 3, height: 16, backgroundColor: color, borderRadius: 2 }} />
            <Ionicons name={iconName} size={15} color={color} />
            <Text style={{ color, fontSize: 13, fontFamily: 'PoppinsSemiBold', letterSpacing: 0.3 }}>
                {label}
            </Text>
            <View style={{
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderRadius: 10,
                paddingHorizontal: 7,
                paddingVertical: 1,
            }}>
                <Text style={{ color: COLORS.textSecondary, fontSize: 11, fontFamily: 'PoppinsSemiBold' }}>
                    {totalMatches}
                </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={{ color: COLORS.textMuted, fontSize: 11, fontFamily: 'PoppinsSemiBold', marginRight: 2 }}>
                {isExpanded ? 'Hide' : 'Show'}
            </Text>
            <Ionicons
                name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                size={16}
                color={COLORS.textMuted}
            />
        </TouchableOpacity>
    );
};
