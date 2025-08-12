// app/match/types.ts
/**
 * Type definitions for the Match Enhanced component system
 */

export interface MatchDetails {
  id: number;
  api_match_id: number | null;
  event_id: number | null;
  round: number | null;
  number: number | null;
  player1_id: number | null;
  player1_name: string | null;
  score1: number | null;
  player2_id: number | null;
  player2_name: string | null;
  score2: number | null;
  winner_id: number | null;
  status_code: number | null;
  status_display: string | null;
  scheduled_date: string | null;
  start_date: string | null;
  end_date: string | null;
  frame_scores: string | null;
  sessions_str: string | null;
  on_break: boolean | null;
  unfinished: boolean | null;
  live_url: string | null;
  details_url: string | null;
  note: string | null;
}

export interface EventDetails {
  ID: number;
  Name?: string | null;
  Season?: number | null;
}

export interface FrameScore {
  frameNumber: number;
  player1Score: number;
  player2Score: number;
  winner: 1 | 2 | null;
  isComplete: boolean;
  player1Break?: number; // Highest break by player 1 in this frame
  player2Break?: number; // Highest break by player 2 in this frame
}

export interface MatchStats {
  totalFrames: number;
  completedFrames: number;
  progress: number;
  timeElapsed?: string;
  estimatedTimeRemaining?: string;
  player1Score?: number;
  player2Score?: number;
  matchFormat?: number;
  framesToWin?: number;
  isLive?: boolean;
  isOnBreak?: boolean;
  isFinished?: boolean;
  roundName?: string;
}

export interface H2HData {
  Player1Wins: number;
  Player2Wins: number;
  totalMeetings: number;
  lastMeeting?: string;
  matches?: {
    date: string;
    event: string;
    winner: 1 | 2;
    score: string;
  }[];
}

export interface H2HResponse {
  Player1Wins?: number;
  Player2Wins?: number;
  lastMeeting?: string;
  Matches?: {
    date: string;
    event: string;
    winner: 1 | 2;
    score: string;
  }[];
}

export type TabType = 'overview' | 'frames' | 'stats' | 'h2h';