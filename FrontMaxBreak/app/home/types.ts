// app/home/types.ts
import { Ionicons } from '@expo/vector-icons';

export interface Match {
    id: number;
    api_match_id: number | null;
    event_id?: number;
    player1_id: number | null;
    player2_id: number | null;
    score1: number | null;
    score2: number | null;
    note: string | null;
    scheduled_date: string | null;
    start_date?: string | null;
    end_date?: string | null;
    on_break?: boolean | null;
    unfinished?: boolean | null;
    status_code: number | null;
    status_display?: string | null;
    winner_id: number | null;
    round?: number | null;
    number?: number | null;
    player1_name?: string;
    player2_name?: string;
    frame_scores?: string | null;
    sessions_str?: string | null;
    live_url?: string | null;
    details_url?: string | null;
}

export interface EventDetails { 
    ID: number; 
    Name?: string | null; 
}

export type MatchCategory = 'livePlaying' | 'onBreak' | 'upcoming' | 'finished';

export interface MatchListItem extends Match { 
    type: 'match'; 
    matchCategory: MatchCategory; 
}

export interface StatusHeaderListItem { 
    type: 'statusHeader'; 
    title: string; 
    iconName: keyof typeof Ionicons.glyphMap; 
    id: string; 
}

export interface RoundHeaderListItem { 
    type: 'roundHeader'; 
    roundName: string; 
    id: string; 
}

export type ListItem = MatchListItem | StatusHeaderListItem | RoundHeaderListItem;
export type ActiveFilterType = MatchCategory | 'all';
export type IoniconName = keyof typeof Ionicons.glyphMap;

export interface FilterButton {
    label: string;
    value: ActiveFilterType;
    icon: keyof typeof Ionicons.glyphMap;
}