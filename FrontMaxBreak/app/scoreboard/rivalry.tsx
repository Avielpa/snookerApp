// app/scoreboard/rivalry.tsx
// H2H rivalry detail — stats at top, full session list below.

import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, Modal, TextInput,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import {
  loadAllMatches, loadMatch, deleteMatch, StoredMatch,
  groupByRivalry, RivalryGroup, updateMatchPlayerNames,
} from '../../services/gameStorage';
import { uploadMatch } from '../../services/scoreboardSyncService';
import { isLoggedIn } from '../../services/authService';
import BannerAdSlot from '../../components/ads/BannerAdSlot';

export default function RivalryScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const { rivalryKey, player1, player2 } = useLocalSearchParams<{
    rivalryKey: string; player1: string; player2: string;
  }>();

  const [rivalry, setRivalry] = useState<RivalryGroup | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingMatch, setEditingMatch] = useState<StoredMatch | null>(null);
  const [editP1, setEditP1] = useState('');
  const [editP2, setEditP2] = useState('');

  useFocusEffect(useCallback(() => {
    loadAllMatches().then(all => {
      const groups = groupByRivalry(all);
      setRivalry(groups.find(g => g.key === rivalryKey) ?? null);
    }).catch(() => {});
  }, [rivalryKey]));

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  function handleDelete(id: string) {
    Alert.alert('Delete session?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await deleteMatch(id);
          setExpandedId(prev => prev === id ? null : prev);
          setRivalry(prev => prev
            ? { ...prev, matches: prev.matches.filter(m => m.id !== id), totalSessions: prev.totalSessions - 1 }
            : null,
          );
        },
      },
    ]);
  }

  function openEdit(m: StoredMatch, r: RivalryGroup) {
    const isP1 = m.player1Name.trim().toLowerCase() === r.player1.toLowerCase();
    setEditP1(isP1 ? m.player1Name.trim() : m.player2Name.trim());
    setEditP2(isP1 ? m.player2Name.trim() : m.player1Name.trim());
    setEditingMatch(m);
  }

  async function handleSaveEdit() {
    if (!editingMatch) return;
    const p1 = editP1.trim();
    const p2 = editP2.trim();
    if (!p1 || !p2) return;

    const r = rivalry!;
    const isP1 = editingMatch.player1Name.trim().toLowerCase() === r.player1.toLowerCase();
    const newP1Name = isP1 ? p1 : p2;
    const newP2Name = isP1 ? p2 : p1;

    const updated = await updateMatchPlayerNames(editingMatch.id, newP1Name, newP2Name);
    setEditingMatch(null);

    if (updated) {
      isLoggedIn().then(logged => {
        if (logged) uploadMatch(updated).catch(() => {});
      });
    }

    // Reload rivalry — find group that still contains this match (key may have changed)
    const matchId = editingMatch.id;
    loadAllMatches().then(all => {
      const groups = groupByRivalry(all);
      const found = groups.find(g => g.matches.some(m => m.id === matchId));
      setRivalry(found ?? null);
    }).catch(() => {});
  }

  function startNewSession() {
    router.push({
      pathname: '/scoreboard' as any,
      params: { prefillPlayer1: player1, prefillPlayer2: player2 },
    });
  }

  if (!rivalry) {
    return (
      <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { borderBottomColor: c.cardBorder }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={{ color: c.textMuted, fontSize: 28, lineHeight: 32 }}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.textHeader }]}>Rivalry</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.empty, { color: c.textMuted }]}>No sessions found.</Text>
      </View>
    );
  }

  const p1Leads = rivalry.matchesWon[0] > rivalry.matchesWon[1];
  const p2Leads = rivalry.matchesWon[1] > rivalry.matchesWon[0];

  // ── H2H stats header ──────────────────────────────────────────────────────

  const ListHeader = () => (
    <View style={{ marginBottom: 16 }}>
      <View style={[styles.h2hCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <View style={styles.h2hRow}>
          <View style={styles.h2hPlayer}>
            {p1Leads && <Text style={[styles.trophy]}>🏆</Text>}
            <Text style={[styles.h2hName, { color: c.textPrimary }]} numberOfLines={2}>{rivalry.player1}</Text>
          </View>

          <View style={styles.h2hCenter}>
            <Text style={[styles.h2hBigScore, { color: c.textHeader }]}>
              {rivalry.matchesWon[0]}–{rivalry.matchesWon[1]}
            </Text>
            <Text style={[styles.h2hCenterLabel, { color: c.textMuted }]}>sessions</Text>
          </View>

          <View style={[styles.h2hPlayer, { alignItems: 'flex-end' }]}>
            {p2Leads && <Text style={styles.trophy}>🏆</Text>}
            <Text style={[styles.h2hName, { color: c.textPrimary, textAlign: 'right' }]} numberOfLines={2}>{rivalry.player2}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />

        {([
          ['Frames won', `${rivalry.framesWon[0]}`, `${rivalry.framesWon[1]}`],
          ['Highest break', `${rivalry.highestBreak[0]}`, `${rivalry.highestBreak[1]}`],
          ['Avg break', `${rivalry.avgBreak[0]}`, `${rivalry.avgBreak[1]}`],
          ['Avg pts/frame', `${rivalry.avgPointsPerFrame[0]}`, `${rivalry.avgPointsPerFrame[1]}`],
          ['Sessions played', `${rivalry.totalSessions}`, ''],
        ] as [string, string, string][]).map(([label, v1, v2]) => (
          <View key={label} style={styles.statRow}>
            <Text style={[styles.statRowValue, { color: c.primary, textAlign: 'left' }]}>{v1}</Text>
            <Text style={[styles.statRowLabel, { color: c.textMuted }]}>{label}</Text>
            <Text style={[styles.statRowValue, { color: c.primary, textAlign: 'right' }]}>{v2}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.newSessionBtn, { backgroundColor: c.primary }]}
        onPress={startNewSession}
        activeOpacity={0.85}
      >
        <Text style={styles.newSessionBtnText}>▶  New Session</Text>
      </TouchableOpacity>

      <BannerAdSlot />

      <Text style={[styles.sessionsLabel, { color: c.textSecondary }]}>
        Sessions ({rivalry.totalSessions})
      </Text>
    </View>
  );

  // ── Individual session card ───────────────────────────────────────────────

  function renderSession({ item: m }: { item: StoredMatch }) {
    const r = rivalry!;
    const isP1 = m.player1Name.trim().toLowerCase() === r.player1.toLowerCase();
    const [myIdx, oppIdx] = isP1 ? [0, 1] : [1, 0];
    const p1Won = m.framesWon[myIdx] > m.framesWon[oppIdx];
    const p2Won = m.framesWon[oppIdx] > m.framesWon[myIdx];
    const isExpanded = expandedId === m.id;
    const hasFrames = m.frameResults.length > 0;

    return (
      <View style={[styles.sessionCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}>
        <View style={styles.sessionHeader}>
          <Text style={[styles.sessionDate, { color: c.textMuted }]}>{formatDate(m.startedAt)}</Text>
          <Text style={[styles.sessionMeta, { color: c.textMuted }]}>
            {m.bestOf === null ? '1 frame' : m.bestOf === 9999 ? 'Unlimited' : `BO${m.bestOf}`} · {m.numberOfReds} reds
          </Text>
          <View style={styles.sessionActions}>
            <TouchableOpacity
              onPress={() => openEdit(m, r)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.actionBtn}
            >
              <Text style={[styles.actionBtnText, { color: c.textMuted }]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(m.id)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.actionBtn}
            >
              <Text style={[styles.actionBtnText, { color: '#CC0000' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => hasFrames && setExpandedId(isExpanded ? null : m.id)}
          activeOpacity={hasFrames ? 0.8 : 1}
        >
          <View style={styles.sessionScore}>
            <Text style={[styles.sessionPlayer, { color: p1Won ? c.primary : c.textSecondary }]} numberOfLines={1}>
              {p1Won ? '🏆 ' : ''}{r.player1}
            </Text>
            <Text style={[styles.sessionFrames, { color: c.textPrimary }]}>
              {m.framesWon[myIdx]}–{m.framesWon[oppIdx]}
            </Text>
            <Text style={[styles.sessionPlayerRight, { color: p2Won ? c.primary : c.textSecondary }]} numberOfLines={1}>
              {r.player2}{p2Won ? ' 🏆' : ''}
            </Text>
          </View>

          {hasFrames && (
            isExpanded ? (
              <View style={[styles.frameTable, { borderTopColor: c.cardBorder }]}>
                <View style={[styles.frameTableHeaderRow, { borderBottomColor: c.cardBorder }]}>
                  <Text style={[styles.frameTableHeaderCell, { color: c.textMuted, flex: 0.6 }]}>Frame</Text>
                  <Text style={[styles.frameTableHeaderCell, { color: c.textMuted, flex: 1 }]}>{r.player1}</Text>
                  <Text style={[styles.frameTableHeaderCell, { color: c.textMuted, flex: 1, textAlign: 'right' }]}>{r.player2}</Text>
                  <Text style={[styles.frameTableHeaderCell, { color: c.textMuted, flex: 0.9, textAlign: 'right' }]}>H.Break</Text>
                </View>
                {m.frameResults.map(fr => {
                  const p1WinsFrame = fr.winner === myIdx;
                  const p2WinsFrame = fr.winner === oppIdx;
                  const hb = Math.max(fr.highestBreak[0], fr.highestBreak[1]);
                  return (
                    <View key={fr.frameNumber} style={[styles.frameTableRow, { borderBottomColor: c.cardBorder }]}>
                      <Text style={[styles.frameTableCell, { color: c.textMuted, flex: 0.6 }]}>F{fr.frameNumber}</Text>
                      <Text style={[styles.frameTableCell, {
                        color: p1WinsFrame ? c.primary : c.textSecondary,
                        flex: 1,
                        fontFamily: p1WinsFrame ? 'PoppinsBold' : undefined,
                      }]}>
                        {fr.scores[myIdx]}{p1WinsFrame ? ' ✓' : ''}
                      </Text>
                      <Text style={[styles.frameTableCell, {
                        color: p2WinsFrame ? c.primary : c.textSecondary,
                        flex: 1,
                        textAlign: 'right',
                        fontFamily: p2WinsFrame ? 'PoppinsBold' : undefined,
                      }]}>
                        {p2WinsFrame ? '✓ ' : ''}{fr.scores[oppIdx]}
                      </Text>
                      <Text style={[styles.frameTableCell, { color: c.textMuted, flex: 0.9, textAlign: 'right' }]}>
                        {hb > 0 ? hb : '–'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.pillsRow}>
                {m.frameResults.map(fr => (
                  <View key={fr.frameNumber} style={[styles.pill, { backgroundColor: c.backgroundTertiary }]}>
                    <Text style={[styles.pillText, { color: c.textMuted }]}>
                      F{fr.frameNumber}: {fr.scores[isP1 ? 0 : 1]}–{fr.scores[isP1 ? 1 : 0]}
                    </Text>
                  </View>
                ))}
              </View>
            )
          )}

          {hasFrames && (
            <Text style={[styles.expandHint, { color: c.textMuted }]}>
              {isExpanded ? '▲ collapse' : '▼ frame details'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: c.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 28, lineHeight: 32 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.textHeader }]} numberOfLines={1}>
          {rivalry.player1} vs {rivalry.player2}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={rivalry.matches}
        keyExtractor={m => m.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<ListHeader />}
        ListEmptyComponent={<Text style={[styles.empty, { color: c.textMuted }]}>No sessions yet.</Text>}
      />

      {/* ── Edit player names modal ── */}
      <Modal visible={editingMatch !== null} transparent animationType="fade">
        <View style={styles.editOverlay}>
          <View style={[styles.editCard, { backgroundColor: c.backgroundSecondary, borderColor: c.cardBorder }]}>
            <Text style={[styles.editTitle, { color: c.textPrimary }]}>Edit Player Names</Text>

            <Text style={[styles.editLabel, { color: c.textMuted }]}>Player 1</Text>
            <TextInput
              style={[styles.editInput, { color: c.textPrimary, borderColor: c.cardBorder, backgroundColor: c.backgroundTertiary }]}
              value={editP1}
              onChangeText={setEditP1}
              autoCapitalize="words"
              returnKeyType="next"
              placeholderTextColor={c.textMuted}
            />

            <Text style={[styles.editLabel, { color: c.textMuted }]}>Player 2</Text>
            <TextInput
              style={[styles.editInput, { color: c.textPrimary, borderColor: c.cardBorder, backgroundColor: c.backgroundTertiary }]}
              value={editP2}
              onChangeText={setEditP2}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={handleSaveEdit}
              placeholderTextColor={c.textMuted}
            />

            <View style={styles.editBtnRow}>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: c.backgroundTertiary }]}
                onPress={() => setEditingMatch(null)}
              >
                <Text style={[styles.editBtnText, { color: c.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, { backgroundColor: c.primary }]}
                onPress={handleSaveEdit}
              >
                <Text style={[styles.editBtnText, { color: '#121212' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 16, fontFamily: 'PoppinsBold', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  list: { padding: 16, paddingBottom: 40 },
  // H2H card
  h2hCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 12 },
  h2hRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  h2hPlayer: { flex: 1, alignItems: 'flex-start' },
  h2hName: { fontSize: 15, fontFamily: 'PoppinsBold' },
  trophy: { fontSize: 18, marginBottom: 2 },
  h2hCenter: { alignItems: 'center', paddingHorizontal: 12 },
  h2hBigScore: { fontSize: 32, fontFamily: 'PoppinsBold' },
  h2hCenterLabel: { fontSize: 10, marginTop: -4 },
  divider: { height: 1, marginBottom: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  statRowLabel: { flex: 1, textAlign: 'center', fontSize: 12 },
  statRowValue: { flex: 1, fontSize: 15, fontFamily: 'PoppinsBold' },
  // New session button
  newSessionBtn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  newSessionBtnText: { fontFamily: 'PoppinsBold', fontSize: 16, color: '#121212' },
  sessionsLabel: { fontSize: 13, fontFamily: 'PoppinsBold', letterSpacing: 0.5, marginBottom: 4 },
  // Session card
  sessionCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 8 },
  sessionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sessionDate: { fontSize: 12, flex: 1 },
  sessionMeta: { fontSize: 12 },
  sessionActions: { flexDirection: 'row', gap: 10, marginLeft: 8 },
  actionBtn: { paddingHorizontal: 2 },
  actionBtnText: { fontSize: 12, fontFamily: 'PoppinsBold' },
  sessionScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sessionPlayer: { fontSize: 15, fontFamily: 'PoppinsBold', flex: 1 },
  sessionPlayerRight: { fontSize: 15, fontFamily: 'PoppinsBold', flex: 1, textAlign: 'right' },
  sessionFrames: { fontSize: 22, fontFamily: 'PoppinsBold', marginHorizontal: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 11 },
  // Frame detail table
  frameTable: { marginTop: 8, borderTopWidth: 1 },
  frameTableHeaderRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1 },
  frameTableHeaderCell: { fontSize: 10, fontFamily: 'PoppinsBold' },
  frameTableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1 },
  frameTableCell: { fontSize: 13 },
  expandHint: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  // Edit modal
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  editCard: { width: '100%', maxWidth: 360, borderRadius: 16, borderWidth: 1, padding: 24 },
  editTitle: { fontSize: 17, fontFamily: 'PoppinsBold', marginBottom: 20, textAlign: 'center' },
  editLabel: { fontSize: 12, marginBottom: 6 },
  editInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: 'PoppinsRegular', marginBottom: 16 },
  editBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  editBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  editBtnText: { fontFamily: 'PoppinsBold', fontSize: 15 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: 14 },
});
