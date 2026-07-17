import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface ScorePanelProps {
  playerNames: [string, string];
  scores: [number, number];
  framesWon: [number, number];
  currentBreak: number;
  highestBreak: [number, number];
  currentPlayer: 0 | 1;
  pointsOnTable: number;
  isTrainMode: boolean;
  onEndVisit?: (forPlayer: 0 | 1) => void;
  /** Match-mode lead status, e.g. "Aviel ahead · Sam 24 behind" or "Level". Caller decides
   * whether to pass it (game.tsx only computes/passes it outside train mode). */
  leadText?: string;
}

// Unified score panel — the redesign's signature element. Squared corners (deliberately
// breaking from the rounded language everywhere else) + 4 brass corner pins, styled like
// a physical nameplate on a scoreboard cabinet. Replaces the old 3-block layout
// (points-remaining card + 2 separate PlayerCards) with one panel — same data, same
// conditions, just visually merged. See docs/superpowers/specs/2026-07-17-scoreboard-game-screen-redesign-design.md.
export default function ScorePanel({
  playerNames, scores, framesWon, currentBreak, highestBreak, currentPlayer,
  pointsOnTable, isTrainMode, onEndVisit, leadText,
}: ScorePanelProps) {
  const c = scoreboardColors;

  function renderPlayer(idx: 0 | 1) {
    const isActive = currentPlayer === idx;
    const canTapToEndVisit = !isTrainMode && !isActive && !!onEndVisit;
    const inner = (
      <>
        <Text style={[styles.name, { color: isActive ? c.textHeader : c.textSage }]} numberOfLines={1}>
          {playerNames[idx]}
        </Text>
        <Text style={[styles.score, { color: isActive ? c.textHeader : c.textPrimary }]}>
          {scores[idx]}
        </Text>
        {!isTrainMode && (
          <Text style={[styles.meta, { color: c.textMuted }]}>
            Frames {framesWon[idx]}{highestBreak[idx] > 0 ? ` · Best ${highestBreak[idx]}` : ''}
          </Text>
        )}
        {isActive && currentBreak > 0 && (
          <View style={[styles.breakBadge, { backgroundColor: c.pinGold }]}>
            <Text style={styles.breakBadgeText}>Break {currentBreak}</Text>
          </View>
        )}
      </>
    );

    if (canTapToEndVisit) {
      return (
        <TouchableOpacity
          key={idx}
          style={[styles.playerCol, isActive && styles.playerColActive, idx === 0 && styles.borderRight]}
          activeOpacity={0.7}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEndVisit?.(idx); }}
        >
          {inner}
        </TouchableOpacity>
      );
    }
    return (
      <View key={idx} style={[styles.playerCol, isActive && styles.playerColActive, idx === 0 && styles.borderRight]}>
        {inner}
      </View>
    );
  }

  return (
    <View style={[styles.panel, { backgroundColor: c.cardBackground, borderColor: c.borderGlass }]}>
      <View style={[styles.pin, styles.pinTL, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinTR, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinBL, { backgroundColor: c.pinGold }]} />
      <View style={[styles.pin, styles.pinBR, { backgroundColor: c.pinGold }]} />
      <View style={styles.scoreRow}>
        {renderPlayer(0)}
        {!isTrainMode && renderPlayer(1)}
      </View>
      <View style={[styles.potRow, { borderTopColor: c.borderGlass }]}>
        <Text style={[styles.potValue, { color: c.textPrimary }]}>{pointsOnTable}</Text>
        <Text style={[styles.potLabel, { color: c.textSage }]}>points remaining</Text>
      </View>
      {!!leadText && (
        <Text style={[styles.leadText, { color: c.textSage }]}>{leadText}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 6, // squared vs. the rest of the screen's rounded elements — the signature detail
    borderWidth: 1,
    overflow: 'hidden',
  },
  pin: { position: 'absolute', width: 5, height: 5, borderRadius: 3, opacity: 0.85 },
  pinTL: { top: 6, left: 6 },
  pinTR: { top: 6, right: 6 },
  pinBL: { bottom: 6, left: 6 },
  pinBR: { bottom: 6, right: 6 },
  scoreRow: { flexDirection: 'row' },
  playerCol: { flex: 1, paddingVertical: 16, paddingHorizontal: 8, alignItems: 'center' },
  playerColActive: { backgroundColor: 'rgba(199,164,92,0.08)' },
  borderRight: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.08)' },
  name: { fontSize: 11, fontFamily: 'PoppinsBold', letterSpacing: 1, textTransform: 'uppercase' },
  score: { fontSize: 42, fontFamily: 'PoppinsBold', lineHeight: 48, marginTop: 4 },
  meta: { fontSize: 10, marginTop: 4 },
  breakBadge: { marginTop: 6, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 4 },
  breakBadgeText: { color: '#0a2a1f', fontSize: 10, fontFamily: 'PoppinsBold' },
  potRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderTopWidth: 1, backgroundColor: 'rgba(0,0,0,0.16)',
  },
  potValue: { fontSize: 24, fontFamily: 'PoppinsBold' },
  potLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  leadText: { fontSize: 11, textAlign: 'center', paddingBottom: 10, paddingHorizontal: 12 },
});
