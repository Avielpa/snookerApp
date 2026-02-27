// contexts/ThemeContext.tsx - Dark mode only
import React, { createContext, useContext, ReactNode } from 'react';

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

  // Accent (used in home screen prize/header)
  accent: string;
  accentLight: string;
}

export const darkColors: Colors = {
  background: '#121212',
  backgroundSecondary: '#1E1E1E',
  backgroundTertiary: '#2C2C2C',

  cardBackground: 'rgba(255, 255, 255, 0.08)',
  cardBorder: 'rgba(255, 255, 255, 0.16)',

  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textMuted: '#999999',
  textHeader: '#FFB74D',

  primary: '#FFB74D',
  primaryDark: '#FFA726',
  secondary: '#FFCC80',

  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F87171',
  info: '#60A5FA',

  live: '#4CAF50',
  onBreak: '#FF9800',

  filterButton: 'rgba(255, 183, 77, 0.12)',
  filterButtonActive: '#FFB74D',
  filterText: '#B3B3B3',
  filterTextActive: '#121212',

  white: '#FFFFFF',
  black: '#000000',
  shadow: '#000000',
  skeleton: '#334155',

  tabBackground: 'rgba(255, 183, 77, 0.08)',
  tabActive: '#FFB74D',
  tabInactive: '#999999',

  accent: '#FFB74D',
  accentLight: '#FFD180',
};

export interface Theme {
  colors: Colors;
  isDark: boolean;
}

export interface ThemeContextType {
  theme: Theme;
  colorScheme: 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
  theme: { colors: darkColors, isDark: true },
  colorScheme: 'dark',
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const value: ThemeContextType = {
    theme: { colors: darkColors, isDark: true },
    colorScheme: 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => useContext(ThemeContext);

export const useColors = (): Colors => darkColors;

export const useIsDark = (): boolean => true;
