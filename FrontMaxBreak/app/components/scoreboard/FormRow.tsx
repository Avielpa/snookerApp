import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';
import MomentumGraph from './MomentumGraph';

interface FormRowProps {
  winProbability: [number, number] | null;
  momentumSeries: number[];
}

// Merges the win-probability bar and momentum sparkline into one compact row instead of
// two separate stacked blocks — same two pieces of data, same rendering conditions as
// before, just grouped. MomentumGraph itself is untouched (still View-bar, not svg).
export default function FormRow({ winProbability, momentumSeries }: FormRowProps) {
  const c = scoreboardColors;
  const showWinProb = !!winProbability;
  const showMomentum = momentumSeries.length >= 2;
  if (!showWinProb && !showMomentum) return null;

  return (
    <View style={styles.row}>
      {showWinProb && (
        <>
          <Text style={[styles.pct, { color: c.textSage }]}>{winProbability![0]}%</Text>
          <View style={[styles.track, { backgroundColor: c.backgroundTertiary }]}>
            <View style={{ width: `${winProbability![0]}%`, backgroundColor: c.pinGold }} />
            <View style={{ width: `${winProbability![1]}%`, backgroundColor: '#7d1c2c' }} />
          </View>
          <Text style={[styles.pct, { color: c.textSage }]}>{winProbability![1]}%</Text>
        </>
      )}
      {showMomentum && (
        <View style={styles.sparkWrap}>
          <MomentumGraph series={momentumSeries} height={16} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, opacity: 0.9 },
  pct: { fontSize: 9, fontFamily: 'PoppinsBold' },
  track: { flex: 1, height: 4, borderRadius: 3, overflow: 'hidden', flexDirection: 'row' },
  sparkWrap: { width: 46 },
});
