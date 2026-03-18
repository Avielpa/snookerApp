// app/tour/components/DrawTab.tsx
// Self-contained tournament bracket view — no shared state, no side effects.
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

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

const CARD_WIDTH = 200;
const WINNER_COLOR = '#FFA726';

// ─── Single match card ────────────────────────────────────────────────────────
function BracketMatchCard({ match, accent }: { match: DrawMatch; accent: string }) {
  const isFinished = match.status_code === 3;
  const isLive = match.status_code === 1 || match.status_code === 2;
  const p1Won = isFinished && match.winner_id != null && match.winner_id === match.player1_id;
  const p2Won = isFinished && match.winner_id != null && match.winner_id === match.player2_id;
  const hasScore = (isFinished || isLive) && match.score1 != null && match.score2 != null;

  const p1Name = match.player1_name || 'TBD';
  const p2Name = match.player2_name || 'TBD';

  return (
    <View style={[s.card, isLive && { borderColor: accent + 'AA' }]}>
      {/* Player 1 */}
      <View style={[s.playerRow, p1Won && s.winnerRow]}>
        <Text
          style={[
            s.playerName,
            p1Won ? { color: WINNER_COLOR } : !match.player1_name ? s.tbd : s.normal,
            !p1Won && isFinished && s.loser,
            p1Won && { fontFamily: 'PoppinsBold' },
          ]}
          numberOfLines={1}
        >
          {p1Won ? '🏆 ' : ''}{p1Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, p1Won ? { color: WINNER_COLOR, fontFamily: 'PoppinsBold' } : s.scoreDim]}>
            {match.score1}
          </Text>
        )}
      </View>

      <View style={s.divider} />

      {/* Player 2 */}
      <View style={[s.playerRow, p2Won && s.winnerRow]}>
        <Text
          style={[
            s.playerName,
            p2Won ? { color: WINNER_COLOR } : !match.player2_name ? s.tbd : s.normal,
            !p2Won && isFinished && s.loser,
            p2Won && { fontFamily: 'PoppinsBold' },
          ]}
          numberOfLines={1}
        >
          {p2Won ? '🏆 ' : ''}{p2Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, p2Won ? { color: WINNER_COLOR, fontFamily: 'PoppinsBold' } : s.scoreDim]}>
            {match.score2}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Main DrawTab ─────────────────────────────────────────────────────────────
export function DrawTab({ matches, roundNames, colors }: DrawTabProps) {
  // Graceful fallback — event screen uses `accent`, ranking screen uses `primary`
  const accent: string = colors.accent || colors.primary || '#FFA726';

  const bracketRounds = useMemo(() => {
    const byRound = new Map<number, DrawMatch[]>();
    matches.forEach((m) => {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    });

    const allRounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    // Show rounds with ≤ 8 matches (R16, QF, SF, Final)
    let mainRounds = allRounds.filter((r) => (byRound.get(r)?.length ?? 0) <= 8);

    // Fallback: take last 4 rounds if nothing qualifies
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
        <Text style={[s.emptyText, { color: colors.textSecondary || '#9CA3AF' }]}>
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
            {/* Round header pill */}
            <View style={[s.roundPill, { backgroundColor: accent + '22', borderColor: accent + '66' }]}>
              <Text style={[s.roundTitle, { color: accent }]} numberOfLines={1}>
                {round.roundName}
              </Text>
              <Text style={[s.matchCount, { color: accent + 'AA' }]}>
                {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
              </Text>
            </View>

            {round.matches.map((match) => (
              <BracketMatchCard key={match.id} match={match} accent={accent} />
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
    gap: 10,
    alignItems: 'flex-start',
  },
  column: {
    width: CARD_WIDTH,
  },
  roundPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  roundTitle: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
  },
  matchCount: {
    fontSize: 10,
    fontFamily: 'PoppinsRegular',
    marginTop: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
    backgroundColor: '#252525',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  winnerRow: {
    backgroundColor: 'rgba(255,167,38,0.08)',
  },
  playerName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
  },
  normal: {
    color: '#FFFFFF',
  },
  tbd: {
    color: '#6B7280',
    fontStyle: 'italic',
  },
  loser: {
    opacity: 0.4,
  },
  score: {
    fontSize: 14,
    minWidth: 18,
    textAlign: 'right',
  },
  scoreDim: {
    color: '#9CA3AF',
    fontFamily: 'PoppinsRegular',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
