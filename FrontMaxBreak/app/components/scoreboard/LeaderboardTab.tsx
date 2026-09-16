// FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx
//
// Global best-break leaderboard, split by reds_count (6-red / 15-red boards
// are never comparable — see PlayerBestBreak's backend docstring).
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, FlatList, StyleSheet, I18nManager } from 'react-native';
import { fetchLeaderboard, LeaderboardEntry } from '../../../services/leaderboardService';
import { formatElapsed } from '../../../hooks/useSessionTimer';
import { scoreboardColors as c } from '../../../constants/scoreboardTheme';

const REDS_OPTIONS = [15, 6] as const;

// `writingDirection` in RN's Text style is iOS-only, so it has no effect on
// Android's bidi algorithm reordering a numeral+punctuation string (e.g.
// "1." rendering as ".1") on an RTL-locale device. Unicode's own strong
// LTR-override marks work on both platforms because they operate on the
// bidi algorithm directly, not through a style property.
const LRO = '‭'; // Left-to-Right Override
const PDF = '‬'; // Pop Directional Formatting
function forceLtr(text: string): string {
  return `${LRO}${text}${PDF}`;
}

// This leaderboard's rank/name/stat ordering is a fixed left-to-right data
// layout, not text content — force it regardless of the device's RTL locale
// setting (RN mirrors 'row' to visually reverse when I18nManager.isRTL).
const LTR_ROW = I18nManager.isRTL ? 'row-reverse' : 'row';

export default function LeaderboardTab() {
  const [redsCount, setRedsCount] = useState<number>(15);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(redsCount).then(result => {
      if (!cancelled) {
        setEntries(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [redsCount]);

  function renderEntry({ item: entry, index: i }: { item: LeaderboardEntry; index: number }) {
    return (
      <View style={styles.row}>
        <Text style={styles.rank}>{forceLtr(`${i + 1}.`)}</Text>
        <Text style={styles.name}>{entry.username}</Text>
        <Text style={styles.stat}>Break {entry.best_break}</Text>
        <Text style={styles.stat}>
          {entry.frame_time_seconds !== null ? formatElapsed(entry.frame_time_seconds) : '—'}
        </Text>
        {!entry.is_verified && <Text style={styles.flag}>⚠</Text>}
      </View>
    );
  }

  const pillRow = (
    <View style={styles.pillRow}>
      {REDS_OPTIONS.map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => setRedsCount(n)}
          style={[styles.pill, redsCount === n && styles.pillActive]}
        >
          <Text style={[styles.pillText, redsCount === n && styles.pillTextActive]}>
            {n} reds
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        {pillRow}
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={entries}
      keyExtractor={(entry, i) => `${entry.username}-${i}`}
      renderItem={renderEntry}
      ListHeaderComponent={pillRow}
      ListEmptyComponent={<Text style={styles.empty}>No records yet for this format.</Text>}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pillRow: { flexDirection: LTR_ROW, gap: 8, marginBottom: 12 },
  pill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder },
  pillActive: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { color: c.textMuted, fontSize: 13 },
  pillTextActive: { color: c.background, fontWeight: '600' },
  empty: { color: c.textMuted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: LTR_ROW, alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
  rank: { color: c.textMuted, width: 24 },
  name: { color: c.textPrimary, flex: 1, fontWeight: '600' },
  stat: { color: c.textSecondary, fontSize: 13, marginLeft: 8 },
  flag: { marginLeft: 6 },
});
