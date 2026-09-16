// FrontMaxBreak/hooks/useFrameTimer.ts
//
// Tracks elapsed time for the current frame: starts on the first ball
// potted (any colour), freezes at frame end, resets on the next frame.
// Pure observer of GameState fields passed in by the caller (game.tsx) —
// never touches useSnookerGame's reducer.
import { useEffect, useRef, useState } from 'react';

export interface FrameTimerInput {
  frameNumber: number;
  isFrameOver: boolean;
  hasAnyPotThisFrame: boolean;
}

export interface FrameTimerState {
  frameNumber: number;
  startedAt: number | null;
  frozenElapsedMs: number | null;
}

const INITIAL_STATE: FrameTimerState = { frameNumber: 1, startedAt: null, frozenElapsedMs: null };

/** Pure state transition, fully unit-testable without mounting React. */
export function computeFrameTimerState(
  input: FrameTimerInput,
  prev: FrameTimerState,
  now: number,
): FrameTimerState {
  if (input.frameNumber !== prev.frameNumber) {
    return {
      frameNumber: input.frameNumber,
      startedAt: input.hasAnyPotThisFrame ? now : null,
      frozenElapsedMs: null,
    };
  }
  if (input.isFrameOver) {
    if (prev.frozenElapsedMs !== null) return prev;
    return { ...prev, frozenElapsedMs: prev.startedAt !== null ? now - prev.startedAt : 0 };
  }
  if (prev.startedAt === null && input.hasAnyPotThisFrame) {
    return { ...prev, startedAt: now };
  }
  return prev;
}

export function useFrameTimer(input: FrameTimerInput): { elapsedSeconds: number } {
  const stateRef = useRef<FrameTimerState>(INITIAL_STATE);
  const [, forceTick] = useState(0);

  useEffect(() => {
    stateRef.current = computeFrameTimerState(input, stateRef.current, Date.now());
  }, [input.frameNumber, input.isFrameOver, input.hasAnyPotThisFrame]);

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const s = stateRef.current;
  const elapsedMs = s.frozenElapsedMs !== null
    ? s.frozenElapsedMs
    : s.startedAt !== null
      ? Date.now() - s.startedAt
      : 0;
  return { elapsedSeconds: Math.floor(elapsedMs / 1000) };
}
