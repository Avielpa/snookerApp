// app/tour/components/DrawTab.tsx
// Self-contained tournament bracket — proper vertical alignment + connector lines.
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

// ─── Round name inference (fallback when round_names not provided) ────────────
function inferRoundName(round: number): string {
  if (round >= 15) return 'Final';
  if (round === 14) return 'Semi-Finals';
  if (round === 13) return 'Quarter-Finals';
  if (round === 12) return 'Last 16';
  if (round === 11) return 'Last 32';
  if (round === 10) return 'Last 64';
  if (round === 9) return 'Last 128';
  return `Round ${round}`;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const CARD_W = 185;
const CARD_H = 70;   // estimated rendered height (2 player rows + divider)
const BASE_SLOT = CARD_H + 8;   // 78px — height of one "slot" in the first round
const CONN_W = 26;              // width of connector column between rounds
const PILL_H = 52;              // round header pill height
const WIN_COLOR = '#FFA726';

// Top offset of match j in roundIndex (0 = first/most-matches round)
function getTop(roundIndex: number, matchIndex: number): number {
  const slotH = BASE_SLOT * Math.pow(2, roundIndex);
  return matchIndex * slotH + (slotH - CARD_H) / 2;
}

// Total height of the card area — determined by first round match count
function totalHeight(firstRoundCount: number): number {
  return firstRoundCount * BASE_SLOT;
}

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
    <View style={[s.card, isLive && { borderColor: accent }]}>
      {/* Player 1 */}
      <View style={[s.playerRow, p1Won && { backgroundColor: accent + '18' }]}>
        <Text
          style={[
            s.playerName,
            p1Won ? { color: WIN_COLOR, fontFamily: 'PoppinsBold' }
              : !match.player1_name ? s.tbd
              : s.normal,
            !p1Won && isFinished && s.loser,
          ]}
          numberOfLines={1}
        >
          {p1Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, { color: p1Won ? WIN_COLOR : '#9CA3AF' }]}>
            {match.score1}
          </Text>
        )}
      </View>

      <View style={s.divider} />

      {/* Player 2 */}
      <View style={[s.playerRow, p2Won && { backgroundColor: accent + '18' }]}>
        <Text
          style={[
            s.playerName,
            p2Won ? { color: WIN_COLOR, fontFamily: 'PoppinsBold' }
              : !match.player2_name ? s.tbd
              : s.normal,
            !p2Won && isFinished && s.loser,
          ]}
          numberOfLines={1}
        >
          {p2Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, { color: p2Won ? WIN_COLOR : '#9CA3AF' }]}>
            {match.score2}
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Connector lines between two adjacent round columns ──────────────────────
function ConnectorLines({
  roundIndex,
  numMatches,
  totalH,
  accent,
}: {
  roundIndex: number;
  numMatches: number;   // matches in the SOURCE (left) round
  totalH: number;
  accent: string;
}) {
  const lineColor = accent + '60';
  const pairs = Math.floor(numMatches / 2);
  const lines: React.ReactElement[] = [];

  for (let j = 0; j < pairs; j++) {
    const child0Center = getTop(roundIndex, j * 2) + CARD_H / 2;
    const child1Center = getTop(roundIndex, j * 2 + 1) + CARD_H / 2;
    const parentCenter = getTop(roundIndex + 1, j) + CARD_H / 2;
    const midX = CONN_W / 2;

    // Horizontal line: left edge → midX at child0 level
    lines.push(
      <View key={`lh0-${j}`} style={{
        position: 'absolute', top: child0Center - 0.5,
        left: 0, width: midX, height: 1, backgroundColor: lineColor,
      }} />
    );
    // Horizontal line: left edge → midX at child1 level
    lines.push(
      <View key={`lh1-${j}`} style={{
        position: 'absolute', top: child1Center - 0.5,
        left: 0, width: midX, height: 1, backgroundColor: lineColor,
      }} />
    );
    // Vertical line joining child0 and child1 at midX
    lines.push(
      <View key={`lv-${j}`} style={{
        position: 'absolute', top: child0Center,
        left: midX - 0.5, width: 1,
        height: child1Center - child0Center,
        backgroundColor: lineColor,
      }} />
    );
    // Horizontal line: midX → right edge at parent level
    lines.push(
      <View key={`lhp-${j}`} style={{
        position: 'absolute', top: parentCenter - 0.5,
        left: midX, width: midX, height: 1, backgroundColor: lineColor,
      }} />
    );
  }

  return (
    <View style={{ width: CONN_W, height: totalH, position: 'relative' }}>
      {lines}
    </View>
  );
}

