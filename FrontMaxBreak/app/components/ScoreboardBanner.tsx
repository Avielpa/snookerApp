import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

interface Props {
  visible: boolean;
  onHide: () => void;
}

const VISIBLE_MS = 3000;
const FADE_MS = 300;

export default function ScoreboardBanner({ visible, onHide }: Props) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => onHide());
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.container, { opacity, top: insets.top + 70 }]}
    >
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => router.push('/scoreboard' as any)}
      >
        <Text style={styles.text}>🎱 Try the new Scoreboard — tap Play!</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  banner: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  text: {
    color: '#121212',
    fontSize: 13,
    fontFamily: 'PoppinsBold',
  },
});
