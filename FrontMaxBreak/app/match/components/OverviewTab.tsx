// app/match/components/OverviewTab.tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LiveIndicator, ProgressBar } from '../../components/modern';
import { MatchDetails, MatchStats } from '../types';

interface OverviewTabProps {
  matchDetails: MatchDetails;
  matchStats: MatchStats;
  tournamentName: string | null;
  colors: any;
  styles: any;
}

const BRAND_COLORS: Record<string, string> = {
  'Eurosport': '#003DA5',
  'Discovery+': '#0079BF',
  'BBC': '#BB1919',
  'DAZN': '#F0FF00',
  'Huya': '#FF6600',
  'WST TV': '#1A1A1A',
  'Laola1': '#E30613',
  'Sport1': '#E2001A',
  'Viaplay': '#00C8C8',
};

export function OverviewTab({
  matchDetails,
  matchStats,
  tournamentName,
  colors,
  styles
}: OverviewTabProps) {
  const isLive = matchDetails?.status_code === 1;
  const isOnBreak = matchDetails?.status_code === 2;

  const hasBroadcasters = !!matchDetails?.broadcasters?.length;
  const hasLiveUrl = !!matchDetails?.live_url;
  const showWatchSection = hasBroadcasters || hasLiveUrl;

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* Match Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Match Status</Text>
          <LiveIndicator isLive={isLive} onBreak={isOnBreak} />
        </View>

        <Text style={styles.statusText}>
          {matchDetails?.status_display || 'Status Unknown'}
        </Text>

        {matchStats.progress > 0 && (
          <ProgressBar
            progress={matchStats.progress}
            label="Match Progress"
            showPercentage={true}
            colors={[colors.primary, colors.secondary]}
          />
        )}
      </View>

      {/* Where to Watch */}
      {showWatchSection && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="tv-outline" size={20} color="#FFA726" />
            <Text style={styles.infoTitle}>Where to Watch</Text>
          </View>

          {/* Broadcaster name badges — info only, no links */}
          {hasBroadcasters && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {matchDetails.broadcasters!.map((b) => {
                const bg = BRAND_COLORS[b.name] || 'rgba(255,255,255,0.15)';
                const textColor = b.name === 'DAZN' ? '#000' : '#fff';
                return (
                  <View
                    key={b.name}
                    style={{
                      backgroundColor: bg,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 4,
                    }}
                  >
                    <Text style={{ color: textColor, fontSize: 12, fontWeight: '700' }}>
                      {b.name}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Official coverage link from snooker.org */}
          {hasLiveUrl && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                marginTop: 10,
                backgroundColor: 'rgba(255,167,38,0.15)',
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#FFA726',
                alignSelf: 'flex-start',
              }}
              onPress={() => openUrl(matchDetails.live_url!)}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle-outline" size={16} color="#FFA726" />
              <Text style={{ color: '#FFA726', fontSize: 13, fontWeight: '700' }}>
                Official Coverage
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Tournament Info */}
      {tournamentName && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="trophy-outline" size={20} color="#FFA726" />
            <Text style={styles.infoTitle}>Tournament</Text>
          </View>
          <Text style={styles.infoText}>{tournamentName}</Text>
          {matchStats.roundName && (
            <Text style={[styles.infoText, { opacity: 0.7, marginTop: 4 }]}>
              {matchStats.roundName}
            </Text>
          )}
          {matchStats.matchFormat != null && matchStats.matchFormat > 0 && (
            <Text style={[styles.infoText, { opacity: 0.7, marginTop: 2 }]}>
              Best of {matchStats.matchFormat} frames
            </Text>
          )}
        </View>
      )}

      {/* Session Times */}
      {matchDetails?.sessions_str && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="time-outline" size={20} color="#FFA726" />
            <Text style={styles.infoTitle}>Session Times</Text>
          </View>
          {matchDetails.sessions_str.split(';').map((session, index) => (
            <Text key={index} style={styles.sessionText}>
              {session.trim()}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
