import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
        <View style={styles.playBtnWrapper}>
          <TouchableOpacity onPress={handleHomePress} activeOpacity={0.85}>
            <LinearGradient
              colors={isInScoreboard ? [colors.cardBackground, colors.cardBackground] : ['#FFD54F', '#FFA000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.playBtnPill, isInScoreboard && { borderWidth: 1, borderColor: colors.cardBorder }]}
            >
              <Ionicons
                name={isInScoreboard ? 'arrow-back' : 'play'}
                size={13}
                color={isInScoreboard ? colors.textPrimary : '#1A1200'}
              />
              <Text style={[styles.playBtnText, { color: isInScoreboard ? colors.textPrimary : '#1A1200' }]}>
                {isInScoreboard ? 'Home' : 'Play'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {!isInScoreboard && (
            <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        <View style={styles.logoRow}>
          <Image
            source={require('../../assets/images/header-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
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
  playBtnWrapper: {
    width: 74,
    alignItems: 'flex-start',
    justifyContent: 'center',
    position: 'relative',
  },
  playBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  playBtnText: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
  },
  newBadge: {
    position: 'absolute',
    top: -8,
    left: 40,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 6,
  },
  newBadgeText: {
    color: '#121212',
    fontSize: 8,
    fontFamily: 'PoppinsBold',
    letterSpacing: 0.3,
  },
  logoRow: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: '100%',
    height: 36,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
    justifyContent: 'flex-end',
  },
});

export default Header;