// ─── Main DrawTab ─────────────────────────────────────────────────────────────
export function DrawTab({ matches, roundNames, colors }: DrawTabProps) {
  const accent: string = colors.accent || colors.primary || '#FFA726';

  const bracketRounds = useMemo(() => {
    const byRound = new Map<number, DrawMatch[]>();
    matches.forEach((m) => {
      const r = m.round ?? 0;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r)!.push(m);
    });

    const allRounds = Array.from(byRound.keys()).sort((a, b) => a - b);

    // Main draw = rounds with ≤ 8 matches (R16, QF, SF, Final)
    let mainRounds = allRounds.filter((r) => (byRound.get(r)?.length ?? 0) <= 8);
    if (mainRounds.length === 0 && allRounds.length > 0) {
      mainRounds = allRounds.slice(-Math.min(4, allRounds.length));
    }

    return mainRounds.map((r) => ({
      roundNumber: r,
      roundName: roundNames[r] || inferRoundName(r),
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

  const firstRoundCount = bracketRounds[0].matches.length;
  const cardAreaH = totalHeight(firstRoundCount);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.row, { minHeight: PILL_H + cardAreaH + 24 }]}
        nestedScrollEnabled
      >
        {bracketRounds.map((round, roundIndex) => (
          <React.Fragment key={round.roundNumber}>
            {/* ── Round column ───────────────────────────────────── */}
            <View style={{ width: CARD_W }}>
              {/* Round pill header */}
              <View style={[s.roundPill, { backgroundColor: accent + '22', borderColor: accent + '66', height: PILL_H }]}>
                <Text style={[s.roundTitle, { color: accent }]} numberOfLines={1}>
                  {round.roundName}
                </Text>
                <Text style={[s.matchCount, { color: accent + 'AA' }]}>
                  {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
                </Text>
              </View>

              {/* Cards — absolutely positioned within cardAreaH */}
              <View style={{ height: cardAreaH, position: 'relative' }}>
                {round.matches.map((match, matchIndex) => (
                  <View
                    key={match.id}
                    style={{ position: 'absolute', top: getTop(roundIndex, matchIndex), left: 0, right: 0 }}
                  >
                    <BracketMatchCard match={match} accent={accent} />
                  </View>
                ))}
              </View>
            </View>

            {/* ── Connector lines to next round ──────────────────── */}
            {roundIndex < bracketRounds.length - 1 && (
              <View style={{ paddingTop: PILL_H }}>
                <ConnectorLines
                  roundIndex={roundIndex}
                  numMatches={round.matches.length}
                  totalH={cardAreaH}
                  accent={accent}
                />
              </View>
            )}
          </React.Fragment>
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
    paddingRight: 24,
    alignItems: 'flex-start',
  },
  roundPill: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 0,
    justifyContent: 'center',
  },
  roundTitle: {
    fontSize: 13,
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
  playerName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'PoppinsRegular',
  },
  normal: { color: '#FFFFFF' },
  tbd: { color: '#6B7280', fontStyle: 'italic' },
  loser: { opacity: 0.38 },
  score: {
    fontSize: 13,
    fontFamily: 'PoppinsBold',
    minWidth: 18,
    textAlign: 'right',
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
