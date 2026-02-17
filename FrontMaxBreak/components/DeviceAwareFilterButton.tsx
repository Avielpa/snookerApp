// components/DeviceAwareFilterButton.tsx
import React from 'react';
import { TouchableOpacity, Pressable, Text, View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceTabConfig } from '../config/deviceTabConfig';
import { createEnhancedTabStyles, premiumColors } from './EnhancedTabStyles';
import { logger } from '../utils/logger';

interface FilterOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface DeviceAwareFilterButtonProps {
  option: FilterOption;
  isSelected: boolean;
  onPress: (id: string) => void;
  colors: any;
  additionalStyles?: any;
  count?: number;
}

export const DeviceAwareFilterButton: React.FC<DeviceAwareFilterButtonProps> = ({
  option,
  isSelected,
  onPress,
  colors,
  additionalStyles = {},
  count
}) => {
  const config = getDeviceTabConfig();
  const profile = config.getProfile();
  const touchConfig = config.getTouchConfig();
  const dynamicStyles = config.createDynamicStyles(colors);
  const enhancedStyles = createEnhancedTabStyles(colors);

  // Enhanced press handler with device-specific timing and better debugging
  const handlePress = () => {
    logger.debug(`[DeviceAwareFilter] ${profile.name} - Button "${option.label}" (${option.id}) pressed`);
    
    // Samsung devices need small delay to prevent conflicts
    if (profile.manufacturer === 'Samsung' && Platform.OS === 'android') {
      setTimeout(() => {
        logger.debug(`[DeviceAwareFilter] Executing delayed press for: ${option.label}`);
        onPress(option.id);
      }, 25);
    } else {
      onPress(option.id);
    }
  };

  // Common props for both TouchableOpacity and Pressable
  const commonProps = {
    onPress: handlePress,
    hitSlop: touchConfig.hitSlop,
    pressRetentionOffset: touchConfig.pressRetentionOffset,
    delayPressIn: touchConfig.delayPressIn,
    delayPressOut: touchConfig.delayPressOut,
    accessibilityRole: 'button' as const,
    accessible: true,
  };

  // Style configuration
  const buttonStyle = [
    dynamicStyles.filterButton,
    isSelected && dynamicStyles.filterButtonActive,
    additionalStyles.filterButton || {},
  ];

  const textStyle = [
    dynamicStyles.filterText,
    enhancedStyles.premiumText, // Enhanced text shadow
    isSelected && dynamicStyles.filterTextActive,
    additionalStyles.filterText || {},
  ];

  // Icon color with proper theme support
  const iconColor = isSelected ? colors.filterTextActive : colors.filterText;

  // Enhanced wrapper styles for better visual separation
  const wrapperStyle = [
    dynamicStyles.buttonWrapper,
    isSelected && dynamicStyles.buttonWrapperActive,
  ];

  // Enhanced icon style with improved visual effects
  const iconStyle = [
    dynamicStyles.filterIcon,
    enhancedStyles.premiumIcon, // Enhanced icon shadow
    isSelected && dynamicStyles.filterIconActive,
  ];

  // Content JSX with enhanced styling
  const renderContent = () => (
    <View style={buttonStyle}>
      {/* Optional active glow overlay */}
      {isSelected && (
        <View style={enhancedStyles.activeGlowOverlay} />
      )}
      
      <Ionicons 
        name={option.icon} 
        size={12} // Smaller icon - SofaScore style
        color={iconColor}
        style={iconStyle}
      />
      <Text style={textStyle}>
        {option.label}
      </Text>
      {count !== undefined && (
        <Text style={[
          dynamicStyles.filterText,
          { 
            marginLeft: 3, // Smaller margin
            color: isSelected ? colors.filterTextActive : premiumColors.accent,
            fontFamily: 'PoppinsMedium', // Less bold
            fontSize: Math.max((dynamicStyles.filterText.fontSize || 12) - 2, 8), // Much smaller count
            opacity: 0.8, // More subtle
          }
        ]}>
          ({count})
        </Text>
      )}
    </View>
  );

  // Use device-specific component with enhanced wrapper
  if (config.shouldUsePressable()) {
    // Pressable for Samsung and problematic Android devices
    return (
      <View style={wrapperStyle}>
        <Pressable
          {...commonProps}
          style={({ pressed }) => [
            pressed && { 
              opacity: touchConfig.activeOpacity,
              transform: [{ scale: 0.98 }], // Subtle press feedback
              backgroundColor: 'rgba(255, 107, 53, 0.2)' // Subtle color feedback
            }
          ]}
          android_ripple={
            touchConfig.useNativeFeedback ? {
              color: 'rgba(255, 107, 53, 0.3)', // Vibrant ripple color
              borderless: false,
              radius: 80,
            } : undefined
          }
        >
          {renderContent()}
        </Pressable>
      </View>
    );
  } else {
    // TouchableOpacity for iOS and compatible Android devices
    return (
      <View style={wrapperStyle}>
        <TouchableOpacity
          {...commonProps}
          activeOpacity={touchConfig.activeOpacity}
        >
          {renderContent()}
        </TouchableOpacity>
      </View>
    );
  }
};