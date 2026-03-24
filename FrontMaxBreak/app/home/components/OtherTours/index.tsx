// OtherTours/index.tsx — tab root: thin orchestrator

import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { TourPills } from './TourPills';
import { EventSection } from './EventSection';
import { useOtherToursData } from './useOtherToursData';
import { TourFilter } from './groupUtils';

interface Props {
    colors: any;
}

export function OtherToursTab({ colors }: Props) {
    const [tour, setTour] = useState<TourFilter>('all');
    const { live, upcoming, recent, earlier, loading, refreshing, error, refresh } = useOtherToursData(tour);

    const counts: Record<TourFilter, number> = {
        all: live.length + upcoming.length + recent.length + earlier.length,
        womens: 0,
        seniors: 0,
        qtour: 0,
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={colors.accentLight ?? '#FFA726'} />
            </View>
        );
    }

    const isEmpty = !live.length && !upcoming.length && !recent.length && !earlier.length;

    return (
        <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={refresh}
                    tintColor={colors.accentLight ?? '#FFA726'}
                    colors={[colors.accentLight ?? '#FFA726']}
                />
            }
        >
            <TourPills selected={tour} onSelect={setTour} counts={counts} />

            {error ? (
                <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                    {error}
                </Text>
            ) : isEmpty ? (
                <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                    No events found for this tour.
                </Text>
            ) : (
                <View style={{ paddingBottom: 32 }}>
                    <EventSection title="Live Now"            icon="🔴" events={live}     firstExpanded />
                    <EventSection title="Upcoming"            icon="🔜" events={upcoming} firstExpanded />
                    <EventSection title="Recent Results"      icon="✅" events={recent}   firstExpanded />
                    <EventSection title="Earlier This Season" icon="📁" events={earlier}  collapsible defaultCollapsed />
                </View>
            )}
        </ScrollView>
    );
}
