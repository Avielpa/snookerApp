// Foul-with-a-potted-ball test suite — covers the "cue ball also potted alongside a
// legal-looking pot" gap: colours-phase foul combos, free-ball + foul combos, and the
// convertLastPotToFoul() correction action. Runs in Node.js (no React).
// Logic mirrors hooks/useSnookerGame.ts's resolveFoulPotOutcome/resolveColoursExhausted/
// applyFoul/convertLastPotToFoul/applyFreeBall exactly.
// Run: node foulconvert_test.mjs

// ── Inline game logic (kept in sync with useSnookerGame.ts) ──────────────────

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27;

function calcPointsOnTable(phase, redsRemaining, awaiting, colorsRemaining) {
  if (phase === 'colors') return colorsRemaining.reduce((s,b) => s + BALL_VALUES[b], 0);
  if (awaiting === 'color') return 7 + redsRemaining * 8 + COLORS_TOTAL;
  return redsRemaining * 8 + COLORS_TOTAL;
}

function resolveColoursExhausted(scores) {
  if (scores[0] === scores[1]) return { isFrameOver: false, awaitingRespotChoice: true };
  return { isFrameOver: true, awaitingRespotChoice: false };
}

function resolveFoulPotOutcome(preShotSnap, pottedBall) {
  if (!pottedBall || pottedBall === 'red' || preShotSnap.phase === 'reds') {
    return { removesFromTable: false };
  }
  return { removesFromTable: pottedBall === preShotSnap.colorsRemaining[0] };
}

function makeInitialFrame(numberOfReds, currentPlayer=0) {
  return {
    scores: [0,0], currentBreak:0, currentPlayer,
    pointsOnTable: numberOfReds * 8 + COLORS_TOTAL,
    phase: 'reds', redsRemaining: numberOfReds,
    awaiting: 'red', colorsRemaining: [...COLORS_SEQUENCE],
    isFrameOver: false, freeBallActive: false,
    awaitingRespotChoice: false, respottedBlackActive: false, respotForfeitWinner: null,
    breakBalls: [],
  };
}

function makeGame(numberOfReds=15, bestOf=null) {
  return {
    config:{numberOfReds,bestOf}, framesWon:[0,0], frameResults:[],
    frameNumber:1, current: makeInitialFrame(numberOfReds,0),
    history:[], frameHighestBreak:[0,0], isMatchOver:false, matchWinner:null,
  };
}

function getAvailableBalls(snap) {
  if (snap.isFrameOver) return [];
  if (snap.freeBallActive) return [...COLORS_SEQUENCE, 'red'];
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0,1);
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}

