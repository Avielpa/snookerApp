// app/home/components/TodayMatchesSection.tsx
// One job: show every match scheduled today, across every tournament,
// collapsed/expanded by the user. See docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTodayMatches } from '../hooks/useTodayMatches';
import { TodayMatchesGroup } from './TodayMatchesGroup';

interface TodayMatchesSectionProps {
    COLORS: any;
}

export const TodayMatchesSection = ({ COLORS }: TodayMatchesSectionProps) => {
    const { groups } = useTodayMatches();
    const [isExpanded, setIsExpanded] = useState(true);

    if (groups.length === 0) return null;

    const totalMatches = groups.reduce((sum, group) => sum + group.matches.length, 0);

    return (
        <View style={{ marginBottom: 8 }}>
            <TouchableOpacity
                onPress={() => setIsExpanded((prev) => !prev)}
                activeOpacity={0.7}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
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
                <Ionicons
                    name={isExpanded ? 'chevron-up-outline' : 'chevron-down-outline'}
                    size={14}
                    color={COLORS.textMuted}
                />
            </TouchableOpacity>

            {isExpanded && groups.map((group) => (
                <TodayMatchesGroup key={group.event_id} group={group} COLORS={COLORS} />
            ))}
        </View>
    );
};
