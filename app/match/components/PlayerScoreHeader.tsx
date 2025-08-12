// app/match/components/PlayerScoreHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LiveIndicator } from '../../components/modern';
import { MatchDetails } from '../types';

interface PlayerScoreHeaderProps {
  matchDetails: MatchDetails;
  styles: any; // We'll improve this when we create the styles file
}

export function PlayerScoreHeader({ matchDetails, styles }: PlayerScoreHeaderProps) {
  const router = useRouter();

  const p1Name = matchDetails?.player1_name ?? 'TBD';
  const p2Name = matchDetails?.player2_name ?? 'TBD';
  const score1 = matchDetails?.score1 ?? 0;
  const score2 = matchDetails?.score2 ?? 0;
  const isLive = matchDetails?.status_code === 1;
  const isOnBreak = matchDetails?.status_code === 2;
  const isFinished = matchDetails?.status_code === 3;

  return (
    <View style={styles.scoreHeader}>
      <View style={styles.scoreContainer}>
        {/* Player 1 */}
        <TouchableOpacity
          style={styles.playerContainer}
          onPress={() => matchDetails.player1_id && 
            router.push(`/player/${matchDetails.player1_id}`)}
          disabled={!matchDetails.player1_id}
        >
          <Text style={[styles.playerName, styles.player1]} numberOfLines={1}>
            {p1Name}
          </Text>
          <Text style={[styles.playerScore, score1 > score2 && isFinished && styles.winnerScore]}>
            {score1}
          </Text>
        </TouchableOpacity>

        {/* VS and Live Indicator */}
        <View style={styles.vsContainer}>
          {(isLive || isOnBreak) && (
            <LiveIndicator isLive={isLive} onBreak={isOnBreak} size="large" />
          )}
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Player 2 */}
        <TouchableOpacity
          style={styles.playerContainer}
          onPress={() => matchDetails.player2_id && 
            router.push(`/player/${matchDetails.player2_id}`)}
          disabled={!matchDetails.player2_id}
        >
          <Text style={[styles.playerScore, score2 > score1 && isFinished && styles.winnerScore]}>
            {score2}
          </Text>
          <Text style={[styles.playerName, styles.player2]} numberOfLines={1}>
            {p2Name}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}