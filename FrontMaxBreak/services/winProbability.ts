// Live win-probability heuristic — a heuristic, not a promise. Documented formula so
// every number it produces is traceable, not hardcoded.
//
// Base: score-gap / points-remaining ratio, clamped to [-1, 1], mapped linearly onto
// a [1, 99] percentage centered at 50 (never exactly 0/100 while the frame is live,
// since anything can still happen with points on the table).
// Optional nudge: if a rivalry comeback rate (0-100, "how often has the trailing
// player in this rivalry come back to win from a deficit like this") is supplied,
// it can shift the estimate by at most 10 points toward the trailing player —
// capped so a single historical stat can never dominate the live score state.
export function computeWinProbability(
  scores: [number, number],
  pointsOnTable: number,
  isFrameOver: boolean,
  comebackRateForTrailingPlayer?: number,
): [number, number] {
  if (isFrameOver) {
    return scores[0] >= scores[1] ? [100, 0] : [0, 100];
  }

  const diff = scores[0] - scores[1];
  if (pointsOnTable <= 0) {
    return diff >= 0 ? [100, 0] : [0, 100];
  }

  const ratio = Math.max(-1, Math.min(1, diff / pointsOnTable));
  let p0 = 50 + ratio * 49; // keep 1 point of headroom at each extreme

  if (comebackRateForTrailingPlayer !== undefined) {
    const trailingPlayer: 0 | 1 = diff >= 0 ? 1 : 0;
    // Nudge magnitude: how far comebackRate sits from a neutral 50%, capped at 10 points.
    const nudge = Math.max(0, Math.min(10, (comebackRateForTrailingPlayer - 50) / 5));
    p0 = trailingPlayer === 1 ? p0 - nudge : p0 + nudge;
  }

  const clamped = Math.round(Math.max(1, Math.min(99, p0)));
  return [clamped, 100 - clamped];
}
