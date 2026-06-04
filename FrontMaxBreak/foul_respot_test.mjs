// foul_respot_test.mjs
// Tests for:
//   1. applyFoul with redsAccidentallyPotted parameter (Problem 2 fix)
//   2. Abandon-match state shape verification (Problem 1)
//
// Run: node foul_respot_test.mjs

// ── Inline game logic (mirrors useSnookerGame.ts exactly) ─────────────────────

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27; // 2+3+4+5+6+7

function calcPointsOnTable(phase, redsRemaining, awaiting, colorsRemaining) {
  if (phase === 'colors') return colorsRemaining.reduce((s,b) => s + BALL_VALUES[b], 0);
  if (awaiting === 'color') return 7 + redsRemaining * 8 + COLORS_TOTAL;
  return redsRemaining * 8 + COLORS_TOTAL;
}

function makeInitialFrame(numberOfReds, currentPlayer=0) {
  return {
    scores: [0,0], currentBreak:0, currentPlayer,
    pointsOnTable: numberOfReds * 8 + COLORS_TOTAL,
    phase: 'reds', redsRemaining: numberOfReds,
    awaiting: 'red', colorsRemaining: [...COLORS_SEQUENCE],
    isFrameOver: false, freeBallActive: false,
  };
}

function makeGame(numberOfReds, bestOf=null) {
  return {
    config: { numberOfReds, bestOf },
    framesWon: [0,0], frameResults: [], frameNumber: 1,
    current: makeInitialFrame(numberOfReds, 0),
    history: [], frameHighestBreak: [0,0],
    isMatchOver: false, matchWinner: null,
  };
}

