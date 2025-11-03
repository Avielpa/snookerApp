// app/home/utils/roundNaming.ts

export const getRoundName = (round: number | null | undefined): string => {
    if (round === null || round === undefined) return '';
    if (round >= 15) return 'Final';
    if (round === 14) return 'Semi-Finals';
    if (round === 13) return 'Quarter-Finals';
    if (round >= 8) return `Round ${16 - round + 1}`;
    if (round === 7) return 'Round 1 (L32)';
    return `Round ${round}`;
};