import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGameContext } from '../../contexts/GameContext';
import AuthCard from './AuthCard';

const Header = () => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = theme.colors;
  const pathname = usePathname();
  const isInScoreboard = pathname.startsWith('/scoreboard');
  const { loggedIn } = useAuth();
  const { isGameActive } = useGameContext();
  const [authVisible, setAuthVisible] = useState(false);

  const handleHomePress = () => {
    if (isInScoreboard && isGameActive) {
      Alert.alert(
        'Game in progress',
        'Leave and save for later?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => router.push('/') },
        ]
      );
    } else {
      isInScoreboard ? router.push('/') : router.push('/scoreboard' as any);
    }
  };

  return (
    <View style={[styles.header, {
      paddingTop: insets.top,
      backgroundColor: colors.cardBackground,
      borderBottomColor: colors.cardBorder,
    }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.playBtn}
          onPress={handleHomePress}
        >
          <Text style={[styles.playBtnText, { color: colors.primary }]}>
            {isInScoreboard ? '← Home' : '▶ Play'}
          </Text>
        </TouchableOpacity>

        <View style={styles.logoRow}>
          <View style={styles.iconWrapper}>
            <Image
              source={require('../../assets/images/icon.png')}
              style={styles.iconImage}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.title, { color: colors.textHeader }]}>
            MaxBreak147
          </Text>
        </View>

        <TouchableOpacity style={styles.rightSection} onPress={() => setAuthVisible(true)}>
          <Text style={{ color: loggedIn ? colors.primary : colors.textMuted, fontSize: 18 }}>
            {loggedIn ? '👤' : '🔑'}
          </Text>
        </TouchableOpacity>
      </View>

      <AuthCard visible={authVisible} onClose={() => setAuthVisible(false)} />
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
    paddingVertical: 10,
  },
  playBtn: {
    width: 60,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  playBtnText: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  iconImage: {
    width: 32,
    height: 32,
  },
  title: {
    fontSize: 22,
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