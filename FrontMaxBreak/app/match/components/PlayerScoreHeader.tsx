// app/match/components/PlayerScoreHeader.tsx
// Hero scoreboard — strict 3-zone flex layout: LEFT (player 1) / CENTER
// (score + live status) / RIGHT (player 2). See docs/SESSION notes for the
// exact spec this was built to.
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LiveIndicator } from '../../components/modern';
import { MatchDetails } from '../types';
import { getNationalityFlag } from '../../../utils/nationalityFlag';
import { areScoresValid, normalizeScore } from '../../../utils/playerUtils';

interface PlayerScoreHeaderProps {
  matchDetails: MatchDetails;
  styles: any;
}

function initialOf(name: string | null | undefined): string {
  return name?.trim()?.charAt(0)?.toUpperCase() || '?';
}

// One player's zone (avatar + name + flag). LEFT and RIGHT both render this
// same component, so the two sides stay structurally identical.
function PlayerZone({
  name,
  nationality,
  playerId,
  styles,
  onPress,
}: {
  name: string;
  nationality: string | null | undefined;
  playerId: number | null;
  styles: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.playerZone}
      onPress={onPress}
      disabled={!playerId || playerId === 376}
      activeOpacity={0.7}
    >
      {/* Placeholder square avatar (initial letter) — swap for a real
          player photo URL once that data exists in the API response. */}
      <View style={styles.avatarSquare}>
        <Text style={styles.avatarInitial}>{initialOf(name)}</Text>
      </View>
      <View style={styles.nameFlagRow}>
        <Text style={styles.playerName} numberOfLines={1} ellipsizeMode="tail">
          {name}
        </Text>
        {!!nationality && (
          <Text style={styles.flagText}>{getNationalityFlag(nationality)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export function PlayerScoreHeader({ matchDetails, styles }: PlayerScoreHeaderProps) {
  const router = useRouter();

  const p1Name = matchDetails?.player1_name ?? 'TBD';
  const p2Name = matchDetails?.player2_name ?? 'TBD';
  const hasScore = areScoresValid(matchDetails?.score1, matchDetails?.score2);
  const score1 = normalizeScore(matchDetails?.score1);
  const score2 = normalizeScore(matchDetails?.score2);
  const isLive = matchDetails?.status_code === 1;
  const isOnBreak = matchDetails?.status_code === 2;
  const isFinished = matchDetails?.status_code === 3;

  const goToPlayer = (playerId: number | null) => {
    if (playerId && typeof playerId === 'number' && playerId > 0 && playerId !== 376) {
      router.push(`/player/${playerId}`);
    }
  };

  return (
    <View style={styles.scoreHeader}>
      <View style={styles.scoreContainer}>
        {/* LEFT ZONE — Player 1 */}
        <PlayerZone
          name={p1Name}
          nationality={matchDetails?.player1_nationality}
          playerId={matchDetails?.player1_id ?? null}
          styles={styles}
          onPress={() => goToPlayer(matchDetails?.player1_id ?? null)}
        />

        {/* CENTER ZONE — Score & Status. The "vs" placeholder only shows
            when there's no real score yet (e.g. a scheduled match) — once
            there's a score, it's replaced entirely, never shown alongside it. */}
        <View style={styles.centerZone}>
          {hasScore ? (
            <View style={styles.scoreRow}>
              <Text style={[styles.playerScore, score1 > score2 && isFinished && styles.winnerScore]}>
                {score1}
              </Text>
              <Text style={styles.scoreSeparator}>-</Text>
              <Text style={[styles.playerScore, score2 > score1 && isFinished && styles.winnerScore]}>
                {score2}
              </Text>
            </View>
          ) : (
            <Text style={styles.vsText}>VS</Text>
          )}
          {(isLive || isOnBreak) && (
            <View style={styles.statusBadgeRow}>
              <LiveIndicator isLive={isLive} onBreak={isOnBreak} size="large" />
            </View>
          )}
        </View>

        {/* RIGHT ZONE — Player 2 */}
        <PlayerZone
          name={p2Name}
          nationality={matchDetails?.player2_nationality}
          playerId={matchDetails?.player2_id ?? null}
          styles={styles}
          onPress={() => goToPlayer(matchDetails?.player2_id ?? null)}
        />
      </View>
    </View>
  );
}
