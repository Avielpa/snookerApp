// app/match/utils/frameScoreParser.ts
import { FrameScore } from '../types';
import { logger } from '../../../utils/logger';

/**
 * Parses HTML-formatted frame scores string into structured FrameScore objects
 * 
 * Expected format:
 * "Session 1:<br/>103-7 (68), 7-129 (129), 7-109 (96), 87-0 (86)<br/>90-0 (65), 31-65 (51), 1-82 (80), 0-78 (78)<br/>69-15 (68), 66-1 (66)<br/><br/>Session 2:<br/>27-70, 0-105 (105), 76-0 (76), 63-0 <br/>14-83 (66), 0-122 (122), 140-0 (140)<br/>90-0 (63), 7-126 (86), 56-57"
 */
export function parseFrameScoresString(frameScoresString: string): FrameScore[] {
  if (!frameScoresString || frameScoresString.trim() === '') {
    return [];
  }

  const frameScores: FrameScore[] = [];
  let frameNumber = 1;

  try {
    let cleanString = frameScoresString
      .replace(/<br\s*\/?>/gi, ',')       // <br> acts as frame group separator → comma
      .replace(/<[^>]*>/g, '')            // Remove other HTML tags
      .replace(/&nbsp;/g, ' ')            // Replace HTML entities
      // Remove session headers: "First session:", "Second session:", "Session 1:" etc.
      .replace(/\b(?:first|second|third|fourth)\s+session\s*:/gi, '')
      .replace(/session\s+\d+\s*:/gi, '')
      .trim();

    // Protect commas inside parentheses (e.g. "(MF 59, DJ 59)") by replacing them with semicolons
    // so the outer split(',') doesn't break mid-break-info
    cleanString = cleanString.replace(/\([^)]*\)/g, (match) => match.replace(/,/g, ';'));

    // Now split by comma — each token is one frame entry
    const frameEntries = cleanString.split(',').map(s => s.trim()).filter(s => s);

    for (const entry of frameEntries) {
      const parsedFrame = parseIndividualFrame(entry, frameNumber);
      if (parsedFrame) {
        frameScores.push(parsedFrame);
        frameNumber++;
      }
    }
  } catch (error) {
    logger.error('[frameScoreParser] Error parsing frame scores:', error);
    return [];
  }

  return frameScores;
}

/**
 * Parses a single frame score string
 * Examples: "103-7 (68)", "87-0 (86)", "56-57", "140-0 (140)"
 */
function parseIndividualFrame(frameString: string, frameNumber: number): FrameScore | null {
  if (!frameString || frameString.trim() === '') {
    return null;
  }

  try {
    // Extract the basic score (before any parentheses)
    const scoreMatch = frameString.match(/^(\d+)-(\d+)/);
    
    if (!scoreMatch) {
      return null;
    }

    const player1Score = parseInt(scoreMatch[1], 10);
    const player2Score = parseInt(scoreMatch[2], 10);

    // Determine winner
    let winner: 1 | 2 | null = null;
    if (player1Score > player2Score) {
      winner = 1;
    } else if (player2Score > player1Score) {
      winner = 2;
    }
    // If scores are equal, it might be an ongoing frame or error

    // Extract break information
    const breakInfo = extractBreakInfo(frameString);

    return {
      frameNumber,
      player1Score,
      player2Score,
      winner,
      isComplete: true, // Assume completed if we have scores
      ...breakInfo, // Add player1Break and/or player2Break if available
    };
  } catch (error) {
    logger.error(`[frameScoreParser] Error parsing individual frame "${frameString}":`, error);
    return null;
  }
}

/**
 * Extracts break information from frame strings (numbers in parentheses)
 * Example: "103-7 (68)" -> 68 is the highest break
 */
export function extractBreakInfo(frameString: string): { player1Break?: number; player2Break?: number } {
  const breakMatch = frameString.match(/\((\d+)\)/);
  if (breakMatch) {
    const breakValue = parseInt(breakMatch[1], 10);
    
    // Try to determine which player made the break based on the score
    const scoreMatch = frameString.match(/^(\d+)-(\d+)/);
    if (scoreMatch) {
      const player1Score = parseInt(scoreMatch[1], 10);
      const player2Score = parseInt(scoreMatch[2], 10);
      
      // The player with the higher score likely made the break
      if (player1Score > player2Score) {
        return { player1Break: breakValue };
      } else if (player2Score > player1Score) {
        return { player2Break: breakValue };
      }
    }
  }
  
  return {};
}