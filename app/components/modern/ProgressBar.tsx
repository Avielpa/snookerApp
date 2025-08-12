// components/modern/ProgressBar.tsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface ProgressBarProps {
  progress: number; // 0-1
  height?: number;
  animated?: boolean;
  showPercentage?: boolean;
  colors?: string[];
  backgroundColor?: string;
  borderRadius?: number;
  label?: string;
}

/**
 * Modern animated progress bar component
 * Used for showing tournament progress, match completion, etc.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  height = 8,
  animated = true,
  showPercentage = false,
  colors = ['#4CAF50', '#8BC34A'],
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
  borderRadius = 4,
  label,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const clampedProgress = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    if (animated) {
      Animated.timing(animatedWidth, {
        toValue: clampedProgress,
        duration: 800,
        useNativeDriver: false,
      }).start();
    } else {
      animatedWidth.setValue(clampedProgress);
    }
  }, [clampedProgress, animated, animatedWidth]);

  const widthInterpolation = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>{label}</Text>
          {showPercentage && (
            <Text style={styles.percentage}>
              {Math.round(clampedProgress * 100)}%
            </Text>
          )}
        </View>
      )}
      
      <View style={[styles.track, { height, backgroundColor, borderRadius }]}>
        <Animated.View style={[styles.fill, { width: widthInterpolation, borderRadius }]}>
          <LinearGradient
            colors={colors as unknown as readonly [string, string, ...string[]]}
            style={styles.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </Animated.View>
      </View>
    </View>
  );
};

// Add displayName for debugging
ProgressBar.displayName = 'ProgressBar';

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: 'PoppinsMedium',
    color: '#FFFFFF',
  },
  percentage: {
    fontSize: 12,
    fontFamily: 'PoppinsSemiBold',
    color: '#FFA726',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
});