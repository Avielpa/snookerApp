import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { BallType, BALL_VALUES, GamePhase, AwaitingType, COLORS_SEQUENCE } from '../../../hooks/useSnookerGame';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  phase: GamePhase;
  awaiting: AwaitingType;
  colorsRemaining: BallType[];
  redsRemaining: number;
  currentBreak: number;
  onPot: (ball: BallType) => void;
  onExtraRed: () => void;
  onMiss: () => void;
  onFoul: () => void;
  onUndo: () => void;
  onConcede: () => void;
  canUndo: boolean;
  trainMode?: boolean;
  freeBallActive?: boolean;
  onFreeBall?: (ball: BallType) => void;
}

const ALL_BALLS: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

// Two-stop gradient per ball for a glossy-sphere highlight instead of a flat fill —
// light stop top-left, base ball color everywhere else. Values match
// scoreboardBallColors exactly (same ball → same base color), just adding a highlight.
const BALL_GRADIENT: Record<BallType, [string, string]> = {
  red: ['#e8544f', '#8f1526'],
  yellow: ['#ffe27a', '#b9891c'],
  green: ['#3fb867', '#0e4d26'],
  brown: ['#a06b3f', '#452b16'],
  blue: ['#4a80d6', '#163665'],
  pink: ['#f5b6cd', '#b95f80'],
  black: ['#3a3a3a', '#000000'],
};

export default function BallPad({
  phase, awaiting, colorsRemaining, redsRemaining, currentBreak, onPot, onExtraRed, onMiss, onFoul, onUndo, onConcede, canUndo, trainMode, freeBallActive, onFreeBall,
}: Props) {
  const c = scoreboardColors;

  function isEnabled(ball: BallType): boolean {
    if (freeBallActive) return true;
    if (phase === 'colors') return ball === colorsRemaining[0];
    if (awaiting === 'red') return ball === 'red';
    return ball !== 'red'; // awaiting color
  }

  function getOpacity(ball: BallType): number {
    if (!isEnabled(ball)) return 0.25;
    return 1;
  }

  async function handlePot(ball: BallType) {
    if (!isEnabled(ball)) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (freeBallActive) { onFreeBall?.(ball); return; }
    onPot(ball);
  }

  const statusLabel = (() => {
    if (freeBallActive) return 'Free ball — tap to nominate any ball';
    if (phase === 'colors') {
      const next = colorsRemaining[0];
      return `Pot the ${next} (${BALL_VALUES[next]} pts)`;
    }
    if (redsRemaining === 0 && awaiting === 'color') return 'Pot a colour — last red is off the table';
    if (awaiting === 'red') return `${redsRemaining} red${redsRemaining !== 1 ? 's' : ''} remaining — pot a red`;
    return 'Red potted — nominate a colour';
  })();

  // True when multiple reds may have been potted simultaneously on the same shot
  // Only show after the current player has actually potted a red this visit (currentBreak > 0).
  // Without this guard, awaiting='color' carried over from the previous player's visit would
  // incorrectly show the extra-red button at the start of the new player's turn.
  const showExtraRed = phase === 'reds' && awaiting === 'color' && redsRemaining > 0
    && currentBreak > 0 && !trainMode && !freeBallActive;

  return (
    <View style={[styles.container, { backgroundColor: c.backgroundSecondary }]}>
      <Text style={[styles.status, { color: c.textSecondary }]}>{statusLabel}</Text>

      {/* Extra red — shows when multiple reds may have been potted on one shot */}
      {showExtraRed && (
        <TouchableOpacity
          style={[styles.extraRedBtn, { borderColor: '#CC0000', backgroundColor: 'rgba(204,0,0,0.12)' }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onExtraRed(); }}
        >
          <Text style={[styles.extraRedText, { color: '#CC0000' }]}>
            +1 extra red potted ({redsRemaining} left)
          </Text>
        </TouchableOpacity>
      )}

      {/* Ball buttons */}
      <View style={styles.ballRow}>
        {ALL_BALLS.map(ball => (
          <TouchableOpacity
            key={ball}
            onPress={() => handlePot(ball)}
            disabled={!isEnabled(ball)}
            activeOpacity={0.7}
            style={[styles.ballButton, { opacity: getOpacity(ball) }]}
          >
            <LinearGradient
              colors={BALL_GRADIENT[ball]}
              start={{ x: 0.3, y: 0.25 }}
              end={{ x: 0.75, y: 0.9 }}
              style={[
                styles.ballGradient,
                { borderWidth: ball === 'black' ? 2 : 0, borderColor: ball === 'black' ? '#555' : undefined },
                isEnabled(ball) && styles.ballEnabled,
              ]}
            >
              <Text style={[styles.ballPts, { color: ball === 'yellow' || ball === 'green' ? '#000' : '#fff' }]}>
                {BALL_VALUES[ball]}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
          onPress={onMiss}
        >
          <Text style={[styles.actionText, { color: c.textSage }]}>
            {trainMode ? 'End Break' : 'End Visit'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(224,100,95,0.14)' }]}
          onPress={onFoul}
        >
          <Text style={[styles.actionText, { color: c.error }]}>Foul</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.05)', opacity: canUndo ? 1 : 0.35 }]}
          onPress={onUndo}
          disabled={!canUndo}
        >
          <Text style={[styles.actionText, { color: c.textSage }]}>↩ Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: c.pinGold }]}
          onPress={onConcede}
        >
          <Text style={[styles.actionText, { color: '#0a2a1f', fontWeight: '700' }]}>
            {trainMode ? 'End Session' : 'Concede'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  status: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  ballRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 6,
  },
  ballButton: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 52,
    maxHeight: 52,
  },
  ballGradient: {
    flex: 1,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ballEnabled: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  ballPts: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
  },
  extraRedBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 8,
    alignItems: 'center',
  },
  extraRedText: {
    fontSize: 12,
    fontFamily: 'PoppinsBold',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontFamily: 'PoppinsBold',
  },
});