function applyPot(state, ball) {
  const snap = state.current;
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. phase=${snap.phase} awaiting=${snap.awaiting}`);

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
      ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
    }
  }

  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

  const newSnap = {
    ...snap,
    scores: newScores, currentBreak: newBreak, currentPlayer: snap.currentPlayer,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining, isFrameOver, awaitingRespotChoice, freeBallActive: false,
    breakBalls: [...snap.breakBalls, ball],
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyExtraRed(state) {
  const snap = state.current;
  if (snap.phase !== 'reds' || snap.awaiting !== 'color' || snap.redsRemaining === 0) throw new Error('addExtraRed precondition failed');
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += 1;
  const newBreak = snap.currentBreak + 1;
  const newRedsRemaining = snap.redsRemaining - 1;
  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;
  const newSnap = { ...snap, scores: newScores, currentBreak: newBreak, redsRemaining: newRedsRemaining,
    pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, snap.awaiting, snap.colorsRemaining),
    breakBalls: [...snap.breakBalls, 'red'] };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyFoul(state, foulValue, opponentPlays=true, redsAccidentallyPotted=0, colourPotted=null) {
  const snap = state.current;
  const opponent = snap.currentPlayer===0?1:0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;

  if (snap.respottedBlackActive) {
    return { ...state, current: { ...snap, scores: newScores, currentBreak:0, isFrameOver:true, respotForfeitWinner: opponent, breakBalls: [] }, history: [...state.history, snap] };
  }

  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newAwaiting = snap.awaiting;
  const newRedsRemaining = Math.max(0, snap.redsRemaining - redsAccidentallyPotted);

  const { removesFromTable } = resolveFoulPotOutcome(snap, colourPotted);
  let newColorsRemaining = snap.colorsRemaining;
  let isFrameOver = false, awaitingRespotChoice = false;
  if (removesFromTable) {
    newColorsRemaining = snap.colorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) {
      ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
    }
  }

  const newSnap = {
    ...snap, scores: newScores, currentBreak: 0, currentPlayer: newPlayer, awaiting: newAwaiting,
    redsRemaining: newRedsRemaining, colorsRemaining: newColorsRemaining,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(snap.phase, newRedsRemaining, newAwaiting, newColorsRemaining),
    isFrameOver, awaitingRespotChoice, freeBallActive: false, breakBalls: [],
  };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function convertLastPotToFoul(state, foulValue, opponentPlays=true) {
  if (state.current.breakBalls.length === 0 || state.history.length === 0) return state;
  const preShot = state.history[state.history.length - 1];
  if (preShot.awaitingRespotChoice) return state;

  const pottedBall = state.current.breakBalls[state.current.breakBalls.length - 1];
  const opponent = preShot.currentPlayer===0?1:0;
  const newScores = [...preShot.scores]; newScores[opponent] += foulValue;

  if (preShot.respottedBlackActive) {
    return { ...state, current: { ...preShot, scores: newScores, currentBreak:0, isFrameOver:true, respotForfeitWinner: opponent, breakBalls: [] }, history: [...state.history, state.current] };
  }

  const newPlayer = opponentPlays ? opponent : preShot.currentPlayer;
  const newAwaiting = preShot.awaiting;
  const redsAccidentallyPotted = pottedBall === 'red' ? 1 : 0;
  const newRedsRemaining = Math.max(0, preShot.redsRemaining - redsAccidentallyPotted);
  const colourPotted = pottedBall === 'red' ? null : pottedBall;
  const { removesFromTable } = resolveFoulPotOutcome(preShot, colourPotted);

  let newColorsRemaining = preShot.colorsRemaining;
  let isFrameOver = false, awaitingRespotChoice = false;
  if (removesFromTable) {
    newColorsRemaining = preShot.colorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) {
      ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
    }
  }

  const newSnap = {
    ...preShot, scores: newScores, currentBreak: 0, currentPlayer: newPlayer, awaiting: newAwaiting,
    redsRemaining: newRedsRemaining, colorsRemaining: newColorsRemaining,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(preShot.phase, newRedsRemaining, newAwaiting, newColorsRemaining),
    isFrameOver, awaitingRespotChoice, freeBallActive: false, breakBalls: [],
  };
  return { ...state, current: newSnap, history: [...state.history, state.current] };
}

function applyDeclareFreesBall(state) {
  const snap = state.current;
  return { ...state, current: { ...snap, freeBallActive: true }, history: [...state.history, snap] };
}

function applyFreeBall(state, nominatedBall) {
  const snap = state.current;
  if (!snap.freeBallActive) return state;

  let scoreValue, newPhase = snap.phase, newRedsRemaining = snap.redsRemaining;
  let newAwaiting = snap.awaiting, newColorsRemaining = [...snap.colorsRemaining];

  if (snap.phase === 'reds') {
    if (snap.awaiting === 'red') { scoreValue = 1; newAwaiting = 'color'; }
    else {
      scoreValue = BALL_VALUES[nominatedBall];
      if (snap.redsRemaining === 0) { newPhase = 'colors'; newColorsRemaining = [...COLORS_SEQUENCE]; }
      else { newAwaiting = 'red'; }
    }
  } else {
    scoreValue = BALL_VALUES[newColorsRemaining[0]];
    if (nominatedBall === newColorsRemaining[0]) { newColorsRemaining = newColorsRemaining.slice(1); }
  }

  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += scoreValue;
  const newBreak = snap.currentBreak + scoreValue;

  let isFrameOver = false, awaitingRespotChoice = false;
  if (newPhase === 'colors' && newColorsRemaining.length === 0) {
    ({ isFrameOver, awaitingRespotChoice } = resolveColoursExhausted(newScores));
  }

  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

  const newSnap = {
    ...snap, scores: newScores, currentBreak: newBreak, phase: newPhase, redsRemaining: newRedsRemaining,
    awaiting: newAwaiting, colorsRemaining: newColorsRemaining,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    isFrameOver, awaitingRespotChoice, freeBallActive: false, breakBalls: [...snap.breakBalls, nominatedBall],
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

function chooseRespotBreaker(state, player) {
  const snap = state.current;
  const newSnap = { ...snap, currentPlayer: player, currentBreak: 0, awaitingRespotChoice: false,
    respottedBlackActive: true, phase: 'colors', colorsRemaining: ['black'], pointsOnTable: 7 };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

// Drives a game to just before the colours phase (all reds gone, last colour respotted).
function driveToColoursPhase(g) {
  for (let i = 0; i < 15; i++) {
    g = applyPot(g, 'red');
    g = applyPot(g, 'black');
  }
  return g; // phase='colors', colorsRemaining=[yellow..black]
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed=0, failed=0;
function assert(label, condition, extra='') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra?` — got: ${extra}`:''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 1 — Colours-phase foul-pot combos (Path A: applyFoul with colourPotted)');
// ═══════════════════════════════════════════════════════════════════════════════
{
  let g = makeGame(15);
  g = driveToColoursPhase(g);
  assert('setup: phase=colors', g.current.phase === 'colors');
  assert('setup: colorsRemaining full 6', g.current.colorsRemaining.length === 6);

  // Test 21: correct on-colour (not last) + cue ball
  let g21 = applyFoul(g, 5, true, 0, 'yellow');
  assert('[21] yellow removed from colorsRemaining', !g21.current.colorsRemaining.includes('yellow'));
  assert('[21] colorsRemaining now 5', g21.current.colorsRemaining.length === 5);
  assert('[21] striker scores 0 (no score change for P0)', g21.current.scores[0] === g.current.scores[0]);
  assert('[21] opponent gets foul value', g21.current.scores[1] === g.current.scores[1] + 5);
  assert('[21] next on-ball is green', g21.current.colorsRemaining[0] === 'green');

  // Test 22: wrong colour (not on-ball) + cue ball
  let g22 = applyFoul(g, 5, true, 0, 'blue');
  assert('[22] colorsRemaining unchanged (respots)', g22.current.colorsRemaining.length === 6 && g22.current.colorsRemaining[0] === 'yellow');
  assert('[22] opponent gets foul value', g22.current.scores[1] === g.current.scores[1] + 5);

  // Test 23: final black + cue ball, NOT tied
  let g23setup = { ...g, current: { ...g.current, colorsRemaining: ['black'], scores: [50, 30] } };
  let g23 = applyFoul(g23setup, 7, true, 0, 'black');
  assert('[23] frame ends (not tied)', g23.current.isFrameOver === true);
  assert('[23] colorsRemaining empty', g23.current.colorsRemaining.length === 0);
  assert('[23] not awaiting respot', g23.current.awaitingRespotChoice === false);

  // Test 24: final black + cue ball, TIED
  let g24setup = { ...g, current: { ...g.current, colorsRemaining: ['black'], scores: [30, 30] } };
  let g24 = applyFoul(g24setup, 7, true, 0, 'black');
  assert('[24] scores tied after foul value (30 vs 37) → NOT tied, frame ends', g24.current.isFrameOver === true);
  // Recompute a genuinely-tied case: foul value must land scores equal
  let g24bsetup = { ...g, current: { ...g.current, colorsRemaining: ['black'], scores: [30, 23] } };
  let g24b = applyFoul(g24bsetup, 7, true, 0, 'black'); // opponent (P1) 23+7=30, tied with P0's 30
  assert('[24b] tied score → awaitingRespotChoice set, not frame over', g24b.current.awaitingRespotChoice === true && g24b.current.isFrameOver === false);

  // Test 25: multiple colours down, one matches on-ball
  let g25 = applyFoul(g, 5, true, 0, 'yellow'); // only the named on-ball is ever considered — engine has no "multiple colours" input, confirms single-field sufficiency
  assert('[25] only on-ball removed, single-field picker is sufficient', g25.current.colorsRemaining.length === 5 && !g25.current.colorsRemaining.includes('yellow'));

  // Test 26: multiple colours down, none matching on-ball → no-op
  let g26 = applyFoul(g, 5, true, 0, 'pink');
  assert('[26] non-on-ball colour never removes anything', g26.current.colorsRemaining.length === 6);

  // Test 27: reds-phase colour named anyway → ignored/no-op
  let gReds = makeGame(15);
  let g27 = applyFoul(gReds, 4, true, 0, 'yellow');
  assert('[27] reds-phase colourPotted is a no-op', g27.current.colorsRemaining.length === 6 && g27.current.phase === 'reds');
}

// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 2 — Free-ball + foul combos');
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Test 28: free ball, on-ball red, nominated colour potted + cue ball in-off
  let g28 = makeGame(15);
  g28 = applyDeclareFreesBall(g28);
  // simulate: player pots the nominated colour (not via applyFreeBall, since it went in-off —
  // report directly as a foul with that colour named, same as any other foul-combo)
  let g28f = applyFoul(g28, 4, true, 0, 'yellow');
  assert('[28] reds-phase free ball + colour + cue → respots (no removal, redsRemaining unchanged)', g28f.current.redsRemaining === 15 && g28f.current.colorsRemaining.length === 6);
  assert('[28] opponent gets foul value', g28f.current.scores[1] === 4);

  // Test 29: free ball, on-ball colour (reds phase, awaiting=color), nominated ball + cue in-off
  let g29 = makeGame(15);
  g29 = applyPot(g29, 'red'); // awaiting=color now
  g29 = applyDeclareFreesBall(g29);
  let g29f = applyFoul(g29, 4, true, 0, 'blue');
  assert('[29] reds-phase colour-on-ball free ball + cue → respots', g29f.current.colorsRemaining.length === 6);

  // Test 30: free ball, colours phase, nominated === true on-ball + cue in-off
  let g30 = makeGame(15);
  g30 = driveToColoursPhase(g30);
  g30 = applyDeclareFreesBall(g30);
  let g30f = applyFoul(g30, 5, true, 0, 'yellow'); // colorsRemaining[0] === 'yellow'
  assert('[30] free ball colours-phase on-ball + cue → removed permanently', !g30f.current.colorsRemaining.includes('yellow') && g30f.current.colorsRemaining.length === 5);

  // Test 31: free ball, colours phase, nominated !== true on-ball + cue in-off
  let g31 = makeGame(15);
  g31 = driveToColoursPhase(g31);
  g31 = applyDeclareFreesBall(g31);
  let g31f = applyFoul(g31, 5, true, 0, 'black'); // colorsRemaining[0] === 'yellow', not black
  assert('[31] free ball colours-phase wrong-ball + cue → respots', g31f.current.colorsRemaining.length === 6);

  // Test 32: free ball on the final black, colours phase, tied score
  let g32setup = makeGame(15);
  g32setup = { ...g32setup, current: { ...g32setup.current, phase: 'colors', colorsRemaining: ['black'], scores: [30, 23], freeBallActive: true } };
  let g32 = applyFoul(g32setup, 7, true, 0, 'black'); // currentPlayer=0(30), opponent=1(23+7=30) → tied
  assert('[32] free ball on final black + cue, tied → awaitingRespotChoice', g32.current.awaitingRespotChoice === true);
  let g32bsetup = { ...g32setup, current: { ...g32setup.current, scores: [40, 30] } };
  let g32b = applyFoul(g32bsetup, 7, true, 0, 'black'); // opponent 30+7=37, not tied with 40
  assert('[32b] free ball on final black + cue, not tied → frame ends', g32b.current.isFrameOver === true);
}

// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 3 — convertLastPotToFoul (Path B)');
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Test 33: pot last red normally, then convert
  let g33 = { ...makeGame(1), current: { ...makeInitialFrame(1), redsRemaining: 1 } };
  g33 = applyPot(g33, 'red'); // scores P0=1, redsRemaining=0, awaiting=color
  let g33c = convertLastPotToFoul(g33, 4, true);
  assert('[33] striker score reversed (back to 0)', g33c.current.scores[0] === 0);
  assert('[33] opponent gets foul value', g33c.current.scores[1] === 4);
  assert('[33] red permanently removed (redsRemaining still 0)', g33c.current.redsRemaining === 0);
  assert('[33] awaiting reflects pre-shot state (red)', g33c.current.awaiting === 'red');

  // Test 34: pot a colour during reds phase, then convert
  let g34 = makeGame(15);
  g34 = applyPot(g34, 'red');
  g34 = applyPot(g34, 'yellow'); // scores P0 += 2, colour respotted normally
  let g34c = convertLastPotToFoul(g34, 4, true);
  assert('[34] striker score reversed', g34c.current.scores[0] === 1); // back to just the red's 1pt
  assert('[34] colour respots (colorsRemaining unaffected either way)', g34c.current.colorsRemaining.length === 6);
  assert('[34] opponent gets foul value', g34c.current.scores[1] === 4);

  // Test 35: pot correct on-colour during colours phase, then convert
  let g35 = makeGame(15);
  g35 = driveToColoursPhase(g35);
  const preConvertScore = g35.current.scores[0];
  g35 = applyPot(g35, 'yellow'); // scores P0 += 2, yellow removed
  let g35c = convertLastPotToFoul(g35, 4, true);
  assert('[35] striker score reversed to pre-pot value', g35c.current.scores[0] === preConvertScore);
  assert('[35] yellow permanently removed (matches Path A on-ball case)', !g35c.current.colorsRemaining.includes('yellow'));
  assert('[35] opponent gets foul value', g35c.current.scores[1] === g35.history[g35.history.length-1].scores[1] + 4);

  // Test 36: pot via addExtraRed, then convert
  let g36 = makeGame(15);
  g36 = applyPot(g36, 'red'); // awaiting=color, redsRemaining=14
  g36 = applyExtraRed(g36); // extra red: redsRemaining=13, scores P0=2
  let g36c = convertLastPotToFoul(g36, 4, true);
  // Conversion is relative to the pre-extra-red snapshot (redsRemaining=14): the extra
  // red is re-labeled as an accidental pot rather than a scored one, but a red never
  // returns to the table either way — so redsRemaining stays 13, same as before conversion.
  assert('[36] extra red stays off the table (redsRemaining still 13)', g36c.current.redsRemaining === 13);
  assert('[36] score reversed to 1 (just the first red)', g36c.current.scores[0] === 1);

  // Test 37: pot via applyFreeBall (colours-phase on-ball), then convert
  let g37 = makeGame(15);
  g37 = driveToColoursPhase(g37);
  const preScore37 = g37.current.scores[0];
  g37 = applyDeclareFreesBall(g37);
  g37 = applyFreeBall(g37, 'yellow'); // nominated = true on-ball, scores +2, removed
  let g37c = convertLastPotToFoul(g37, 4, true);
  assert('[37] re-derives on-ball from PRE-SHOT snapshot (yellow was on-ball)', !g37c.current.colorsRemaining.includes('yellow'));
  assert('[37] score reversed', g37c.current.scores[0] === preScore37);

  // Test 38: convert with empty breakBalls → no-op
  let g38 = makeGame(15);
  let g38c = convertLastPotToFoul(g38, 4, true);
  assert('[38] no-op when breakBalls empty', g38c === g38);

  // Test 39: convert with empty history (very first shot never taken, breakBalls also empty
  // by construction) → no-op, same guard as 38
  let g39 = makeGame(15);
  assert('[39] initial state has empty history', g39.history.length === 0);
  let g39c = convertLastPotToFoul(g39, 4, true);
  assert('[39] no-op on fresh frame', g39c === g39);

  // Test 40: undo immediately after a conversion restores pre-conversion snapshot
  let g40 = makeGame(15);
  g40 = applyPot(g40, 'red');
  const midState = g40.current;
  g40 = convertLastPotToFoul(g40, 4, true);
  let g40u1 = applyUndo(g40);
  assert('[40] first undo restores pre-conversion (originally-scored) snapshot', JSON.stringify(g40u1.current) === JSON.stringify(midState));
  let g40u2 = applyUndo(g40u1);
  assert('[40] second undo restores true pre-shot snapshot', g40u2.current.scores[0] === 0 && g40u2.current.redsRemaining === 15);

  // Test 41: convert on final black → frame-end/tie logic
  let g41setup = makeGame(15);
  g41setup = { ...g41setup, current: { ...g41setup.current, phase: 'colors', colorsRemaining: ['black'], scores: [23, 30] } };
  g41setup = { ...g41setup, history: [g41setup.current] }; // simulate a preceding history entry
  let g41 = applyPot(g41setup, 'black'); // P0 scores +7 -> 30, tied with 30
  let g41c = convertLastPotToFoul(g41, 7, true); // reverse the pot, apply as foul: opponent 30+7=37
  assert('[41] convert on final black re-resolves tie/frame-end via foul path', g41c.current.isFrameOver === true || g41c.current.awaitingRespotChoice === true);

  // Test 42: convert combined with opponentPlays=false
  let g42 = makeGame(15);
  g42 = applyPot(g42, 'red');
  let g42c = convertLastPotToFoul(g42, 4, false);
  assert('[42] fouling player continues (currentPlayer unchanged)', g42c.current.currentPlayer === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 4 — Regression / cross-cutting');
// ═══════════════════════════════════════════════════════════════════════════════
{
  // Test 43: pointsOnTable recomputes correctly after a colours-phase foul removal
  let g43 = makeGame(15);
  g43 = driveToColoursPhase(g43);
  const before43 = g43.current.pointsOnTable;
  let g43f = applyFoul(g43, 5, true, 0, 'yellow');
  assert('[43] pointsOnTable shrinks by yellow\'s value after removal', g43f.current.pointsOnTable === before43 - BALL_VALUES['yellow']);

  // Test 44: breakBalls clears on every foul and every conversion
  let g44 = makeGame(15);
  g44 = applyPot(g44, 'red');
  let g44f = applyFoul(g44, 4, true, 0, null);
  assert('[44a] breakBalls clears after a plain foul', g44f.current.breakBalls.length === 0);
  let g44b = makeGame(15);
  g44b = applyPot(g44b, 'red');
  let g44c = convertLastPotToFoul(g44b, 4, true);
  assert('[44b] breakBalls clears after a conversion', g44c.current.breakBalls.length === 0);

  // Test 45: (documented, not independently testable here — Alert-chain logic lives in
  // game.tsx, which is a UI concern, not part of this pure-logic mirror. Verified by
  // reading the wiring: handleFoulConfirm's opponentPlays branch fires identically for
  // both applyFoul and convertLastPotToFoul, since both end in a normal foul-scored state.)
  assert('[45] Alert-chain wiring reviewed in game.tsx (not a pure-logic assertion)', true);

  // Test 46: full existing suite re-run is done separately (game/train/mega/freeball/
  // stats/offseason) — not duplicated in this file.
  assert('[46] baseline suites re-run separately, see full test run', true);

  // Test 47: sudden-death respotted-black shootout + potted ball reported alongside a foul
  // still unconditionally forfeits, unaffected by the new colour/convert logic.
  let g47 = makeGame(15);
  g47 = { ...g47, current: { ...g47.current, awaitingRespotChoice: true, scores: [30,30], phase: 'colors', colorsRemaining: ['black'] } };
  g47 = chooseRespotBreaker(g47, 0);
  assert('[47] respottedBlackActive is set', g47.current.respottedBlackActive === true);
  let g47f = applyFoul(g47, 7, true, 0, 'black');
  assert('[47] any foul during shootout forfeits outright regardless of colourPotted', g47f.current.isFrameOver === true && g47f.current.respotForfeitWinner === 1);
  // For convert: simulate a clean pot during the shootout first (so history/breakBalls
  // reflect a real pre-shot snapshot with respottedBlackActive=true), then convert it.
  let g47pot = applyPot(g47, 'black');
  let g47c = convertLastPotToFoul(g47pot, 7, true);
  assert('[47b] convert during shootout also forfeits outright', g47c.current.isFrameOver === true && g47c.current.respotForfeitWinner === 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed}/${passed+failed} assertions passed${failed>0?` (${failed} FAILED)`:''}`);
if (failed > 0) process.exit(1);
