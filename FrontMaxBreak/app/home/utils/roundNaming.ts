// app/home/utils/roundNaming.ts
//
// Generic fallback only. Home/Tour/Draw use sequential Round 1..N from
// bracketChain.ts. This helper is for a round with no label in that map.

export const getRoundName = (round: number | null | undefined): string => {
    if (round === null || round === undefined) return '';
    return `Round ${round}`;
};