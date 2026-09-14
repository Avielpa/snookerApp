// services/shareService.ts
//
// "Challenge a friend" share flow — fired from FrameSummary right after a real
// completed break/frame/match, never on a random interrupt. Uses React Native's
// built-in Share module (no extra dependency). Every shared link carries its own
// UTM tag so this channel is measurable through the same GA4/Play-referrer
// pipeline already confirmed working for other outbound links — see
// docs/GROWTH_UTM_TRACKING.md.
import { Share } from 'react-native';
import { logger } from '../utils/logger';

const PLAY_STORE_PACKAGE = 'com.avielpahima.maxbreaksnooker';
const APPLE_APP_STORE_ID = '6762826909';

// Pure, testable: Play Store link with a UTM referrer scoped to this one channel
// (in-app share), distinct from every FB/growth-push link.
export function buildPlayStoreLink(): string {
  const inner = 'utm_source=app&utm_medium=referral&utm_campaign=frame_share';
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}&referrer=${encodeURIComponent(inner)}`;
}

// Pure, testable: Apple App Store link. No UTM param — the App Store has no
// referrer-based attribution equivalent to Google Play's, so this link is
// intentionally untagged (same reasoning as the FB posts' iOS link).
export function buildAppStoreLink(): string {
  return `https://apps.apple.com/app/id${APPLE_APP_STORE_ID}`;
}

// Both store links together, sharer platform-agnostic: the person receiving the
// share may be on either OS regardless of which one the sharer is using, so both
// are always included — same lesson as the FB posts that shipped Android-only
// at first and had to be edited in place after the gap was caught.
function buildStoreLinksBlock(): string {
  return `${buildPlayStoreLink()}\n📱 iPhone: ${buildAppStoreLink()}`;
}

// Pure, testable: message for a completed Train-mode break. `breakScore` is the
// raw points value from the just-finished break (snap.scores[0] at frame-over).
export function buildBreakShareMessage(breakScore: number): string {
  const scoreLabel = breakScore === 0 ? 'a break' : `a break of ${breakScore}`;
  return `🎱 I just made ${scoreLabel} on MaxBreak147! Think you can beat it?\n\n${buildStoreLinksBlock()}`;
}

// Pure, testable: message for a break that just beat the player's own personal
// best (server-confirmed via bestBreakService's is_new_record). Distinct copy
// from buildBreakShareMessage — leads with the achievement, not a generic brag,
// since a new record is the single best moment to prompt a share.
export function buildNewRecordShareMessage(breakScore: number): string {
  return `🏆 New personal best! I just made a break of ${breakScore} on MaxBreak147! Think you can beat it?\n\n${buildStoreLinksBlock()}`;
}

// Pure, testable: message for a completed Match/Unlimited-mode frame or match.
// `winnerName` and `scoreline` (e.g. "3–1") come straight from the same values
// FrameSummary already renders, so the shared text always matches what's on screen.
export function buildFrameShareMessage(winnerName: string, scoreline: string): string {
  const name = winnerName.trim() || 'I';
  return `🎱 ${name} won ${scoreline} on MaxBreak147 — track your own frames free:\n\n${buildStoreLinksBlock()}`;
}

// Opens the native share sheet. Sharing is a nice-to-have layered on top of a
// real result the player already has — a cancel or platform error here must
// never surface to the user or interrupt the scoreboard flow.
export async function shareResult(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch (error) {
    logger.warn('[Share] Failed to open share sheet:', (error as any)?.message);
  }
}
