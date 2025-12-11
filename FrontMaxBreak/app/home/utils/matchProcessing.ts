// app/home/utils/matchProcessing.ts
import { logger } from '../../../utils/logger';
import { Match, MatchCategory, MatchListItem, ListItem, IoniconName } from '../types';
import { getRoundName } from './roundNaming';
import { ICONS } from './icons';

export const processMatchesForList = (matches: Match[]): ListItem[] => {
    logger.log(`[HomeScreen processMatches] Processing ${matches?.length || 0} matches...`);

    if (!matches || matches.length === 0) return [];

    // DEDUPLICATION FIX: Remove duplicate matches by api_match_id OR live_url/details_url
    // When duplicates exist, keep the one with higher priority status and round
    const uniqueMatches = new Map<string, Match>();

    matches.forEach((match: Match) => {
        // Create a unique key based on api_match_id, live_url, or details_url
        // This handles cases where the same physical match has different api_match_ids
        let matchKey: string;

        if (match.live_url && match.live_url.trim() !== '') {
            // Prefer live_url as the unique identifier
            matchKey = `url:${match.live_url}`;
        } else if (match.details_url && match.details_url.trim() !== '') {
            // Fall back to details_url
            matchKey = `url:${match.details_url}`;
        } else if (match.api_match_id) {
            // Fall back to api_match_id
            matchKey = `id:${match.api_match_id}`;
        } else {
            // Last resort: use internal database ID
            matchKey = `db:${match.id}`;
        }

        const existing = uniqueMatches.get(matchKey);

        if (!existing) {
            uniqueMatches.set(matchKey, match);
        } else {
            // Determine which match to keep based on priority:
            // 1. Live playing (status_code 1) has highest priority
            // 2. On break (status_code 2)
            // 3. Upcoming (status_code 0)
            // 4. Finished (status_code 3) has lowest priority
            // Also prefer higher round numbers (later stages of tournament)

            const currentStatus = match.status_code ?? -1;
            const existingStatus = existing.status_code ?? -1;

            const currentRound = match.round ?? -1;
            const existingRound = existing.round ?? -1;

            // Status priority: 1 (live) > 2 (break) > 0 (upcoming) > 3 (finished)
            const getStatusPriority = (status: number): number => {
                if (status === 1) return 4; // live - highest
                if (status === 2) return 3; // on break
                if (status === 0) return 2; // upcoming
                if (status === 3) return 1; // finished - lowest
                return 0;
            };

            const currentPriority = getStatusPriority(currentStatus);
            const existingPriority = getStatusPriority(existingStatus);

            // SIMPLE FIX: Higher round wins, OR if same round then higher status wins
            const shouldReplace =
                (currentRound > existingRound) ||
                (currentRound === existingRound && currentPriority > existingPriority);

            if (shouldReplace) {
                logger.log(`[MatchProcessing] 🔄 Replacing duplicate [${matchKey}]: ` +
                    `Old(api_id=${existing.api_match_id}, status=${existingStatus}, round=${existingRound}) -> ` +
                    `New(api_id=${match.api_match_id}, status=${currentStatus}, round=${currentRound})`);
                uniqueMatches.set(matchKey, match);
            } else {
                logger.log(`[MatchProcessing] ⏭️  Keeping [${matchKey}]: ` +
                    `Keep(api_id=${existing.api_match_id}, status=${existingStatus}, round=${existingRound}) over ` +
                    `Skip(api_id=${match.api_match_id}, status=${currentStatus}, round=${currentRound})`);
            }
        }
    });

    const deduplicatedMatches = Array.from(uniqueMatches.values());

    if (deduplicatedMatches.length < matches.length) {
        logger.warn(`[MatchProcessing] ⚠️  Removed ${matches.length - deduplicatedMatches.length} duplicate matches`);
    }

    const categories: Record<MatchCategory, { title: string; icon: IoniconName; matches: MatchListItem[] }> = {
        livePlaying: { title: 'Playing Now', icon: ICONS.livePlaying, matches: [] },
        onBreak: { title: 'On Break', icon: ICONS.onBreak, matches: [] },
        upcoming: { title: 'Upcoming', icon: ICONS.upcoming, matches: [] },
        finished: { title: 'Results', icon: ICONS.finished, matches: [] }
    };

    deduplicatedMatches.forEach((match: Match) => {
        let cat: MatchCategory = 'upcoming';
        const status = match.status_code;
        
        if (status === 1) cat = 'livePlaying';
        else if (status === 2) cat = 'onBreak';
        else if (status === 3) cat = 'finished';
        else if (status === 0) cat = 'upcoming';
        
        // DEBUG: Log finished matches during processing
        if (status === 3 && match.score1 != null && match.score2 != null) {
            logger.log(`[MatchProcessing] 📊 Processing finished match:`, {
                api_match_id: match.api_match_id,
                player1_name: match.player1_name,
                player2_name: match.player2_name,
                score1: match.score1,
                score2: match.score2,
                winner_id: match.winner_id,
                player1_id: match.player1_id,
                player2_id: match.player2_id,
                processing_step: 'Raw from API before item creation'
            });
        }
        
        const matchItem: MatchListItem = { ...match, type: 'match', matchCategory: cat };
        
        if (categories[cat]) {
            categories[cat].matches.push(matchItem);
        } else {
            categories.upcoming.matches.push({ ...matchItem, matchCategory: 'upcoming' });
        }
    });

    // Sorting functions
    const sortByRoundThenDate = (a: Match, b: Match): number => {
        const rA = a.round ?? 999;
        const rB = b.round ?? 999;
        if (rA !== rB) return rA - rB;
        
        const dA = new Date(a.scheduled_date || 0).getTime();
        const dB = new Date(b.scheduled_date || 0).getTime();
        if (dA !== dB) return dA - dB;
        
        return (a.number ?? 999) - (b.number ?? 999);
    };

    const sortByRoundThenEndDateDesc = (a: Match, b: Match): number => {
        const rA = a.round ?? -1;
        const rB = b.round ?? -1;
        if (rA !== rB) return rB - rA;
        
        const dA = new Date(a.end_date || a.start_date || a.scheduled_date || 0).getTime();
        const dB = new Date(b.end_date || b.start_date || b.scheduled_date || 0).getTime();
        if (dA !== dB) return dB - dA;
        
        return (a.number ?? 999) - (b.number ?? 999);
    };

    categories.livePlaying.matches.sort(sortByRoundThenDate);
    categories.onBreak.matches.sort(sortByRoundThenDate);
    categories.upcoming.matches.sort(sortByRoundThenDate);
    categories.finished.matches.sort(sortByRoundThenEndDateDesc);

    const processedList: ListItem[] = [];
    const categoryOrder: MatchCategory[] = ['livePlaying', 'onBreak', 'upcoming', 'finished'];
    let roundHeaderIndex = 0;

    categoryOrder.forEach((key: MatchCategory) => {
        const category = categories[key];
        
        if (category.matches.length > 0) {
            processedList.push({
                type: 'statusHeader',
                title: category.title,
                iconName: category.icon,
                id: `statusHeader-${key}`
            });
            
            let currentRound: number | null | undefined = -999;
            
            category.matches.forEach((match: MatchListItem) => {
                const matchRound = match.round ?? null;
                
                if (matchRound !== currentRound) {
                    currentRound = matchRound;
                    const roundName = getRoundName(currentRound);
                    const uniqueRoundHeaderId = `roundHeader-${key}-${currentRound ?? 'unknown'}-${roundHeaderIndex++}`;
                    
                    processedList.push({
                        type: 'roundHeader',
                        roundName: roundName,
                        id: uniqueRoundHeaderId
                    });
                }
                
                processedList.push(match);
            });
        }
    });
    
    return processedList;
};