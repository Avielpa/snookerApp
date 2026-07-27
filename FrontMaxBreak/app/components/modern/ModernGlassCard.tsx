// app/components/modern/ModernGlassCard.tsx
// MODERN GLASS CARD - Smaller padding, cleaner look
// NO LOGIC CHANGES - ONLY VISUAL IMPROVEMENTS

import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../../contexts/ThemeContext';

interface ModernGlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  // Which edge the accent color renders on. Defaults to 'top' to preserve
  // every existing call site's look (player profile, home state components);
  // 'left' is the "Premium Broadcast" treatment used by Home's match cards.
  accentSide?: 'top' | 'left';
  accentWidth?: number;
  // Soft colored shadow matching accentColor — used for the live-match glow.
  glow?: boolean;
}

export const ModernGlassCard: React.FC<ModernGlassCardProps> = ({
  children,
  style,
  accentColor,
  accentSide = 'top',
  accentWidth,
  glow = false,
}) => {
  const colors = useColors();

  // Dynamic gradient colors based on theme
  const gradientColors = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? ['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)'] as const // Light mode - brighter
    : ['rgba(28, 28, 30, 0.85)', 'rgba(14, 14, 16, 0.7)'] as const; // Dark mode - obsidian/charcoal, no green tint

  const borderColor = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? 'rgba(26, 115, 58, 0.12)' // Light mode - subtle snooker green
    : colors.cardBorder; // Dark mode - matches the app's global card border token

  const accentStyle = accentColor
    ? accentSide === 'left'
      ? { borderLeftColor: accentColor, borderLeftWidth: accentWidth ?? 4 }
      : { borderTopColor: accentColor, borderTopWidth: accentWidth ?? 3 }
    : {};

  const glowStyle = glow && accentColor
    ? {
        shadowColor: accentColor,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 8,
        elevation: 6,
      }
    : {};

  return (
    <View style={[styles.outerContainer, { borderColor }, accentStyle, glowStyle, style]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {children}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 12,              // Smaller, tighter radius
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },  // Subtle shadow
    shadowOpacity: 0.1,            // Lighter shadow
    shadowRadius: 6,               // Tighter
    elevation: 3,                  // Less elevated (smaller cards)
  },
  gradient: {
    padding: 6,
  },
});

// Add displayName for debugging
ModernGlassCard.displayName = 'ModernGlassCard';
