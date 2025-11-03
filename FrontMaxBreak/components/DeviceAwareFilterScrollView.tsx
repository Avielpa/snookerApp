// components/DeviceAwareFilterScrollView.tsx
import React from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDeviceTabConfig } from '../config/deviceTabConfig';
import { DeviceAwareFilterButton } from './DeviceAwareFilterButton';
import { createEnhancedTabStyles } from './EnhancedTabStyles';

interface FilterOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  count?: number;
}

interface DeviceAwareFilterScrollViewProps {
  options: FilterOption[];
  selectedValue: string;
  onSelectionChange: (value: string) => void;
  colors: any;
  style?: any;
  containerStyle?: any;
  children?: React.ReactNode;
}

export const DeviceAwareFilterScrollView: React.FC<DeviceAwareFilterScrollViewProps> = ({
  options,
  selectedValue,
  onSelectionChange,
  colors,
  style = {},
  containerStyle = {},
  children
}) => {
  const config = getDeviceTabConfig();
  const layoutConfig = config.getLayoutConfig();
  const dynamicStyles = config.createDynamicStyles(colors);
  const enhancedStyles = createEnhancedTabStyles(colors);

  return (
    <View style={[enhancedStyles.premiumContainer, containerStyle]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={layoutConfig.scrollBehavior.showsHorizontalScrollIndicator}
        contentContainerStyle={[dynamicStyles.filterContainer, style]}
        scrollEventThrottle={16} // Smooth 60fps scrolling like bottom bar
        decelerationRate="normal" // Normal smooth deceleration like bottom bar
        bounces={true} // Allow natural bouncing
        style={[dynamicStyles.filterScrollView, enhancedStyles.enhancedScrollView]}
        // Minimal optimizations - keep it simple
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // NO snap behavior - smooth free scrolling like bottom bar
        // NO snapToInterval - removes rectangle behavior
        // NO snapToAlignment - removes snapping
        // Simple smooth scrolling optimizations
        alwaysBounceHorizontal={false}
        directionalLockEnabled={true}
      >
        {options.map((option) => (
          <DeviceAwareFilterButton
            key={option.id}
            option={option}
            isSelected={selectedValue === option.id}
            onPress={onSelectionChange}
            colors={colors}
            count={option.count}
          />
        ))}
        {children}
      </ScrollView>
    </View>
  );
};