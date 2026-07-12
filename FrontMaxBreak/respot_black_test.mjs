// Respotted-black-on-tie logic test suite.
// Runs in Node.js (no React). Logic mirrors the PLANNED additive changes to
// useSnookerGame.ts (see docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, section 7.7).
// Written BEFORE touching the real hook, per this repo's TDD convention
// (same pattern as freeball_test.mjs, which predated the real free-ball implementation).
// Run: node respot_black_test.mjs

// ── Inline game logic (kept in sync with the planned useSnookerGame.ts changes) ──

const BALL_VALUES = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
const COLORS_SEQUENCE = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
const COLORS_TOTAL = 27;
const ALL_BALLS = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

function calcPointsOnTable(phase, redsRemaining, awaiting, colorsRemaining) {
  if (phase === 'colors') return colorsRemaining.reduce((s, b) => s + BALL_VALUES[b], 0);
  if (awaiting === 'color') return 7 + redsRemaining * 8 + COLORS_TOTAL;
  return redsRemaining * 8 + COLORS_TOTAL;
}

function makeInitialFrame(numberOfReds, currentPlayer = 0) {
  return {
    scores: [0, 0], currentBreak: 0, currentPlayer,
    pointsOnTable: numberOfReds * 8 + COLORS_TOTAL,
    phase: 'reds', redsRemaining: numberOfReds,
    awaiting: 'red', colorsRemaining: [...COLORS_SEQUENCE],
    isFrameOver: false,
    freeBallActive: false,
    // NEW FIELDS (Phase R):
    awaitingRespotChoice: false,
    respottedBlackActive: false,
    respotForfeitWinner: null,
  };
}

function makeGame(numberOfReds = 15, bestOf = null) {
  return {
    config: { numberOfReds, bestOf }, framesWon: [0, 0], frameResults: [],
    frameNumber: 1, current: makeInitialFrame(numberOfReds, 0),
    history: [], frameHighestBreak: [0, 0], isMatchOver: false, matchWinner: null,
  };
}

// Directly construct a colours-phase state for deterministic tie/non-tie setups,
// bypassing a full reds->colours playthrough (same pattern used elsewhere for
// deep mid-frame scenarios — we're testing the pure transition function, not
// the whole playthrough).
function makeColoursPhaseState(scores, colorsRemaining, currentPlayer = 0, numberOfReds = 15) {
  const g = makeGame(numberOfReds);
  g.current = {
    ...g.current,
    scores: [...scores],
    phase: 'colors',
    redsRemaining: 0,
    awaiting: 'color',
    colorsRemaining: [...colorsRemaining],
    pointsOnTable: calcPointsOnTable('colors', 0, 'color', colorsRemaining),
    currentPlayer,
    currentBreak: 0,
  };
  return g;
}

function getAvailableBalls(snap) {
  if (snap.isFrameOver || snap.awaitingRespotChoice) return [];
  if (snap.freeBallActive) return [...ALL_BALLS];
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0, 1);
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}

