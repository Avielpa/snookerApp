import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { scoreboardColors } from '../../../constants/scoreboardTheme';

interface Props {
  trigger: boolean; // pulses true for one render when services/centuryTrigger.ts fires
  player: string;
  breakValue: number;
}

// Non-blocking celebration overlay — pointerEvents="none" so it never intercepts the
// ball pad underneath, and auto-dismisses on its own after a few seconds.
export default function CenturyCelebration({ trigger, player, breakValue }: Props) {
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
        <Text style={[styles.label, { color: c.textMuted }]}>CENTURY</Text>
        <Text style={[styles.text, { color: c.primary }]}>{player} — {breakValue}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: '32%',
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
