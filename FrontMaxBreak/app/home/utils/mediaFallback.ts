// app/home/utils/mediaFallback.ts
import { MATCH_CONSTANTS } from '../../../utils/constants';

interface MinimalMatchItem {
    type: string;
    player1_id: number | null;
    player2_id: number | null;
}

/**
 * True when the home screen has nothing worth showing: either no matches at all,
 * or every match present has at least one undecided (TBD) player.
 */
export function shouldRedirectToMedia(listData: MinimalMatchItem[]): boolean {
    const matchItems = listData.filter(item => item.type === 'match');
    const hasDecidedMatch = matchItems.some(
        item => item.player1_id !== MATCH_CONSTANTS.UNKNOWN_PLAYER_ID ||
            item.player2_id !== MATCH_CONSTANTS.UNKNOWN_PLAYER_ID
    );
    return !hasDecidedMatch;
}
