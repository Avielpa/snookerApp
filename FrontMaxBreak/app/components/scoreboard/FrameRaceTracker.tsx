import React from 'react';
import { View, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  framesWon: [number, number];
  bestOf: number | null; // null = single frame, 9999 = unlimited sentinel
}

// Diamond-rail race tracker — one diamond per frame in the match, filled per frame won.
// Purely derived from framesWon + bestOf, both already tracked by useSnookerGame — no
// new state. Renders nothing for single-frame or unlimited matches, where "race length"
// isn't a meaningful concept.
export default function FrameRaceTracker({ framesWon, bestOf }: Props) {
  const c = scoreboardColors;
  if (bestOf === null || bestOf >= 9999) return null;

  const diamonds = Array.from({ length: bestOf }, (_, i) => i);
  let filled0 = framesWon[0];
  let filled1 = framesWon[1];

  return (
    <View style={[styles.rail, { backgroundColor: '#3a2412', borderColor: '#6b4526' }]}>
      <View style={[styles.rod, { backgroundColor: c.primary }]} />
      <View style={styles.diamondRow}>
        {diamonds.map(i => {
          let fillColor: string | null = null;
          if (filled0 > 0) { fillColor = c.primary; filled0--; }
          else if (filled1 > 0) { fillColor = '#c31f3a'; filled1--; }
          return (
            <View
              key={i}
              style={[
                styles.diamond,
                fillColor
                  ? { backgroundColor: fillColor, borderColor: fillColor }
                  : { backgroundColor: '#0a2a1f', borderColor: c.primary },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    justifyContent: 'center',
    position: 'relative',
  },
  rod: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 2,
    opacity: 0.6,
  },
  diamondRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  diamond: {
    width: 10,
    height: 10,
    borderWidth: 1.5,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
});
