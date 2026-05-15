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
