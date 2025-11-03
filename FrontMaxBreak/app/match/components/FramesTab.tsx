// app/match/components/FramesTab.tsx
import React from 'react';
import { View, Text, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrameScoreCard } from './FrameScoreCard';
import { FrameScore, MatchStats } from '../types';

interface FramesTabProps {
  frameScores: FrameScore[];
  matchStats: MatchStats;
  styles: any;
}


export function FramesTab({ frameScores, matchStats, styles }: FramesTabProps) {
  const renderFrameScore = ({ item }: { item: FrameScore }) => (
    <FrameScoreCard frame={item} styles={styles} />
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.framesContainer}>
        <Text style={styles.framesTitle}>
          {`Frame by Frame (${matchStats.completedFrames}/${matchStats.totalFrames})`}
        </Text>
        
        {frameScores.length > 0 ? (
          <FlatList
            data={frameScores}
            renderItem={renderFrameScore}
            keyExtractor={(item) => `frame-${item.frameNumber}`}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.framesGrid}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="grid-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>
              No frame data available
            </Text>
            <Text style={styles.emptySubtext}>
              Frame-by-frame scores will appear here when available
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}