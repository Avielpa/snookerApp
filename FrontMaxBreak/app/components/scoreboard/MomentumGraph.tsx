import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  series: number[]; // player0-minus-player1 score differential per shot (see services/momentum.ts)
  height?: number;
}

// Plain-View bar sparkline — deliberately not react-native-svg, since that isn't an
// existing dependency and adding it would force a native rebuild (eas build) instead
// of a simple eas update. See docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, Phase 2.
export default function MomentumGraph({ series, height = 36 }: Props) {
  const c = scoreboardColors;
  if (series.length < 2) return null; // nothing meaningful to show yet

  const half = height / 2;
  const maxAbs = Math.max(1, ...series.map(v => Math.abs(v)));

  return (
    <View style={[styles.wrap, { backgroundColor: c.cardBackground, borderColor: c.cardBorder, height }]}>
      <View style={[styles.baseline, { top: half, backgroundColor: c.cardBorder }]} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {series.map((v, i) => {
          const barHeight = Math.max(2, (Math.abs(v) / maxAbs) * (half - 2));
          const isPlayer0Leading = v >= 0;
          return (
            <View key={i} style={[styles.barSlot, { height }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    top: isPlayer0Leading ? half - barHeight : half,
                    backgroundColor: isPlayer0Leading ? c.primary : '#c31f3a',
                  },
                ]}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 8,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  baseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
  row: {
    alignItems: 'stretch',
    paddingHorizontal: 6,
  },
  barSlot: {
    width: 5,
    marginHorizontal: 1,
    position: 'relative',
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: 2,
  },
});
