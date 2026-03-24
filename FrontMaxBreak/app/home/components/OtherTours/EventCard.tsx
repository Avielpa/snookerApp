// EventCard.tsx — single event card, expandable, handles group stages

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MatchRow } from './MatchRow';
import { GroupedEvent } from './groupUtils';

const TOUR_COLOR: Record<string, string> = {
    womens: '#E91E63',
    seniors: '#FF9800',
    qtour: '#2196F3',
};

const TOUR_LABEL: Record<string, string> = {
    womens: "Women's",
    seniors: 'Seniors',
    qtour: 'Q Tour',
};

function formatDateRange(start: string | null, end: string | null): string {
    if (!start) return '';
    const s = new Date(start);
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    if (!end || start === end) return s.toLocaleDateString('en-GB', opts);
    const e = new Date(end);
    return `${s.toLocaleDateString('en-GB', opts)} – ${e.toLocaleDateString('en-GB', opts)}`;
}

interface Props {
    event: GroupedEvent;
    defaultExpanded?: boolean;
}

export function EventCard({ event, defaultExpanded = false }: Props) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [expandedGroup, setExpandedGroup] = useState<number | null>(null);

    const accent = TOUR_COLOR[event.tour] ?? '#9E9E9E';
    const label = TOUR_LABEL[event.tour] ?? event.tour;
    const hasGroups = (event.groups?.length ?? 0) > 0;

    const allMatches = hasGroups
        ? (event.groups ?? []).flatMap(g => g.matches)
        : event.matches;

    const liveCount = allMatches.filter(m => m.status === 1).length;
    const finishedCount = allMatches.filter(m => m.status === 2 || m.status === 3).length;
    const location = [event.city, event.country].filter(Boolean).join(', ');
    const dateRange = formatDateRange(event.start_date, event.end_date);

    return (
        <View style={{
            marginHorizontal: 12,
            marginBottom: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            backgroundColor: '#14142a',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <TouchableOpacity
                onPress={() => setExpanded(e => !e)}
                activeOpacity={0.7}
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    gap: 8,
                    borderLeftWidth: 3,
                    borderLeftColor: accent,
                }}
            >
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#FFFFFF', fontSize: 13, fontFamily: 'PoppinsBold' }} numberOfLines={1}>
                        {event.event_name}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 1 }}>
                        {label}{dateRange ? ` · ${dateRange}` : ''}{location ? ` · ${location}` : ''}
                    </Text>
                    {hasGroups && (
                        <Text style={{ color: '#6B7280', fontSize: 10, fontFamily: 'PoppinsRegular', marginTop: 1 }}>
                            {event.groups!.length} group stages · {finishedCount} matches played
                        </Text>
                    )}
                </View>

                {liveCount > 0 && (
                    <View style={{ backgroundColor: '#22C55E22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#22C55E', fontSize: 10, fontFamily: 'PoppinsBold' }}>
                            {liveCount} LIVE
                        </Text>
                    </View>
                )}

                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#6B7280" />
            </TouchableOpacity>

            {/* Content */}
            {expanded && (
                hasGroups
                    ? (event.groups ?? []).map(group => (
                        <View key={group.event_id}>
                            <TouchableOpacity
                                onPress={() => setExpandedGroup(g => g === group.event_id ? null : group.event_id)}
                                activeOpacity={0.7}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    backgroundColor: 'rgba(255,255,255,0.04)',
                                    borderTopWidth: 0.5,
                                    borderTopColor: 'rgba(255,255,255,0.08)',
                                }}
                            >
                                <Text style={{ flex: 1, color: '#D1D5DB', fontSize: 12, fontFamily: 'PoppinsBold' }}>
                                    {group.event_name.replace(event.event_name, '').trim().replace(/^[-–]\s*/, '')}
                                </Text>
                                <Text style={{ color: '#6B7280', fontSize: 11, fontFamily: 'PoppinsRegular', marginRight: 6 }}>
                                    {group.matches.filter(m => m.status === 2 || m.status === 3).length}/{group.matches.length}
                                </Text>
                                <Ionicons
                                    name={expandedGroup === group.event_id ? 'chevron-up' : 'chevron-down'}
                                    size={12}
                                    color="#6B7280"
                                />
                            </TouchableOpacity>
                            {expandedGroup === group.event_id && group.matches.map(m => (
                                <MatchRow key={m.id} match={m} />
                            ))}
                        </View>
                    ))
                    : event.matches.map(m => <MatchRow key={m.id} match={m} />)
            )}
        </View>
    );
}