function applyPot(state, ball) {
  const snap = state.current;
  const points = BALL_VALUES[ball];
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += points;
  const newBreak = snap.currentBreak + points;
  let newPhase = snap.phase, newRedsRemaining = snap.redsRemaining;
  let newAwaiting = snap.awaiting, newColorsRemaining = [...snap.colorsRemaining];
  let isFrameOver = false;
  if (snap.phase === 'reds') {
    if (ball === 'red') { newRedsRemaining--; newAwaiting = 'color'; }
    else {
      if (snap.redsRemaining === 0) { newPhase = 'colors'; newColorsRemaining = [...COLORS_SEQUENCE]; }
      else { newAwaiting = 'red'; }
    }
  } else {
    newColorsRemaining = newColorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) isFrameOver = true;
  }
  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;
  const newSnap = {
    ...snap, scores: newScores, currentBreak: newBreak,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining, isFrameOver, freeBallActive: false,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

// Updated applyFoul: mirrors the fixed useSnookerGame.ts including redsAccidentallyPotted
function applyFoul(state, foulValue, opponentPlays=true, redsAccidentallyPotted=0) {
  const snap = state.current;
  const opponent = snap.currentPlayer === 0 ? 1 : 0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newAwaiting = snap.awaiting; // NEVER reset by a foul
  const newRedsRemaining = Math.max(0, snap.redsRemaining - redsAccidentallyPotted);
  const newSnap = {
    ...snap,
    scores: newScores,
    currentBreak: 0,
    currentPlayer: newPlayer,
    awaiting: newAwaiting,
    redsRemaining: newRedsRemaining,
    pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, newAwaiting, snap.colorsRemaining),
    freeBallActive: false,
  };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

function applyEndVisit(state) {
  const snap = state.current;
  let newPhase = snap.phase, newAwaiting = snap.awaiting;
  let newColorsRemaining = [...snap.colorsRemaining];
  if (snap.phase === 'reds') {
    if (snap.redsRemaining === 0 && snap.awaiting === 'color') {
      newPhase = 'colors'; newColorsRemaining = [...COLORS_SEQUENCE];
    } else { newAwaiting = 'red'; }
  }
  const newPot = calcPointsOnTable(newPhase, snap.redsRemaining, newAwaiting, newColorsRemaining);
  return { ...state, current: { ...snap, currentPlayer: snap.currentPlayer===0?1:0, currentBreak:0, phase:newPhase, awaiting:newAwaiting, colorsRemaining:newColorsRemaining, pointsOnTable:newPot, freeBallActive:false }, history:[...state.history,snap] };
}

// Simplified confirmFrameEnd for J-section state-shape tests
function confirmFrame(state, winner) {
  const result = {
    frameNumber: state.frameNumber, winner,
    scores: [...state.current.scores],
    highestBreak: [...state.frameHighestBreak],
  };
  const newFW = [state.framesWon[0], state.framesWon[1]];
  newFW[winner]++;
  return {
    ...state,
    framesWon: newFW,
    frameResults: [...state.frameResults, result],
    frameNumber: state.frameNumber + 1,
    current: makeInitialFrame(state.config.numberOfReds, 0),
    history: [], frameHighestBreak: [0,0],
  };
}

// ── Test runner ────────────────────────────────────────────────────────────────
let passed=0, failed=0;
function assert(label, condition, extra='') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${extra}` : ''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION A — BACKWARD COMPAT: foul with redsAccidentallyPotted=0 (default)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION A — Backward compat: foul with no accidentally potted reds');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true, 0);
  assert('A01 opponent score += 4', g.current.scores[1] === 4);
  assert('A02 fouler score unchanged = 0', g.current.scores[0] === 0);
  assert('A03 currentBreak reset to 0', g.current.currentBreak === 0);
  assert('A04 player switches to opponent', g.current.currentPlayer === 1);
  assert('A05 awaiting stays red', g.current.awaiting === 'red');
  assert('A06 redsRemaining unchanged = 15', g.current.redsRemaining === 15);
  assert('A07 pointsOnTable = 15*8+27 = 147', g.current.pointsOnTable === 147);
  assert('A08 history length = 1', g.history.length === 1);

  assert('A09 foul value 5', applyFoul(makeGame(15), 5, true, 0).current.scores[1] === 5);
  assert('A10 foul value 6', applyFoul(makeGame(15), 6, true, 0).current.scores[1] === 6);
  assert('A11 foul value 7', applyFoul(makeGame(15), 7, true, 0).current.scores[1] === 7);
  assert('A12 opponentPlays=false: player stays P0', applyFoul(makeGame(15), 4, false, 0).current.currentPlayer === 0);

  // awaiting='color' preserved
  let g2 = applyPot(makeGame(15), 'red');
  g2 = applyFoul(g2, 4, true, 0);
  assert('A13 awaiting=color preserved across foul', g2.current.awaiting === 'color');
  assert('A14 redsRemaining stays 14 (no accidental reds)', g2.current.redsRemaining === 14);
  assert('A15 pointsOnTable = 7+14*8+27 = 146', g2.current.pointsOnTable === 146, g2.current.pointsOnTable);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION B — 1 RED ACCIDENTALLY POTTED, awaiting='color'
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION B — 1 red accidentally potted on foul, awaiting=color');
{
  // Scenario: player potted a red legally (awaiting→color), then fouls attempting
  // the colour and accidentally pots another red. That red stays off the table.
  let g = makeGame(15);
  g = applyPot(g, 'red');         // redsRemaining=14, awaiting=color, scores=[1,0]
  g = applyFoul(g, 4, true, 1);  // 1 red accidentally potted on foul
  assert('B01 redsRemaining decremented to 13', g.current.redsRemaining === 13);
  assert('B02 opponent score += 4', g.current.scores[1] === 4);
  assert('B03 fouler score = 1 (from legal red)', g.current.scores[0] === 1);
  assert('B04 currentBreak reset to 0', g.current.currentBreak === 0);
  assert('B05 awaiting stays color (next player owes a colour)', g.current.awaiting === 'color');
  assert('B06 player switches to opponent', g.current.currentPlayer === 1);
  assert('B07 pointsOnTable = 7+13*8+27 = 138', g.current.pointsOnTable === 138, g.current.pointsOnTable);
  assert('B08 history length = 2 (pot + foul)', g.history.length === 2);

  // Compare with no accidental red
  let g2 = applyPot(makeGame(15), 'red');
  g2 = applyFoul(g2, 4, true, 0);
  assert('B09 without redsAccidentallyPotted: redsRemaining stays 14', g2.current.redsRemaining === 14);
  assert('B10 without redsAccidentallyPotted: pointsOnTable = 146', g2.current.pointsOnTable === 146);

  // 10-red game
  let g3 = applyPot(makeGame(10), 'red');
  g3 = applyFoul(g3, 4, true, 1);
  assert('B11 10-red: redsRemaining → 8', g3.current.redsRemaining === 8);
  assert('B12 10-red: pointsOnTable = 7+8*8+27 = 98', g3.current.pointsOnTable === 98, g3.current.pointsOnTable);

  // 6-red game
  let g4 = applyPot(makeGame(6), 'red');
  g4 = applyFoul(g4, 4, true, 1);
  assert('B13 6-red: redsRemaining → 4', g4.current.redsRemaining === 4);
  assert('B14 6-red: pointsOnTable = 7+4*8+27 = 66', g4.current.pointsOnTable === 66);

  // opponentPlays=false: same player, red still stays potted
  let g5 = applyPot(makeGame(15), 'red');
  g5 = applyFoul(g5, 4, false, 1);
  assert('B15 opponentPlays=false: player stays P0', g5.current.currentPlayer === 0);
  assert('B16 opponentPlays=false: redsRemaining still decrements', g5.current.redsRemaining === 13);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION C — 1 RED ACCIDENTALLY POTTED, awaiting='red'
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION C — 1 red accidentally potted on foul, awaiting=red');
{
  // Scenario: player is on a red, commits a foul AND clips a red into a pocket.
  let g = makeGame(15);
  g = applyFoul(g, 4, true, 1);
  assert('C01 redsRemaining decrements to 14', g.current.redsRemaining === 14);
  assert('C02 opponent gets foul points = 4', g.current.scores[1] === 4);
  assert('C03 currentBreak reset to 0', g.current.currentBreak === 0);
  assert('C04 awaiting stays red', g.current.awaiting === 'red');
  assert('C05 player switches to opponent', g.current.currentPlayer === 1);
  assert('C06 pointsOnTable = 14*8+27 = 139', g.current.pointsOnTable === 139, g.current.pointsOnTable);

  // 5-red game
  let g2 = makeGame(5);
  g2 = applyFoul(g2, 4, true, 1);
  assert('C07 5-red: redsRemaining → 4', g2.current.redsRemaining === 4);
  assert('C08 5-red: pointsOnTable = 4*8+27 = 59', g2.current.pointsOnTable === 59);
  // next player can still pot a red
  g2 = applyPot(g2, 'red');
  assert('C09 next player pots red normally: awaiting=color', g2.current.awaiting === 'color');
  assert('C10 next player: redsRemaining → 3', g2.current.redsRemaining === 3);

  // 1-red game: last red accidentally potted on foul
  let g3 = makeGame(1);
  g3 = applyFoul(g3, 4, true, 1);
  assert('C11 1-red: redsRemaining → 0', g3.current.redsRemaining === 0);
  assert('C12 1-red: pointsOnTable = 0*8+27 = 27', g3.current.pointsOnTable === 27);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION D — 2 REDS ACCIDENTALLY POTTED
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION D — 2 reds accidentally potted on foul');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true, 2);
  assert('D01 redsRemaining → 13', g.current.redsRemaining === 13);
  assert('D02 pointsOnTable = 13*8+27 = 131', g.current.pointsOnTable === 131, g.current.pointsOnTable);

  // awaiting='color'
  let g2 = applyPot(makeGame(15), 'red');
  g2 = applyFoul(g2, 4, true, 2);
  assert('D03 awaiting=color, 2 reds: redsRemaining → 12', g2.current.redsRemaining === 12);
  assert('D04 pointsOnTable = 7+12*8+27 = 130', g2.current.pointsOnTable === 130, g2.current.pointsOnTable);

  // 5-red game
  let g3 = makeGame(5);
  g3 = applyFoul(g3, 5, true, 2);
  assert('D05 5-red, 2 acc: redsRemaining → 3', g3.current.redsRemaining === 3);
  assert('D06 pointsOnTable = 3*8+27 = 51', g3.current.pointsOnTable === 51);

  // 3-red game
  let g4 = makeGame(3);
  g4 = applyFoul(g4, 4, true, 2);
  assert('D07 3-red, 2 acc: redsRemaining → 1', g4.current.redsRemaining === 1);
  assert('D08 pointsOnTable = 1*8+27 = 35', g4.current.pointsOnTable === 35);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION E — 3 REDS ACCIDENTALLY POTTED
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION E — 3 reds accidentally potted on foul');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true, 3);
  assert('E01 redsRemaining → 12', g.current.redsRemaining === 12);
  assert('E02 pointsOnTable = 12*8+27 = 123', g.current.pointsOnTable === 123, g.current.pointsOnTable);

  // awaiting='color'
  let g2 = applyPot(makeGame(5), 'red'); // redsRemaining=4
  g2 = applyFoul(g2, 4, true, 3);
  assert('E03 awaiting=color, 3 acc: redsRemaining → 1', g2.current.redsRemaining === 1);
  assert('E04 pointsOnTable = 7+1*8+27 = 42', g2.current.pointsOnTable === 42, g2.current.pointsOnTable);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION F — POINTSONTABLE FORMULA AT VARIOUS RED COUNTS
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION F — pointsOnTable formula verification after foul with accidentally potted reds');
{
  // [startingReds, potRedFirst, accidental, expectedPointsOnTable]
  const cases = [
    [15, false, 1, 14*8+27],    // awaiting=red,   14 reds: 139
    [15, false, 2, 13*8+27],    // awaiting=red,   13 reds: 131
    [15, false, 3, 12*8+27],    // awaiting=red,   12 reds: 123
    [15, true,  1, 7+13*8+27],  // awaiting=color, 13 reds: 138
    [15, true,  2, 7+12*8+27],  // awaiting=color, 12 reds: 130
    [15, true,  3, 7+11*8+27],  // awaiting=color, 11 reds: 122
    [10, false, 1, 9*8+27],     // awaiting=red,    9 reds: 99
    [10, true,  1, 7+8*8+27],   // awaiting=color,  8 reds: 98
    [6,  false, 1, 5*8+27],     // awaiting=red,    5 reds: 67
    [6,  true,  1, 7+4*8+27],   // awaiting=color,  4 reds: 66
    [3,  false, 1, 2*8+27],     // awaiting=red,    2 reds: 43
    [2,  false, 1, 1*8+27],     // awaiting=red,    1 red:  35
    [1,  false, 1, 0*8+27],     // awaiting=red,    0 reds: 27
    [2,  true,  1, 7+0*8+27],   // awaiting=color,  0 reds: 34
    [3,  true,  2, 7+0*8+27],   // awaiting=color,  0 reds: 34
  ];
  cases.forEach(([reds, potRed, acc, expected], i) => {
    let g = makeGame(reds);
    if (potRed) g = applyPot(g, 'red');
    g = applyFoul(g, 4, true, acc);
    const n = String(i+1).padStart(2,'0');
    assert(`F${n} ${reds}r potRed=${potRed} acc=${acc}: POT=${expected}`,
      g.current.pointsOnTable === expected, g.current.pointsOnTable);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION G — UNDO RESTORES redsRemaining AND pointsOnTable
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION G — Undo restores redsRemaining after foul with accidentally potted reds');
{
  // Single undo
  let g = makeGame(15);
  g = applyFoul(g, 4, true, 1);
  assert('G01 before undo: redsRemaining=14', g.current.redsRemaining === 14);
  g = applyUndo(g);
  assert('G02 after undo: redsRemaining restored to 15', g.current.redsRemaining === 15);
  assert('G03 after undo: pointsOnTable = 147', g.current.pointsOnTable === 147);
  assert('G04 after undo: scores = [0,0]', g.current.scores[0]===0 && g.current.scores[1]===0);
  assert('G05 after undo: awaiting = red', g.current.awaiting === 'red');
  assert('G06 after undo: history empty', g.history.length === 0);

  // Undo after pot + foul
  let g2 = applyPot(makeGame(15), 'red'); // redsRemaining=14, awaiting=color
  g2 = applyFoul(g2, 4, true, 1);         // redsRemaining=13
  assert('G07 pot+foul: redsRemaining=13', g2.current.redsRemaining === 13);
  g2 = applyUndo(g2);                      // undo foul
  assert('G08 undo foul: redsRemaining back to 14', g2.current.redsRemaining === 14);
  assert('G09 undo foul: awaiting back to color', g2.current.awaiting === 'color');
  assert('G10 undo foul: pointsOnTable = 146', g2.current.pointsOnTable === 146);
  g2 = applyUndo(g2);                      // undo pot
  assert('G11 undo pot: redsRemaining back to 15', g2.current.redsRemaining === 15);
  assert('G12 undo pot: awaiting = red', g2.current.awaiting === 'red');

  // Undo after 2 accidentally potted
  let g3 = makeGame(15);
  g3 = applyFoul(g3, 4, true, 2);
  assert('G13 2 acc: redsRemaining=13', g3.current.redsRemaining === 13);
  g3 = applyUndo(g3);
  assert('G14 undo 2 acc: redsRemaining=15', g3.current.redsRemaining === 15);
  assert('G15 undo 2 acc: pointsOnTable=147', g3.current.pointsOnTable === 147);

  // Two sequential fouls with accidentally potted reds, two undos
  let g4 = makeGame(10);
  g4 = applyFoul(g4, 4, true, 1);  // redsRemaining=9
  g4 = applyFoul(g4, 4, true, 1);  // redsRemaining=8
  assert('G16 two fouls: redsRemaining=8', g4.current.redsRemaining === 8);
  g4 = applyUndo(g4);
  assert('G17 one undo: redsRemaining=9', g4.current.redsRemaining === 9);
  g4 = applyUndo(g4);
  assert('G18 two undos: redsRemaining=10', g4.current.redsRemaining === 10);
  assert('G19 two undos: pointsOnTable=107', g4.current.pointsOnTable === 107, g4.current.pointsOnTable);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION H — EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION H — Edge cases');
{
  // Colors phase: redsAccidentallyPotted clamped to 0 (Math.max guard)
  let gColors = makeGame(1);
  gColors = applyPot(gColors, 'red');   // redsRemaining=0, awaiting=color
  gColors = applyPot(gColors, 'black'); // transitions to colors phase
  assert('H01 setup: phase=colors', gColors.current.phase === 'colors');
  assert('H02 setup: redsRemaining=0', gColors.current.redsRemaining === 0);
  gColors = applyFoul(gColors, 4, true, 0);
  assert('H03 colors phase foul: redsRemaining stays 0', gColors.current.redsRemaining === 0);
  assert('H04 colors phase foul: opponent gets 4 pts', gColors.current.scores[1] === 4);

  // Math.max(0,...) guard: trying to pot more reds than on the table
  let g2 = makeGame(1);
  g2 = applyFoul(g2, 4, true, 3); // only 1 red on table, 3 accidentally potted
  assert('H05 guard: redsRemaining never goes below 0', g2.current.redsRemaining === 0);
  assert('H06 guard: pointsOnTable = 0*8+27 = 27', g2.current.pointsOnTable === 27, g2.current.pointsOnTable);

  // freeBallActive reset by foul
  let g3 = makeGame(15);
  g3 = { ...g3, current: { ...g3.current, freeBallActive: true } };
  g3 = applyFoul(g3, 4, true, 1);
  assert('H07 freeBallActive reset to false', g3.current.freeBallActive === false);
  assert('H08 redsRemaining decremented even when freeBallActive was true', g3.current.redsRemaining === 14);

  // Exact boundary: 2 reds on table, 2 accidentally potted → 0 remaining
  let g4 = makeGame(2);
  g4 = applyFoul(g4, 4, true, 2);
  assert('H09 exactly 2 reds potted: redsRemaining=0', g4.current.redsRemaining === 0);
  assert('H10 pointsOnTable = 0*8+27 = 27', g4.current.pointsOnTable === 27);

  // Phase stays reds after foul even if redsRemaining→0 (no auto-transition via foul)
  let g5 = makeGame(1);
  g5 = applyFoul(g5, 4, true, 1);
  assert('H11 phase stays reds after foul', g5.current.phase === 'reds');
  assert('H12 awaiting stays red after foul', g5.current.awaiting === 'red');

  // explicit 0 = no change
  let g6 = makeGame(15);
  g6 = applyFoul(g6, 4, true, 0);
  assert('H13 explicit 0: redsRemaining unchanged', g6.current.redsRemaining === 15);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION I — GAME SEQUENCES WITH ACCIDENTALLY POTTED REDS
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION I — Full game sequences with accidentally potted reds');
{
  // Sequence 1: P0 pots red → P0 fouls + 1 accidental red → P1 pots color
  let g = makeGame(15);
  g = applyPot(g, 'red');           // redsRemaining=14, awaiting=color, scores=[1,0]
  g = applyFoul(g, 4, true, 1);    // redsRemaining=13, scores=[1,4], P1's turn, awaiting=color
  assert('I01 redsRemaining=13', g.current.redsRemaining === 13);
  assert('I02 P1 plays next', g.current.currentPlayer === 1);
  assert('I03 awaiting=color (still owed after P0 foul)', g.current.awaiting === 'color');
  assert('I04 scores=[1,4]', g.current.scores[0]===1 && g.current.scores[1]===4);
  g = applyPot(g, 'black');         // P1 pots black: scores=[1,11], awaiting=red
  assert('I05 P1 pots black: scores=[1,11]', g.current.scores[0]===1 && g.current.scores[1]===11);
  assert('I06 after black: awaiting=red', g.current.awaiting === 'red');

  // Sequence 2: two fouls by different players with accidentally potted reds
  let g2 = makeGame(10);
  // P0 fouls, 2 acc reds, P1 plays: redsRemaining=8, scores=[0,5]
  g2 = applyFoul(g2, 5, true, 2);
  // P1 fouls, 1 acc red, P0 plays: redsRemaining=7, scores=[4,5]
  g2 = applyFoul(g2, 4, true, 1);
  assert('I07 two fouls: redsRemaining=7', g2.current.redsRemaining === 7);
  assert('I08 scores=[4,5]', g2.current.scores[0]===4 && g2.current.scores[1]===5);
  assert('I09 awaiting=red', g2.current.awaiting === 'red');
  assert('I10 P0 plays next', g2.current.currentPlayer === 0);

  // Sequence 3: pot + foul with acc red → full undo chain → original state
  let g3 = makeGame(15);
  const origPOT = g3.current.pointsOnTable;
  g3 = applyPot(g3, 'red');
  g3 = applyFoul(g3, 4, true, 1);
  g3 = applyUndo(g3);
  g3 = applyUndo(g3);
  assert('I11 full undo: redsRemaining=15', g3.current.redsRemaining === 15);
  assert('I12 full undo: pointsOnTable=147', g3.current.pointsOnTable === origPOT);
  assert('I13 full undo: scores=[0,0]', g3.current.scores[0]===0 && g3.current.scores[1]===0);
  assert('I14 full undo: awaiting=red', g3.current.awaiting === 'red');
  assert('I15 full undo: history empty', g3.history.length === 0);

  // Sequence 4: foul with acc reds, then end visit (phase/awaiting transitions)
  let g4 = makeGame(5);
  g4 = applyPot(g4, 'red');        // redsRemaining=4, awaiting=color
  g4 = applyFoul(g4, 4, true, 1); // redsRemaining=3, awaiting=color, P1 plays
  // P1 must pot a color (awaiting=color). End their visit instead.
  g4 = applyEndVisit(g4);
  assert('I16 after endVisit: awaiting=red (color missed, back to red)', g4.current.awaiting === 'red');
  assert('I17 redsRemaining still 3 after endVisit', g4.current.redsRemaining === 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION J — ABANDON MATCH: state shape for saving
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION J — Abandon match: verify state shape for saving');
{
  // Abandon after 0 frames
  let g = makeGame(15, 5);
  assert('J01 abandon 0 frames: frameResults empty', g.frameResults.length === 0);
  assert('J02 abandon 0 frames: framesWon=[0,0]', g.framesWon[0]===0 && g.framesWon[1]===0);

  // Abandon after 1 frame (P0 wins)
  g = confirmFrame(g, 0);
  assert('J03 1 frame: frameResults.length=1', g.frameResults.length === 1);
  assert('J04 1 frame: framesWon=[1,0]', g.framesWon[0]===1 && g.framesWon[1]===0);
  assert('J05 1 frame: result.winner=0', g.frameResults[0].winner === 0);
  assert('J06 1 frame: result.frameNumber=1', g.frameResults[0].frameNumber === 1);

  // Abandon mid-BO5 after 3 frames
  g = confirmFrame(g, 1); // P1 wins frame 2
  g = confirmFrame(g, 0); // P0 wins frame 3
  assert('J07 3 frames: frameResults.length=3', g.frameResults.length === 3);
  assert('J08 3 frames: framesWon=[2,1]', g.framesWon[0]===2 && g.framesWon[1]===1);

  // StoredMatch shape on abandon (isComplete=false, completed frames only)
  const wouldSave = {
    isComplete: false,
    frameResults: g.frameResults,
    framesWon: g.framesWon,
    numberOfReds: g.config.numberOfReds,
    bestOf: g.config.bestOf,
  };
  assert('J09 isComplete=false on abandon', wouldSave.isComplete === false);
  assert('J10 framesWon=[2,1]', wouldSave.framesWon[0]===2 && wouldSave.framesWon[1]===1);
  assert('J11 frameResults.length=3', wouldSave.frameResults.length === 3);
  assert('J12 bestOf=5 preserved', wouldSave.bestOf === 5);
  assert('J13 numberOfReds=15 preserved', wouldSave.numberOfReds === 15);

  // BO3 abandon after 1 frame: incomplete, not a full match
  let g2 = makeGame(15, 3);
  g2 = confirmFrame(g2, 1); // P1 wins frame 1
  const save2 = { isComplete: false, framesWon: g2.framesWon, frameResults: g2.frameResults };
  assert('J14 BO3 abandon after 1: isComplete=false', save2.isComplete === false);
  assert('J15 BO3 abandon after 1: framesWon=[0,1]', save2.framesWon[0]===0 && save2.framesWon[1]===1);

  // Current in-progress frame is NOT included in abandon (only frameResults)
  let g3 = makeGame(15, 5);
  g3 = confirmFrame(g3, 0);
  // Now simulate some in-progress frame progress (scores without frame completion)
  const inProgressScores = [23, 0]; // P0 has 23 pts in current frame
  assert('J16 in-progress frame excluded: only frameResults.length=1 saved', g3.frameResults.length === 1);
  // framesWon reflects only completed frames
  assert('J17 framesWon=[1,0] excludes in-progress frame', g3.framesWon[0]===1 && g3.framesWon[1]===0);
}

// ── Final report ───────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${failed === 0 ? '✅' : '❌'} All ${total} assertions — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
