// app/home/components/OtherLiveSection.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { OtherLiveMatch } from '../hooks/useOtherLiveMatches';
import { MatchItem } from './MatchItem';
import { ActiveFilterType } from '../types';

interface OtherLiveSectionProps {
    matches: OtherLiveMatch[];
    activeFilter: ActiveFilterType;
    COLORS: any;
}

export const OtherLiveSection = ({ matches, activeFilter, COLORS }: OtherLiveSectionProps) => {
    const navigation = useRouter();

    // Only show on All, Live, and Break tabs
    if (activeFilter !== 'all' && activeFilter !== 'livePlaying' && activeFilter !== 'onBreak') {
        return null;
    }

    // Filter by active tab
    const visibleMatches = activeFilter === 'livePlaying'
        ? matches.filter(m => m.matchCategory === 'livePlaying')
        : activeFilter === 'onBreak'
        ? matches.filter(m => m.matchCategory === 'onBreak')
        : matches;

    if (visibleMatches.length === 0) return null;

    // Group by event_name
    const grouped: Record<string, OtherLiveMatch[]> = {};
    for (const m of visibleMatches) {
        if (!grouped[m.event_name]) grouped[m.event_name] = [];
        grouped[m.event_name].push(m);
    }

    return (
        <View style={{ marginTop: 8 }}>
            {/* Section header */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 8,
                gap: 6,
            }}>
                <View style={{ width: 3, height: 16, backgroundColor: '#22C55E', borderRadius: 2 }} />
                <Ionicons name="radio-outline" size={15} color="#22C55E" />
                <Text style={{ color: '#22C55E', fontSize: 13, fontFamily: 'PoppinsSemiBold', letterSpacing: 0.3 }}>
                    Also Live
                </Text>
            </View>

            {/* Matches grouped by event */}
            {Object.entries(grouped).map(([eventName, eventMatches]) => (
                <View key={eventName}>
                    <Text style={{
                        color: COLORS.textSecondary,
                        fontSize: 11,
                        fontFamily: 'PoppinsSemiBold',
                        paddingHorizontal: 16,
                        paddingBottom: 4,
                        paddingTop: 2,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                    }}>
                        {eventName}
                    </Text>
                    {eventMatches.map(match => (
                        <MatchItem
                            key={`other-live-${match.id}-${match.api_match_id}`}
                            item={match}
                            tourName={eventName}
                            navigation={navigation}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
};
