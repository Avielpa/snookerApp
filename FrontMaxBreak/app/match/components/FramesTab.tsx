// app/match/components/FramesTab.tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrameScoreCard } from './FrameScoreCard';
import { FrameScore, MatchStats } from '../types';
import { MatchFrameScore } from '../../../services/matchServices';
import BannerAdSlot from '../../../components/ads/BannerAdSlot';

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

  // DEBUG: re-verify with hard numbers whether contentInsetAdjustmentBehavior
  // actually closed the Yoga-vs-visual gap, or whether that "fix" was itself
  // masked by rainbow colors like every prior round. Remove once resolved.
  const scrollRef = useRef<ScrollView>(null);
  const titleRef = useRef<View>(null);
  const [measurements, setMeasurements] = useState<{ scrollTop?: number; titleTop?: number; ts?: number }>({});
  useEffect(() => {
    // Re-measure continuously (not once) — every reproduction of this bug
    // has been on a LIVE match with a 30s auto-refresh poll, so a one-shot
    // measurement can easily go stale before a screenshot is actually taken.
    const id = setInterval(() => {
      (scrollRef.current as any)?.measureInWindow((x: number, y: number) => {
        setMeasurements((m) => ({ ...m, scrollTop: y, ts: Date.now() }));
      });
      (titleRef.current as any)?.measureInWindow((x: number, y: number) => {
        setMeasurements((m) => ({ ...m, titleTop: y, ts: Date.now() }));
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      // iOS auto-adjusts a ScrollView's top content inset to account for
      // translucent nav/tab bars — since this screen replaces the native
      // header with its own custom TopActionRow, iOS has no way to know
      // that, and was injecting extra top inset the JS layout tree never
      // saw (confirmed via measureInWindow: Yoga's positions were correct,
      // the rendered content was still pushed down). This opts out.
      contentInsetAdjustmentBehavior="never"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FF8F00" colors={['#FF8F00']} />
      }
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 4, right: 4, zIndex: 999, backgroundColor: 'black', padding: 6, borderRadius: 6 }}
      >
        <Text style={{ color: '#0F0', fontSize: 11, fontFamily: 'monospace' }}>
          {`scrollTop: ${measurements.scrollTop ?? '?'}\ntitleTop: ${measurements.titleTop ?? '?'}\ndiff: ${measurements.scrollTop != null && measurements.titleTop != null ? (measurements.titleTop - measurements.scrollTop).toFixed(1) : '?'}\nlast measured: ${measurements.ts ? new Date(measurements.ts).toLocaleTimeString() : '?'} (updates every 1s)`}
        </Text>
      </View>
      <View ref={titleRef} style={styles.framesContainer}>
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
      <BannerAdSlot />
    </ScrollView>
  );
}
