// EventSection.tsx — section with title, optional collapse, list of EventCards

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EventCard } from './EventCard';
import { GroupedEvent } from './groupUtils';

interface Props {
    title: string;
    icon: string;
    events: GroupedEvent[];
    collapsible?: boolean;
    defaultCollapsed?: boolean;
    firstExpanded?: boolean; // auto-expand the first event card
}

export function EventSection({ title, icon, events, collapsible, defaultCollapsed, firstExpanded }: Props) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed ?? false);

    if (events.length === 0) return null;

    return (
        <View style={{ marginBottom: 8 }}>
            {/* Section header */}
            <TouchableOpacity
                onPress={collapsible ? () => setCollapsed(c => !c) : undefined}
                activeOpacity={collapsible ? 0.7 : 1}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    gap: 6,
                }}
            >
                <Text style={{ fontSize: 14 }}>{icon}</Text>
                <Text style={{ flex: 1, color: '#E5E7EB', fontSize: 13, fontFamily: 'PoppinsBold', letterSpacing: 0.3 }}>
                    {title}
                </Text>
                <Text style={{ color: '#6B7280', fontSize: 12, fontFamily: 'PoppinsRegular' }}>
                    {events.length}
                </Text>
                {collapsible && (
                    <Ionicons name={collapsed ? 'chevron-down' : 'chevron-up'} size={14} color="#6B7280" />
                )}
            </TouchableOpacity>

            {/* Event cards */}
            {!collapsed && events.map((event, i) => (
                <EventCard
                    key={event.event_id}
                    event={event}
                    defaultExpanded={firstExpanded && i === 0}
                />
            ))}
        </View>
    );
}
