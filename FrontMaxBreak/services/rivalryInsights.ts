import { StoredMatch, RivalryGroup } from './gameStorage';

// Extends groupByRivalry()'s existing aggregation with a small set of derived
// tendencies — does not modify groupByRivalry itself, so every existing caller
// (history.tsx, rivalry.tsx) is unaffected until a screen explicitly imports this.
//
// Every tendency requires a minimum sample size before it's surfaced at all, so it
// never asserts a pattern from a single session.

export interface RivalryTendency {
  text: string;
  strength: number; // sample size backing this tendency, for future confidence display
}

const MIN_SAMPLE = 3;

function isRelevantDecisiveMatch(m: StoredMatch, p1: string, p2: string): boolean {
  if (!m.isComplete || m.frameResults.length === 0) return false;
  if (m.mode && m.mode !== 'match') return false; // exclude train/unlimited — bestOf-based deciders only
  if (m.bestOf === null || m.bestOf < 3) return false; // single-frame matches have no "decider" concept
  const names = [m.player1Name.trim().toLowerCase(), m.player2Name.trim().toLowerCase()];
  return names.includes(p1.toLowerCase()) && names.includes(p2.toLowerCase());
}

// Deciding-frame record: of the matches that actually went the distance to a winner-takes-all
// final frame, who has won more of those deciders?
export function computeRivalryTendencies(matches: StoredMatch[], rivalry: RivalryGroup): RivalryTendency[] {
  const tendencies: RivalryTendency[] = [];

  const relevant = matches.filter(m => isRelevantDecisiveMatch(m, rivalry.player1, rivalry.player2));
  if (relevant.length < MIN_SAMPLE) return tendencies;

  let player1Deciders = 0;
  let player2Deciders = 0;

  for (const m of relevant) {
    const target = Math.ceil((m.bestOf as number) / 2);
    // A "decider" is a match whose final frame result was needed to reach the target —
    // i.e. going into the last recorded frame, neither player had already reached it.
    const framesBeforeLast = m.frameResults.length - 1;
    if (framesBeforeLast < 0) continue;
    let p1WinsBeforeLast = 0;
    let p2WinsBeforeLast = 0;
    const isP1 = m.player1Name.trim().toLowerCase() === rivalry.player1.toLowerCase();
    for (let i = 0; i < framesBeforeLast; i++) {
      const winner = m.frameResults[i].winner;
      const rivalryP1Won = isP1 ? winner === 0 : winner === 1;
      if (rivalryP1Won) p1WinsBeforeLast++; else p2WinsBeforeLast++;
    }
    const wasDecider = p1WinsBeforeLast < target && p2WinsBeforeLast < target
      && p1WinsBeforeLast === target - 1 && p2WinsBeforeLast === target - 1;
    if (!wasDecider) continue;

    const lastWinner = m.frameResults[m.frameResults.length - 1].winner;
    const rivalryP1WonDecider = isP1 ? lastWinner === 0 : lastWinner === 1;
    if (rivalryP1WonDecider) player1Deciders++; else player2Deciders++;
  }

  const totalDeciders = player1Deciders + player2Deciders;
  if (totalDeciders >= MIN_SAMPLE && player1Deciders !== player2Deciders) {
    const leaderName = player1Deciders > player2Deciders ? rivalry.player1 : rivalry.player2;
    const record = player1Deciders > player2Deciders
      ? `${player1Deciders}-${player2Deciders}`
      : `${player2Deciders}-${player1Deciders}`;
    tendencies.push({
      text: `Deciding frames are ${record} in ${leaderName}'s favour`,
      strength: totalDeciders,
    });
  }

  return tendencies;
}