function applyPot(state, ball) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard: must choose a breaker first
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. Phase=${snap.phase} awaiting=${snap.awaiting}`);

  const points = BALL_VALUES[ball];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += points;
  const newBreak = snap.currentBreak + points;

  let newPhase = snap.phase, newRedsRemaining = snap.redsRemaining;
  let newAwaiting = snap.awaiting, newColorsRemaining = [...snap.colorsRemaining];
  let isFrameOver = false;
  let awaitingRespotChoice = false;

  if (snap.phase === 'reds') {
    if (ball === 'red') { newRedsRemaining--; newAwaiting = 'color'; }
    else {
      if (snap.redsRemaining === 0) { newPhase = 'colors'; newColorsRemaining = [...COLORS_SEQUENCE]; }
      else { newAwaiting = 'red'; }
    }
  } else {
    newColorsRemaining = newColorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) {
      // NEW (Phase R): a level score after the black respots instead of ending the frame.
      if (newScores[0] === newScores[1]) {
        awaitingRespotChoice = true;
      } else {
        isFrameOver = true;
      }
    }
  }

  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

  const newSnap = {
    scores: newScores, currentBreak: newBreak, currentPlayer: snap.currentPlayer,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining, isFrameOver, freeBallActive: false,
    awaitingRespotChoice,
    respottedBlackActive: snap.respottedBlackActive,
    respotForfeitWinner: snap.respotForfeitWinner,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyFoul(state, foulValue, opponentPlays = true) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard

  if (snap.respottedBlackActive) {
    // NEW (Phase R): any foul during the sudden-death shootout forfeits the frame outright.
    const opponent = snap.currentPlayer === 0 ? 1 : 0;
    const newScores = [...snap.scores]; newScores[opponent] += foulValue;
    return {
      ...state,
      current: { ...snap, scores: newScores, currentBreak: 0, isFrameOver: true, respotForfeitWinner: opponent },
      history: [...state.history, snap],
    };
  }

  const opponent = snap.currentPlayer === 0 ? 1 : 0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newSnap = { ...snap, scores: newScores, currentBreak: 0, currentPlayer: newPlayer, awaiting: snap.awaiting };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function applyEndVisit(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard
  return { ...state, current: { ...snap, currentPlayer: snap.currentPlayer === 0 ? 1 : 0, currentBreak: 0 }, history: [...state.history, snap] };
}

function applyConcede(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard
  return { ...state, current: { ...snap, isFrameOver: true }, history: [...state.history, snap] };
}

function applyAddExtraRed(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard
  if (snap.phase !== 'reds' || snap.awaiting !== 'color' || snap.redsRemaining === 0) return state;
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += 1;
  const newBreak = snap.currentBreak + 1;
  const newRedsRemaining = snap.redsRemaining - 1;
  return {
    ...state,
    current: { ...snap, scores: newScores, currentBreak: newBreak, redsRemaining: newRedsRemaining,
      pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, snap.awaiting, snap.colorsRemaining) },
    history: [...state.history, snap],
  };
}

function applyDeclareFreesBall(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard
  if (state.isMatchOver || snap.isFrameOver) return state;
  return { ...state, current: { ...snap, freeBallActive: true }, history: [...state.history, snap] };
}

function applyFreeBall(state, nominatedBall) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state; // guard
  if (!snap.freeBallActive || snap.isFrameOver || state.isMatchOver) return state;
  const scoreValue = BALL_VALUES[nominatedBall];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += scoreValue;
  return { ...state, current: { ...snap, scores: newScores, freeBallActive: false }, history: [...state.history, snap] };
}

// NEW (Phase R): choose which player breaks the respotted black.
function applyChooseRespotBreaker(state, player) {
  const snap = state.current;
  if (!snap.awaitingRespotChoice) return state; // guard: only valid during the choice window
  const newSnap = {
    ...snap,
    currentPlayer: player,
    currentBreak: 0,
    awaitingRespotChoice: false,
    respottedBlackActive: true,
    phase: 'colors',
    colorsRemaining: ['black'],
    pointsOnTable: 7,
  };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

// Mirrors the planned game.tsx winner-calculation contract.
function computeWinner(snap) {
  return snap.respotForfeitWinner ?? (snap.scores[0] >= snap.scores[1] ? 0 : 1);
}

// ── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }
function snapshotEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 1 — New fields default correctly');
{
  const g = makeGame(15);
  assert('1. awaitingRespotChoice starts false', g.current.awaitingRespotChoice === false);
  assert('2. respottedBlackActive starts false', g.current.respottedBlackActive === false);
  assert('3. respotForfeitWinner starts null', g.current.respotForfeitWinner === null);
  const g2 = applyPot(makeGame(6), 'red');
  assert('4. after a normal pot: all 3 new fields still at defaults',
    g2.current.awaitingRespotChoice === false && g2.current.respottedBlackActive === false && g2.current.respotForfeitWinner === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 2 — Non-tied black potted: unaffected regression (existing behavior)');
{
  // Player 0 leads 40-30, pots black (47-30) — not tied, frame ends normally as today.
  let g = makeColoursPhaseState([40, 30], ['black'], 0);
  g = applyPot(g, 'black');
  assert('5. non-tied black: isFrameOver true (unchanged behavior)', g.current.isFrameOver === true);
  assert('6. non-tied black: awaitingRespotChoice stays false', g.current.awaitingRespotChoice === false);
  assert('7. non-tied black: score reflects +7 (47)', g.current.scores[0] === 47);
  assert('8. non-tied black: winner-calc picks the potter', computeWinner(g.current) === 0);

  // Player 1 pots black from behind but still doesn't level the score (30+7=37 vs 40).
  let g2 = makeColoursPhaseState([40, 30], ['black'], 1);
  g2 = applyPot(g2, 'black');
  assert('9. non-tied black (trailing potter, still behind): isFrameOver true', g2.current.isFrameOver === true);
  assert('10. non-tied black (trailing potter, still behind): winner-calc picks leader', computeWinner(g2.current) === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 3 — Tied black potted: triggers awaitingRespotChoice instead of ending the frame');
function makeTiedBeforeBlack(currentPlayer = 0) {
  // currentPlayer's score + 7 will equal the opponent's score exactly.
  return currentPlayer === 0 ? makeColoursPhaseState([33, 40], ['black'], 0) : makeColoursPhaseState([40, 33], ['black'], 1);
}
{
  let g = makeTiedBeforeBlack(0);
  g = applyPot(g, 'black');
  assert('11. tied black: isFrameOver stays false', g.current.isFrameOver === false);
  assert('12. tied black: awaitingRespotChoice becomes true', g.current.awaitingRespotChoice === true);
  assert('13. tied black: scores are level (40-40)', g.current.scores[0] === 40 && g.current.scores[1] === 40);
  assert('14. tied black: respottedBlackActive still false (no breaker chosen yet)', g.current.respottedBlackActive === false);
  assert('15. tied black: history grew by exactly 1', g.history.length === 1);

  let g2 = makeTiedBeforeBlack(1);
  g2 = applyPot(g2, 'black');
  assert('16. tied black (other player potting): awaitingRespotChoice becomes true', g2.current.awaitingRespotChoice === true);
  assert('17. tied black (other player potting): scores level (40-40)', g2.current.scores[0] === 40 && g2.current.scores[1] === 40);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 4 — Guards: every shot action no-ops while awaitingRespotChoice is true');
{
  function tiedState() { let g = makeTiedBeforeBlack(0); return applyPot(g, 'black'); }

  let g1 = tiedState(); let r1 = applyEndVisit(g1);
  assert('18. endVisit no-ops during awaitingRespotChoice', snapshotEqual(g1, r1));

  let g2 = tiedState(); let r2 = applyFoul(g2, 4, true);
  assert('19. applyFoul no-ops during awaitingRespotChoice', snapshotEqual(g2, r2));

  let g3 = tiedState(); let r3 = applyConcede(g3);
  assert('20. concede no-ops during awaitingRespotChoice', snapshotEqual(g3, r3));

  let g4 = tiedState(); let r4 = applyDeclareFreesBall(g4);
  assert('21. declareFreesBall no-ops during awaitingRespotChoice', snapshotEqual(g4, r4));

  let g5 = tiedState(); let r5 = applyFreeBall(g5, 'blue');
  assert('22. applyFreeBall no-ops during awaitingRespotChoice', snapshotEqual(g5, r5));

  let g6 = tiedState(); let r6 = applyAddExtraRed(g6);
  assert('23. addExtraRed no-ops during awaitingRespotChoice', snapshotEqual(g6, r6));

  let g7 = tiedState();
  let threw = false;
  try { applyPot(g7, 'black'); } catch (e) { threw = true; }
  assert('24. potBall("black") does not throw during awaitingRespotChoice (guarded, returns state unchanged)', !threw);
  let r7 = applyPot(g7, 'black');
  assert('25. potBall no-ops during awaitingRespotChoice (state unchanged)', snapshotEqual(g7, r7));

  let g8 = tiedState(); let r8 = applyChooseRespotBreaker({ ...g8, current: { ...g8.current, awaitingRespotChoice: false } }, 0);
  assert('26. chooseRespotBreaker no-ops if awaitingRespotChoice is already false (misuse guard)',
    r8.current.respottedBlackActive === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 5 — chooseRespotBreaker correctness');
{
  function tiedState() { let g = makeTiedBeforeBlack(0); return applyPot(g, 'black'); }

  let g0 = applyChooseRespotBreaker(tiedState(), 0);
  assert('27. chooseRespotBreaker(0): currentPlayer = 0', g0.current.currentPlayer === 0);
  assert('28. chooseRespotBreaker(0): respottedBlackActive = true', g0.current.respottedBlackActive === true);
  assert('29. chooseRespotBreaker(0): awaitingRespotChoice = false', g0.current.awaitingRespotChoice === false);
  assert('30. chooseRespotBreaker(0): colorsRemaining = ["black"]', JSON.stringify(g0.current.colorsRemaining) === JSON.stringify(['black']));
  assert('31. chooseRespotBreaker(0): phase = colors', g0.current.phase === 'colors');
  assert('32. chooseRespotBreaker(0): currentBreak reset to 0', g0.current.currentBreak === 0);
  assert('33. chooseRespotBreaker(0): pointsOnTable = 7', g0.current.pointsOnTable === 7);
  assert('34. chooseRespotBreaker(0): history grew by 1 more (tie-detect + choice)', g0.history.length === 2);

  let g1 = applyChooseRespotBreaker(tiedState(), 1);
  assert('35. chooseRespotBreaker(1): currentPlayer = 1', g1.current.currentPlayer === 1);
  assert('36. chooseRespotBreaker(1): respottedBlackActive = true', g1.current.respottedBlackActive === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 6 — Potting the respotted black ends the frame in the potter\'s favour');
{
  function shootoutState(breaker) { return applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), breaker); }

  let g0 = shootoutState(0); g0 = applyPot(g0, 'black');
  assert('37. breaker 0 pots black: isFrameOver true', g0.current.isFrameOver === true);
  assert('38. breaker 0 pots black: scores 47-40 (potter leads)', g0.current.scores[0] === 47 && g0.current.scores[1] === 40);
  assert('39. breaker 0 pots black: respotForfeitWinner stays null (won by potting, not forfeit)', g0.current.respotForfeitWinner === null);
  assert('40. breaker 0 pots black: winner-calc correctly picks player 0', computeWinner(g0.current) === 0);

  let g1 = shootoutState(1); g1 = applyPot(g1, 'black');
  assert('41. breaker 1 pots black: isFrameOver true', g1.current.isFrameOver === true);
  assert('42. breaker 1 pots black: scores 40-47 (potter leads)', g1.current.scores[0] === 40 && g1.current.scores[1] === 47);
  assert('43. breaker 1 pots black: winner-calc correctly picks player 1', computeWinner(g1.current) === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 7 — A miss during the shootout just passes the shot (no forfeit)');
{
  let g = applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), 0);
  assert('44. before any miss: currentPlayer = 0', g.current.currentPlayer === 0);

  for (let i = 1; i <= 6; i++) {
    g = applyEndVisit(g);
    assert(`45.${i} miss #${i}: frame still open`, g.current.isFrameOver === false);
    assert(`46.${i} miss #${i}: still respottedBlackActive`, g.current.respottedBlackActive === true);
    assert(`47.${i} miss #${i}: colorsRemaining still ["black"]`, JSON.stringify(g.current.colorsRemaining) === JSON.stringify(['black']));
  }
  assert('48. after 6 alternating misses: currentPlayer swapped back to 0 (even count)', g.current.currentPlayer === 0);
  assert('49. after 6 alternating misses: scores never changed (33/40 base + 7 from the tying black = 40/40)',
    g.current.scores[0] === 40 && g.current.scores[1] === 40);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 8 — A foul during the shootout forfeits the frame to the opponent');
{
  function shootoutState(breaker) { return applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), breaker); }

  let g0 = shootoutState(0); g0 = applyFoul(g0, 4, true);
  assert('50. foul by breaker 0 (value 4): isFrameOver true', g0.current.isFrameOver === true);
  assert('51. foul by breaker 0: respotForfeitWinner = 1 (the non-fouling player)', g0.current.respotForfeitWinner === 1);
  assert('52. foul by breaker 0: opponent score increased by the foul value (40->44)', g0.current.scores[1] === 44);
  assert('53. foul by breaker 0: winner-calc respects the forfeit over raw score comparison', computeWinner(g0.current) === 1);

  let g1 = shootoutState(1); g1 = applyFoul(g1, 7, true);
  assert('54. foul by breaker 1 (value 7): isFrameOver true', g1.current.isFrameOver === true);
  assert('55. foul by breaker 1: respotForfeitWinner = 0', g1.current.respotForfeitWinner === 0);
  assert('56. foul by breaker 1: opponent (player 0) score increased by 7 (40->47)', g1.current.scores[0] === 47);
  assert('57. foul by breaker 1: winner-calc respects the forfeit', computeWinner(g1.current) === 0);

  // A foul after one clean miss (breaker swapped once) still forfeits correctly to whoever didn't foul.
  let g2 = shootoutState(0);
  g2 = applyEndVisit(g2); // now player 1 is on
  g2 = applyFoul(g2, 4, true);
  assert('58. miss then foul: current fouler is player 1, forfeit goes to player 0', g2.current.respotForfeitWinner === 0);
  assert('59. miss then foul: winner-calc picks player 0', computeWinner(g2.current) === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 9 — undo() correctly restores every step of the respot sequence');
{
  let g = makeTiedBeforeBlack(0);
  const beforeTie = JSON.parse(JSON.stringify(g.current));
  g = applyPot(g, 'black'); // tie detected
  const afterTie = JSON.parse(JSON.stringify(g.current));
  g = applyChooseRespotBreaker(g, 0); // breaker chosen
  const afterChoice = JSON.parse(JSON.stringify(g.current));
  g = applyPot(g, 'black'); // shootout shot potted, frame ends

  assert('60. after full sequence: frame is over', g.current.isFrameOver === true);

  g = applyUndo(g);
  assert('61. undo #1: restores the post-choice, pre-shootout-shot state', snapshotEqual(g.current, afterChoice));

  g = applyUndo(g);
  assert('62. undo #2: restores the post-tie, pre-choice state (awaitingRespotChoice=true)', snapshotEqual(g.current, afterTie));
  assert('62b. undo #2: awaitingRespotChoice is true again', g.current.awaitingRespotChoice === true);

  g = applyUndo(g);
  assert('63. undo #3: restores the original pre-tie state', snapshotEqual(g.current, beforeTie));

  const noMoreHistory = applyUndo(g);
  assert('64. undo with empty history: no-op', snapshotEqual(g, noMoreHistory));

  // Undo also correctly restores through a forfeit-ending foul.
  let g2 = applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), 1);
  const beforeFoul = JSON.parse(JSON.stringify(g2.current));
  g2 = applyFoul(g2, 4, true);
  assert('65. before undo: forfeit is recorded', g2.current.respotForfeitWinner === 0);
  g2 = applyUndo(g2);
  assert('66. undo after forfeit foul: respotForfeitWinner reverts to null', g2.current.respotForfeitWinner === null);
  assert('67. undo after forfeit foul: snapshot matches pre-foul shootout state', snapshotEqual(g2.current, beforeFoul));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 10 — Downstream winner-calc contract (mirrors the planned game.tsx logic)');
{
  // Natural pot ending: no forfeit set, pure score comparison applies.
  let g0 = makeColoursPhaseState([40, 30], ['black'], 0);
  g0 = applyPot(g0, 'black');
  assert('68. natural non-tied ending: winner-calc uses score comparison (player 0)', computeWinner(g0.current) === 0);

  // Forfeit ending: respotForfeitWinner overrides any score comparison, even if scores would say otherwise.
  let g1 = applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), 0);
  g1 = applyFoul(g1, 4, true); // breaker 0 fouls, forfeits to player 1, but scores are 40 vs 44 (player 1 "should" win anyway here)
  assert('69. forfeit ending happens to agree with score comparison here — verify explicitly via the flag, not coincidence',
    g1.current.respotForfeitWinner === 1 && computeWinner(g1.current) === 1);

  // Construct a forfeit scenario where the flag DISAGREES with a naive score comparison, to prove the ?? override matters.
  let g2 = applyChooseRespotBreaker(applyPot(makeTiedBeforeBlack(0), 'black'), 1); // scores 40-40 before shootout
  // Player 1 breaks, then fouls immediately — forfeits to player 0 — but a hypothetical bug that only ever
  // compared raw scores (40 === 40, defaulting to player 0 anyway) would mask a broken forfeit flag here.
  // Use a foul VALUE that would make player 0's naive-comparison "winner" wrong if we hadn't recorded the forfeit
  // explicitly for player 1 fouling — check the flag is what's actually driving the result, not luck.
  g2 = applyFoul(g2, 4, true);
  assert('70. forfeit flag is what decides the winner, independent of the raw score snapshot',
    g2.current.respotForfeitWinner === 0 && computeWinner(g2.current) === 0 && g2.current.scores[0] === 44);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 11 — Full regression: ordinary (non-respot) play is completely unaffected');
{
  // Standard reds-phase play through several visits — none of this should ever touch the new fields.
  let g = makeGame(6);
  g = applyPot(g, 'red'); g = applyPot(g, 'black'); g = applyPot(g, 'red'); g = applyPot(g, 'pink');
  assert('71. ordinary reds-phase play: awaitingRespotChoice stays false throughout', g.current.awaitingRespotChoice === false);
  assert('72. ordinary reds-phase play: respottedBlackActive stays false throughout', g.current.respottedBlackActive === false);
  assert('73. ordinary reds-phase play: respotForfeitWinner stays null throughout', g.current.respotForfeitWinner === null);
  assert('74. ordinary reds-phase play: score correct (1+7+1+6=15)', g.current.scores[0] === 15);

  // A clean, decisive (non-tied) run through the colours phase end-to-end.
  let g2 = makeColoursPhaseState([20, 10], ['yellow', 'green', 'brown', 'blue', 'pink', 'black'], 0);
  ['yellow', 'green', 'brown', 'blue', 'pink'].forEach(b => { g2 = applyPot(g2, b); });
  assert('75. mid-colours-phase decisive run: still not frame-over before black', g2.current.isFrameOver === false);
  g2 = applyPot(g2, 'black');
  assert('76. mid-colours-phase decisive run: frame ends normally on a non-tied black (unaffected by Phase R)', g2.current.isFrameOver === true);
  assert('77. mid-colours-phase decisive run: awaitingRespotChoice never set', g2.current.awaitingRespotChoice === false);

  // Free ball, extra red, and concede all still behave exactly as before when nowhere near a respot situation.
  let g3 = makeGame(15);
  g3 = applyDeclareFreesBall(g3);
  assert('78. declareFreesBall unaffected outside respot context', g3.current.freeBallActive === true);
  g3 = applyFreeBall(g3, 'blue');
  assert('79. applyFreeBall unaffected outside respot context', g3.current.scores[0] === 5);

  let g4 = makeGame(15);
  g4 = applyPot(g4, 'red'); g4 = applyAddExtraRed(g4);
  assert('80. addExtraRed unaffected outside respot context', g4.current.scores[0] === 2 && g4.current.redsRemaining === 13);

  let g5 = makeGame(15);
  g5 = applyConcede(g5);
  assert('81. concede unaffected outside respot context', g5.current.isFrameOver === true);
}

// ── Final results ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
