import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BallType } from '../../../hooks/useSnookerGame';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

// Same two-stop gradient BallPad uses for its ball buttons, so a picked ball here reads
// as the same physical object as everywhere else in the scoreboard — the picker borrows
// the app's own visual vocabulary (true ball colours) instead of a generic text list.
const BALL_GRADIENT: Record<BallType, [string, string]> = {
  red: ['#e8544f', '#8f1526'],
  yellow: ['#ffe27a', '#b9891c'],
  green: ['#3fb867', '#0e4d26'],
  brown: ['#a06b3f', '#452b16'],
  blue: ['#4a80d6', '#163665'],
  pink: ['#f5b6cd', '#b95f80'],
  black: ['#3a3a3a', '#000000'],
};

interface Props {
  label: string;
  options: BallType[];
  value: BallType | null;
  onChange: (ball: BallType | null) => void;
}

// Which non-red ball (if any) went down alongside a foul. Selection state mirrors the
// existing reds-count picker in FoulModal (coloured border + tinted fill) rather than
// opacity-dimming — opacity already means "disabled" elsewhere in this app (BallPad).
export default function FoulPottedBallsPicker({ label, options, value, onChange }: Props) {
  const c = scoreboardColors;
  return (
    <View>
      <Text style={[styles.sectionLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[
            styles.noneBtn,
            { borderColor: value === null ? c.error : c.cardBorder },
            value === null && { backgroundColor: 'rgba(224,100,95,0.14)' },
          ]}
          onPress={() => onChange(null)}
        >
          <Text style={[styles.noneText, { color: value === null ? c.error : c.textSecondary }]}>None</Text>
        </TouchableOpacity>
        {options.map(ball => (
          <TouchableOpacity
            key={ball}
            style={[styles.chipWrap, { borderColor: value === ball ? c.error : 'transparent' }]}
            onPress={() => onChange(ball)}
          >
            <LinearGradient
              colors={BALL_GRADIENT[ball]}
              start={{ x: 0.3, y: 0.25 }}
              end={{ x: 0.75, y: 0.9 }}
              style={styles.chip}
            />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 11,
    marginBottom: 6,
    marginTop: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noneBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noneText: {
    fontSize: 12,
    fontFamily: 'PoppinsBold',
  },
  chipWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
});
