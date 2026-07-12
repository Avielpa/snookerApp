// Pure trigger decision for the century/maximum celebration overlay — fires once per
// frame the break crosses 100, not on every subsequent shot within that same break/frame.
export function shouldTriggerCentury(
  currentBreak: number,
  lastCelebratedFrame: number | null,
  frameNumber: number,
): boolean {
  return currentBreak >= 100 && lastCelebratedFrame !== frameNumber;
}
