// app/tour/components/DrawTab.tsx
// Self-contained tournament bracket — proper vertical alignment + connector lines.
import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getNationalityFlag } from '../../../utils/nationalityFlag';

export interface DrawMatch {
  id: number;
  api_match_id?: number | null;
  number?: number | null;
  round?: number | null;
  player1_name?: string;
  player2_name?: string;
  player1_id?: number | null;
  player2_id?: number | null;
  player1_nationality?: string | null;
  player2_nationality?: string | null;
  score1?: number | null;
  score2?: number | null;
  winner_id?: number | null;
  status_code?: number | null;
}

interface DrawTabProps {
  matches: DrawMatch[];
  roundNames: Record<number, string>;
  roundFormats?: Record<number, string>;
  roundPrizes?: Record<number, any>;
  colors: any;
}

// ─── Round name inference ─────────────────────────────────────────────────────
// Primary: infer from match count (works regardless of API round numbering)
export function inferRoundNameFromCount(count: number): string {
  if (count === 1) return 'Final';
  if (count === 2) return 'Semi-Finals';
  if (count === 4) return 'Quarter-Finals';
  if (count === 8) return 'Last 16';
  if (count === 16) return 'Last 32';
  if (count === 32) return 'Last 64';
  if (count === 64) return 'Last 128';
  return `Round (${count} matches)`;
}

export interface BracketRound {
  roundNumber: number;
  roundName: string;
  roundFormat: string | null;
  roundPrize: any;
  matches: DrawMatch[];
}

export function computeBracketRounds(
  matches: DrawMatch[],
  roundNames: Record<number, string>,
  roundFormats?: Record<number, string>,
  roundPrizes?: Record<number, any>
): BracketRound[] {
  const byRound = new Map<number, DrawMatch[]>();
  matches.forEach((m) => {
    const r = m.round ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  });

  const allRounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  // Build bracket by chaining backwards from the last round:
  // valid bracket = chain where each earlier round has exactly 2x the matches
  // (e.g. Final=1, SF=2, QF=4, R16=8, Last32=16, Last64=32) — up to 7 rounds shown
  let chain: number[] = [];
  // Find last round with ≤ 32 matches as starting point (covers Last 64 as first round)
  for (let i = allRounds.length - 1; i >= 0; i--) {
    if ((byRound.get(allRounds[i])?.length ?? 0) <= 32) {
      chain = [allRounds[i]];
      break;
    }
  }
  if (chain.length > 0) {
    let needed = (byRound.get(chain[0])?.length ?? 1) * 2;
    const startIdx = allRounds.indexOf(chain[0]) - 1;
    for (let i = startIdx; i >= 0 && chain.length < 7; i--) {
      const r = allRounds[i];
      const count = byRound.get(r)?.length ?? 0;
      if (count === needed) {
        chain.unshift(r);
        needed = count * 2;
      }
    }
  }

  // Fallback: if no chain found, take last 7 rounds with ≤ 32 matches
  let mainRounds = chain.length > 0
    ? chain
    : allRounds.filter((r) => (byRound.get(r)?.length ?? 0) <= 32).slice(-7);

  return mainRounds.map((r) => ({
    roundNumber: r,
    roundName: roundNames[r] || inferRoundNameFromCount(byRound.get(r)!.length),
    roundFormat: roundFormats?.[r] ?? null,
    roundPrize: roundPrizes?.[r] ?? null,
    matches: (byRound.get(r) || []).slice().sort((a, b) => {
      const aPos = a.number ?? a.api_match_id ?? a.id;
      const bPos = b.number ?? b.api_match_id ?? b.id;
      return aPos - bPos;
    }),
  }));
}

