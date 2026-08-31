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
}

export const TodayMatchesToggle = ({ COLORS, totalMatches, isExpanded, onToggle }: TodayMatchesToggleProps) => {
    if (totalMatches === 0) return null;

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
            <View style={{ width: 3, height: 16, backgroundColor: COLORS.accentLight, borderRadius: 2 }} />
            <Ionicons name="today-outline" size={15} color={COLORS.accentLight} />
            <Text style={{ color: COLORS.accentLight, fontSize: 13, fontFamily: 'PoppinsSemiBold', letterSpacing: 0.3 }}>
                Today's Matches
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
