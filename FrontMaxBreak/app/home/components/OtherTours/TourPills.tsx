// TourPills.tsx — All / Women's / Seniors / Q Tour filter pills

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TourFilter } from './groupUtils';

const PILLS: { label: string; value: TourFilter; color: string }[] = [
    { label: 'All', value: 'all', color: '#9E9E9E' },
    { label: "Women's", value: 'womens', color: '#E91E63' },
    { label: 'Seniors', value: 'seniors', color: '#FF9800' },
    { label: 'Q Tour', value: 'qtour', color: '#2196F3' },
];

interface Props {
    selected: TourFilter;
    onSelect: (t: TourFilter) => void;
    counts: Record<TourFilter, number>;
}

export function TourPills({ selected, onSelect, counts }: Props) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexDirection: 'row' }}
        >
            {PILLS.map(pill => {
                const active = selected === pill.value;
                const count = counts[pill.value];
                return (
                    <TouchableOpacity
                        key={pill.value}
                        onPress={() => onSelect(pill.value)}
                        activeOpacity={0.7}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            paddingHorizontal: 14,
                            paddingVertical: 7,
                            borderRadius: 20,
                            borderWidth: 1,
                            borderColor: active ? pill.color : 'rgba(255,255,255,0.12)',
                            backgroundColor: active ? pill.color + '22' : 'transparent',
                        }}
                    >
                        <Text style={{
                            color: active ? pill.color : '#9CA3AF',
                            fontSize: 13,
                            fontFamily: active ? 'PoppinsBold' : 'PoppinsRegular',
                        }}>
                            {pill.label}
                        </Text>
                        {count > 0 && (
                            <View style={{
                                backgroundColor: active ? pill.color + '44' : 'rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                            }}>
                                <Text style={{ color: active ? pill.color : '#6B7280', fontSize: 10, fontFamily: 'PoppinsBold' }}>
                                    {count}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}
