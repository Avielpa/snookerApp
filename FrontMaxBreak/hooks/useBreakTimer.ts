// FrontMaxBreak/hooks/useBreakTimer.ts
//
// Tracks each individual break (one player's scoring visit) in Match/Unlimited
// mode: starts on the first ball potted in a visit, freezes and emits a
// "completed break" event when the visit ends (player switch, a foul-forced
// forfeit, or the frame ending). Pure observer of GameState fields passed in
// by the caller (game.tsx) — never touches useSnookerGame's reducer, same
// discipline as hooks/useFrameTimer.ts.
import { useEffect, useState } from 'react';

export interface BreakTimerInput {
  currentPlayer: 0 | 1;
  currentBreak: number;
  breakBallsLength: number;
  isFrameOver: boolean;
  frameNumber: number;
}

export interface CompletedBreak {
  player: 0 | 1;
  breakValue: number;
  durationSeconds: number;
  completedAt: number;
}

export interface BreakTimerState {
  player: 0 | 1;
  startedAt: number | null;
  frozenElapsedMs: number | null;
  lastKnownBreakValue: number;
  completedBreak: CompletedBreak | null;
  frameNumber: number;
}

const INITIAL_STATE: BreakTimerState = {
  player: 0,
  startedAt: null,
  frozenElapsedMs: null,
  lastKnownBreakValue: 0,
  completedBreak: null,
  frameNumber: 1,
};

/**
 * The reducer can reset currentBreak to 0 in the same transition that ends a
 * break (foul-forced-forfeit paths in useSnookerGame.ts), while a normal
 * frame-winning pot leaves currentBreak intact. Math.max over the live input
 * and the last value we saw while this player was still on strike is correct
 * either way, without branching on which reducer path caused the transition.
 */
function finalizeBreak(prev: BreakTimerState, input: BreakTimerInput, now: number): CompletedBreak | null {
  if (prev.startedAt === null) return null;
  const breakValue = Math.max(input.currentBreak, prev.lastKnownBreakValue);
  if (breakValue <= 0) return null;
  return {
    player: prev.player,
    breakValue,
    durationSeconds: Math.floor((now - prev.startedAt) / 1000),
    completedAt: now,
  };
}

/** Pure state transition, fully unit-testable without mounting React. */
export function computeBreakTimerState(
  input: BreakTimerInput,
  prev: BreakTimerState,
  now: number,
): BreakTimerState {
  // Frame-boundary reset — mirrors computeFrameTimerState in useFrameTimer.ts.
  // Must run BEFORE the player-switch/frame-over/same-player branches below,
  // otherwise the "same player breaks first in the new frame" case would fall
  // into the same-player-continuing branch and carry over stale startedAt/
  // frozenElapsedMs from the frame that just ended. By the time frameNumber
  // changes, the previous frame's break has already been finalized via the
  // isFrameOver-freeze branch (confirmFrameEnd in useSnookerGame.ts only
  // increments frameNumber in the same transition that resets isFrameOver to
  // false for the new frame — the freeze branch already ran on the render
  // where isFrameOver first became true), so no completed-break event is
  // lost or needs finalizing here.
  if (input.frameNumber !== prev.frameNumber) {
    return {
      player: input.currentPlayer,
      startedAt: input.breakBallsLength > 0 ? now : null,
      frozenElapsedMs: null,
      lastKnownBreakValue: input.currentBreak,
      completedBreak: prev.completedBreak,
      frameNumber: input.frameNumber,
    };
  }
  if (input.currentPlayer !== prev.player) {
    const completed = finalizeBreak(prev, input, now);
    return {
      player: input.currentPlayer,
      startedAt: input.breakBallsLength > 0 ? now : null,
      frozenElapsedMs: null,
      lastKnownBreakValue: input.currentBreak,
      completedBreak: completed ?? prev.completedBreak,
      frameNumber: input.frameNumber,
    };
  }
  if (input.isFrameOver) {
    if (prev.frozenElapsedMs !== null) return prev; // already frozen, don't re-finalize
    const completed = finalizeBreak(prev, input, now);
    return {
      ...prev,
      frozenElapsedMs: prev.startedAt !== null ? now - prev.startedAt : 0,
      lastKnownBreakValue: Math.max(input.currentBreak, prev.lastKnownBreakValue),
      completedBreak: completed ?? prev.completedBreak,
    };
  }
  const nextStartedAt = prev.startedAt === null && input.breakBallsLength > 0 ? now : prev.startedAt;
  if (nextStartedAt === prev.startedAt && input.currentBreak === prev.lastKnownBreakValue) return prev;
  return { ...prev, startedAt: nextStartedAt, lastKnownBreakValue: input.currentBreak };
}

/**
 * The single most important safety gate in this feature: decides whether a
 * completed break should ever be submitted to the backend (both the new
 * personal-analytics endpoint and the existing best-break leaderboard).
 * Extracted as a pure function specifically so the "never attribute the
 * other local player's break" rule (the exact bug class fixed 2026-09-14 for
 * Train mode's predecessor feature) has a real, automated test — not just a
 * manual on-device check.
 */
export function shouldSubmitCompletedBreak(
  completedBreak: CompletedBreak | null,
  mePlayerIndex: 0 | 1 | null,
  isTrainMode: boolean,
): boolean {
  if (isTrainMode) return false; // Train mode has its own, separate best-break path
  if (mePlayerIndex === null) return false; // "me" was never confirmed — never attribute a break to anyone
  if (!completedBreak) return false;
  if (completedBreak.breakValue <= 0) return false;
  return completedBreak.player === mePlayerIndex;
}

export function useBreakTimer(input: BreakTimerInput): { elapsedSeconds: number; completedBreak: CompletedBreak | null } {
  const [state, setState] = useState<BreakTimerState>(INITIAL_STATE);
  const [, forceTick] = useState(0);

  useEffect(() => {
    setState(prev => computeBreakTimerState(input, prev, Date.now()));
  }, [input.currentPlayer, input.currentBreak, input.breakBallsLength, input.isFrameOver, input.frameNumber]);

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = state.frozenElapsedMs !== null
    ? state.frozenElapsedMs
    : state.startedAt !== null
      ? Date.now() - state.startedAt
      : 0;
  return { elapsedSeconds: Math.floor(elapsedMs / 1000), completedBreak: state.completedBreak };
}
