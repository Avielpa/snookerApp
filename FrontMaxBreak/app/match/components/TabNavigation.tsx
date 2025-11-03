// app/match/components/TabNavigation.tsx
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TabType } from '../types';

interface TabNavigationProps {
  selectedTab: TabType;
  onTabChange: (tab: TabType) => void;
  colors: any;
  styles: any;
}

interface TabConfig {
  id: TabType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TAB_CONFIG: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: 'information-circle-outline' },
  { id: 'frames', label: 'Frames', icon: 'grid-outline' },
  { id: 'stats', label: 'Stats', icon: 'bar-chart-outline' },
  { id: 'h2h', label: 'H2H', icon: 'people-outline' },
];

export function TabNavigation({ selectedTab, onTabChange, colors, styles }: TabNavigationProps) {
  const handleTabPress = (tabId: string) => {
    onTabChange(tabId as TabType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Create local styles using same approach as home screen
  const tabStyles = StyleSheet.create({
    filterButton: { 
      flexDirection: 'row', 
      alignItems: 'center', 
      backgroundColor: colors.cardBackground, 
      paddingVertical: 6, 
      paddingHorizontal: 10, 
      borderRadius: 16, 
      marginRight: 6,
      borderWidth: 1,
      borderColor: 'rgba(255, 167, 38, 0.25)',
      elevation: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
    },
    filterButtonActive: { 
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      elevation: 2,
      shadowOpacity: 0.15,
    },
    filterText: { 
      color: colors.textSecondary, 
      fontSize: 12, 
      fontFamily: 'PoppinsMedium', 
      marginLeft: 4,
      letterSpacing: 0.1,
    },
    filterTextActive: { 
      color: '#FFFFFF', 
      fontFamily: 'PoppinsBold',
    },
  });

  const renderTabButton = (tab: TabConfig) => {
    const isSelected = selectedTab === tab.id;
    
    return (
      <TouchableOpacity
        key={tab.id}
        style={[
          tabStyles.filterButton,
          isSelected && tabStyles.filterButtonActive
        ]}
        onPress={() => {
          console.log(`[MatchTabFilter] Pressed: ${tab.id}`);
          handleTabPress(tab.id);
        }}
        activeOpacity={0.6}
        hitSlop={{ top: 35, bottom: 35, left: 35, right: 35 }}
        delayPressIn={0}
        delayPressOut={0}
        pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
      >
        <Ionicons 
          name={tab.icon} 
          size={14} 
          color={isSelected ? '#FFFFFF' : colors.textSecondary} 
        />
        <Text style={[
          tabStyles.filterText,
          isSelected && tabStyles.filterTextActive
        ]}>
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.tabContainer}>
      {TAB_CONFIG.map(renderTabButton)}
    </View>
  );
}