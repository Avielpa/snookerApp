// components/EnhancedTabStyles.ts
// Compact professional styling inspired by SofaScore/Score365

import { StyleSheet } from 'react-native';

export const createEnhancedTabStyles = (colors: any) => {
  return StyleSheet.create({
    // Minimal compact container - SofaScore style
    premiumContainer: {
      backgroundColor: 'transparent', // No background - cleaner
      paddingHorizontal: 4, // Minimal horizontal padding
      paddingVertical: 2,   // Minimal vertical padding
    },
    
    // Clean minimal scroll view
    enhancedScrollView: {
      backgroundColor: 'transparent',
      paddingVertical: 2, // Much smaller padding
    },
    
    // Minimal separator - SofaScore style
    buttonSeparator: {
      width: 0.5, // Thinner line
      height: 12, // Much smaller
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      marginHorizontal: 2, // Much closer spacing
      alignSelf: 'center',
    },
    
    // Subtle active indicator - no glow, just clean highlight
    activeGlowOverlay: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 6, // Much smaller radius
      backgroundColor: 'transparent', // No background overlay
      borderWidth: 0, // No border
    },
    
    // Minimal animation - SofaScore style (no scaling)
    animatedButton: {
      transform: [{ scale: 1 }],
    },
    
    animatedButtonActive: {
      transform: [{ scale: 1 }], // No scaling animation - cleaner
    },
    
    // Clean text - no shadows (SofaScore style)
    premiumText: {
      // No text shadow - cleaner modern look
    },
    
    // Clean icon - no shadows
    premiumIcon: {
      // No text shadow - cleaner modern look
    },
  });
};

// Lively, young, and inviting color palette inspired by modern sports apps
export const premiumColors = {
  primary: '#FF6B35',        // Vibrant orange-red - energetic and inviting
  primaryDark: '#E55A2B',    // Darker shade
  primaryLight: '#FF8A5C',   // Lighter shade
  accent: '#00D4AA',         // Mint green - fresh and modern
  secondary: '#5B7FFF',      // Electric blue - tech and dynamic
  warning: '#FFB347',        // Soft orange - friendly warnings
  success: '#20E070',        // Bright green - positive actions
  background: 'rgba(255, 107, 53, 0.02)',  // Very subtle primary tint
  surface: 'rgba(255, 255, 255, 0.06)',    // Slightly more visible surface
  border: 'rgba(255, 255, 255, 0.12)',     // More visible borders
  borderActive: '#FF6B35',   // Vibrant active border
  text: 'rgba(255, 255, 255, 0.85)',       // Better contrast
  textSecondary: 'rgba(255, 255, 255, 0.65)', // Still readable but muted
  textActive: '#FFFFFF',     // Pure white for active
  shadow: 'rgba(255, 107, 53, 0.15)',      // Subtle colored shadow
  glow: 'rgba(255, 107, 53, 0.25)',        // Subtle colored glow
};

// Animation configurations
export const animationConfig = {
  duration: 200,
  useNativeDriver: true,
  tension: 100,
  friction: 8,
};