// Fallback: infer from round number (only used when count isn't a clean power of 2)
export function inferRoundName(round: number): string {
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
export const CARD_W = 118;
export const CARD_H = 40;
export const BASE_SLOT = CARD_H + 8;
export const CONN_W = 22;
const PILL_H = 50;
const WIN_COLOR = '#FFA726';

export function getTop(roundIndex: number, matchIndex: number, firstRoundCount: number = 8): number {
  const slotH = BASE_SLOT * Math.pow(2, roundIndex);
  return matchIndex * slotH + (slotH - CARD_H) / 2;
}

export function totalHeight(firstRoundCount: number): number {
  return firstRoundCount * BASE_SLOT;
}

// ─── Format prize money ───────────────────────────────────────────────────────
function formatPrize(amount: any): string | null {
  if (!amount) return null;
  const n = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(n) || n <= 0) return null;
  if (n >= 1000000) return `\u00a3${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000) return `\u00a3${Math.round(n / 1000)}k`;
  return `\u00a3${Math.round(n)}`;
}

// ─── Single match card ────────────────────────────────────────────────────────
function BracketMatchCard({
  match,
  accent,
  onPress,
}: {
  match: DrawMatch;
  accent: string;
  onPress?: () => void;
}) {
  const isFinished = match.status_code === 3;
  const isLive = match.status_code === 1 || match.status_code === 2;
  const p1Won = isFinished && match.winner_id != null && match.winner_id === match.player1_id;
  const p2Won = isFinished && match.winner_id != null && match.winner_id === match.player2_id;
  const hasScore = (isFinished || isLive) && match.score1 != null && match.score2 != null;

  const p1Flag = match.player1_nationality ? getNationalityFlag(match.player1_nationality) + ' ' : '';
  const p2Flag = match.player2_nationality ? getNationalityFlag(match.player2_nationality) + ' ' : '';
  const p1Name = (match.player1_name || 'TBD');
  const p2Name = (match.player2_name || 'TBD');

  const card = (
    <View style={[s.card, isLive && { borderColor: accent, borderWidth: 1.5, shadowColor: accent, shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 0, height: 0 }, elevation: 3 }]}>
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
          {p1Flag}{p1Name}
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
          {p2Flag}{p2Name}
        </Text>
        {hasScore && (
          <Text style={[s.score, { color: p2Won ? WIN_COLOR : '#9CA3AF' }]}>
            {match.score2}
          </Text>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {card}
      </TouchableOpacity>
    );
  }
  return card;
}

// ─── Connector lines between two adjacent round columns ──────────────────────
function ConnectorLines({
  roundIndex,
  numMatches,
  numMatchesFirstRound,
  totalH,
  accent,
}: {
  roundIndex: number;
  numMatches: number;
  numMatchesFirstRound: number;
  totalH: number;
  accent: string;
}) {
  // Thicker, more opaque lines than before ('60'/1px was too dim/thin to
  // read as a real connected bracket) — geometry (getTop/CONN_W) untouched,
  // only the line View's own color/thickness/rounding changed.
  const LINE_W = 1.75;
  const lineColor = accent + 'B0';
  const pairs = Math.floor(numMatches / 2);
  const lines: React.ReactElement[] = [];

  for (let j = 0; j < pairs; j++) {
    const child0Center = getTop(roundIndex, j * 2, numMatchesFirstRound) + CARD_H / 2;
    const child1Center = getTop(roundIndex, j * 2 + 1, numMatchesFirstRound) + CARD_H / 2;
    const parentCenter = getTop(roundIndex + 1, j, numMatchesFirstRound) + CARD_H / 2;
    const midX = CONN_W / 2;

    lines.push(
      <View key={`lh0-${j}`} style={{ position: 'absolute', top: child0Center - LINE_W / 2, left: 0, width: midX, height: LINE_W, borderRadius: LINE_W / 2, backgroundColor: lineColor }} />
    );
    lines.push(
      <View key={`lh1-${j}`} style={{ position: 'absolute', top: child1Center - LINE_W / 2, left: 0, width: midX, height: LINE_W, borderRadius: LINE_W / 2, backgroundColor: lineColor }} />
    );
    lines.push(
      <View key={`lv-${j}`} style={{ position: 'absolute', top: child0Center, left: midX - LINE_W / 2, width: LINE_W, height: child1Center - child0Center, backgroundColor: lineColor }} />
    );
    lines.push(
      <View key={`lhp-${j}`} style={{ position: 'absolute', top: parentCenter - LINE_W / 2, left: midX, width: midX, height: LINE_W, borderRadius: LINE_W / 2, backgroundColor: lineColor }} />
    );
  }

  return (
    <View style={{ width: CONN_W, height: totalH, position: 'relative' }}>
      {lines}
    </View>
  );
}

// ─── Main DrawTab ─────────────────────────────────────────────────────────────
export function DrawTab({ matches, roundNames, roundFormats, roundPrizes, colors }: DrawTabProps) {
  const accent: string = colors.accent || colors.primary || '#FFA726';
  const router = useRouter();

  const bracketRounds = useMemo(
    () => computeBracketRounds(matches, roundNames, roundFormats, roundPrizes),
    [matches, roundNames, roundFormats, roundPrizes]
  );

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
                {round.roundFormat && (
                  <Text style={[s.roundMeta, { color: accent + 'BB' }]} numberOfLines={1}>
                    {round.roundFormat}
                  </Text>
                )}
                {round.roundPrize && (
                  <Text style={[s.roundMeta, { color: accent + 'BB' }]} numberOfLines={1}>
                    {'Losers: '}{formatPrize(round.roundPrize)}
                  </Text>
                )}
                <Text style={[s.matchCount, { color: accent + '88' }]}>
                  {round.matches.length} {round.matches.length === 1 ? 'match' : 'matches'}
                </Text>
              </View>

              {/* Cards — absolutely positioned within cardAreaH */}
              <View style={{ height: cardAreaH, position: 'relative' }}>
                {round.matches.map((match, matchIndex) => (
                  <View
                    key={match.id}
                    style={{ position: 'absolute', top: getTop(roundIndex, matchIndex, firstRoundCount), left: 0, right: 0 }}
                  >
                    <BracketMatchCard
                      match={match}
                      accent={accent}
                      onPress={match.api_match_id ? () => router.push(`/match/${match.api_match_id}`) : undefined}
                    />
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
                  numMatchesFirstRound={firstRoundCount}
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
    borderWidth: 1.5,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 0,
    justifyContent: 'center',
  },
  roundTitle: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
  },
  roundMeta: {
    fontSize: 8,
    fontFamily: 'PoppinsRegular',
    marginTop: 1,
  },
  matchCount: {
    fontSize: 8,
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
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 3,
  },
  playerName: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'PoppinsRegular',
  },
  normal: { color: '#FFFFFF' },
  tbd: { color: '#6B7280', fontStyle: 'italic' },
  loser: { opacity: 0.38 },
  score: {
    fontSize: 10,
    fontFamily: 'PoppinsBold',
    minWidth: 12,
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
