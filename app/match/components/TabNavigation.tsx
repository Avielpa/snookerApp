// app/match/components/TabNavigation.tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
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
  const renderTabButton = (tab: TabConfig) => (
    <TouchableOpacity
      key={tab.id}
      style={[styles.tabButton, selectedTab === tab.id && styles.tabButtonActive]}
      onPress={() => {
        onTabChange(tab.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
    >
      <Ionicons 
        name={tab.icon} 
        size={20} 
        color={selectedTab === tab.id ? colors.primary : colors.textSecondary} 
      />
      <Text style={[styles.tabText, selectedTab === tab.id && styles.tabTextActive]}>
        {tab.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.tabContainer}>
      {TAB_CONFIG.map(renderTabButton)}
    </View>
  );
}