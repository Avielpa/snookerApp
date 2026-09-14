import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  trigger: boolean; // pulses true for one render when the live break passes the known best
  breakValue: number;
}

// Sibling to CenturyCelebration.tsx (same non-blocking overlay pattern), positioned
// lower so the two can both be visible without overlapping if a break happens to be
// both a century AND a new personal best at once. Login-gated at the call site
// (game.tsx only computes `trigger` for a logged-in Train-mode session — this
// component itself has no auth awareness, same separation of concerns as
// CenturyCelebration).
export default function PersonalBestCelebration({ trigger, breakValue }: Props) {
  const c = scoreboardColors;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <View style={[styles.stamp, { borderColor: c.primary, backgroundColor: 'rgba(8,20,15,0.92)' }]}>
        <Text style={[styles.label, { color: c.textMuted }]}>🏆 NEW PERSONAL BEST</Text>
        <Text style={[styles.text, { color: c.primary }]}>{breakValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  stamp: {
    borderWidth: 3,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    letterSpacing: 2,
  },
  text: {
    fontFamily: 'PoppinsBold',
    fontSize: 20,
    marginTop: 2,
  },
});
