// app/tour/components/DrawTab.tsx
// Self-contained tournament bracket view — no shared state, no side effects.
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

// Minimal match shape needed by this component
export interface DrawMatch {
  id: number;
  round?: number | null;
  player1_name?: string;
  player2_name?: string;
  player1_id?: number | null;
  player2_id?: number | null;
  score1?: number | null;
  score2?: number | null;
  winner_id?: number | null;
  status_code?: number | null;
}

interface DrawTabProps {
  matches: DrawMatch[];
  roundNames: Record<number, string>;
  colors: any;
}

const CARD_WIDTH = 190;
const CARD_GAP = 12;

// ─── Single match card ────────────────────────────────────────────────────────
function BracketMatchCard({ match, colors }: { match: DrawMatch; colors: any }) {
  const isFinished = match.status_code === 3;
  const p1Won = isFinished && match.winner_id != null && match.winner_id === match.player1_id;
  const p2Won = isFinished && match.winner_id != null && match.winner_id === match.player2_id;
  const hasScore = isFinished && match.score1 != null && match.score2 != null;

  const p1Name = match.player1_name || 'TBD';
  const p2Name = match.player2_name || 'TBD';

  const isTBD = !match.player1_name && !match.player2_name;

  return (
    <View style={[s.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      {/* Player 1 row */}
      <View style={s.playerRow}>
        <Text
          style={[
            s.playerName,
            { color: p1Won ? '#FFA726' : isTBD ? colors.textSecondary : colors.textPrimary },
            p1Won && s.winner,
            !p1Won && isFinished && s.loser,
          ]}
          numberOfLines={1}
        >
          {p1Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, { color: p1Won ? '#FFA726' : colors.textSecondary }, p1Won && s.winner]}>
            {match.score1}
          </Text>
        )}
      </View>

      {/* Divider */}
      <View style={[s.divider, { backgroundColor: colors.cardBorder }]} />

      {/* Player 2 row */}
      <View style={s.playerRow}>
        <Text
          style={[
            s.playerName,
            { color: p2Won ? '#FFA726' : isTBD ? colors.textSecondary : colors.textPrimary },
            p2Won && s.winner,
            !p2Won && isFinished && s.loser,
          ]}
          numberOfLines={1}
        >
          {p2Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, { color: p2Won ? '#FFA726' : colors.textSecondary }, p2Won && s.winner]}>
            {match.score2}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main DrawTab ─────────────────────────────────────────────────────────────
export function DrawTab({ matches, roundNames, colors }: DrawTabProps) {
  const bracketRounds = useMemo(() => {
    // Group by round number
    const byRound = new Map<number, DrawMatch[]>();
    matches.forEach((m) => {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    });

    const allRounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    // Main draw = rounds with ≤ 8 matches (covers R16, QF, SF, Final)
    let mainRounds = allRounds.filter((r) => (byRound.get(r)?.length ?? 0) <= 8);

    // Fallback: if nothing qualifies (tiny event), show last 4 rounds
    if (mainRounds.length === 0 && allRounds.length > 0) {
      mainRounds = allRounds.slice(-Math.min(4, allRounds.length));
    }

    return mainRounds.map((r) => ({
      roundNumber: r,
      roundName: roundNames[r] || `Round ${r}`,
      matches: byRound.get(r) || [],
    }));
  }, [matches, roundNames]);

  if (bracketRounds.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={[s.emptyText, { color: colors.textSecondary }]}>
          {'No bracket data yet.\nMain draw matches may not have started.'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 24 }}
      showsVerticalScrollIndicator={false}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        nestedScrollEnabled
      >
        {bracketRounds.map((round) => (
          <View key={round.roundNumber} style={s.column}>
            {/* Round header */}
            <View style={[s.roundHeader, { borderBottomColor: colors.primary + '80' }]}>
              <Text style={[s.roundTitle, { color: colors.primary }]} numberOfLines={2}>
                {round.roundName}
              </Text>
              <Text style={[s.matchCount, { color: colors.textSecondary }]}>
                {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
              </Text>
            </View>

            {/* Match cards */}
            {round.matches.map((match) => (
              <BracketMatchCard key={match.id} match={match} colors={colors} />
            ))}
          </View>
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: CARD_GAP,
    alignItems: 'flex-start',
  },
  column: {
    width: CARD_WIDTH,
  },
  roundHeader: {
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 10,
  },
  roundTitle: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
    lineHeight: 18,
  },
  matchCount: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    marginTop: 2,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  playerName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
  },
  score: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
    minWidth: 16,
    textAlign: 'right',
  },
  winner: {
    fontFamily: 'PoppinsBold',
  },
  loser: {
    opacity: 0.45,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
    textAlign: 'center',
    lineHeight: 22,
  },
});
