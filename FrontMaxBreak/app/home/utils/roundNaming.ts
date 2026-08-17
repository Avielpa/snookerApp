// app/home/utils/roundNaming.ts
//
// Generic fallback label only — the real stage naming (Final/SF/QF/etc.)
// now comes from ../../tour/utils/bracketChain.ts's knockout-chain
// inference (used by matchProcessing.ts), which correctly ignores extra
// rounds (Wild Card Round etc.) instead of forcing them into a guessed
// label based purely on round number. This function only covers the two
// cases the chain can't: no round at all, and a round genuinely outside
// the knockout chain.

export const getRoundName = (round: number | null | undefined): string => {
    if (round === null || round === undefined) return '';
    return `Round ${round}`;
};