// app/home/components/TodayMatchesSection.tsx
// One job: show every match scheduled today, across every tournament,
// collapsed/expanded by the user. See docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md.
//
// Rendered as a plain (non-FlatList) block above the main match list, so its
// expanded content is capped to MAX_EXPANDED_HEIGHT and scrolls internally —
// otherwise a long match list here (e.g. 15 qualifiers) would push the rest
// of the screen out of reach with no way back except the collapse button.
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTodayMatches } from '../hooks/useTodayMatches';
import { TodayMatchesGroup } from './TodayMatchesGroup';

const MAX_EXPANDED_HEIGHT = 320;

interface TodayMatchesSectionProps {
    COLORS: any;
}

export const TodayMatchesSection = ({ COLORS }: TodayMatchesSectionProps) => {
    const { groups } = useTodayMatches();
    const [isExpanded, setIsExpanded] = useState(true);

    if (groups.length === 0) return null;

    const totalMatches = groups.reduce((sum, group) => sum + group.matches.length, 0);

    return (
        <View style={{ marginHorizontal: 12, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <TouchableOpacity
                onPress={() => setIsExpanded((prev) => !prev)}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 12,
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

            {isExpanded && (
                <ScrollView
                    style={{ maxHeight: MAX_EXPANDED_HEIGHT }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator
                >
                    {groups.map((group) => (
                        <TodayMatchesGroup key={group.event_id} group={group} COLORS={COLORS} />
                    ))}
                </ScrollView>
            )}
        </View>
    );
};
