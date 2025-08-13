// utils/playerUtils.ts
import { MATCH_CONSTANTS } from './constants';

/**
 * Formats player name with fallback for missing or unknown players
 * @param playerName - The player's name (can be null/undefined)
 * @param playerId - The player's ID (can be null/undefined)
 * @returns Formatted player name string
 */
export function formatPlayerName(playerName: string | null | undefined, playerId: number | null | undefined): string {
  // If we have a player name, use it
  if (playerName?.trim()) {
    return playerName.trim();
  }
  
  // If no name but valid player ID (not the unknown player ID), show player ID
  if (playerId && playerId !== MATCH_CONSTANTS.UNKNOWN_PLAYER_ID) {
    return `P${playerId}`;
  }
  
  // Fallback for unknown/missing players
  return MATCH_CONSTANTS.PLAYER_NAME_FALLBACK;
}

/**
 * Gets player display names for a match
 * @param match - Match object with player data
 * @returns Object with formatted player names
 */
export function getMatchPlayerNames(match: {
  player1_name?: string | null;
  player1_id?: number | null;
  player2_name?: string | null;  
  player2_id?: number | null;
}) {
  return {
    player1Name: formatPlayerName(match.player1_name, match.player1_id),
    player2Name: formatPlayerName(match.player2_name, match.player2_id),
  };
}

/**
 * Validates if score data is complete and valid
 * @param score1 - First player's score
 * @param score2 - Second player's score
 * @returns Boolean indicating if scores are valid
 */
export function areScoresValid(score1: unknown, score2: unknown): boolean {
  return (
    score1 !== null && score1 !== undefined && 
    score2 !== null && score2 !== undefined &&
    typeof score1 === 'number' && typeof score2 === 'number' &&
    !isNaN(score1) && !isNaN(score2)
  );
}

/**
 * Normalizes scores to ensure they're non-negative numbers
 * @param score - Raw score value
 * @returns Normalized score (minimum 0)
 */
export function normalizeScore(score: number | null | undefined): number {
  if (typeof score === 'number' && !isNaN(score)) {
    return Math.max(0, score);
  }
  return 0;
}