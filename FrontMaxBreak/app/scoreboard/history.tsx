import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import {
  loadAllMatches, deleteMatch, StoredMatch,
  computeTrainingStats, groupByRivalry, RivalryGroup,
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

  const trainSessions = matches.filter(m => m.mode === 'train');
  const rivalries = groupByRivalry(matches);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // ── Rivalry card ────────────────────────────────────────────────────────────

  function renderRivalry({ item: r }: { item: RivalryGroup }) {
    const p1Leads = r.matchesWon[0] > r.matchesWon[1];
    const p2Leads = r.matchesWon[1] > r.matchesWon[0];

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}
        onPress={() => router.push({
          pathname: '/scoreboard/rivalry' as any,
          params: { rivalryKey: r.key, player1: r.player1, player2: r.player2 },
        })}
        activeOpacity={0.75}
      >
        {/* Names + record */}
        <View style={styles.rivalryRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.rivalryNameRow}>
              <Text style={[styles.rivalryName, { color: p1Leads ? c.primary : c.textPrimary }]} numberOfLines={1}>
                {p1Leads ? '🏆 ' : ''}{r.player1}
              </Text>
              <View style={styles.rivalryScore}>
                <Text style={[styles.rivalryScoreText, { color: c.textPrimary }]}>
                  {r.matchesWon[0]}–{r.matchesWon[1]}
                </Text>
                <Text style={[styles.rivalryScoreSub, { color: c.textMuted }]}>matches</Text>
              </View>
              <Text style={[styles.rivalryNameRight, { color: p2Leads ? c.primary : c.textPrimary }]} numberOfLines={1}>
                {r.player2}{p2Leads ? ' 🏆' : ''}
              </Text>
            </View>

            {/* Sub stats */}
            <View style={styles.rivalryMeta}>
              <Text style={[styles.rivalryMetaText, { color: c.textMuted }]}>
                Frames {r.framesWon[0]}–{r.framesWon[1]}
              </Text>
              <Text style={[styles.rivalryMetaText, { color: c.textMuted }]}>
                {r.totalSessions} session{r.totalSessions !== 1 ? 's' : ''}
              </Text>
              <Text style={[styles.rivalryMetaText, { color: c.textMuted }]}>
                {formatDate(r.lastPlayedAt)}
              </Text>
            </View>
          </View>
          <Text style={[styles.rivalryChevron, { color: c.textMuted }]}>›</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // ── Training session card ───────────────────────────────────────────────────

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

  function renderTrainSession({ item }: { item: StoredMatch }) {
    const breaksCount = item.frameResults.length;
    const sessionHighest = breaksCount > 0
      ? Math.max(...item.frameResults.map(fr => fr.highestBreak[0])) : 0;
    const avgBreak = breaksCount > 0
      ? Math.round(item.frameResults.reduce((s, fr) => s + fr.highestBreak[0], 0) / breaksCount) : 0;

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
          {([['Breaks', String(breaksCount)], ['Best', String(sessionHighest)], ['Avg', String(avgBreak)]] as [string, string][]).map(([label, value]) => (
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
                <Text style={[styles.pillText, { color: c.textMuted }]}>B{fr.frameNumber}: {fr.highestBreak[0]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  // ── Training overall stats header ───────────────────────────────────────────

  function TrainingHeader() {
    const names = [...new Set(trainSessions.map(m => m.player1Name).filter(Boolean))];
    if (names.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Overall Training Stats</Text>
        {names.map(name => {
          const stats = computeTrainingStats(matches, name);
          if (stats.totalBreaks === 0) return null;
          return (
            <View key={name} style={[styles.statsCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
              <Text style={[styles.statsName, { color: c.textPrimary }]}>{name}</Text>
              <View style={styles.statsGrid}>
                {([
                  ['Breaks', String(stats.totalBreaks)],
                  ['Best', String(stats.highestBreak)],
                  ['Avg', String(stats.avgBreak)],
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

      <View style={[styles.tabRow, { borderBottomColor: c.cardBorder }]}>
        {(['matches', 'training'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? c.primary : c.textMuted }]}>
              {tab === 'matches'
                ? `⚔️  Rivalries${rivalries.length > 0 ? ` (${rivalries.length})` : ''}`
                : `🎯  Training${trainSessions.length > 0 ? ` (${trainSessions.length})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'matches' ? (
        <FlatList
          data={rivalries}
          keyExtractor={r => r.key}
          renderItem={renderRivalry}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>{emptyText}</Text>}
        />
      ) : (
        <FlatList
          data={trainSessions}
          keyExtractor={m => m.id}
          renderItem={renderTrainSession}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<TrainingHeader />}
          ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>{emptyText}</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { padding: 6 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontFamily: 'PoppinsBold' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 13, fontFamily: 'PoppinsBold' },
  list: { padding: 16, gap: 10 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 2 },
  // Rivalry card
  rivalryRow: { flexDirection: 'row', alignItems: 'center' },
  rivalryNameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  rivalryName: { fontSize: 16, fontFamily: 'PoppinsBold', flex: 1 },
  rivalryNameRight: { fontSize: 16, fontFamily: 'PoppinsBold', flex: 1, textAlign: 'right' },
  rivalryScore: { alignItems: 'center', marginHorizontal: 10 },
  rivalryScoreText: { fontSize: 22, fontFamily: 'PoppinsBold' },
  rivalryScoreSub: { fontSize: 9, marginTop: -2 },
  rivalryMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  rivalryMetaText: { fontSize: 12 },
  rivalryChevron: { fontSize: 26, paddingLeft: 8, lineHeight: 32 },
  // Training card
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardDate: { fontSize: 11 },
  cardMeta: { fontSize: 11 },
  trainName: { fontSize: 16, fontFamily: 'PoppinsBold' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 10 },
  // Stats header
  sectionTitle: { fontSize: 13, fontFamily: 'PoppinsBold', marginBottom: 8 },
  statsCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 10 },
  statsName: { fontSize: 16, fontFamily: 'PoppinsBold', marginBottom: 10 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statItem: { alignItems: 'center', minWidth: 70 },
  statValue: { fontSize: 18, fontFamily: 'PoppinsBold' },
  statLabel: { fontSize: 10, marginTop: 2 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14 },
});
