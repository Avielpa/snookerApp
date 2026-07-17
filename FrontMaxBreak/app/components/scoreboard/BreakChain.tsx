import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { BallType } from '../../../hooks/useSnookerGame';
import { scoreboardColors, scoreboardBallColors } from '../../../constants/scoreboardTheme';

interface Props {
  breakBalls: BallType[];
  currentBreak: number;
}

// Renders the actual sequence of balls potted in the live break, not just its total —
// reads state.current.breakBalls directly, nothing invented or re-derived.
export default function BreakChain({ breakBalls, currentBreak }: Props) {
  const c = scoreboardColors;
  if (breakBalls.length === 0) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.backgroundSecondary, borderColor: c.borderGlass }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {breakBalls.map((ball, i) => (
          <React.Fragment key={i}>
            <View style={[styles.chip, { backgroundColor: scoreboardBallColors[ball] }]} />
            {i < breakBalls.length - 1 && <Text style={[styles.arrow, { color: c.textMuted }]}>›</Text>}
          </React.Fragment>
        ))}
      </ScrollView>
      <Text style={[styles.total, { color: c.pinGold }]}>{currentBreak}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chip: {
    width: 17,
    height: 17,
    borderRadius: 9,
  },
  arrow: {
    fontSize: 9,
    marginHorizontal: 1,
  },
  total: {
    fontFamily: 'PoppinsBold',
    fontSize: 15,
    marginLeft: 10,
  },
});
