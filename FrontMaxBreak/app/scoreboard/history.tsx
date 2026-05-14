import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import {
  loadAllMatches, deleteMatch, StoredMatch, computePlayerStats, computeTrainingStats,
} from '../../services/gameStorage';

export default function HistoryScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [activeTab, setActiveTab] = useState<'matches' | 'training'>('matches');

  useFocusEffect(useCallback(() => {
    loadAllMatches().then(setMatches).catch(() => {});
  }, []));

  const matchHistory = matches.filter(m => !m.mode || m.mode === 'match');
  const trainSessions = matches.filter(m => m.mode === 'train');

  const matchPlayerNames = [...new Set(
    matchHistory.flatMap(m => [m.player1Name, m.player2Name]).filter(n => n),
  )];
  const trainPlayerNames = [...new Set(
    trainSessions.map(m => m.player1Name).filter(n => n),
  )];

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function handleDelete(id: string) {
    Alert.alert('Delete?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteMatch(id);
          setMatches(prev => prev.filter(m => m.id !== id));
        },
      },
    ]);
  }

  function renderMatch({ item }: { item: StoredMatch }) {
    const p1Won = item.framesWon[0] > item.framesWon[1];
    const p2Won = item.framesWon[1] > item.framesWon[0];
    const bestBreak = item.frameResults.length > 0
      ? Math.max(...item.frameResults.flatMap(fr => fr.highestBreak))
      : 0;

    return (
      <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardDate, { color: c.textMuted }]}>{formatDate(item.startedAt)}</Text>
          <Text style={[styles.cardMeta, { color: c.textMuted }]}>
            {item.bestOf === null ? '1 frame' : `BO${item.bestOf}`} · {item.numberOfReds} reds
          </Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={{ color: c.textMuted, fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.matchScoreRow}>
          <Text style={[styles.matchPlayer, { color: p1Won ? c.primary : c.textSecondary }]}>
            {p1Won ? '🏆 ' : ''}{item.player1Name}
          </Text>
          <Text style={[styles.matchFrames, { color: c.textPrimary }]}>
            {item.framesWon[0]} – {item.framesWon[1]}
          </Text>
          <Text style={[styles.matchPlayerRight, { color: p2Won ? c.primary : c.textSecondary }]}>
            {item.player2Name}{p2Won ? ' 🏆' : ''}
          </Text>
        </View>

        {item.frameResults.length > 0 && (
          <View style={styles.pillsRow}>
            {item.frameResults.map(fr => (
              <View key={fr.frameNumber} style={[styles.pill, { backgroundColor: c.backgroundTertiary }]}>
                <Text style={[styles.pillText, { color: c.textMuted }]}>
                  F{fr.frameNumber}: {fr.scores[0]}–{fr.scores[1]}
                </Text>
              </View>
            ))}
          </View>
        )}

        {bestBreak > 0 && (
          <Text style={[styles.bestBreak, { color: c.textMuted }]}>
            Highest break: {bestBreak}
          </Text>
        )}
      </View>
    );
  }

  function renderTrainSession({ item }: { item: StoredMatch }) {
    const breaksCount = item.frameResults.length;
    const sessionHighest = breaksCount > 0
      ? Math.max(...item.frameResults.map(fr => fr.highestBreak[0]))
      : 0;
    const avgBreak = breaksCount > 0
      ? Math.round(item.frameResults.reduce((s, fr) => s + fr.highestBreak[0], 0) / breaksCount)
      : 0;

    return (
      <View style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardDate, { color: c.textMuted }]}>{formatDate(item.startedAt)}</Text>
          <Text style={[styles.cardMeta, { color: c.textMuted }]}>{item.numberOfReds} reds</Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={{ color: c.textMuted, fontSize: 16 }}>🗑</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.trainName, { color: c.textPrimary }]}>{item.player1Name}</Text>

        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          {([
            ['Breaks', String(breaksCount)],
            ['Best', String(sessionHighest)],
            ['Avg', String(avgBreak)],
          ] as [string, string][]).map(([label, value]) => (
            <View key={label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: c.primary }]}>{value}</Text>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {breaksCount > 0 && (
          <View style={styles.pillsRow}>
            {item.frameResults.map(fr => (
              <View key={fr.frameNumber} style={[styles.pill, { backgroundColor: c.backgroundTertiary }]}>
                <Text style={[styles.pillText, { color: c.textMuted }]}>
                  B{fr.frameNumber}: {fr.highestBreak[0]}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  function renderMatchStats() {
    if (matchPlayerNames.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Player Stats</Text>
        {matchPlayerNames.map(name => {
          const stats = computePlayerStats(matchHistory, name);
          if (stats.totalFramesPlayed === 0) return null;
          return (
            <View key={name} style={[styles.statsCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
              <Text style={[styles.statsName, { color: c.textPrimary }]}>{name}</Text>
              <View style={styles.statsGrid}>
                {([
                  ['Frames Won', `${stats.totalFramesWon}/${stats.totalFramesPlayed}`],
                  ['Win Rate', `${stats.winRate}%`],
                  ['Best Break', String(stats.highestBreak)],
                  ['Avg Break', String(stats.avgBreak)],
                  ['Matches', `${stats.totalMatchesWon}/${stats.totalMatches}`],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={styles.statItem}>
                    <Text style={[styles.statValue, { color: c.primary }]}>{value}</Text>
                    <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  function renderTrainStats() {
    if (trainPlayerNames.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Overall Training Stats</Text>
        {trainPlayerNames.map(name => {
          const stats = computeTrainingStats(matches, name);
          if (stats.totalBreaks === 0) return null;
          return (
            <View key={name} style={[styles.statsCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
              <Text style={[styles.statsName, { color: c.textPrimary }]}>{name}</Text>
              <View style={styles.statsGrid}>
                {([
                  ['Breaks', String(stats.totalBreaks)],
                  ['Best Break', String(stats.highestBreak)],
                  ['Avg Break', String(stats.avgBreak)],
                  ['50+', String(stats.breaksOver50)],
                  ['25+', String(stats.breaksOver25)],
                ] as [string, string][]).map(([label, value]) => (
                  <View key={label} style={styles.statItem}>
                    <Text style={[styles.statValue, { color: c.primary }]}>{value}</Text>
                    <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    );
  }

  const currentData = activeTab === 'matches' ? matchHistory : trainSessions;
  const currentRender = activeTab === 'matches' ? renderMatch : renderTrainSession;
  const currentHeader = activeTab === 'matches' ? renderMatchStats : renderTrainStats;
  const emptyText = activeTab === 'matches'
    ? 'No matches yet. Start a match from Play Mode.'
    : 'No training sessions yet. Select Train mode in Play Mode.';

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 28, lineHeight: 32 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.textHeader }]}>History</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab toggle */}
      <View style={[styles.tabRow, { borderBottomColor: c.cardBorder }]}>
        {(['matches', 'training'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? c.primary : c.textMuted }]}>
              {tab === 'matches' ? `⚔️  Matches${matchHistory.length > 0 ? ` (${matchHistory.length})` : ''}` : `🎯  Training${trainSessions.length > 0 ? ` (${trainSessions.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={currentData}
        keyExtractor={m => m.id}
        renderItem={currentRender as any}
        contentContainerStyle={styles.list}
        ListHeaderComponent={currentHeader}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>{emptyText}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { padding: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: 'PoppinsBold' },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
  },
  list: { padding: 16, gap: 10 },
  sectionTitle: { fontSize: 13, fontFamily: 'PoppinsBold', marginBottom: 8 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: { fontSize: 11 },
  cardMeta: { fontSize: 11 },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  matchPlayer: { fontSize: 14, fontFamily: 'PoppinsBold', flex: 1 },
  matchPlayerRight: { fontSize: 14, fontFamily: 'PoppinsBold', flex: 1, textAlign: 'right' },
  matchFrames: { fontSize: 20, fontFamily: 'PoppinsBold', marginHorizontal: 8 },
  trainName: { fontSize: 16, fontFamily: 'PoppinsBold' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 10 },
  bestBreak: { fontSize: 11, marginTop: 4 },
  statsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  statsName: { fontSize: 16, fontFamily: 'PoppinsBold', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { alignItems: 'center', minWidth: 70 },
  statValue: { fontSize: 18, fontFamily: 'PoppinsBold' },
  statLabel: { fontSize: 10, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14 },
});
