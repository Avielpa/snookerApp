// services/leaderboardService.ts
//
// Global best-break leaderboard — public read, no auth required (mirrors
// the backend's leaderboard_view, which uses AllowAny).
import axios from 'axios';
import { logger } from '../utils/logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

export interface LeaderboardEntry {
  username: string;
  reds_count: number;
  best_break: number;
  frame_time_seconds: number | null;
  is_verified: boolean;
  achieved_at: string;
}

/** Top entries for one reds_count. Empty array on any error — never throws. */
export async function fetchLeaderboard(redsCount: number): Promise<LeaderboardEntry[]> {
  try {
    const res = await axios.get(`${API_BASE}scoreboard/leaderboard/?reds_count=${redsCount}`);
    return res.data as LeaderboardEntry[];
  } catch (error: any) {
    logger.warn('[Leaderboard] fetchLeaderboard failed:', error?.message);
    return [];
  }
}
