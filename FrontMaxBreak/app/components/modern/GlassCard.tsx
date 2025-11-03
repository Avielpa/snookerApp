import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '../../../contexts/ThemeContext';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, style }) => {
  const colors = useColors();
  
  // Dynamic gradient colors based on theme
  const gradientColors = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? ['rgba(255, 255, 255, 0.95)', 'rgba(255, 255, 255, 0.85)'] as const // Light mode
    : ['rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.5)'] as const; // Dark mode
    
  const borderColor = colors.cardBackground === 'rgba(255, 255, 255, 0.95)'
    ? 'rgba(0, 0, 0, 0.15)' // Light mode
    : 'rgba(255, 255, 255, 0.3)'; // Dark mode
  
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
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  gradient: {
    padding: 16,
  },
});

// Add displayName for debugging
GlassCard.displayName = 'GlassCard';