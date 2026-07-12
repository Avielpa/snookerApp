import { GameState } from '../hooks/useSnookerGame';

// Local, free, no-AI "commentary" engine — a template pool per real situation, picked
// deterministically (never Math.random unseeded) so phrasing varies across matches
// without ever inventing a number or name: every {slot} is filled from real GameState
// values passed in by the caller. See docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md,
// section 3.2, for the design rationale (and the documented later swap-in point for a
// real LLM call, not built here).

export type SituationKey = 'century' | 'highestBreakSoFar' | 'decidingFrame' | 'whitewash' | 'tightFrame';

export interface DetectedSituation {
  key: SituationKey;
  priority: number; // higher wins when multiple situations are true at once
  values: Record<string, string | number>;
}

const TEMPLATES: Record<SituationKey, string[]> = {
  century: [
    '{player} compiles a century! {n} and counting',
    'Century break for {player} — {n} points in one visit',
    '{n}! {player} crosses the century mark',
  ],
  highestBreakSoFar: [
    "{player}'s break of {n} is the highest of the match so far",
    "That's a new match-high break for {player} — {n}",
    '{player} finds form with a break of {n}, the best of the match',
    'A break of {n} from {player} sets the new match high',
  ],
  decidingFrame: [
    'This is the decider — winner takes the match',
    'Everything comes down to this final frame',
    'Winner takes it all in this deciding frame',
  ],
  whitewash: [
    '{player} is well clear here, {n} ahead',
    'One-way traffic — {player} leads by {n}',
    '{player} in control, {n} points to the good',
  ],
  tightFrame: [
    'Nothing in it — {player} edges ahead by just {n}',
    'As tight as it gets, {n} the difference',
    '{player} holds the slenderest of leads, {n} points',
  ],
};

// Deterministic pseudo-index: same seed always yields the same phrasing (testable),
// but different seeds (e.g. current total points scored this frame) spread across
// the pool, so repeated matches don't always read identically.
function seededIndex(seed: number, length: number): number {
  const h = Math.abs(Math.sin(seed + 1) * 10000);
  return Math.floor((h - Math.floor(h)) * length);
}

export function pickInsight(situations: DetectedSituation[], seed: number): string | null {
  if (situations.length === 0) return null;
  const top = [...situations].sort((a, b) => b.priority - a.priority)[0];
  const pool = TEMPLATES[top.key];
  const idx = seededIndex(seed, pool.length);
  let text = pool[idx];
  for (const [key, value] of Object.entries(top.values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

// Reads only real, already-tracked GameState fields — nothing here is invented.
export function detectGameSituations(
  state: GameState,
  sessionBest: number,
  playerNames: [string, string],
): DetectedSituation[] {
  const snap = state.current;
  const results: DetectedSituation[] = [];

  if (snap.currentBreak >= 100) {
    results.push({ key: 'century', priority: 100, values: { player: playerNames[snap.currentPlayer], n: snap.currentBreak } });
  } else if (snap.currentBreak > 0 && snap.currentBreak > sessionBest) {
    results.push({ key: 'highestBreakSoFar', priority: 80, values: { player: playerNames[snap.currentPlayer], n: snap.currentBreak } });
  }

  if (!snap.isFrameOver && state.config.bestOf !== null && state.config.bestOf < 9999) {
    const target = Math.ceil(state.config.bestOf / 2);
    if (state.framesWon[0] === target - 1 && state.framesWon[1] === target - 1) {
      results.push({ key: 'decidingFrame', priority: 90, values: {} });
    }
  }

  const diff = snap.scores[0] - snap.scores[1];
  const totalScored = snap.scores[0] + snap.scores[1];
  if (!snap.isFrameOver && Math.abs(diff) >= 30) {
    const leader: 0 | 1 = diff > 0 ? 0 : 1;
    results.push({ key: 'whitewash', priority: 50, values: { player: playerNames[leader], n: Math.abs(diff) } });
  } else if (!snap.isFrameOver && diff !== 0 && Math.abs(diff) <= 10 && totalScored > 20) {
    const leader: 0 | 1 = diff > 0 ? 0 : 1;
    results.push({ key: 'tightFrame', priority: 40, values: { player: playerNames[leader], n: Math.abs(diff) } });
  }

  return results;
}
