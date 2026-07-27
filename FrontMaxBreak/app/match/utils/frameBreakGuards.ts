// app/match/utils/frameBreakGuards.ts

/**
 * Whether a single player's break value should render.
 * A break of 0 is a legitimate "no data" value, not falsy-safe for a bare `&&` JSX guard.
 */
export function hasBreak(value?: number): boolean {
  return typeof value === 'number' && value > 0;
}

/** Whether either player has a break worth showing. */
export function hasAnyBreak(a?: number, b?: number): boolean {
  return hasBreak(a) || hasBreak(b);
}
