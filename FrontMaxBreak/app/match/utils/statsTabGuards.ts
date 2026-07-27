// app/match/utils/statsTabGuards.ts

/**
 * Whether the "frames to win" section should render.
 * framesToWin defaults to 0 when a match's format isn't published yet (e.g. TBD matches) —
 * a bare `framesToWin &&` JSX guard would render that 0 as a stray text node and crash RN.
 */
export function hasFramesToWin(framesToWin?: number): boolean {
  return typeof framesToWin === 'number' && framesToWin > 0;
}
