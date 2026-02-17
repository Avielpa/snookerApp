// components/UnifiedFilterButton.tsx
import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/logger';

interface FilterOption {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface UnifiedFilterButtonProps {
  option: FilterOption;
  isSelected: boolean;
  onPress: (id: string) => void;
  colors: any;
  styles: any;
}

export const UnifiedFilterButton: React.FC<UnifiedFilterButtonProps> = ({
  option,
  isSelected,
  onPress,
  colors,
  styles
}) => {
  return (
    <TouchableOpacity
      key={option.id}
      style={[
        styles.filterButton,
        isSelected && styles.filterButtonActive
      ]}
      onPress={() => {
        logger.debug(`[UnifiedFilter] Pressed: ${option.id}`);
        onPress(option.id);
      }}
      activeOpacity={0.6}
      hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
      delayPressIn={0}
      delayPressOut={0}
      pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
    >
      <Ionicons 
        name={option.icon} 
        size={14} 
        color={isSelected ? colors.filterTextActive : colors.filterText} 
      />
      <Text style={[
        styles.filterText,
        isSelected && styles.filterTextActive
      ]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
};