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
    
    // Haptic feedback for better UX
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.log('[UniversalTab] Haptics not available:', error);
    }
    
    // Use Samsung-compatible handler if needed
    const handler = needsEnhanced ? createSamsungCompatibleHandler(() => onPress(id)) : () => onPress(id);
    handler();
  }, [id, onPress, needsEnhanced]);

  const tabStyle = [
    styles.tabButton,
    {
      backgroundColor,
      borderColor,
      borderWidth: 1,
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 6,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});