import { useState, useCallback } from 'react';

export type BallType = 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';
export type GamePhase = 'reds' | 'colors';
export type AwaitingType = 'red' | 'color';

export const BALL_VALUES: Record<BallType, number> = {
  red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7,
};

export const BALL_COLORS: Record<BallType, string> = {
  red: '#CC0000',
  yellow: '#E8C000',
  green: '#1A7A1A',
  brown: '#7B3F00',
  blue: '#0044CC',
  pink: '#E8457A',
  black: '#222222',
};

export const COLORS_SEQUENCE: BallType[] = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
const COLORS_TOTAL = 27; // 2+3+4+5+6+7

function calcPointsOnTable(
  phase: GamePhase,
  redsRemaining: number,
  awaiting: AwaitingType,
  colorsRemaining: BallType[],
): number {
  if (phase === 'colors') {
    return colorsRemaining.reduce((s, b) => s + BALL_VALUES[b], 0);
  }
  // reds phase: each remaining red + best subsequent color (7) + final 6 colors (27)
  if (awaiting === 'color') {
    // red already potted; player about to pot a color that will return
    return 7 + redsRemaining * 8 + COLORS_TOTAL;
  }
  return redsRemaining * 8 + COLORS_TOTAL;
}

export interface FrameSnapshot {
  scores: [number, number];
  currentBreak: number;
  currentPlayer: 0 | 1;
  pointsOnTable: number;
  phase: GamePhase;
  redsRemaining: number;
  awaiting: AwaitingType;
  colorsRemaining: BallType[];
  isFrameOver: boolean;
  freeBallActive: boolean;
  // Respotted-black-on-tie (see docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, section 7.7)
  awaitingRespotChoice: boolean;
  respottedBlackActive: boolean;
  respotForfeitWinner: 0 | 1 | null;
  // Break-architecture chain (see docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, section 3.1) —
  // the sequence of balls potted in the live break, cleared on a miss/foul, preserved through
  // a concede (a conceded break is still historically what was built).
  breakBalls: BallType[];
}

export interface MatchConfig {
  id: string;
  player1Name: string;
  player2Name: string;
  numberOfReds: number;
  bestOf: number | null; // null = single frame
}

export interface FrameResult {
  frameNumber: number;
  winner: 0 | 1;
  scores: [number, number];
  highestBreak: [number, number];
}

export interface GameState {
  config: MatchConfig;
  framesWon: [number, number];
  frameResults: FrameResult[];
  frameNumber: number;
  current: FrameSnapshot;
  history: FrameSnapshot[];
  frameHighestBreak: [number, number];
  isMatchOver: boolean;
  matchWinner: 0 | 1 | null;
}

function makeInitialFrame(numberOfReds: number, currentPlayer: 0 | 1): FrameSnapshot {
  return {
    scores: [0, 0],
    currentBreak: 0,
    currentPlayer,
    pointsOnTable: numberOfReds * 8 + COLORS_TOTAL,
    phase: 'reds',
    redsRemaining: numberOfReds,
    awaiting: 'red',
    colorsRemaining: [...COLORS_SEQUENCE],
    isFrameOver: false,
    freeBallActive: false,
    awaitingRespotChoice: false,
    respottedBlackActive: false,
    respotForfeitWinner: null,
    breakBalls: [],
  };
}

export function getSnookersNeeded(scores: [number, number], pointsOnTable: number): [number, number] {
  // [snookers P0 needs, snookers P1 needs]
  // A player needs snookers when they trail by more than pointsOnTable
  const need0 = Math.max(0, Math.ceil((scores[1] - scores[0] - pointsOnTable) / 7));
  const need1 = Math.max(0, Math.ceil((scores[0] - scores[1] - pointsOnTable) / 7));
  return [need0, need1];
}

// Shared tie-check for when colorsRemaining empties out (via a clean pot, a free ball,
// or a foul-with-a-potted-colour) — a level score respots the black instead of ending
// the frame. Single source of truth so every caller resolves this identically.
function resolveColoursExhausted(scores: [number, number]): { isFrameOver: boolean; awaitingRespotChoice: boolean } {
  if (scores[0] === scores[1]) return { isFrameOver: false, awaitingRespotChoice: true };
  return { isFrameOver: true, awaitingRespotChoice: false };
}

