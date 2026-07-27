import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface LiveIndicatorProps {
  isLive?: boolean;
  onBreak?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// Sizing per variant — 'small' is the compact badge used inside Home's
// match cards; 'medium'/'large' preserve the original fixed dimensions
// this component always rendered at (used on the match-detail header).
const SIZES = {
  small: { dot: 5, fontSize: 9, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 9, dotMargin: 4 },
  medium: { dot: 8, fontSize: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, dotMargin: 6 },
  large: { dot: 8, fontSize: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, dotMargin: 6 },
} as const;

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({
  isLive = true,
  onBreak = false,
  size = 'medium',
}) => {
  const isBreak = onBreak && !isLive;
  const s = SIZES[size];
  const dotOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isLive) {
      dotOpacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(dotOpacity, { toValue: 0.3, duration: 900, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isLive, dotOpacity]);

  if (!isLive && !onBreak) return null;

  return (
    <View
      style={[
        styles.liveContainer,
        isBreak && styles.breakContainer,
        {
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: s.borderRadius,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.liveDot,
          { width: s.dot, height: s.dot, borderRadius: s.dot / 2, marginRight: s.dotMargin },
          isLive && { opacity: dotOpacity },
        ]}
      />
      <Text style={[styles.liveText, { fontSize: s.fontSize }]}>
        {isBreak ? 'BREAK' : 'LIVE'}
      </Text>
    </View>
  );
};

// Add displayName for debugging
LiveIndicator.displayName = 'LiveIndicator';

const styles = StyleSheet.create({
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
  },
  breakContainer: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
  },
  liveDot: {
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
