// components/DebugTouchButton.tsx - Emergency fallback for mobile touch issues
import React from 'react';
import { TouchableOpacity, Text, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DebugTouchButtonProps {
  option: {
    id: string;
    label: string;
    icon: string;
    color: string;
  };
  isSelected: boolean;
  onPress: (id: string) => void;
  colors: any;
  styles: any;
}

export const DebugTouchButton: React.FC<DebugTouchButtonProps> = ({
  option,
  isSelected,
  onPress,
  colors,
  styles
}) => {
  const handlePress = () => {
    // Debug logging for mobile
    console.log(`[MOBILE DEBUG] Button pressed: ${option.id}`);
    Alert.alert('Debug', `Pressed: ${option.label}`);
    onPress(option.id);
  };

  const handlePressIn = () => {
    console.log(`[MOBILE DEBUG] Press IN: ${option.id}`);
  };

  const handlePressOut = () => {
    console.log(`[MOBILE DEBUG] Press OUT: ${option.id}`);
  };

  return (
    <View style={{ margin: 5 }}>
      <TouchableOpacity
        key={`debug-${option.id}`}
        style={[
          styles.filterButton,
          {
            backgroundColor: isSelected ? option.color : colors.cardBackground,
            borderColor: isSelected ? option.color : colors.cardBorder,
            borderWidth: 2, // Thicker border for mobile
            minHeight: 56, // Even larger for mobile
            minWidth: 120,
            paddingHorizontal: 20,
            paddingVertical: 16,
          }
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.5} // More obvious feedback
        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} // Larger hit area
        delayPressIn={0}
        delayPressOut={100}
      >
        <Ionicons 
          name={option.icon as any}
          size={24} // Larger icon
          color={isSelected ? '#FFFFFF' : colors.textPrimary} 
        />
        <Text style={[
          styles.filterText, 
          { 
            color: isSelected ? '#FFFFFF' : colors.textPrimary,
            fontSize: 16, // Larger text
            fontWeight: 'bold',
            marginLeft: 12
          }
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    </View>
  );
};