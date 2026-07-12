import { FrameSnapshot } from '../hooks/useSnookerGame';

// Shot-by-shot score differential (player 0 minus player 1) across the live frame.
// Pure derived read of state.history + state.current — no new state, recalculated
// on every render, never stored or stale.
export function computeMomentumSeries(current: FrameSnapshot, history: FrameSnapshot[]): number[] {
  return [...history, current].map(snap => snap.scores[0] - snap.scores[1]);
}
