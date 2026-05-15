import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import { Alert, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../contexts/ThemeContext';
import { useGameContext } from '../../contexts/GameContext';
import { DeviceType } from '../../hooks/useDeviceType';
import { logger } from '../../utils/logger';

const NAV_ITEMS: {
  path: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconOutline: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
}[] = [
  { path: '/',                  icon: 'home',          iconOutline: 'home-outline',          label: 'Home' },
  { path: '/CalendarEnhanced',  icon: 'calendar',      iconOutline: 'calendar-outline',      label: 'Calendar' },
  { path: '/RankingEnhanced',   icon: 'trophy',        iconOutline: 'trophy-outline',        label: 'Rankings' },
  { path: '/NewsScreen',        icon: 'film',          iconOutline: 'film-outline',          label: 'Media' },
];

interface SideNavProps {
  device: DeviceType;
}

const SideNav: React.FC<SideNavProps> = ({ device }) => {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useColors();
  const { isGameActive } = useGameContext();
  const alertActive = useRef(false);
  const isTV = device === 'tv';
  const styles = createStyles(colors, isTV);

  return (
    <View style={styles.container}>
      {isTV && (
        <View style={styles.logoArea}>
          <Ionicons name="billiards-outline" size={32} color={colors.primary} />
        </View>
      )}
      {NAV_ITEMS.map((item, index) => {
        const isActive = pathname === item.path;
        return (
          <TouchableOpacity
            key={item.path}
            style={[styles.navItem, isActive && styles.navItemActive]}
            onPress={() => {
              if (isGameActive) {
                if (alertActive.current) return;
                alertActive.current = true;
                Alert.alert(
                  'Game in progress',
                  'Leaving will pause your game. You can resume it later.',
                  [
                    { text: 'Stay', style: 'cancel', onPress: () => { alertActive.current = false; } },
                    {
                      text: 'Leave',
                      style: 'destructive',
                      onPress: () => {
                        alertActive.current = false;
                        logger.log(`[SideNav] Leaving game, navigating to ${item.path}`);
                        router.push(item.path as any);
                      },
                    },
                  ],
                );
                return;
              }
              logger.log(`[SideNav] Navigating to ${item.path}`);
              router.push(item.path as any);
            }}
            activeOpacity={0.6}
            // TV: first active item gets auto-focus on mount
            hasTVPreferredFocus={isTV && isActive && index === 0}
            focusable={isTV}
          >
            <Ionicons
              name={isActive ? item.icon : item.iconOutline}
              size={isTV ? 32 : 22}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[styles.label, isActive && styles.labelActive]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const createStyles = (colors: any, isTV: boolean) =>
  StyleSheet.create({
    container: {
      width: isTV ? 180 : 100,
      backgroundColor: colors.cardBackground,
      borderRightWidth: 1,
      borderRightColor: colors.cardBorder,
      paddingTop: isTV ? 40 : 16,
      paddingHorizontal: isTV ? 12 : 8,
      alignItems: 'stretch',
    },
    logoArea: {
      alignItems: 'center',
      marginBottom: 32,
    },
    navItem: {
      flexDirection: isTV ? 'row' : 'column',
      alignItems: 'center',
      paddingVertical: isTV ? 18 : 12,
      paddingHorizontal: isTV ? 16 : 8,
      borderRadius: 12,
      marginBottom: isTV ? 8 : 4,
      gap: isTV ? 14 : 4,
    },
    navItemActive: {
      backgroundColor: colors.filterButton,
    },
    label: {
      color: colors.textSecondary,
      fontSize: isTV ? 18 : 10,
      fontFamily: 'PoppinsMedium',
      textAlign: isTV ? 'left' : 'center',
    },
    labelActive: {
      color: colors.primary,
      fontFamily: 'PoppinsBold',
    },
  });

export default SideNav;
