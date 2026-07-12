// Break-architecture-chain (breakBalls field) test suite.
// Runs in Node.js (no React). Logic mirrors the PLANNED additive changes to
// useSnookerGame.ts (see docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md, section 3.1).
// Written BEFORE touching the real hook, per this repo's TDD convention.
// Run: node breakchain_test.mjs

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
    isFrameOver: false, freeBallActive: false,
    awaitingRespotChoice: false, respottedBlackActive: false, respotForfeitWinner: null,
    breakBalls: [], // NEW FIELD (Phase 3)
  };
}

function makeGame(numberOfReds = 15, bestOf = null) {
  return {
    config: { numberOfReds, bestOf }, framesWon: [0, 0], frameResults: [],
    frameNumber: 1, current: makeInitialFrame(numberOfReds, 0),
    history: [], frameHighestBreak: [0, 0], isMatchOver: false, matchWinner: null,
  };
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
  if (snap.awaitingRespotChoice) return state;
  if (snap.freeBallActive) return state; // must use applyFreeBall instead
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. Phase=${snap.phase} awaiting=${snap.awaiting}`);

  const points = BALL_VALUES[ball];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += points;
  const newBreak = snap.currentBreak + points;

  let newPhase = snap.phase, newRedsRemaining = snap.redsRemaining;
  let newAwaiting = snap.awaiting, newColorsRemaining = [...snap.colorsRemaining];
  let isFrameOver = false, awaitingRespotChoice = false;

  if (snap.phase === 'reds') {
    if (ball === 'red') { newRedsRemaining--; newAwaiting = 'color'; }
    else {
      if (snap.redsRemaining === 0) { newPhase = 'colors'; newColorsRemaining = [...COLORS_SEQUENCE]; }
      else { newAwaiting = 'red'; }
    }
  } else {
    newColorsRemaining = newColorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) {
      if (newScores[0] === newScores[1]) awaitingRespotChoice = true;
      else isFrameOver = true;
    }
  }

  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

  // NEW (Phase 3): append this ball to the live break's chain.
  const newBreakBalls = [...snap.breakBalls, ball];

  const newSnap = {
    scores: newScores, currentBreak: newBreak, currentPlayer: snap.currentPlayer,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining, isFrameOver, freeBallActive: false,
    awaitingRespotChoice, respottedBlackActive: snap.respottedBlackActive, respotForfeitWinner: snap.respotForfeitWinner,
    breakBalls: newBreakBalls,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyEndVisit(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  return {
    ...state,
    current: { ...snap, currentPlayer: snap.currentPlayer === 0 ? 1 : 0, currentBreak: 0, breakBalls: [] }, // NEW: chain clears on a miss
    history: [...state.history, snap],
  };
}

function applyFoul(state, foulValue, opponentPlays = true) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  if (snap.respottedBlackActive) {
    const opponent = snap.currentPlayer === 0 ? 1 : 0;
    const newScores = [...snap.scores]; newScores[opponent] += foulValue;
    return { ...state, current: { ...snap, scores: newScores, currentBreak: 0, isFrameOver: true, respotForfeitWinner: opponent, breakBalls: [] }, history: [...state.history, snap] };
  }
  const opponent = snap.currentPlayer === 0 ? 1 : 0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  return { ...state, current: { ...snap, scores: newScores, currentBreak: 0, currentPlayer: newPlayer, breakBalls: [] }, history: [...state.history, snap] }; // NEW: chain clears on a foul
}

function applyConcede(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  // NEW: concede does NOT clear breakBalls — a conceded break is still historically what was built.
  return { ...state, current: { ...snap, isFrameOver: true }, history: [...state.history, snap] };
}

function applyAddExtraRed(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  if (snap.phase !== 'reds' || snap.awaiting !== 'color' || snap.redsRemaining === 0) return state;
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += 1;
  const newBreak = snap.currentBreak + 1;
  const newRedsRemaining = snap.redsRemaining - 1;
  return {
    ...state,
    current: {
      ...snap, scores: newScores, currentBreak: newBreak, redsRemaining: newRedsRemaining,
      pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, snap.awaiting, snap.colorsRemaining),
      breakBalls: [...snap.breakBalls, 'red'], // NEW: extra red also joins the chain
    },
    history: [...state.history, snap],
  };
}

function applyDeclareFreesBall(state) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  if (state.isMatchOver || snap.isFrameOver) return state;
  return { ...state, current: { ...snap, freeBallActive: true }, history: [...state.history, snap] };
}

function applyFreeBall(state, nominatedBall) {
  const snap = state.current;
  if (snap.awaitingRespotChoice) return state;
  if (!snap.freeBallActive || snap.isFrameOver || state.isMatchOver) return state;
  const scoreValue = BALL_VALUES[nominatedBall];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += scoreValue;
  const newBreak = snap.currentBreak + scoreValue;
  return {
    ...state,
    current: { ...snap, scores: newScores, currentBreak: newBreak, freeBallActive: false, breakBalls: [...snap.breakBalls, nominatedBall] }, // NEW
    history: [...state.history, snap],
  };
}

function applyChooseRespotBreaker(state, player) {
  const snap = state.current;
  if (!snap.awaitingRespotChoice) return state;
  return {
    ...state,
    current: { ...snap, currentPlayer: player, currentBreak: 0, awaitingRespotChoice: false, respottedBlackActive: true, phase: 'colors', colorsRemaining: ['black'], pointsOnTable: 7 },
    history: [...state.history, snap],
  };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

function applyConfirmFrameEnd(state, winner, nextBreakerOverride) {
  const newFramesWon = [...state.framesWon]; newFramesWon[winner]++;
  const nextBreaker = nextBreakerOverride !== undefined ? nextBreakerOverride : (state.frameNumber % 2 === 0) ? 0 : 1;
  return {
    ...state,
    framesWon: newFramesWon,
    frameResults: [...state.frameResults, { frameNumber: state.frameNumber, winner, scores: [...state.current.scores], highestBreak: [...state.frameHighestBreak] }],
    frameNumber: state.frameNumber + 1,
    current: makeInitialFrame(state.config.numberOfReds, nextBreaker),
    history: [],
    frameHighestBreak: [0, 0],
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────
function driveToColorsPhase(g) {
  const n = g.config.numberOfReds;
  for (let i = 0; i < n; i++) {
    g = applyPot(g, 'red');
    if (i < n - 1) g = applyPot(g, 'yellow');
  }
  g = applyPot(g, 'yellow');
  return g;
}

// ── Test runner ─────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }
const arrEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 1 — Default and regression: field starts empty and does not affect existing behavior');
{
  const g = makeGame(15);
  assert('1. breakBalls starts as an empty array', arrEq(g.current.breakBalls, []));
  const g2 = applyPot(makeGame(6), 'red');
  assert('2. score/redsRemaining logic unaffected by the new field', g2.current.scores[0] === 1 && g2.current.redsRemaining === 5);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 2 — Chain grows with each type of pot');
{
  let g = makeGame(15);
  g = applyPot(g, 'red');
  assert('3. after 1 red: chain = ["red"]', arrEq(g.current.breakBalls, ['red']));
  g = applyPot(g, 'black');
  assert('4. after red+black: chain = ["red","black"]', arrEq(g.current.breakBalls, ['red', 'black']));
  g = applyPot(g, 'red');
  g = applyPot(g, 'pink');
  assert('5. after red,black,red,pink: chain grows in exact shot order', arrEq(g.current.breakBalls, ['red', 'black', 'red', 'pink']));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 3 — Extra red joins the chain');
{
  let g = makeGame(15);
  g = applyPot(g, 'red');
  g = applyAddExtraRed(g);
  assert('6. extra red appended as "red"', arrEq(g.current.breakBalls, ['red', 'red']));
  assert('7. score reflects both reds (1+1=2)', g.current.scores[0] === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 4 — Free ball joins the chain as the nominated ball');
{
  let g = makeGame(15);
  g = applyPot(g, 'red');
  g = applyFoul(g, 4, true); // clears chain (opponent plays)
  g = applyDeclareFreesBall(g);
  g = applyFreeBall(g, 'blue');
  assert('8. free ball nominating blue appends "blue" to the (freshly cleared) chain', arrEq(g.current.breakBalls, ['blue']));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 5 — Chain clears on a miss (endVisit)');
{
  let g = makeGame(15);
  g = applyPot(g, 'red'); g = applyPot(g, 'black');
  assert('9. chain has 2 entries before the miss', g.current.breakBalls.length === 2);
  g = applyEndVisit(g);
  assert('10. chain clears to [] after endVisit', arrEq(g.current.breakBalls, []));
  assert('11. currentBreak also resets to 0 (unaffected pre-existing behavior)', g.current.currentBreak === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 6 — Chain clears on a foul');
{
  let g = makeGame(15);
  g = applyPot(g, 'red'); g = applyPot(g, 'yellow'); g = applyPot(g, 'red');
  assert('12. chain has 3 entries before the foul', g.current.breakBalls.length === 3);
  g = applyFoul(g, 4, true);
  assert('13. chain clears to [] after a foul', arrEq(g.current.breakBalls, []));

  // Also verify it clears during the respotted-black forfeit path.
  let g2 = makeGame(15);
  g2.current = { ...g2.current, scores: [33, 40], phase: 'colors', redsRemaining: 0, awaiting: 'color', colorsRemaining: ['black'] };
  g2 = applyPot(g2, 'black'); // ties it at 40-40 -> awaitingRespotChoice
  g2 = applyChooseRespotBreaker(g2, 0);
  g2 = applyFoul(g2, 4, true); // foul during the shootout forfeits the frame
  assert('13b. chain clears to [] after a foul during the respotted-black shootout', arrEq(g2.current.breakBalls, []));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 7 — Chain survives a concede (NOT cleared — a conceded break is still what was built)');
{
  let g = makeGame(15);
  g = applyPot(g, 'red'); g = applyPot(g, 'black'); g = applyPot(g, 'red');
  const chainBeforeConcede = [...g.current.breakBalls];
  g = applyConcede(g);
  assert('14. breakBalls unchanged by concede', arrEq(g.current.breakBalls, chainBeforeConcede));
  assert('15. isFrameOver is true after concede (pre-existing behavior)', g.current.isFrameOver === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 8 — Chain resets to [] on a new frame (confirmFrameEnd -> makeInitialFrame)');
{
  let g = makeGame(15, 5);
  g = applyPot(g, 'red'); g = applyPot(g, 'black');
  g = applyConcede(g);
  g = applyConfirmFrameEnd(g, 0, 1);
  assert('16. new frame starts with an empty chain', arrEq(g.current.breakBalls, []));
  assert('17. frameNumber incremented (pre-existing behavior, unaffected)', g.frameNumber === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 9 — undo() correctly restores the chain at every step');
{
  let g = makeGame(15);
  const s0 = JSON.parse(JSON.stringify(g.current)); // []
  g = applyPot(g, 'red');
  const s1 = JSON.parse(JSON.stringify(g.current)); // ["red"]
  g = applyPot(g, 'black');
  const s2 = JSON.parse(JSON.stringify(g.current)); // ["red","black"]
  g = applyPot(g, 'red');

  assert('18. before undo: chain has 3 entries', g.current.breakBalls.length === 3);
  g = applyUndo(g);
  assert('19. undo #1 restores chain to ["red","black"]', arrEq(g.current.breakBalls, s2.breakBalls));
  g = applyUndo(g);
  assert('20. undo #2 restores chain to ["red"]', arrEq(g.current.breakBalls, s1.breakBalls));
  g = applyUndo(g);
  assert('21. undo #3 restores chain to []', arrEq(g.current.breakBalls, s0.breakBalls));

  // Undo also restores the chain across a foul-clear.
  let g2 = makeGame(15);
  g2 = applyPot(g2, 'red'); g2 = applyPot(g2, 'black');
  const beforeFoul = JSON.parse(JSON.stringify(g2.current));
  g2 = applyFoul(g2, 4, true);
  assert('22. chain cleared after foul', arrEq(g2.current.breakBalls, []));
  g2 = applyUndo(g2);
  assert('23. undo after foul restores the pre-foul chain (["red","black"])', arrEq(g2.current.breakBalls, beforeFoul.breakBalls));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 10 — Chain behaves correctly in train mode (single player, alternating breaks)');
{
  let g = makeGame(6);
  g = applyPot(g, 'red'); g = applyPot(g, 'yellow');
  assert('24. train-mode-style play (player 0 only) still tracks the chain', arrEq(g.current.breakBalls, ['red', 'yellow']));
  g = applyConcede(g); // "End Break" in train mode calls concede
  assert('25. chain survives the end-of-break concede (still shows what was potted)', arrEq(g.current.breakBalls, ['red', 'yellow']));
  g = applyConfirmFrameEnd(g, 0, 0); // train mode always re-breaks as player 0
  assert('26. chain resets for the next break/frame', arrEq(g.current.breakBalls, []));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 11 — Chain behaves correctly across the colours phase and into a full clearance');
{
  let g = driveToColorsPhase(makeGame(6));
  assert('27. chain has entries after driving through the reds phase', g.current.breakBalls.length > 0);
  const lenBeforeColors = g.current.breakBalls.length;
  g = applyPot(g, 'yellow'); g = applyPot(g, 'green'); g = applyPot(g, 'brown'); g = applyPot(g, 'blue'); g = applyPot(g, 'pink'); g = applyPot(g, 'black');
  assert('28. chain includes every colour potted through to the black (6 more than before)', g.current.breakBalls.length === lenBeforeColors + 6);
  assert('29. chain ends with "black"', g.current.breakBalls[g.current.breakBalls.length - 1] === 'black');
  assert('30. frame is over (clean clearance, not tied)', g.current.isFrameOver === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 12 — Chain in unlimited mode (bestOf sentinel 9999) behaves identically to match mode');
{
  let g = makeGame(15, 9999);
  g = applyPot(g, 'red'); g = applyPot(g, 'yellow'); g = applyPot(g, 'red');
  assert('31. chain grows normally under the unlimited sentinel', arrEq(g.current.breakBalls, ['red', 'yellow', 'red']));
  g = applyEndVisit(g);
  assert('32. chain clears normally under the unlimited sentinel', arrEq(g.current.breakBalls, []));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 13 — declareFreesBall does not itself modify the chain (it only toggles freeBallActive)');
{
  let g = makeGame(15);
  g = applyPot(g, 'red'); g = applyPot(g, 'black');
  const chainBefore = [...g.current.breakBalls];
  g = applyFoul(g, 4, true); // clears chain, opponent to play
  const clearedChain = [...g.current.breakBalls];
  g = applyDeclareFreesBall(g);
  assert('33. declareFreesBall alone does not add to the (already-cleared) chain', arrEq(g.current.breakBalls, clearedChain));
  assert('34. sanity: chain really was cleared by the foul before this (not equal to pre-foul chain)', !arrEq(clearedChain, chainBefore));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 14 — Multiple consecutive extra reds all join the chain in order');
{
  let g = makeGame(15);
  g = applyPot(g, 'red');
  g = applyAddExtraRed(g);
  g = applyAddExtraRed(g);
  g = applyAddExtraRed(g);
  assert('35. three extra reds after the first: chain = ["red","red","red","red"]', arrEq(g.current.breakBalls, ['red', 'red', 'red', 'red']));
  assert('36. score reflects all 4 reds (4 points)', g.current.scores[0] === 4);
  assert('37. redsRemaining decremented 4 times (15 -> 11)', g.current.redsRemaining === 11);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 15 — Free ball nominating a red (on-ball is red) appends "red" to the chain');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true); // opponent plays next, awaiting stays 'red' (foul while awaiting red)
  g = applyDeclareFreesBall(g);
  g = applyFreeBall(g, 'red');
  assert('38. free ball nominating red (on-ball is red) appends "red"', arrEq(g.current.breakBalls, ['red']));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 16 — undo() restores the chain correctly across addExtraRed and applyFreeBall specifically');
{
  let g = makeGame(15);
  g = applyPot(g, 'red');
  const beforeExtra = [...g.current.breakBalls];
  g = applyAddExtraRed(g);
  assert('39. before undo: chain has the extra red', g.current.breakBalls.length === 2);
  g = applyUndo(g);
  assert('40. undo after addExtraRed restores the pre-extra-red chain', arrEq(g.current.breakBalls, beforeExtra));

  let g2 = makeGame(15);
  g2 = applyDeclareFreesBall(g2);
  const beforeFreeBall = [...g2.current.breakBalls];
  g2 = applyFreeBall(g2, 'blue');
  assert('41. before undo: chain has the free-ball nomination', arrEq(g2.current.breakBalls, ['blue']));
  g2 = applyUndo(g2);
  assert('42. undo after applyFreeBall restores the pre-free-ball chain', arrEq(g2.current.breakBalls, beforeFreeBall));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 17 — Guarded actions during awaitingRespotChoice never touch breakBalls');
{
  function tiedShootoutSetup() {
    let g = makeGame(15);
    g.current = { ...g.current, scores: [33, 40], phase: 'colors', redsRemaining: 0, awaiting: 'color', colorsRemaining: ['black'], breakBalls: ['pink', 'black'] };
    return applyPot(g, 'black'); // scores level at 40-40, awaitingRespotChoice=true, chain untouched by the tie-detect branch itself
  }
  const g1 = tiedShootoutSetup();
  const chainAtTie = [...g1.current.breakBalls];
  assert('43. chain is preserved (not reset) the instant a tie is detected', arrEq(chainAtTie, ['pink', 'black', 'black']));

  const beforeFoulGuard = tiedShootoutSetup();
  const afterFoulGuard = applyFoul(beforeFoulGuard, 4, true);
  assert('44. applyFoul while awaitingRespotChoice is a true no-op (chain, and whole state, unchanged)', arrEq(afterFoulGuard.current, beforeFoulGuard.current));

  const afterEndVisitGuard = applyEndVisit(tiedShootoutSetup());
  assert('45. applyEndVisit while awaitingRespotChoice leaves the chain exactly as-is', arrEq(afterEndVisitGuard.current.breakBalls, chainAtTie));
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 18 — Chain length always equals the number of pots since the last clear (invariant over a long scripted sequence)');
{
  let g = makeGame(15);
  const actions = ['red', 'black', 'red', 'pink', 'red', 'yellow'];
  actions.forEach(ball => { g = applyPot(g, ball); });
  assert('46. chain length matches the number of pots (6)', g.current.breakBalls.length === actions.length);
  assert('47. chain contents match the exact sequence played', arrEq(g.current.breakBalls, actions));
  g = applyEndVisit(g);
  assert('48. after a miss, chain length resets to 0 regardless of how long it had grown', g.current.breakBalls.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section('SECTION 19 — Chain is independent per player (swapping current player via endVisit starts a fresh chain for the incoming player)');
{
  let g = makeGame(15);
  g = applyPot(g, 'red'); g = applyPot(g, 'black'); // player 0's break
  assert('49. player 0 currentPlayer is 0 while building this break', g.current.currentPlayer === 0);
  g = applyEndVisit(g);
  assert('50. after the miss, currentPlayer is now 1 and the chain is empty for their incoming break', g.current.currentPlayer === 1 && g.current.breakBalls.length === 0);
  g = applyPot(g, 'red');
  assert('51. player 1 starts building their own independent chain', arrEq(g.current.breakBalls, ['red']));
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
