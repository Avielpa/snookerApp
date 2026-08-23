// app/tour/utils/bracketChain.ts
//
// Shared bracket-depth inference used whenever the backend hasn't supplied
// round names yet (RoundDetails missing/incomplete for an event). Replaces
// the old per-file "if round >= 15 return Final" guesses (app/tour/[eventId]
// .tsx and app/home/utils/roundNaming.ts) and the round-number-scanning
// chain builder in DrawTab.tsx — all three disagreed with each other and
// with reality whenever a tournament has an extra round (e.g. a Wild Card
// Round) numbered outside the normal knockout sequence.
//
// Core idea: a round NUMBER is not a reliable proxy for bracket depth (an
// extra pre-round can be numbered higher than the real Final). Match COUNT
// (each real knockout round has exactly half the matches of the round
// before it) plus DATE (a real knockout round is chronologically adjacent
// to its neighbours) are reliable regardless of how the round is numbered.

export interface ChainMatch {
  round?: number | null;
  event_id?: number | null;
  scheduled_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

export interface KnockoutChainRound {
  roundNumber: number;
  matchCount: number;
  // 0 = earliest round in the chain, increasing toward the Final.
  chainIndex: number;
}

// Matches today's DrawTab cap — a real single-elim bracket is never deeper
// than this in practice (Last 64 -> ... -> Final = 7 rounds).
const MAX_CHAIN_DEPTH = 7;

function representativeDateMs(matches: ChainMatch[]): number {
  const times = matches
    .map((m) => {
      const raw = m.scheduled_date || m.start_date || m.end_date;
      if (!raw) return null;
      const t = new Date(raw).getTime();
      return isNaN(t) ? null : t;
    })
    .filter((t): t is number => t !== null);
  if (times.length === 0) return 0;
  // Earliest match in the round — the round "starts" then, which is what we
  // want to compare against a neighbouring round's own start.
  return Math.min(...times);
}

/**
 * Infer a round's display name purely from how many matches it has.
 * Only meaningful for a round already confirmed to be part of a real
 * knockout doubling chain (see computeKnockoutChain) — a bare count of 2
 * could otherwise just as easily be an unrelated 2-match round.
 */
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

/** User-facing label: one sequential path, Round 1 then Round 2, never Last 64 / QF mix. */
export function sequentialRoundName(chainIndex: number): string {
  return `Round ${chainIndex + 1}`;
}

/**
 * Map API round numbers onto Round 1..N in knockout order.
 * Leftover rounds (not in the doubling chain) continue the same sequence.
 */
export function buildSequentialRoundLabels(matches: ChainMatch[]): Map<number, string> {
  const chain = computeKnockoutChain(matches);
  const labels = new Map<number, string>();
  const ordered = Array.from(chain.values()).sort((a, b) => a.chainIndex - b.chainIndex);
  ordered.forEach((entry, index) => {
    labels.set(entry.roundNumber, sequentialRoundName(index));
  });
  const leftoverRounds = [
    ...new Set(
      matches
        .map((m) => m.round)
        .filter((r): r is number => r !== null && r !== undefined && !labels.has(r))
    ),
  ].sort((a, b) => a - b);
  leftoverRounds.forEach((roundNumber, index) => {
    labels.set(roundNumber, sequentialRoundName(ordered.length + index));
  });
  return labels;
}

/**
 * Computes the real knockout bracket chain for matches known to belong to a
 * single event. Anchors on the round with the globally fewest matches
 * (ties broken by the latest representative date — the deepest round is
 * whichever one is chronologically last), then walks backward requiring
 * each earlier round to have exactly double the match count, preferring
 * the chronologically-closest-preceding candidate whenever more than one
 * round shares that count (e.g. a real Semi-Final vs. an unrelated Wild
 * Card Round that coincidentally also has 2 matches).
 *
 * Rounds that never join this chain (extra/qualifying/wildcard rounds) are
 * simply absent from the returned map — callers must not force a label
 * onto them (see [eventId].tsx / DrawTab.tsx for how "not in chain" is
 * handled at each call site).
 */
export function computeKnockoutChain(matches: ChainMatch[]): Map<number, KnockoutChainRound> {
  const byRound = new Map<number, ChainMatch[]>();
  matches.forEach((m) => {
    const r = m.round;
    if (r === null || r === undefined) return;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  });

  const rounds = Array.from(byRound.keys());
  if (rounds.length === 0) return new Map();

  // The anchor is only ever the STARTING point of the chain — later rounds
  // walked backward from it may exceed this (e.g. a real Last 64 round has
  // 32+ matches), but a round this large can never plausibly BE a Final,
  // so it must never be picked as the anchor itself (matches the old
  // round-number-scanning algorithm's same ≤32 starting-point guard).
  const MAX_ANCHOR_COUNT = 32;
  let anchor: number | null = null;
  let anchorCount = Infinity;
  let anchorDate = -Infinity;
  for (const r of rounds) {
    const ms = byRound.get(r)!;
    const count = ms.length;
    if (count === 0 || count > MAX_ANCHOR_COUNT) continue;
    const date = representativeDateMs(ms);
    if (count < anchorCount || (count === anchorCount && date > anchorDate)) {
      anchor = r;
      anchorCount = count;
      anchorDate = date;
    }
  }
  if (anchor === null) return new Map();

  const chain: number[] = [anchor];
  const used = new Set<number>([anchor]);
  let neededCount = anchorCount * 2;
  let earliestDateInChain = anchorDate;

  while (chain.length < MAX_CHAIN_DEPTH) {
    let bestBefore: { r: number; date: number; diff: number } | null = null;
    let bestAfter: { r: number; date: number; diff: number } | null = null;

    for (const r of rounds) {
      if (used.has(r)) continue;
      const ms = byRound.get(r)!;
      if (ms.length !== neededCount) continue;
      const date = representativeDateMs(ms);
      const diff = earliestDateInChain - date;
      if (diff >= 0) {
        if (!bestBefore || diff < bestBefore.diff) bestBefore = { r, date, diff };
      } else {
        const absDiff = -diff;
        if (!bestAfter || absDiff < bestAfter.diff) bestAfter = { r, date, diff: absDiff };
      }
    }

    const chosen = bestBefore ?? bestAfter;
    if (!chosen) break;

    chain.unshift(chosen.r);
    used.add(chosen.r);
    earliestDateInChain = chosen.date;
    neededCount *= 2;
  }

  const result = new Map<number, KnockoutChainRound>();
  chain.forEach((r, idx) => {
    result.set(r, { roundNumber: r, matchCount: byRound.get(r)!.length, chainIndex: idx });
  });
  return result;
}

/**
 * Same as computeKnockoutChain, but for match lists that may span more than
 * one concurrent event (e.g. Home's combined live+upcoming feed). Groups by
 * event_id first so two different events that happen to reuse the same
 * round number never collide, then returns a single map keyed by
 * "<event_id>:<round>".
 */
export function computeKnockoutChainsByEvent(matches: ChainMatch[]): Map<string, KnockoutChainRound> {
  const byEvent = new Map<string, ChainMatch[]>();
  matches.forEach((m) => {
    const key = String(m.event_id ?? 'unknown');
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key)!.push(m);
  });

  const result = new Map<string, KnockoutChainRound>();
  byEvent.forEach((eventMatches, eventKey) => {
    const chain = computeKnockoutChain(eventMatches);
    chain.forEach((round, roundNumber) => {
      result.set(`${eventKey}:${roundNumber}`, round);
    });
  });
  return result;
}
