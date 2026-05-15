// services/scoreboardSyncService.ts
// Cloud sync for scoreboard matches.
// Uploads local matches to the server and merges server matches into local storage.
// Offline-first: AsyncStorage is always the source of truth; server is a backup/sync layer.

import axios from 'axios';
import { StoredMatch, loadAllMatches, saveMatch } from './gameStorage';
import { getAuthHeader } from './authService';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

async function authHeaders() {
  const header = await getAuthHeader();
  if (!header) throw new Error('Not logged in');
  return { Authorization: header };
}

/** Upload a single match to the server (upsert by match_id). Fire-and-forget friendly. */
export async function uploadMatch(match: StoredMatch): Promise<void> {
  const headers = await authHeaders();
  await axios.post(`${API_BASE}scoreboard/matches/`, { match_id: match.id, data: match }, { headers });
}

/** Download all matches from the server for the logged-in user. */
async function downloadMatches(): Promise<StoredMatch[]> {
  const headers = await authHeaders();
  const res = await axios.get(`${API_BASE}scoreboard/matches/`, { headers });
  return (res.data as Array<{ match_id: string; data: StoredMatch }>).map(r => r.data);
}

/**
 * Merge server matches into local storage.
 * For each server match:
 *  - if missing locally → save it
 *  - if present locally and server version is newer (by completedAt or startedAt) → overwrite
 */
async function mergeServerMatchesLocally(serverMatches: StoredMatch[]): Promise<void> {
  const local = await loadAllMatches();
  const localById = new Map(local.map(m => [m.id, m]));

  for (const sm of serverMatches) {
    const lm = localById.get(sm.id);
    if (!lm) {
      await saveMatch(sm);
      continue;
    }
    const serverTime = sm.completedAt ?? sm.startedAt;
    const localTime = lm.completedAt ?? lm.startedAt;
    if (serverTime > localTime) {
      await saveMatch(sm);
    }
  }
}

/** Upload all local matches to the server (used after login to push existing history). */
export async function syncAllLocal(): Promise<void> {
  const local = await loadAllMatches();
  for (const m of local) {
    try {
      await uploadMatch(m);
    } catch {
      // best-effort; skip failures silently
    }
  }
}

/**
 * Full sync: called once after login.
 * 1. Download server matches and merge into local.
 * 2. Upload all local matches to server.
 */
export async function syncOnLogin(): Promise<void> {
  try {
    const serverMatches = await downloadMatches();
    await mergeServerMatchesLocally(serverMatches);
  } catch {
    // download failed — still try upload
  }
  await syncAllLocal();
}
