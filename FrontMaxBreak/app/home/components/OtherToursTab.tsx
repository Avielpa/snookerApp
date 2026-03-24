// app/home/components/OtherToursTab.tsx
// Displays women's, seniors, and Q tour matches grouped by event.
// All data comes from the backend — no direct snooker.org calls.

import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, ScrollView, RefreshControl,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../services/api';
import { getNationalityFlag } from '../../../utils/nationalityFlag';

interface OtherTourMatchData {
    id: number;
    round: number;
    number: number;
    player1_name: string;
    player2_name: string;
    player1_nationality: string | null;
    player2_nationality: string | null;
    score1: number | null;
    score2: number | null;
    winner_id: number | null;
    status: number;
    scheduled_date: string | null;
}

interface OtherTourEventData {
    event_id: number;
    event_name: string;
    tour: string;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    country: string | null;
    matches: OtherTourMatchData[];
}

const TOUR_LABEL: Record<string, string> = {
    womens: "Women's",
    seniors: 'Seniors',
    qtour: 'Q Tour',
    other: 'Other',
};

const TOUR_COLOR: Record<string, string> = {
    womens: '#E91E63',
    seniors: '#FF9800',
    qtour: '#2196F3',
    other: '#9E9E9E',
};

function MatchRow({ match, accent }: { match: OtherTourMatchData; accent: string }) {
    const isFinished = match.status === 2 || match.status === 3;
    const isLive = match.status === 1;
    const p1Won = isFinished && match.winner_id != null && match.winner_id === match.player1_nationality as any;
    const hasScore = (isFinished || isLive) && match.score1 != null && match.score2 != null;
    const p1Flag = match.player1_nationality ? getNationalityFlag(match.player1_nationality) + ' ' : '';
    const p2Flag = match.player2_nationality ? getNationalityFlag(match.player2_nationality) + ' ' : '';

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.07)',
        }}>
            {isLive && (
                <View style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: '#22C55E', marginRight: 8,
                }} />
            )}
            <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 12, fontFamily: 'PoppinsRegular' }} numberOfLines={1}>
                {p1Flag}{match.player1_name}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 13, fontFamily: 'PoppinsBold', marginHorizontal: 8, writingDirection: 'ltr' }}>
                {hasScore ? `${match.score1}–${match.score2}` : 'vs'}
            </Text>
            <Text style={{ flex: 1, color: '#FFFFFF', fontSize: 12, fontFamily: 'PoppinsRegular', textAlign: 'right' }} numberOfLines={1}>
                {match.player2_name}{p2Flag ? ' ' + p2Flag : ''}
            </Text>
        </View>
    );
}

function EventCard({ event, colors }: { event: OtherTourEventData; colors: any }) {
    const [expanded, setExpanded] = useState(true);
    const accent = TOUR_COLOR[event.tour] || '#9E9E9E';
    const label = TOUR_LABEL[event.tour] || event.tour;

    const liveCount = event.matches.filter(m => m.status === 1).length;

    return (
        <View style={{
            marginHorizontal: 12,
            marginBottom: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
            overflow: 'hidden',
            backgroundColor: '#1a1a2e',
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
                    <Text style={{ color: '#9CA3AF', fontSize: 11, fontFamily: 'PoppinsRegular', marginTop: 1 }}>
                        {label}{event.city ? ` · ${event.city}` : ''}{event.country ? `, ${event.country}` : ''}
                    </Text>
                </View>
                {liveCount > 0 && (
                    <View style={{
                        backgroundColor: '#22C55E22',
                        borderRadius: 4,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                    }}>
                        <Text style={{ color: '#22C55E', fontSize: 10, fontFamily: 'PoppinsBold' }}>
                            {liveCount} LIVE
                        </Text>
                    </View>
                )}
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color="#9CA3AF"
                />
            </TouchableOpacity>

            {/* Matches */}
            {expanded && event.matches.map(match => (
                <MatchRow key={match.id} match={match} accent={accent} />
            ))}
        </View>
    );
}

interface OtherToursTabProps {
    colors: any;
}

export function OtherToursTab({ colors }: OtherToursTabProps) {
    const [events, setEvents] = useState<OtherTourEventData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const response = await api.get<OtherTourEventData[]>('other-tours/');
            setEvents(Array.isArray(response.data) ? response.data : []);
        } catch (e: any) {
            setError('Could not load other tours. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={colors.accentLight || '#FFA726'} />
            </View>
        );
    }

    return (
        <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchData(true)}
                    tintColor={colors.accentLight || '#FFA726'}
                    colors={[colors.accentLight || '#FFA726']}
                />
            }
        >
            <View style={{ paddingTop: 12, paddingBottom: 24 }}>
                {error ? (
                    <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                        {error}
                    </Text>
                ) : events.length === 0 ? (
                    <Text style={{ color: '#9CA3AF', textAlign: 'center', marginTop: 40, fontFamily: 'PoppinsRegular', fontSize: 13 }}>
                        {'No other tour events found.\nCheck back during the season.'}
                    </Text>
                ) : (
                    events.map(event => (
                        <EventCard key={event.event_id} event={event} colors={colors} />
                    ))
                )}
            </View>
        </ScrollView>
    );
}
