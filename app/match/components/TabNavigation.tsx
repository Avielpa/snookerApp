// app/match/components/TabNavigation.tsx
import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { TabType } from '../types';
import { UniversalTab } from '../../../components/UniversalTab';

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

  const renderTabButton = (tab: TabConfig) => {
    const isSelected = selectedTab === tab.id;
    
    return (
      <UniversalTab
        key={tab.id}
        id={tab.id}
        label={tab.label}
        icon={tab.icon}
        color={colors.primary}
        backgroundColor={isSelected ? colors.primary : colors.cardBackground}
        borderColor={isSelected ? colors.primary : colors.cardBorder}
        textColor={isSelected ? colors.surface : colors.textSecondary}
        isSelected={isSelected}
        onPress={handleTabPress}
        customStyle={{
          marginHorizontal: 4,
          paddingVertical: 12,
          paddingHorizontal: 16,
          minHeight: 44,
          borderRadius: 12,
        }}
      />
    );
  };

  return (
    <View style={styles.tabContainer}>
      {TAB_CONFIG.map(renderTabButton)}
    </View>
  );
}