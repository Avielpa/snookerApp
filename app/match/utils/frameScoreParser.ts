// app/match/utils/frameScoreParser.ts
import { FrameScore } from '../types';

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
    // Clean up HTML tags and normalize breaks
    let cleanString = frameScoresString
      .replace(/<br\s*\/?>/gi, '\n') // Replace <br> tags with newlines
      .replace(/<[^>]*>/g, '') // Remove any other HTML tags
      .replace(/&nbsp;/g, ' ') // Replace HTML entities
      .trim();

    // Check if the string contains session headers
    if (cleanString.includes('Session')) {
      // Handle session-based format
      const sessions = cleanString.split(/Session\s+\d+:/i).filter(s => s.trim());

      for (const session of sessions) {
        // Split session into lines and process each line
        const lines = session.split('\n').filter(line => line.trim());

        for (const line of lines) {
          // Split line by commas to get individual frame scores
          const frameScoresInLine = line.split(',').filter(score => score.trim());

          for (const frameScore of frameScoresInLine) {
            const parsedFrame = parseIndividualFrame(frameScore.trim(), frameNumber);
            if (parsedFrame) {
              frameScores.push(parsedFrame);
              frameNumber++;
            }
          }
        }
      }
    } else {
      // Handle simple comma-separated format (e.g., "8-73, 111-20 (69), 28-96 (65)")
      const frameScoresInLine = cleanString.split(',').filter(score => score.trim());
      
      for (const frameScore of frameScoresInLine) {
        const parsedFrame = parseIndividualFrame(frameScore.trim(), frameNumber);
        if (parsedFrame) {
          frameScores.push(parsedFrame);
          frameNumber++;
        }
      }
    }
  } catch (error) {
    console.error('[frameScoreParser] Error parsing frame scores:', error);
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
    console.error(`[frameScoreParser] Error parsing individual frame "${frameString}":`, error);
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