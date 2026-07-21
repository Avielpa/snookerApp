//  app/match/[matchId].tsx - Modern Enhanced Version
import React from 'react';
import { View, StyleSheet } from 'react-native';
import BannerAdSlot from '../../components/ads/BannerAdSlot';
import MatchEnhanced from './MatchEnhanced';

/**
 * Match Details Screen - Now uses the enhanced modern version
 * Features interactive tabs, live updates, predictions, and modern glassmorphism design
 */
export default function MatchDetailsScreen() {
  return (
    <View style={styles.container}>
      <BannerAdSlot />
      <MatchEnhanced />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// Add displayName for debugging
MatchDetailsScreen.displayName = 'MatchDetailsScreen';



