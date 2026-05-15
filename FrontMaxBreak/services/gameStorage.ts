import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameState } from '../hooks/useSnookerGame';

export interface FrameResult {
  frameNumber: number;
  winner: 0 | 1;
  scores: [number, number];
  highestBreak: [number, number];
}

export interface StoredMatch {
  id: string;
  player1Name: string;
  player2Name: string;
  numberOfReds: number;
  bestOf: number | null;
  startedAt: string;
  completedAt?: string;
  isComplete: boolean;
  frameResults: FrameResult[];
  framesWon: [number, number];
  mode?: 'match' | 'train' | 'unlimited';
}

export interface TrainingStats {
  totalBreaks: number;
  highestBreak: number;
  avgBreak: number;
  breaksOver25: number;
  breaksOver50: number;
  sessions: number;
}

export interface PlayerStats {
  totalFramesPlayed: number;
  totalFramesWon: number;
  winRate: number;
  highestBreak: number;
  avgBreak: number;
  totalMatches: number;
  totalMatchesWon: number;
}

const MATCH_INDEX_KEY = 'sb_match_index';
const MATCH_PREFIX = 'sb_match_';
const DRAFT_KEY = 'sb_draft';

export interface GameDraft {
  params: {
    id: string;
    player1: string;
    player2: string;
    numberOfReds: string;
    bestOf: string;
  };
  state: GameState;
  savedAt: string;
}

