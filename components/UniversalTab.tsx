// components/UniversalTab.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getOptimizedTouchConfig, createSamsungCompatibleHandler, needsEnhancedTabHandling } from '../utils/deviceCompatibility';

interface UniversalTabProps {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  isSelected: boolean;
  onPress: (id: string) => void;
  count?: number;
  style?: any;
}

/**
 * Universal Tab Component
 * 
 * This component addresses compatibility issues with Galaxy S23/S24/S25 devices
 * by using multiple touch handling strategies and ensuring proper event propagation.
 * 
 * Key fixes:
 * 1. Uses Pressable as primary component (better Samsung compatibility)
 * 2. Fallback to TouchableOpacity for older devices
 * 3. Enhanced hit detection with larger touch areas
 * 4. Prevents touch event conflicts with proper timing
 * 5. Native feedback handling for consistent UX
 */
export const UniversalTab: React.FC<UniversalTabProps> = ({
  id,
  label,
  icon,
  color,
  backgroundColor,
  borderColor,
  textColor,
  isSelected,
  onPress,
  count,
  style,
}) => {
  const touchConfig = getOptimizedTouchConfig();
  const needsEnhanced = needsEnhancedTabHandling();
  
  const handlePress = React.useCallback(() => {
    console.log(`[UniversalTab] Tab pressed: ${id}, enhanced: ${needsEnhanced}`);
    console.log(`[UniversalTab] Galaxy S24 Debug - Touch event received for tab: ${id}`);
    
    // Enhanced logging for Galaxy S24 debugging
    const { width, height } = require('react-native').Dimensions.get('window');
    console.log(`[UniversalTab] Device: ${width}x${height}, Platform: ${Platform.OS}`);
    
    // Haptic feedback for better UX
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log(`[UniversalTab] Haptic feedback triggered for ${id}`);
    } catch (error) {
      console.log('[UniversalTab] Haptics not available:', error);
    }
    
    // Use Samsung-compatible handler if needed
    const handler = needsEnhanced ? createSamsungCompatibleHandler(() => onPress(id)) : () => onPress(id);
    
    console.log(`[UniversalTab] Calling onPress handler for ${id}`);
    handler();
  }, [id, onPress, needsEnhanced]);

  const tabStyle = [
    styles.tabButton,
    {
      backgroundColor: isSelected ? backgroundColor : `${backgroundColor}70`, // More transparent when not selected
      borderColor: isSelected ? borderColor : `${borderColor}50`,
      borderWidth: isSelected ? 2.5 : 1.5,
      // Enhanced selected state with more pronounced effects
      ...(isSelected && {
        shadowColor: color,
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
        // Add subtle transform for selected state
        transform: [{ scale: 1.02 }],
      }),
      // Subtle hover effect for non-selected
      ...(!isSelected && {
        shadowOpacity: 0.15,
        elevation: 4,
      }),
    },
    style,
  ];

  const iconColor = isSelected ? '#FFFFFF' : textColor;
  const labelColor = isSelected ? '#FFFFFF' : textColor;

  // Primary implementation using Pressable (best Samsung compatibility)
  if (Platform.OS === 'android') {
    return (
      <Pressable
        style={({ pressed }) => [
          ...tabStyle,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        android_ripple={{
          color: isSelected ? '#FFFFFF30' : `${color}30`,
          borderless: false,
          radius: 50,
        }}
        hitSlop={touchConfig.hitSlop}
        pressRetentionOffset={touchConfig.pressRetentionOffset}
      >
        <View style={styles.tabContent}>
          <Ionicons 
            name={icon} 
            size={20} 
            color={iconColor} 
          />
          <Text style={[styles.tabText, { color: labelColor }]}>
            {label}
          </Text>
          {(count !== undefined && count > 0) && (
            <View style={[
              styles.countBadge, 
              { backgroundColor: isSelected ? '#FFFFFF20' : color }
            ]}>
              <Text style={styles.countText}>
                {count}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }

  // Fallback for iOS using TouchableOpacity
  return (
    <TouchableOpacity
      style={tabStyle}
      onPress={handlePress}
      activeOpacity={touchConfig.activeOpacity}
      hitSlop={touchConfig.hitSlop}
      delayPressIn={touchConfig.delayPressIn}
      delayPressOut={touchConfig.delayPressOut}
      pressRetentionOffset={touchConfig.pressRetentionOffset}
    >
      <View style={styles.tabContent}>
        <Ionicons 
          name={icon} 
          size={20} 
          color={iconColor} 
        />
        <Text style={[styles.tabText, { color: labelColor }]}>
          {label}
        </Text>
        {(count !== undefined && count > 0) && (
          <View style={[
            styles.countBadge, 
            { backgroundColor: isSelected ? '#FFFFFF20' : color }
          ]}>
            <Text style={styles.countText}>
              {count}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  tabButton: {
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginHorizontal: 6,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    // Enhanced modern design with subtle gradient background
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderWidth: 1.5,
    // Subtle inner glow effect
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
    elevation: 3,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
    // Better text rendering
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  countBadge: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    // Enhanced badge styling
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  countText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
    // Better text rendering for badge
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});