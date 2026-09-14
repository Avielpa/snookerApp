// services/bestBreakService.ts
//
// Personal-best-break tracking, per reds_count (a 6-red best and a 15-red best
// are never comparable — see the backend PlayerBestBreak model's docstring).
// Login-gated: guests never submit or fetch (mirrors gameStorage's saveMatch
// gating — no account means nothing to attach a record to, and nothing to leak
// if they later sign in on a shared device).
import axios from 'axios';
import { isLoggedIn, getAuthHeader } from './authService';
import { logger } from '../utils/logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

export interface BestBreakRecord {
  reds_count: number;
  best_break: number;
  achieved_at: string;
}

export interface SubmitBreakResult extends BestBreakRecord {
  is_new_record: boolean;
}

// Pure, testable: decides whether a freshly-completed break is even worth a
// network call — mirrors the backend's own "only rises" rule so callers can
// skip the request entirely for an obviously-not-a-record value (e.g. 0, or a
// break lower than one already known client-side from a prior fetch).
export function isPotentialNewRecord(breakValue: number, knownBest: number | null): boolean {
  if (knownBest === null) return breakValue > 0;
  return breakValue > knownBest;
}

/** Submit a completed break. No-op (returns null) for guests — never throws. */
export async function submitBreak(redsCount: number, breakValue: number): Promise<SubmitBreakResult | null> {
  if (breakValue <= 0) return null; // nothing to record
  const logged = await isLoggedIn();
  if (!logged) return null;

  try {
    const header = await getAuthHeader();
    if (!header) return null;
    const res = await axios.post(
      `${API_BASE}scoreboard/best-break/`,
      { reds_count: redsCount, break: breakValue },
      { headers: { Authorization: header } }
    );
    return res.data as SubmitBreakResult;
  } catch (error: any) {
    logger.warn('[BestBreak] submitBreak failed:', error?.message);
    return null;
  }
}

/** Fetch all of the logged-in user's personal-best records. Empty array for guests or on error. */
export async function fetchBestBreaks(): Promise<BestBreakRecord[]> {
  const logged = await isLoggedIn();
  if (!logged) return [];

  try {
    const header = await getAuthHeader();
    if (!header) return [];
    const res = await axios.get(`${API_BASE}scoreboard/best-break/`, { headers: { Authorization: header } });
    return res.data as BestBreakRecord[];
  } catch (error: any) {
    logger.warn('[BestBreak] fetchBestBreaks failed:', error?.message);
    return [];
  }
}

/** Convenience: the record for one specific reds_count, or null if none/guest/error. */
export async function fetchBestBreakForRedsCount(redsCount: number): Promise<BestBreakRecord | null> {
  const all = await fetchBestBreaks();
  return all.find(r => r.reds_count === redsCount) ?? null;
}
