// app/match/components/StatsTab.tsx
import React from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { ProgressBar } from '../../components/modern';
import { FrameScore, MatchStats } from '../types';

interface StatsTabProps {
  frameScores: FrameScore[];
  matchStats: MatchStats;
  realMatchFormat: string | null;
  p1Name: string;
  p2Name: string;
  parseTimeString: (timeStr: string) => number;
  formatDuration: (minutes: number) => string;
  styles: any;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function StatsTab({
  frameScores,
  matchStats,
  realMatchFormat,
  p1Name,
  p2Name,
  parseTimeString,
  formatDuration,
  styles,
  isRefreshing,
  onRefresh,
}: StatsTabProps) {

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#FF8F00" colors={['#FF8F00']} />
      }
    >
      {/* Match Format & Status */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Match Information</Text>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Round:</Text>
          <Text style={styles.statValue}>{matchStats.roundName || 'Unknown'}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Format:</Text>
          <Text style={styles.statValue}>
            {realMatchFormat || `Best of ${matchStats.matchFormat}` || 'Unknown'}
          </Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Frames to Win:</Text>
          <Text style={styles.statValue}>{matchStats.framesToWin || 'Unknown'}</Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current Status:</Text>
          <Text style={[styles.statValue, 
            matchStats.isLive ? { color: '#4CAF50' } :
            matchStats.isOnBreak ? { color: '#FF9800' } :
            matchStats.isFinished ? { color: '#9CA3AF' } : {}
          ]}>
            {matchStats.isLive ? '🔴 LIVE' :
             matchStats.isOnBreak ? '⏸️ ON BREAK' :
             matchStats.isFinished ? '✅ FINISHED' :
             '⏱️ SCHEDULED'}
          </Text>
        </View>
      </View>

      {/* Timing Statistics */}
      {matchStats.timeElapsed && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Timing Statistics</Text>
          
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>Time Elapsed:</Text>
            <Text style={styles.statValue}>{matchStats.timeElapsed}</Text>
          </View>
          
          {/* Note: Estimated time remaining removed per snooker.org feedback
              as frame timing data is not always reliable */}
        </View>
      )}

      {/* Frame Statistics */}
      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Frame Statistics</Text>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Frames Completed:</Text>
          <Text style={styles.statValue}>
            {`${matchStats.completedFrames} / ${matchStats.totalFrames}`}
          </Text>
        </View>
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Match Progress:</Text>
          <Text style={styles.statValue}>
            {`${Math.round(matchStats.progress * 100)}%`}
          </Text>
        </View>
        
        <ProgressBar
          progress={matchStats.progress}
          height={8}
          colors={['#4CAF50', '#8BC34A']}
          label="Match completion"
          showPercentage={false}
        />
        
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>Current Score:</Text>
          <Text style={styles.statValue}>
            {`${matchStats.player1Score || 0} - ${matchStats.player2Score || 0}`}
          </Text>
        </View>
        
        {matchStats.framesToWin && (
          <>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{p1Name} needs:</Text>
              <Text style={styles.statValue}>
                {Math.max(0, matchStats.framesToWin - (matchStats.player1Score || 0))} more frames
              </Text>
            </View>
            
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{p2Name} needs:</Text>
              <Text style={styles.statValue}>
                {Math.max(0, matchStats.framesToWin - (matchStats.player2Score || 0))} more frames
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Frame Breakdown */}
      {frameScores.length > 0 && (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Frame Breakdown</Text>
          
          <View style={styles.frameStatsContainer}>
            <View style={styles.frameStatColumn}>
              <Text style={styles.frameStatTitle}>{p1Name}</Text>
              <Text style={styles.frameStatNumber}>{matchStats.player1Score || 0}</Text>
              <Text style={styles.frameStatLabel}>Frames Won</Text>
            </View>
            
            <View style={styles.frameStatDivider}>
              <Text style={styles.frameStatVs}>VS</Text>
            </View>
            
            <View style={styles.frameStatColumn}>
              <Text style={styles.frameStatTitle}>{p2Name}</Text>
              <Text style={styles.frameStatNumber}>{matchStats.player2Score || 0}</Text>
              <Text style={styles.frameStatLabel}>Frames Won</Text>
            </View>
          </View>
          
          <ProgressBar
            progress={
              (matchStats.player1Score || 0) + (matchStats.player2Score || 0) > 0 
                ? (matchStats.player1Score || 0) / ((matchStats.player1Score || 0) + (matchStats.player2Score || 0))
                : 0.5
            }
            height={8}
            colors={['#4CAF50', '#FFA726']}
            label={`Frame wins: ${p1Name} vs ${p2Name}`}
            showPercentage={false}
          />
        </View>
      )}

    </ScrollView>
  );
}