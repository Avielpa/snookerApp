import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LiveIndicatorProps {
  isLive?: boolean;
  onBreak?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const LiveIndicator: React.FC<LiveIndicatorProps> = ({ 
  isLive = true, 
  onBreak = false 
}) => {
  if (!isLive && !onBreak) return null;
  
  const isBreak = onBreak && !isLive;
  
  return (
    <View style={[styles.liveContainer, isBreak ? styles.breakContainer : null]}>
      <View style={styles.liveDot} />
      <Text style={styles.liveText}>
        {isBreak ? 'BREAK' : 'LIVE'}
      </Text>
    </View>
  );
};

// Add displayName for debugging
LiveIndicator.displayName = 'LiveIndicator';

const styles = StyleSheet.create({
  liveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  breakContainer: {
    backgroundColor: 'rgba(255, 152, 0, 0.8)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});