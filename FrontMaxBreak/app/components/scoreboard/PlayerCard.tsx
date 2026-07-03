import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../contexts/ThemeContext';

interface Props {
  name: string;
  score: number;
  framesWon: number;
  currentBreak: number;
  highestBreak: number;
  isActive: boolean;
  isLeft: boolean;
  onEndVisit?: () => void;
}

export default function PlayerCard({
  name, score, framesWon, currentBreak, highestBreak, isActive, isLeft, onEndVisit,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const cardStyle = [
    styles.card,
    { minHeight: isLandscape ? 70 : 140 },
    { backgroundColor: isActive ? 'rgba(255,183,77,0.12)' : c.cardBackground },
    { borderColor: isActive ? c.primary : c.cardBorder },
    isLeft ? styles.borderRight : styles.borderLeft,
  ];

  const content = (
    <>
      {isActive && (
        <View style={[styles.activeDot, { backgroundColor: c.primary }]} />
      )}

      <Text
        style={[styles.name, { color: isActive ? c.textPrimary : c.textSecondary }]}
        numberOfLines={1}
      >
        {name}
      </Text>

      <Text style={[styles.score, { color: isActive ? c.primary : c.textPrimary }]}>
        {score}
      </Text>

      <View style={styles.row}>
        <Text style={[styles.label, { color: c.textMuted }]}>Frames</Text>
        <Text style={[styles.value, { color: c.textSecondary }]}>{framesWon}</Text>
      </View>

      {isActive && currentBreak > 0 && (
        <View style={[styles.breakBadge, { backgroundColor: c.primary }]}>
          <Text style={styles.breakText}>Break: {currentBreak}</Text>
        </View>
      )}

      {highestBreak > 0 && (
        <View style={styles.row}>
          <Text style={[styles.label, { color: c.textMuted }]}>Best</Text>
          <Text style={[styles.value, { color: c.textMuted }]}>{highestBreak}</Text>
        </View>
      )}

      {onEndVisit && (
        <Text style={[styles.endVisitHint, { color: c.textMuted }]}>tap · end visit</Text>
      )}
    </>
  );

  if (onEndVisit) {
    return (
      <TouchableOpacity
        style={cardStyle}
        activeOpacity={0.7}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onEndVisit();
        }}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    position: 'relative',
  },
  borderRight: { marginRight: 4 },
  borderLeft: { marginLeft: 4 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 10,
    right: 10,
  },
  name: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
    marginBottom: 4,
    textAlign: 'center',
  },
  score: {
    fontSize: 48,
    fontFamily: 'PoppinsBold',
    lineHeight: 56,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    marginTop: 2,
  },
  label: {
    fontSize: 11,
  },
  value: {
    fontSize: 11,
    fontFamily: 'PoppinsBold',
  },
  breakBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  breakText: {
    color: '#121212',
    fontSize: 12,
    fontFamily: 'PoppinsBold',
  },
  endVisitHint: {
    fontSize: 10,
    marginTop: 6,
    opacity: 0.6,
  },
});