// Given the snapshot as it stood immediately before a shot, and the single non-red ball
// reported as potted alongside a foul (or null/omitted), decides whether that ball leaves
// the table permanently or is respotted. Reds are handled separately via the
// redsAccidentallyPotted count (reds are fungible — there is no "wrong red").
// Derives the on-ball/wrong-ball distinction automatically instead of requiring it as
// separate input: during the reds phase a colour always respots regardless (real rule —
// colours never leave the table until all reds are gone); during the colours phase (or a
// free ball taken within it) only the actual on-ball (colorsRemaining[0]) can leave the
// table, so naming any other ball is definitionally "wrong ball" and always respots.
function resolveFoulPotOutcome(
  preShotSnap: FrameSnapshot,
  pottedBall: BallType | null,
): { removesFromTable: boolean } {
  if (!pottedBall || pottedBall === 'red' || preShotSnap.phase === 'reds') {
    return { removesFromTable: false };
  }
  return { removesFromTable: pottedBall === preShotSnap.colorsRemaining[0] };
}

export function getAvailableBalls(snap: FrameSnapshot): BallType[] {
  if (snap.isFrameOver) return [];
  if (snap.freeBallActive) return [...COLORS_SEQUENCE, 'red'] as BallType[];
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0, 1);
  // Safety guard: if somehow awaiting=red but no reds left, treat as awaiting color
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}

