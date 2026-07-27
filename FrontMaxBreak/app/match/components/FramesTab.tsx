// app/match/components/FramesTab.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrameScoreCard } from './FrameScoreCard';
import { FrameScore, MatchStats } from '../types';
import { MatchFrameScore } from '../../../services/matchServices';
import BannerAdSlot from '../../../components/ads/BannerAdSlot';
import { debugLayout, subscribeDebugLayout, notifyDebugLayoutChanged } from '../../../utils/debugLayoutProbe';

interface FramesTabProps {
  frameScores: FrameScore[];
  ctFrameScores: MatchFrameScore[];
  player1Name: string;
  player2Name: string;
  matchStats: MatchStats;
  styles: any;
  isRefreshing: boolean;
  onRefresh: () => void;
}

// Shorten to surname only for compact column headers
function surname(fullName: string): string {
  const parts = fullName.trim().split(' ');
  return parts[parts.length - 1] ?? fullName;
}

function FramePointsTable({
  frames,
  player1Name,
  player2Name,
}: {
  frames: MatchFrameScore[];
  player1Name: string;
  player2Name: string;
}) {
  const p1 = surname(player1Name);
  const p2 = surname(player2Name);

  return (
    <View style={{ marginTop: 8 }}>
      {/* Column headers */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#374151',
          alignItems: 'center',
        }}
      >
        <Text
          style={{
            flex: 1,
            color: '#FFA726',
            fontFamily: 'PoppinsBold',
            fontSize: 13,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {p1}
        </Text>
        <Text
          style={{
            width: 44,
            color: '#6B7280',
            fontFamily: 'PoppinsMedium',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          Frame
        </Text>
        <Text
          style={{
            flex: 1,
            color: '#FFA726',
            fontFamily: 'PoppinsBold',
            fontSize: 13,
            textAlign: 'center',
          }}
          numberOfLines={1}
        >
          {p2}
        </Text>
      </View>

      {/* Frame rows */}
      {frames.map((f, idx) => {
        const p1Won = f.winner === 1;
        const rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.04)';

        return (
          <View
            key={f.frame_number}
            style={{
              flexDirection: 'row',
              paddingVertical: 8,
              paddingHorizontal: 8,
              backgroundColor: rowBg,
              alignItems: 'center',
            }}
          >
            {/* Player 1 side */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: p1Won ? '#FFA726' : 'transparent',
                  borderRadius: 6,
                  paddingHorizontal: p1Won ? 10 : 0,
                  paddingVertical: p1Won ? 3 : 0,
                  minWidth: 36,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: p1Won ? '#111827' : '#9CA3AF',
                    fontFamily: p1Won ? 'PoppinsBold' : 'PoppinsMedium',
                    fontSize: 15,
                  }}
                >
                  {f.player1_points}
                </Text>
              </View>
              {f.player1_break !== null && f.player1_break >= 50 && (
                <Text
                  style={{
                    color: '#6EE7B7',
                    fontSize: 10,
                    fontFamily: 'PoppinsMedium',
                    marginTop: 2,
                  }}
                >
                  {f.player1_break}
                </Text>
              )}
            </View>

            {/* Frame number */}
            <View style={{ width: 44, alignItems: 'center' }}>
              <Text
                style={{
                  color: '#4B5563',
                  fontFamily: 'PoppinsMedium',
                  fontSize: 12,
                }}
              >
                {f.frame_number}
              </Text>
            </View>

            {/* Player 2 side */}
            <View style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  backgroundColor: !p1Won ? '#FFA726' : 'transparent',
                  borderRadius: 6,
                  paddingHorizontal: !p1Won ? 10 : 0,
                  paddingVertical: !p1Won ? 3 : 0,
                  minWidth: 36,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: !p1Won ? '#111827' : '#9CA3AF',
                    fontFamily: !p1Won ? 'PoppinsBold' : 'PoppinsMedium',
                    fontSize: 15,
                  }}
                >
                  {f.player2_points}
                </Text>
              </View>
              {f.player2_break !== null && f.player2_break >= 50 && (
                <Text
                  style={{
                    color: '#6EE7B7',
                    fontSize: 10,
                    fontFamily: 'PoppinsMedium',
                    marginTop: 2,
                  }}
                >
                  {f.player2_break}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {/* Source badge */}
      <Text
        style={{
          color: '#4B5563',
          fontSize: 10,
          fontFamily: 'PoppinsMedium',
          textAlign: 'center',
          marginTop: 12,
          marginBottom: 4,
        }}
      >
        via CueTracker
      </Text>
    </View>
  );
}

export function FramesTab({
  frameScores,
  ctFrameScores,
  player1Name,
  player2Name,
  matchStats,
  styles,
  isRefreshing,
  onRefresh,
}: FramesTabProps) {
  const renderFrameScore = ({ item }: { item: FrameScore }) => (
    <FrameScoreCard frame={item} styles={styles} />
  );

  // DEBUG: precision numeric measurement — remove once the gap is root-caused.
  const scrollRef = useRef<ScrollView>(null);
  const [, forceTick] = useState(0);
  useEffect(() => {
    const unsub = subscribeDebugLayout(() => forceTick((n) => n + 1));
    const t = setTimeout(() => {
      (scrollRef.current as any)?.measureInWindow((x: number, y: number) => {
        debugLayout.scrollTop = y;
        notifyDebugLayoutChanged();
      });
    }, 800);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FF8F00" colors={['#FF8F00']} />
      }
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          zIndex: 999,
          backgroundColor: 'black',
          padding: 6,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#0F0', fontSize: 11, fontFamily: 'monospace' }}>
          {`tabBottom: ${debugLayout.tabBottom ?? '?'}\nscrollTop: ${debugLayout.scrollTop ?? '?'}\nadTop: ${debugLayout.adTop ?? '?'}\nadBottom: ${debugLayout.adBottom ?? '?'}`}
        </Text>
      </View>
      <BannerAdSlot />
      <View style={styles.framesContainer}>
        <Text style={styles.framesTitle}>
          {`Frame by Frame (${matchStats.completedFrames}/${matchStats.totalFrames})`}
        </Text>

        {ctFrameScores.length > 0 ? (
          // CueTracker per-frame point data
          <FramePointsTable
            frames={ctFrameScores}
            player1Name={player1Name}
            player2Name={player2Name}
          />
        ) : frameScores.length > 0 ? (
          // Fallback: snooker.org frame winner grid (sparse, finals only)
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
          // No data from either source
          <View style={styles.emptyState}>
            <Ionicons name="grid-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No frame data available</Text>
            <Text style={styles.emptySubtext}>
              Frame-by-frame scores will appear here when available
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
