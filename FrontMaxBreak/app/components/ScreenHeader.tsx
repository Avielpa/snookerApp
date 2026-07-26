// app/components/ScreenHeader.tsx
// Standardized top-level screen title — left-aligned, large, heavy weight.
// Used by every secondary tab (Calendar, Rankings, Stats). Home is excluded
// by design (its global logo + Home-specific tournament hero serve this role).
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';

interface ScreenHeaderProps {
  title: string;
  children?: React.ReactNode; // right-side accessory (search icon, SeasonPicker, ...)
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({ title, children }) => {
  const colors = useColors();

  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      {children}
    </View>
  );
};

ScreenHeader.displayName = 'ScreenHeader';

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    flexShrink: 1,
    fontSize: 30,
    fontFamily: 'PoppinsBold',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
