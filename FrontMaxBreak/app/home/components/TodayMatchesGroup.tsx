// app/home/components/TodayMatchesGroup.tsx
// One job: render one tournament's today-scheduled matches under its own header.
import React from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { MatchItem } from './MatchItem';
import { TodayMatchGroupWithItems } from '../hooks/useTodayMatches';

interface TodayMatchesGroupProps {
    group: TodayMatchGroupWithItems;
    COLORS: any;
}

export const TodayMatchesGroup = ({ group, COLORS }: TodayMatchesGroupProps) => {
    const navigation = useRouter();
    const title = group.event_name || 'Tournament';

    return (
        <View>
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingBottom: 4,
                paddingTop: 6,
                gap: 6,
            }}>
                <Text
                    style={{
                        color: COLORS.textSecondary,
                        fontSize: 11,
                        fontFamily: 'PoppinsSemiBold',
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                    }}
                    numberOfLines={1}
                >
                    {title}
                </Text>
                {group.is_qualifier && (
                    <View style={{
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 1,
                    }}>
                        <Text style={{ color: COLORS.textMuted, fontSize: 9, fontFamily: 'PoppinsSemiBold' }}>
                            QUALIFIERS
                        </Text>
                    </View>
                )}
            </View>

            {group.matches.map((match) => (
                <MatchItem
                    key={`today-${match.id}-${match.api_match_id}`}
                    item={match}
                    tourName={title}
                    navigation={navigation}
                />
            ))}
        </View>
    );
};
