// FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx
//
// Global best-break leaderboard, split by reds_count (6-red / 15-red boards
// are never comparable — see PlayerBestBreak's backend docstring).
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { fetchLeaderboard, LeaderboardEntry } from '../../../services/leaderboardService';
import { formatElapsed } from '../../../hooks/useSessionTimer';
import { scoreboardColors as c } from '../../../constants/scoreboardTheme';

const REDS_OPTIONS = [15, 6] as const;

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

  return (
    <View style={styles.container}>
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

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No records yet for this format.</Text>
      ) : (
        entries.map((entry, i) => (
          <View key={`${entry.username}-${i}`} style={styles.row}>
            <Text style={styles.rank}>{i + 1}.</Text>
            <Text style={styles.name}>{entry.username}</Text>
            <Text style={styles.stat}>Break {entry.best_break}</Text>
            <Text style={styles.stat}>
              {entry.frame_time_seconds !== null ? formatElapsed(entry.frame_time_seconds) : '—'}
            </Text>
            {!entry.is_verified && <Text style={styles.flag}>⚠</Text>}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder },
  pillActive: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { color: c.textMuted, fontSize: 13 },
  pillTextActive: { color: c.background, fontWeight: '600' },
  empty: { color: c.textMuted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
  rank: { color: c.textMuted, width: 24 },
  name: { color: c.textPrimary, flex: 1, fontWeight: '600' },
  stat: { color: c.textSecondary, fontSize: 13, marginLeft: 8 },
  flag: { marginLeft: 6 },
});
