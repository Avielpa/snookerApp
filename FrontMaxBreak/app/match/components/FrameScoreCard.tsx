// app/match/components/FrameScoreCard.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FrameScore } from '../types';

interface FrameScoreCardProps {
  frame: FrameScore;
  styles: any;
}

export function FrameScoreCard({ frame, styles }: FrameScoreCardProps) {
  return (
    <View style={styles.frameCard}>
      <View style={styles.frameHeader}>
        <Text style={styles.frameNumber}>{`Frame ${frame.frameNumber}`}</Text>
        {frame.winner && (
          <Ionicons 
            name="trophy" 
            size={16} 
            color={frame.winner === 1 ? '#4CAF50' : '#2196F3'} 
          />
        )}
      </View>
      
      {frame.isComplete ? (
        <>
          {frame.showWinnerOnly && frame.winnerName ? (
            // Show winner name when no real score data is available
            <View style={styles.frameWinnerContainer}>
              <Text style={styles.frameWinnerLabel}>Winner:</Text>
              <Text style={styles.frameWinnerName}>
                {frame.winnerName}
              </Text>
            </View>
          ) : (
            // Show actual scores when available
            <View style={styles.frameScores}>
              <Text style={[styles.frameScore, frame.winner === 1 && styles.winningScore]}>
                {frame.player1Score}
              </Text>
              <Text style={styles.frameSeparator}>-</Text>
              <Text style={[styles.frameScore, frame.winner === 2 && styles.winningScore]}>
                {frame.player2Score}
              </Text>
            </View>
          )}
          
          {/* Display highest breaks if available */}
          {(frame.player1Break || frame.player2Break) && (
            <View style={styles.frameBreaks}>
              {frame.player1Break && (
                <Text style={[styles.frameBreak, frame.winner === 1 && styles.winningBreak]}>
                  ({frame.player1Break})
                </Text>
              )}
              {frame.player2Break && (
                <Text style={[styles.frameBreak, frame.winner === 2 && styles.winningBreak]}>
                  ({frame.player2Break})
                </Text>
              )}
            </View>
          )}
        </>
      ) : (
        <Text style={styles.frameIncomplete}>Not played</Text>
      )}
    </View>
  );
}