export async function saveDraft(draft: GameDraft): Promise<void> {
  await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export async function loadDraft(): Promise<GameDraft | null> {
  const raw = await AsyncStorage.getItem(DRAFT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(DRAFT_KEY);
}

export function generateMatchId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function getIndex(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(MATCH_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveMatch(match: StoredMatch): Promise<void> {
  await AsyncStorage.setItem(MATCH_PREFIX + match.id, JSON.stringify(match));
  const index = await getIndex();
  if (!index.includes(match.id)) {
    await AsyncStorage.setItem(MATCH_INDEX_KEY, JSON.stringify([match.id, ...index]));
  }
}

export async function loadMatch(id: string): Promise<StoredMatch | null> {
  const raw = await AsyncStorage.getItem(MATCH_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export async function loadAllMatches(): Promise<StoredMatch[]> {
  const index = await getIndex();
  const results = await Promise.all(index.map(id => loadMatch(id)));
  return results.filter((m): m is StoredMatch => m !== null);
}

export async function deleteMatch(id: string): Promise<void> {
  await AsyncStorage.removeItem(MATCH_PREFIX + id);
  const index = await getIndex();
  await AsyncStorage.setItem(MATCH_INDEX_KEY, JSON.stringify(index.filter(i => i !== id)));
}

export async function clearAllMatches(): Promise<void> {
  const index = await getIndex();
  await Promise.all(index.map(id => AsyncStorage.removeItem(MATCH_PREFIX + id)));
  await AsyncStorage.removeItem(MATCH_INDEX_KEY);
}

export function computeTrainingStats(matches: StoredMatch[], playerName: string): TrainingStats {
  const sessions = matches.filter(
    m => m.mode === 'train' && m.isComplete && m.player1Name === playerName,
  );
  let totalBreaks = 0;
  let highestBreak = 0;
  let breakSum = 0;
  let breaksOver25 = 0;
  let breaksOver50 = 0;
  for (const s of sessions) {
    for (const fr of s.frameResults) {
      const b = fr.highestBreak[0];
      totalBreaks++;
      if (b > highestBreak) highestBreak = b;
      breakSum += b;
      if (b >= 25) breaksOver25++;
      if (b >= 50) breaksOver50++;
    }
  }
  return {
    totalBreaks,
    highestBreak,
    avgBreak: totalBreaks > 0 ? Math.round(breakSum / totalBreaks) : 0,
    breaksOver25,
    breaksOver50,
    sessions: sessions.length,
  };
}

// ── Rivalry grouping ────────────────────────────────────────────────────────

export interface RivalryGroup {
  key: string;                    // normalized "a|b" (alphabetical, lowercase)
  player1: string;                // display name (from earliest match)
  player2: string;
  matches: StoredMatch[];         // newest first
  lastPlayedAt: string;
  matchesWon: [number, number];   // [p1 wins, p2 wins]
  framesWon: [number, number];
  highestBreak: [number, number];
  avgBreak: [number, number];
  avgPointsPerFrame: [number, number];
  totalSessions: number;
}

export function groupByRivalry(matches: StoredMatch[]): RivalryGroup[] {
  const relevant = matches.filter(
    m => (!m.mode || m.mode === 'match' || m.mode === 'unlimited') &&
      m.player1Name?.trim() && m.player2Name?.trim(),
  );

  // Build groups — sort names alphabetically to make the key order-independent
  const groupMap = new Map<string, StoredMatch[]>();
  const displayNames = new Map<string, [string, string]>(); // earliest-seen display names

  // Process oldest-first so displayNames captures the first session
  const chronological = [...relevant].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  );

  for (const m of chronological) {
    const a = m.player1Name.trim().toLowerCase();
    const b = m.player2Name.trim().toLowerCase();
    const [ka, kb] = a < b ? [a, b] : [b, a];
    const key = `${ka}|${kb}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
      // Preserve original casing from the first session
      displayNames.set(key, a < b ? [m.player1Name.trim(), m.player2Name.trim()] : [m.player2Name.trim(), m.player1Name.trim()]);
    }
    groupMap.get(key)!.push(m);
  }

  const result: RivalryGroup[] = [];

  for (const [key, group] of groupMap.entries()) {
    const [p1, p2] = displayNames.get(key)!;
    const sorted = [...group].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    let mw1 = 0, mw2 = 0, fw1 = 0, fw2 = 0, hb1 = 0, hb2 = 0;
    let abSum1 = 0, abCount1 = 0, abSum2 = 0, abCount2 = 0;
    let ptsSum1 = 0, ptsSum2 = 0, frameCount = 0;

    for (const m of group) {
      const isP1 = m.player1Name.trim().toLowerCase() === p1.toLowerCase();
      const [myIdx, oppIdx] = isP1 ? [0, 1] : [1, 0];

      fw1 += m.framesWon[myIdx];
      fw2 += m.framesWon[oppIdx];
      if (m.framesWon[myIdx] > m.framesWon[oppIdx]) mw1++;
      else if (m.framesWon[oppIdx] > m.framesWon[myIdx]) mw2++;

      for (const fr of m.frameResults) {
        if (fr.highestBreak[myIdx] > hb1) hb1 = fr.highestBreak[myIdx];
        if (fr.highestBreak[oppIdx] > hb2) hb2 = fr.highestBreak[oppIdx];
        const b1 = fr.highestBreak[myIdx];
        const b2 = fr.highestBreak[oppIdx];
        if (b1 > 0) { abSum1 += b1; abCount1++; }
        if (b2 > 0) { abSum2 += b2; abCount2++; }
        ptsSum1 += fr.scores[myIdx];
        ptsSum2 += fr.scores[oppIdx];
        frameCount++;
      }
    }

    result.push({
      key, player1: p1, player2: p2,
      matches: sorted,
      lastPlayedAt: sorted[0].startedAt,
      matchesWon: [mw1, mw2],
      framesWon: [fw1, fw2],
      highestBreak: [hb1, hb2],
      avgBreak: [
        abCount1 > 0 ? Math.round(abSum1 / abCount1) : 0,
        abCount2 > 0 ? Math.round(abSum2 / abCount2) : 0,
      ],
      avgPointsPerFrame: [
        frameCount > 0 ? Math.round(ptsSum1 / frameCount) : 0,
        frameCount > 0 ? Math.round(ptsSum2 / frameCount) : 0,
      ],
      totalSessions: group.length,
    });
  }

  return result.sort(
    (a, b) => new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
  );
}

export function computePlayerStats(matches: StoredMatch[], playerName: string): PlayerStats {
  const relevant = matches.filter(
    m => m.isComplete && (!m.mode || m.mode === 'match' || m.mode === 'unlimited') &&
      (m.player1Name === playerName || m.player2Name === playerName),
  );

  let totalFramesPlayed = 0;
  let totalFramesWon = 0;
  let highestBreak = 0;
  let totalBreakSum = 0;
  let totalBreakCount = 0;
  let totalMatchesWon = 0;

  for (const match of relevant) {
    const isP1 = match.player1Name === playerName;
    const pIdx = isP1 ? 0 : 1;

    totalFramesPlayed += match.frameResults.length;
    totalFramesWon += match.framesWon[pIdx];

    if (match.framesWon[pIdx] > match.framesWon[1 - pIdx]) {
      totalMatchesWon++;
    }

    for (const fr of match.frameResults) {
      const hb = fr.highestBreak[pIdx];
      if (hb > highestBreak) highestBreak = hb;
      if (hb > 0) {
        totalBreakSum += hb;
        totalBreakCount++;
      }
    }
  }

  return {
    totalFramesPlayed,
    totalFramesWon,
    winRate: totalFramesPlayed > 0 ? Math.round((totalFramesWon / totalFramesPlayed) * 100) : 0,
    highestBreak,
    avgBreak: totalBreakCount > 0 ? Math.round(totalBreakSum / totalBreakCount) : 0,
    totalMatches: relevant.length,
    totalMatchesWon,
  };
}
