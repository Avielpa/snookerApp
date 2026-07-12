import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  visible: boolean;
  frameNumber: number;
  scores: [number, number];
  highestBreak: [number, number];
  playerNames: [string, string];
  framesWon: [number, number];
  winner: 0 | 1;
  isMatchOver: boolean;
  matchWinner: 0 | 1 | null;
  bestOf: number | null;
  onNextFrame: () => void;
  onEndMatch: () => void;
  trainMode?: boolean;
  sessionBest?: number;
}

export default function FrameSummary({
  visible, frameNumber, scores, highestBreak, playerNames, framesWon, winner,
  isMatchOver, matchWinner, bestOf, onNextFrame, onEndMatch, trainMode, sessionBest,
}: Props) {
  const c = scoreboardColors;

  const isTied = scores[0] === scores[1];

  if (trainMode) {
    const breakScore = scores[0];
    const breaksCompleted = framesWon[0];
    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={[styles.card, { backgroundColor: c.backgroundSecondary, borderColor: c.primary }]}>
            <Text style={[styles.badge, { color: c.textMuted }]}>Break {breaksCompleted}</Text>
            <Text style={[styles.winner, { color: c.textPrimary }]}>
              {breakScore === 0 ? 'No score' : `${breakScore} points`}
            </Text>
            {highestBreak[0] > 0 && (
              <Text style={[styles.subtext, { color: c.textSecondary }]}>
                Highest break: {highestBreak[0]}
              </Text>
            )}
            {sessionBest !== undefined && sessionBest > 0 && (
              <Text style={[styles.subtext, { color: c.primary }]}>
                Session best: {sessionBest}
              </Text>
            )}

            <View style={[styles.scoreRow, { borderColor: c.cardBorder }]}>
              <View style={styles.scoreCol}>
                <Text style={[styles.playerName, { color: c.textSecondary }]} numberOfLines={1}>
                  {playerNames[0]}
                </Text>
                <Text style={[styles.score, { color: c.primary }]}>{breakScore}</Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>Breaks: {breaksCompleted}</Text>
              </View>
            </View>

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: c.primary }]}
                onPress={onNextFrame}
              >
                <Text style={[styles.btnText, { color: '#121212' }]}>New Break →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: c.backgroundTertiary }]}
                onPress={onEndMatch}
              >
                <Text style={[styles.btnText, { color: c.textSecondary }]}>End Session</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: c.backgroundSecondary, borderColor: c.primary }]}>

          {isMatchOver ? (
            <>
              <Text style={[styles.badge, { color: c.primary }]}>Match Over</Text>
              <Text style={[styles.winner, { color: c.textPrimary }]}>
                🏆 {playerNames[matchWinner ?? winner]} wins!
              </Text>
              <Text style={[styles.frames, { color: c.textSecondary }]}>
                {framesWon[0]} – {framesWon[1]}
              </Text>
            </>
          ) : (
            <>
              <Text style={[styles.badge, { color: c.textMuted }]}>Frame {frameNumber}</Text>
              <Text style={[styles.winner, { color: c.textPrimary }]}>
                {isTied ? 'Frame tied — black re-spotted' : `${playerNames[winner]} wins the frame`}
              </Text>
            </>
          )}

          {/* Scores */}
          <View style={[styles.scoreRow, { borderColor: c.cardBorder }]}>
            {([0, 1] as const).map(p => (
              <View key={p} style={styles.scoreCol}>
                <Text style={[styles.playerName, { color: c.textSecondary }]} numberOfLines={1}>
                  {playerNames[p]}
                </Text>
                <Text style={[styles.score, { color: p === winner ? c.primary : c.textPrimary }]}>
                  {scores[p]}
                </Text>
                {highestBreak[p] > 0 && (
                  <Text style={[styles.meta, { color: c.textMuted }]}>
                    Highest break: {highestBreak[p]}
                  </Text>
                )}
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  Frames: {framesWon[p]}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.btnRow}>
            {!isMatchOver && (
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: c.primary }]}
                onPress={onNextFrame}
              >
                <Text style={[styles.btnText, { color: '#121212' }]}>Next Frame →</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: c.backgroundTertiary }]}
              onPress={onEndMatch}
            >
              <Text style={[styles.btnText, { color: c.textSecondary }]}>
                {isMatchOver ? 'View Stats' : 'End Match'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  badge: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  winner: {
    fontSize: 20,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtext: {
    fontSize: 13,
    fontFamily: 'PoppinsRegular',
    marginBottom: 2,
  },
  frames: {
    fontSize: 32,
    fontFamily: 'PoppinsBold',
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    width: '100%',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginVertical: 16,
    paddingVertical: 12,
  },
  scoreCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  playerName: {
    fontSize: 13,
  },
  score: {
    fontSize: 40,
    fontFamily: 'PoppinsBold',
  },
  meta: {
    fontSize: 11,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: 'PoppinsBold',
    fontSize: 15,
  },
});
