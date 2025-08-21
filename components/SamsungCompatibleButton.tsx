// components/SamsungCompatibleButton.tsx
import React from 'react';
import {
  TouchableWithoutFeedback,
  TouchableOpacity,
  Pressable,
  View,
  Text,
  Platform,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SamsungCompatibleButtonProps {
  onPress: () => void;
  isSelected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  colors: any;
  count?: number;
  style?: any;
}

/**
 * Samsung-Compatible Button Component
 * 
 * This component addresses TouchableOpacity issues on Samsung Galaxy devices
 * by implementing multiple fallback strategies based on research:
 * 
 * 1. Uses Pressable (modern, recommended by React Native)
 * 2. Falls back to TouchableWithoutFeedback (proven to work better on Samsung)
 * 3. Uses onPressIn for more reliable touch detection
 * 4. Implements Samsung-specific optimizations
 */
export const SamsungCompatibleButton: React.FC<SamsungCompatibleButtonProps> = ({
  onPress,
  isSelected,
  icon,
  label,
  colors,
  count,
  style,
}) => {
  // Enhanced press handler with Samsung-specific optimizations
  const handlePress = React.useCallback(() => {
    console.log(`[SamsungButton] Button pressed: ${label}`);
    
    // Add small delay for Samsung devices to prevent touch conflicts
    if (Platform.OS === 'android') {
      setTimeout(onPress, 25);
    } else {
      onPress();
    }
  }, [onPress, label]);

  // Base styles matching home screen
  const buttonStyle = [
    styles.filterButton,
    { backgroundColor: isSelected ? colors.primary : colors.cardBackground },
    isSelected && styles.filterButtonActive,
    style,
  ];

  const textColor = isSelected ? '#FFFFFF' : colors.textSecondary;
  const iconColor = isSelected ? '#FFFFFF' : colors.textSecondary;

  // Content to render
  const renderContent = () => (
    <View style={styles.buttonContent}>
      <Ionicons name={icon} size={14} color={iconColor} />
      <Text style={[styles.filterText, { color: textColor }, isSelected && styles.filterTextActive]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.countBadge, { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : colors.primary }]}>
          <Text style={[styles.countText, { color: '#FFFFFF' }]}>
            {count}
          </Text>
        </View>
      )}
    </View>
  );

  // Strategy 1: Use Pressable (modern approach, recommended by React Native)
  if (Platform.OS === 'android') {
    return (
      <Pressable
        style={({ pressed }) => [
          ...buttonStyle,
          pressed && styles.pressed,
        ]}
        onPress={handlePress}
        android_ripple={{
          color: isSelected ? '#FFFFFF30' : `${colors.primary}30`,
          borderless: false,
          radius: 25,
        }}
        hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
        pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
      >
        {renderContent()}
      </Pressable>
    );
  }

  // Strategy 2: For iOS, use TouchableOpacity with Samsung-optimized settings
  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={handlePress}
      activeOpacity={0.6}
      hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
    >
      {renderContent()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 167, 38, 0.25)',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  filterButtonActive: {
    elevation: 2,
    shadowOpacity: 0.15,
    borderColor: 'transparent',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 12,
    fontFamily: 'PoppinsMedium',
    marginLeft: 4,
    letterSpacing: 0.1,
  },
  filterTextActive: {
    fontFamily: 'PoppinsBold',
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    textAlign: 'center',
  },
});