export function useSnookerGame(config: MatchConfig, initialState?: GameState) {
  const [state, setState] = useState<GameState>(() => initialState ?? {
    config,
    framesWon: [0, 0],
    frameResults: [],
    frameNumber: 1,
    current: makeInitialFrame(config.numberOfReds, 0),
    history: [],
    frameHighestBreak: [0, 0],
    isMatchOver: false,
    matchWinner: null,
  });

  const potBall = useCallback((ball: BallType) => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first (chooseRespotBreaker)
      if (snap.freeBallActive) return prev; // must use applyFreeBall instead
      const available = getAvailableBalls(snap);
      if (!available.includes(ball)) return prev;

      const points = BALL_VALUES[ball];
      const newScores: [number, number] = [snap.scores[0], snap.scores[1]];
      newScores[snap.currentPlayer] += points;
      const newBreak = snap.currentBreak + points;

      let newPhase: GamePhase = snap.phase;
      let newRedsRemaining = snap.redsRemaining;
      let newAwaiting: AwaitingType = snap.awaiting;
      let newColorsRemaining = [...snap.colorsRemaining];
      let isFrameOver = false;
      let awaitingRespotChoice = false;

      if (snap.phase === 'reds') {
        if (ball === 'red') {
          newRedsRemaining = snap.redsRemaining - 1;
          newAwaiting = 'color';
        } else {
          // Color potted after red — goes back to table
          if (snap.redsRemaining === 0) {
            // All reds gone; transition to colors phase
            newPhase = 'colors';
            newColorsRemaining = [...COLORS_SEQUENCE];
          } else {
            newAwaiting = 'red';
          }
        }
      } else {
        // Colors phase — balls stay off
        newColorsRemaining = newColorsRemaining.slice(1);
        if (newColorsRemaining.length === 0) {
          ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
        }
      }

      const newHighest: [number, number] = [prev.frameHighestBreak[0], prev.frameHighestBreak[1]];
      if (newBreak > newHighest[snap.currentPlayer]) {
        newHighest[snap.currentPlayer] = newBreak;
      }

      const newSnapshot: FrameSnapshot = {
        scores: newScores,
        currentBreak: newBreak,
        currentPlayer: snap.currentPlayer,
        pointsOnTable: isFrameOver
          ? 0
          : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
        phase: newPhase,
        redsRemaining: newRedsRemaining,
        awaiting: newAwaiting,
        colorsRemaining: newColorsRemaining,
        isFrameOver,
        freeBallActive: false,
        awaitingRespotChoice,
        respottedBlackActive: snap.respottedBlackActive,
        respotForfeitWinner: snap.respotForfeitWinner,
        breakBalls: [...snap.breakBalls, ball],
      };

      return {
        ...prev,
        current: newSnapshot,
        history: [...prev.history, snap],
        frameHighestBreak: newHighest,
      };
    });
  }, []);

  const endVisit = useCallback(() => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first

      let newPhase: GamePhase = snap.phase;
      let newAwaiting: AwaitingType = snap.awaiting;
      let newColorsRemaining = [...snap.colorsRemaining];

      if (snap.phase === 'reds') {
        if (snap.redsRemaining === 0 && snap.awaiting === 'color') {
          // Last red was potted but player missed the color — incoming player starts colors phase
          newPhase = 'colors';
          newColorsRemaining = [...COLORS_SEQUENCE];
        } else {
          // Normal miss after potting a red — incoming player pots a red next
          newAwaiting = 'red';
        }
      }

      const newSnapshot: FrameSnapshot = {
        ...snap,
        currentPlayer: snap.currentPlayer === 0 ? 1 : 0,
        currentBreak: 0,
        freeBallActive: false,
        phase: newPhase,
        awaiting: newAwaiting,
        colorsRemaining: newColorsRemaining,
        pointsOnTable: calcPointsOnTable(newPhase, snap.redsRemaining, newAwaiting, newColorsRemaining),
        breakBalls: [],
      };
      return { ...prev, current: newSnapshot, history: [...prev.history, snap] };
    });
  }, []);

  const applyFoul = useCallback((foulValue: number, opponentPlays: boolean, redsAccidentallyPotted: number = 0, colourPotted: BallType | null = null) => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first
      const opponent: 0 | 1 = snap.currentPlayer === 0 ? 1 : 0;
      const newScores: [number, number] = [snap.scores[0], snap.scores[1]];
      newScores[opponent] += foulValue;

      if (snap.respottedBlackActive) {
        // Any foul during the sudden-death respotted-black shootout forfeits the frame outright.
        return {
          ...prev,
          current: { ...snap, scores: newScores, currentBreak: 0, isFrameOver: true, respotForfeitWinner: opponent, breakBalls: [] },
          history: [...prev.history, snap],
        };
      }

      const newPlayer: 0 | 1 = opponentPlays ? opponent : snap.currentPlayer;
      // Awaiting state is NEVER changed by a foul — it reflects the last legal pot.
      // If a red was potted before the foul (awaiting='color'), the next player still
      // owes a colour. Only reset if awaiting was already 'red'.
      const newAwaiting: AwaitingType = snap.awaiting;
      // Reds accidentally potted on a foul stay off the table (reds are never respotted).
      const newRedsRemaining = Math.max(0, snap.redsRemaining - redsAccidentallyPotted);

      // A colour potted alongside the foul (e.g. the on-colour + an in-off cue ball):
      // no score for the striker either way, but if it was the true on-ball it still
      // leaves the table permanently, same as a clean pot would have.
      const { removesFromTable } = resolveFoulPotOutcome(snap, colourPotted);
      let newColorsRemaining = snap.colorsRemaining;
      let isFrameOver = false;
      let awaitingRespotChoice = false;
      if (removesFromTable) {
        newColorsRemaining = snap.colorsRemaining.slice(1);
        if (newColorsRemaining.length === 0) {
          ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
        }
      }

      const newSnapshot: FrameSnapshot = {
        ...snap,
        scores: newScores,
        currentBreak: 0,
        currentPlayer: newPlayer,
        awaiting: newAwaiting,
        redsRemaining: newRedsRemaining,
        colorsRemaining: newColorsRemaining,
        pointsOnTable: isFrameOver
          ? 0
          : calcPointsOnTable(snap.phase, newRedsRemaining, newAwaiting, newColorsRemaining),
        isFrameOver,
        awaitingRespotChoice,
        freeBallActive: false,
        breakBalls: [],
      };

      return { ...prev, current: newSnapshot, history: [...prev.history, snap] };
    });
  }, []);

  // Converts the most recently potted ball (the top of the live break's breakBalls
  // chain) into a foul outcome in one atomic step — for when a player already tapped a
  // ball button and only then realizes the cue ball also went in on that same shot.
  // Mathematically equivalent to "undo this one pot, then re-enter it as a foul," but
  // as a single history step. Only ever operates on the single most recent shot; an
  // earlier shot must be reached via undo() first, then converted.
  const convertLastPotToFoul = useCallback((foulValue: number, opponentPlays: boolean) => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      if (prev.current.awaitingRespotChoice) return prev; // must choose a breaker first
      if (prev.current.breakBalls.length === 0 || prev.history.length === 0) return prev;
      const preShot = prev.history[prev.history.length - 1];

      const pottedBall = prev.current.breakBalls[prev.current.breakBalls.length - 1];
      const opponent: 0 | 1 = preShot.currentPlayer === 0 ? 1 : 0;
      const newScores: [number, number] = [preShot.scores[0], preShot.scores[1]];
      newScores[opponent] += foulValue;

      if (preShot.respottedBlackActive) {
        return {
          ...prev,
          current: { ...preShot, scores: newScores, currentBreak: 0, isFrameOver: true, respotForfeitWinner: opponent, breakBalls: [] },
          history: [...prev.history, prev.current],
        };
      }

      const newPlayer: 0 | 1 = opponentPlays ? opponent : preShot.currentPlayer;
      const newAwaiting: AwaitingType = preShot.awaiting;
      const redsAccidentallyPotted = pottedBall === 'red' ? 1 : 0;
      const newRedsRemaining = Math.max(0, preShot.redsRemaining - redsAccidentallyPotted);
      const colourPotted = pottedBall === 'red' ? null : pottedBall;
      const { removesFromTable } = resolveFoulPotOutcome(preShot, colourPotted);

      let newColorsRemaining = preShot.colorsRemaining;
      let isFrameOver = false;
      let awaitingRespotChoice = false;
      if (removesFromTable) {
        newColorsRemaining = preShot.colorsRemaining.slice(1);
        if (newColorsRemaining.length === 0) {
          ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
        }
      }

      const newSnapshot: FrameSnapshot = {
        ...preShot,
        scores: newScores,
        currentBreak: 0,
        currentPlayer: newPlayer,
        awaiting: newAwaiting,
        redsRemaining: newRedsRemaining,
        colorsRemaining: newColorsRemaining,
        pointsOnTable: isFrameOver
          ? 0
          : calcPointsOnTable(preShot.phase, newRedsRemaining, newAwaiting, newColorsRemaining),
        isFrameOver,
        awaitingRespotChoice,
        freeBallActive: false,
        breakBalls: [],
      };

      // Pushes the pre-conversion (wrongly-scored) snapshot onto history, not preShot —
      // one undo() after a conversion reverts to "the pot as it was mis-scored" (in case
      // the conversion itself was the mistake); a second undo() reaches the true pre-shot
      // state. Consistent with every other action, which always pushes prev.current.
      return { ...prev, current: newSnapshot, history: [...prev.history, prev.current] };
    });
  }, []);

  // Called when multiple reds are potted on one shot — after the first red has already
  // been recorded via potBall('red'), each additional red increments score & redsRemaining.
  const addExtraRed = useCallback(() => {
    setState(prev => {
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first
      if (snap.freeBallActive) return prev;
      if (snap.phase !== 'reds' || snap.awaiting !== 'color' || snap.redsRemaining === 0) return prev;

      const newScores: [number, number] = [snap.scores[0], snap.scores[1]];
      newScores[snap.currentPlayer] += 1;
      const newBreak = snap.currentBreak + 1;
      const newRedsRemaining = snap.redsRemaining - 1;

      const newHighest: [number, number] = [prev.frameHighestBreak[0], prev.frameHighestBreak[1]];
      if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

      const newSnap: FrameSnapshot = {
        ...snap,
        scores: newScores,
        currentBreak: newBreak,
        redsRemaining: newRedsRemaining,
        pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, snap.awaiting, snap.colorsRemaining),
        freeBallActive: false,
        breakBalls: [...snap.breakBalls, 'red'],
      };

      return { ...prev, current: newSnap, history: [...prev.history, snap], frameHighestBreak: newHighest };
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (prev.history.length === 0) return prev;
      const newHistory = [...prev.history];
      const previousSnapshot = newHistory.pop()!;
      return { ...prev, current: previousSnapshot, history: newHistory };
    });
  }, []);

  const concede = useCallback(() => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first
      return {
        ...prev,
        current: { ...snap, isFrameOver: true, freeBallActive: false },
        history: [...prev.history, snap],
      };
    });
  }, []);

  const declareFreesBall = useCallback(() => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first
      return {
        ...prev,
        current: { ...snap, freeBallActive: true },
        history: [...prev.history, snap],
      };
    });
  }, []);

  const applyFreeBall = useCallback((nominatedBall: BallType) => {
    setState(prev => {
      if (prev.isMatchOver || prev.current.isFrameOver) return prev;
      const snap = prev.current;
      if (snap.awaitingRespotChoice) return prev; // must choose a breaker first
      if (!snap.freeBallActive) return prev;

      let scoreValue: number;
      let newPhase: GamePhase = snap.phase;
      let newRedsRemaining = snap.redsRemaining;
      let newAwaiting: AwaitingType = snap.awaiting;
      let newColorsRemaining = [...snap.colorsRemaining];

      if (snap.phase === 'reds') {
        if (snap.awaiting === 'red') {
          // On-ball is red: always scores 1; redsRemaining unchanged (free ball respotted)
          scoreValue = 1;
          newAwaiting = 'color';
        } else {
          // On-ball is a colour: scores the nominated ball's value; respotted
          scoreValue = BALL_VALUES[nominatedBall];
          if (snap.redsRemaining === 0) {
            newPhase = 'colors';
            newColorsRemaining = [...COLORS_SEQUENCE];
          } else {
            newAwaiting = 'red';
          }
        }
      } else {
        // Colors phase: always scores the on-color's value.
        // If the player nominated the actual on-ball they are potting it directly —
        // the sequence advances. Otherwise the nominated ball respots and the
        // on-ball stays next (colorsRemaining unchanged).
        scoreValue = BALL_VALUES[newColorsRemaining[0]];
        if (nominatedBall === newColorsRemaining[0]) {
          newColorsRemaining = newColorsRemaining.slice(1);
        }
      }

      const newScores: [number, number] = [snap.scores[0], snap.scores[1]];
      newScores[snap.currentPlayer] += scoreValue;
      const newBreak = snap.currentBreak + scoreValue;

      let isFrameOver = false;
      let awaitingRespotChoice = false;
      if (newPhase === 'colors' && newColorsRemaining.length === 0) {
        ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
      }

      const newHighest: [number, number] = [prev.frameHighestBreak[0], prev.frameHighestBreak[1]];
      if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

      const newSnapshot: FrameSnapshot = {
        ...snap,
        scores: newScores,
        currentBreak: newBreak,
        phase: newPhase,
        redsRemaining: newRedsRemaining,
        awaiting: newAwaiting,
        colorsRemaining: newColorsRemaining,
        awaitingRespotChoice,
        pointsOnTable: isFrameOver
          ? 0
          : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
        isFrameOver,
        freeBallActive: false,
        breakBalls: [...snap.breakBalls, nominatedBall],
      };

      return {
        ...prev,
        current: newSnapshot,
        history: [...prev.history, snap],
        frameHighestBreak: newHighest,
      };
    });
  }, []);

  // Chooses which player breaks the respotted black after a tied frame (see potBall's
  // colours-phase branch). Only valid during the awaitingRespotChoice window.
  const chooseRespotBreaker = useCallback((player: 0 | 1) => {
    setState(prev => {
      const snap = prev.current;
      if (!snap.awaitingRespotChoice) return prev;
      const newSnapshot: FrameSnapshot = {
        ...snap,
        currentPlayer: player,
        currentBreak: 0,
        awaitingRespotChoice: false,
        respottedBlackActive: true,
        phase: 'colors',
        colorsRemaining: ['black'],
        pointsOnTable: 7,
      };
      return { ...prev, current: newSnapshot, history: [...prev.history, snap] };
    });
  }, []);

  const confirmFrameEnd = useCallback((winner: 0 | 1, nextBreakerOverride?: 0 | 1) => {
    setState(prev => {
      const newFrameResult: FrameResult = {
        frameNumber: prev.frameNumber,
        winner,
        scores: [...prev.current.scores] as [number, number],
        highestBreak: [...prev.frameHighestBreak] as [number, number],
      };

      const newFramesWon: [number, number] = [prev.framesWon[0], prev.framesWon[1]];
      newFramesWon[winner]++;

      let isMatchOver = false;
      let matchWinner: 0 | 1 | null = null;

      if (prev.config.bestOf === null) {
        isMatchOver = true;
        matchWinner = winner;
      } else {
        const target = Math.ceil(prev.config.bestOf / 2);
        if (newFramesWon[0] >= target) { isMatchOver = true; matchWinner = 0; }
        else if (newFramesWon[1] >= target) { isMatchOver = true; matchWinner = 1; }
      }

      // Alternate who breaks each frame; override allowed (e.g. train mode always uses player 0)
      const nextBreaker: 0 | 1 = nextBreakerOverride !== undefined
        ? nextBreakerOverride
        : (prev.frameNumber % 2 === 0) ? 0 : 1;

      return {
        ...prev,
        framesWon: newFramesWon,
        frameResults: [...prev.frameResults, newFrameResult],
        frameNumber: prev.frameNumber + 1,
        current: makeInitialFrame(prev.config.numberOfReds, nextBreaker),
        history: [],
        frameHighestBreak: [0, 0],
        isMatchOver,
        matchWinner,
      };
    });
  }, []);

  return { state, potBall, addExtraRed, endVisit, applyFoul, convertLastPotToFoul, undo, concede, confirmFrameEnd, declareFreesBall, applyFreeBall, chooseRespotBreaker };
}
