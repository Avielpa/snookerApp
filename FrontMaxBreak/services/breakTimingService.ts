// FrontMaxBreak/services/breakTimingService.ts
//
// Personal break-duration analytics for Match/Unlimited mode. Fire-and-forget,
// login-gated (mirrors bestBreakService.ts's submitBreak) — guests never
// submit, and a network failure never interrupts play. No response value is
// consumed by callers today; this purely feeds a future personal-stats view.
import axios from 'axios';
import { isLoggedIn, getAuthHeader } from './authService';
import { logger } from '../utils/logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

export type BreakTimingMode = 'match' | 'unlimited';

/** Submit one completed break's duration. No-op for guests or on any error — never throws. */
export async function submitBreakTiming(breakValue: number, durationSeconds: number, mode: BreakTimingMode): Promise<void> {
  if (breakValue <= 0) return; // nothing to record
  const logged = await isLoggedIn();
  if (!logged) return;

  try {
    const header = await getAuthHeader();
    if (!header) return;
    await axios.post(
      `${API_BASE}scoreboard/break-timing/`,
      { break_value: breakValue, duration_seconds: durationSeconds, mode },
      { headers: { Authorization: header } },
    );
  } catch (error: any) {
    logger.warn('[BreakTiming] submitBreakTiming failed:', error?.message);
  }
}
