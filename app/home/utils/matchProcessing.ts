// app/home/utils/matchProcessing.ts
import { logger } from '../../../utils/logger';
import { Match, MatchCategory, MatchListItem, ListItem, IoniconName } from '../types';
import { getRoundName } from './roundNaming';
import { ICONS } from './icons';

export const processMatchesForList = (matches: Match[]): ListItem[] => {
    logger.log(`[HomeScreen processMatches] Processing ${matches?.length || 0} matches...`);
    
    if (!matches || matches.length === 0) return [];
    
    const categories: Record<MatchCategory, { title: string; icon: IoniconName; matches: MatchListItem[] }> = {
        livePlaying: { title: 'Playing Now', icon: ICONS.livePlaying, matches: [] },
        onBreak: { title: 'On Break', icon: ICONS.onBreak, matches: [] },
        upcoming: { title: 'Upcoming', icon: ICONS.upcoming, matches: [] },
        finished: { title: 'Results', icon: ICONS.finished, matches: [] }
    };

    matches.forEach((match: Match) => {
        let cat: MatchCategory = 'upcoming';
        const status = match.status_code;
        
        if (status === 1) cat = 'livePlaying';
        else if (status === 2) cat = 'onBreak';
        else if (status === 3) cat = 'finished';
        else if (status === 0) cat = 'upcoming';
        
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