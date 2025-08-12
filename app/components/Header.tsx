import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemeToggle } from '../../components/ThemeToggle';

const Header = () => {  
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;

  return (
    <View style={[styles.header, { 
      paddingTop: insets.top,
      backgroundColor: colors.cardBackground,
      borderBottomColor: colors.cardBorder,
    }]}>
      <View style={styles.headerRow}>
        <View style={styles.placeholderLeft} />
        
        <Text style={[styles.title, { color: colors.textHeader }]}>
          MaxBreak
        </Text>
        
        <View style={styles.rightSection}>
          <ThemeToggle size="small" />
        </View>
      </View>
    </View>
  );
};



const styles = StyleSheet.create({
  header: {
    width: '100%',
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  placeholderLeft: {
    width: 60,
  },
  title: {
    fontSize: 24,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(255, 167, 38, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'flex-end',
  },
});

export default Header;