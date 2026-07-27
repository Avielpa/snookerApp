// app/match/components/PlayerScoreHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LiveIndicator } from '../../components/modern';
import { MatchDetails } from '../types';
import { getNationalityFlag } from '../../../utils/nationalityFlag';

interface PlayerScoreHeaderProps {
  matchDetails: MatchDetails;
  styles: any;
}

function initialOf(name: string | null | undefined): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?';
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
          onPress={() => {
            const playerId = matchDetails.player1_id;
            if (playerId && typeof playerId === 'number' && playerId > 0 && playerId !== 376) {
              router.push(`/player/${playerId}`);
            }
          }}
          disabled={!matchDetails.player1_id || matchDetails.player1_id === 376}
        >
          {/* Placeholder square avatar (initial letter) — swap for a real
              player photo URL once that data exists in the API response. */}
          <View style={styles.avatarSquare}>
            <Text style={styles.avatarInitial}>{initialOf(p1Name)}</Text>
          </View>
          <Text style={[styles.playerName, styles.player1]} numberOfLines={1}>
            {p1Name}
          </Text>
          {!!matchDetails.player1_nationality && (
            <Text style={styles.flagText}>{getNationalityFlag(matchDetails.player1_nationality)}</Text>
          )}
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
          onPress={() => {
            const playerId = matchDetails.player2_id;
            if (playerId && typeof playerId === 'number' && playerId > 0 && playerId !== 376) {
              router.push(`/player/${playerId}`);
            }
          }}
          disabled={!matchDetails.player2_id || matchDetails.player2_id === 376}
        >
          <View style={styles.avatarSquare}>
            <Text style={styles.avatarInitial}>{initialOf(p2Name)}</Text>
          </View>
          <Text style={[styles.playerName, styles.player2]} numberOfLines={1}>
            {p2Name}
          </Text>
          {!!matchDetails.player2_nationality && (
            <Text style={styles.flagText}>{getNationalityFlag(matchDetails.player2_nationality)}</Text>
          )}
          <Text style={[styles.playerScore, score2 > score1 && isFinished && styles.winnerScore]}>
            {score2}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
