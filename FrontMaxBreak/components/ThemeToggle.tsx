// components/ThemeToggle.tsx - Theme Toggle Component
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { logger } from '../utils/logger';


interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large';
  style?: any;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  size = 'medium',
  style 
}) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const colors = theme.colors;

  const sizeConfig = {
    small: { width: 60, height: 32, iconSize: 16 },
    medium: { width: 80, height: 40, iconSize: 20 },
    large: { width: 100, height: 50, iconSize: 24 },
  };

  const config = sizeConfig[size];

  const handlePress = () => {
    const modes: ThemeMode[] = ['light', 'dark', 'system'];
    const currentIndex = modes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];
    
    setThemeMode(nextMode);
    logger.log(`[ThemeToggle] Switched to ${nextMode} theme`);
  };

  const getIconName = (): keyof typeof Ionicons.glyphMap => {
    switch (themeMode) {
      case 'light':
        return 'sunny-outline';
      case 'dark':
        return 'moon-outline';
      case 'system':
        return 'phone-portrait-outline';
      default:
        return 'sunny-outline';
    }
  };

  const getIconColor = (): string => {
    switch (themeMode) {
      case 'light':
        return colors.warning;
      case 'dark':
        return colors.info;
      case 'system':
        return colors.textSecondary;
      default:
        return colors.primary;
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: config.width,
          height: config.height,
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
        },
        style,
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={getIconName()} 
          size={config.iconSize} 
          color={getIconColor()} 
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});