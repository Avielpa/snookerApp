// contexts/ThemeContext.tsx - Modern Theme System
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { logger } from '../utils/logger';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

// Color definitions
export interface Colors {
  // Background colors
  background: string;
  backgroundSecondary: string;
  backgroundTertiary: string;
  
  // Card colors
  cardBackground: string;
  cardBorder: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textHeader: string;
  
  // Brand colors
  primary: string;
  primaryDark: string;
  secondary: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Interactive colors
  live: string;
  onBreak: string;
  
  // Filter colors
  filterButton: string;
  filterButtonActive: string;
  filterText: string;
  filterTextActive: string;
  
  // Misc colors
  white: string;
  black: string;
  shadow: string;
  skeleton: string;
  
  // Tab colors
  tabBackground: string;
  tabActive: string;
  tabInactive: string;
}

// Light theme colors
export const lightColors: Colors = {
  // Background colors
  background: '#FAFAFA',
  backgroundSecondary: '#F5F5F5',
  backgroundTertiary: '#EEEEEE',
  
  // Card colors - Enhanced for background image visibility
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  cardBorder: 'rgba(0, 0, 0, 0.15)',
  
  // Text colors - Enhanced for background image readability
  textPrimary: '#1A1A1A',
  textSecondary: '#2C2C2C', 
  textMuted: '#4A4A4A',
  textHeader: '#FFFFFF',
  
  // Brand colors
  primary: '#FF8F00',
  primaryDark: '#E65100',
  secondary: '#FFB74D',
  
  // Status colors
  success: '#388E3C',
  warning: '#F57C00',
  error: '#D32F2F',
  info: '#1976D2',
  
  // Interactive colors
  live: '#4CAF50',
  onBreak: '#FF9800',
  
  // Filter colors
  filterButton: 'rgba(255, 143, 0, 0.08)',
  filterButtonActive: '#FF8F00',
  filterText: '#424242',
  filterTextActive: '#FFFFFF',
  
  // Misc colors
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  skeleton: '#E2E8F0',
  
  // Tab colors
  tabBackground: 'rgba(255, 143, 0, 0.06)',
  tabActive: '#FF8F00',
  tabInactive: '#757575',
};

// Dark theme colors
export const darkColors: Colors = {
  // Background colors
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  backgroundTertiary: '#2C2C2C',
  
  // Card colors
  cardBackground: 'rgba(255, 255, 255, 0.08)',
  cardBorder: 'rgba(255, 255, 255, 0.16)',
  
  // Text colors
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#999999',
  textHeader: '#FFB74D',
  
  // Brand colors
  primary: '#FFB74D',
  primaryDark: '#FFA726',
  secondary: '#FFCC80',
  
  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F87171',
  info: '#60A5FA',
  
  // Interactive colors
  live: '#4CAF50',
  onBreak: '#FF9800',
  
  // Filter colors
  filterButton: 'rgba(255, 183, 77, 0.12)',
  filterButtonActive: '#FFB74D',
  filterText: '#B3B3B3',
  filterTextActive: '#121212',
  
  // Misc colors
  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  skeleton: '#334155',
  
  // Tab colors
  tabBackground: 'rgba(255, 183, 77, 0.08)',
  tabActive: '#FFB74D',
  tabInactive: '#999999',
};

export interface Theme {
  colors: Colors;
  isDark: boolean;
}

export interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  colorScheme: ColorScheme;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@maxbreak_theme_mode';

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [systemColorScheme, setSystemColorScheme] = useState<ColorScheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );

  // Determine the effective color scheme
  const colorScheme: ColorScheme = 
    themeMode === 'system' ? systemColorScheme : themeMode as ColorScheme;

  // Create theme object
  const theme: Theme = {
    colors: colorScheme === 'dark' ? darkColors : lightColors,
    isDark: colorScheme === 'dark',
  };

  // Load theme preference from storage
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
          logger.log(`[Theme] Loaded theme preference: ${savedTheme}`);
        }
      } catch (error) {
        logger.error('[Theme] Error loading theme preference:', error);
      }
    };

    loadThemePreference();
  }, []);

  // Listen to system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const newScheme = colorScheme === 'dark' ? 'dark' : 'light';
      setSystemColorScheme(newScheme);
      logger.log(`[Theme] System color scheme changed to: ${newScheme}`);
    });

    return () => subscription?.remove();
  }, []);

  // Save theme preference to storage
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      logger.log(`[Theme] Theme mode set to: ${mode}`);
    } catch (error) {
      logger.error('[Theme] Error saving theme preference:', error);
    }
  };

  // Toggle between light and dark (ignores system)
  const toggleTheme = () => {
    const newMode = colorScheme === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
  };

  const contextValue: ThemeContextType = {
    theme,
    themeMode,
    colorScheme,
    setThemeMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Convenience hook for accessing colors
export const useColors = (): Colors => {
  const { theme } = useTheme();
  return theme.colors;
};

// Convenience hook for checking dark mode
export const useIsDark = (): boolean => {
  const { theme } = useTheme();
  return theme.isDark;
};