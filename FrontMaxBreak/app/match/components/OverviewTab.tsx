// app/match/components/OverviewTab.tsx
import React from 'react';
import { View, Text, ScrollView } from 'react-native';
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

export function OverviewTab({ 
  matchDetails, 
  matchStats, 
  tournamentName, 
  colors, 
  styles 
}: OverviewTabProps) {
  const isLive = matchDetails?.status_code === 1;
  const isOnBreak = matchDetails?.status_code === 2;

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

      {/* Tournament Info */}
      {tournamentName && (
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name="trophy-outline" size={20} color="#FFA726" />
            <Text style={styles.infoTitle}>Tournament</Text>
          </View>
          <Text style={styles.infoText}>{tournamentName}</Text>
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