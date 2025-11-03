// app/components/modern/ModernGlassCard.tsx
// MODERN GLASS CARD - Smaller padding, cleaner look
// NO LOGIC CHANGES - ONLY VISUAL IMPROVEMENTS

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../../contexts/ThemeContext';

interface ModernGlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ModernGlassCard: React.FC<ModernGlassCardProps> = ({ children, style }) => {
  const colors = useColors();

  // Dynamic gradient colors based on theme
  const gradientColors = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? ['rgba(255, 255, 255, 0.98)', 'rgba(255, 255, 255, 0.92)'] as const // Light mode - brighter
    : ['rgba(15, 25, 20, 0.8)', 'rgba(10, 20, 15, 0.6)'] as const; // Dark mode - snooker green tint

  const borderColor = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? 'rgba(26, 115, 58, 0.12)' // Light mode - subtle snooker green
    : 'rgba(26, 115, 58, 0.3)'; // Dark mode - snooker green accent

  return (
    <View style={[styles.outerContainer, { borderColor }, style]}>
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
    borderRadius: 14,              // Slightly reduced from 16 (tighter)
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },  // Reduced from 4 (subtler)
    shadowOpacity: 0.08,           // Reduced from 0.1 (lighter shadow)
    shadowRadius: 8,               // Reduced from 12 (tighter)
    elevation: 3,                  // Reduced from 5 (less prominent)
  },
  gradient: {
    padding: 12,                   // Reduced from 16 (SMALLER CARDS!)
  },
});

// Add displayName for debugging
ModernGlassCard.displayName = 'ModernGlassCard';
