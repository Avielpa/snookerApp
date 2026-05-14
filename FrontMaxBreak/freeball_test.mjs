// Free ball logic test suite — 100 assertions.
// Runs in Node.js (no React). Logic mirrors the planned changes to useSnookerGame.ts.
// Run: node freeball_test.mjs

// ── Inline game logic (kept in sync with useSnookerGame.ts) ──────────────────

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27;
const ALL_BALLS = ['red','yellow','green','brown','blue','pink','black'];

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
    isFrameOver: false,
    freeBallActive: false,   // NEW FIELD
  };
}

function makeGame(numberOfReds=15, bestOf=null) {
  return {
    config:{numberOfReds,bestOf}, framesWon:[0,0], frameResults:[],
    frameNumber:1, current: makeInitialFrame(numberOfReds,0),
    history:[], frameHighestBreak:[0,0], isMatchOver:false, matchWinner:null,
  };
}

// Returns all balls when freeBallActive, otherwise normal rules.
function getAvailableBalls(snap) {
  if (snap.isFrameOver) return [];
  if (snap.freeBallActive) return [...ALL_BALLS];   // NEW: any ball can be nominated
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0,1);
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}

function applyPot(state, ball) {
  const snap = state.current;
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. Phase=${snap.phase} awaiting=${snap.awaiting}`);

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
    scores: newScores, currentBreak: newBreak, currentPlayer: snap.currentPlayer,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining, isFrameOver, freeBallActive: false,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyFoul(state, foulValue, opponentPlays=true) {
  const snap = state.current;
  const opponent = snap.currentPlayer===0?1:0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newSnap = { ...snap, scores: newScores, currentBreak:0, currentPlayer: newPlayer, awaiting: snap.awaiting };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function applyEndVisit(state) {
  const snap = state.current;
  return { ...state, current: { ...snap, currentPlayer: snap.currentPlayer===0?1:0, currentBreak:0 }, history:[...state.history,snap] };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

// NEW: declareFreesBall — sets freeBallActive=true, pushes to history
function applyDeclareFreesBall(state) {
  const snap = state.current;
  if (state.isMatchOver || snap.isFrameOver) return state;
  return { ...state, current: { ...snap, freeBallActive: true }, history: [...state.history, snap] };
}

// NEW: applyFreeBall — scores as on-ball value, respots nominated ball
function applyFreeBall(state, nominatedBall) {
  const snap = state.current;
  if (!snap.freeBallActive || snap.isFrameOver || state.isMatchOver) return state;

  let scoreValue;
  let newPhase = snap.phase;
  let newRedsRemaining = snap.redsRemaining;
  let newAwaiting = snap.awaiting;
  let newColorsRemaining = [...snap.colorsRemaining];
  let isFrameOver = false;

  if (snap.phase === 'reds') {
    if (snap.awaiting === 'red') {
      // On-ball is red: free ball always scores 1; redsRemaining unchanged (free ball respotted)
      scoreValue = 1;
      newAwaiting = 'color';
      // redsRemaining stays the same — the actual red is still on the table
    } else {
      // awaiting=color: on-ball is a colour; free ball scores its own value
      scoreValue = BALL_VALUES[nominatedBall];
      if (snap.redsRemaining === 0) {
        newPhase = 'colors';
        newColorsRemaining = [...COLORS_SEQUENCE];
      } else {
        newAwaiting = 'red';
      }
    }
  } else {
    // Colors phase: scores on-color value, advances sequence
    scoreValue = BALL_VALUES[newColorsRemaining[0]];
    newColorsRemaining = newColorsRemaining.slice(1);
    if (newColorsRemaining.length === 0) isFrameOver = true;
  }

  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += scoreValue;
  const newBreak = snap.currentBreak + scoreValue;

  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;

  const newSnap = {
    ...snap,
    scores: newScores, currentBreak: newBreak,
    phase: newPhase, redsRemaining: newRedsRemaining, awaiting: newAwaiting,
    colorsRemaining: newColorsRemaining,
    pointsOnTable: isFrameOver ? 0 : calcPointsOnTable(newPhase, newRedsRemaining, newAwaiting, newColorsRemaining),
    isFrameOver, freeBallActive: false,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

// Helper: drive reds phase to colors phase; leaves game on=yellow in colors phase.
function driveToColorsPhase(g) {
  const nReds = g.config.numberOfReds;
  for (let i = 0; i < nReds; i++) {
    g = applyPot(g, 'red');
    if (i < nReds - 1) g = applyPot(g, 'yellow'); // color returns to table in reds phase
  }
  // redsRemaining=0, awaiting=color — pot yellow to trigger colors phase
  g = applyPot(g, 'yellow'); // colorsRemaining resets to full sequence; on=yellow
  return g;
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed=0, failed=0;
function assert(label, condition, extra='') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra?` — got: ${extra}`:''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — INITIAL STATE: freeBallActive defaults to false
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 1 — Initial state: freeBallActive defaults to false');
{
  let g = makeGame(15);
  assert('1. 15-red game: freeBallActive starts false', g.current.freeBallActive === false);

  let g2 = makeGame(6);
  assert('2. 6-red game: freeBallActive starts false', g2.current.freeBallActive === false);

  let g3 = makeGame(15);
  g3 = applyPot(g3, 'red');
  assert('3. after pot red: freeBallActive still false', g3.current.freeBallActive === false);

  let g4 = makeGame(15);
  g4 = applyEndVisit(g4);
  assert('4. after endVisit: freeBallActive still false', g4.current.freeBallActive === false);

  let g5 = makeGame(15);
  g5 = applyFoul(g5, 4, true);
  assert('5. after foul (no free ball declared): freeBallActive still false', g5.current.freeBallActive === false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — declareFreesBall: state transitions
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 2 — declareFreesBall: state transitions');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true);
  const histBefore = g.history.length;
  g = applyDeclareFreesBall(g);

  assert('6. after declareFreesBall: freeBallActive=true', g.current.freeBallActive === true);
  assert('7. declareFreesBall does not change scores', g.current.scores[0]===0 && g.current.scores[1]===4);
  assert('8. declareFreesBall does not change awaiting', g.current.awaiting === 'red');
  assert('9. declareFreesBall does not change phase', g.current.phase === 'reds');
  assert('10. declareFreesBall pushes to history', g.history.length === histBefore + 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Free ball: reds phase, awaiting=red
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 3 — Free ball in reds phase, awaiting=red');
{
  // Setup: foul at start (awaiting=red), opponent plays, declare free ball
  function setupFreeBallRed(nReds=15) {
    let g = makeGame(nReds);
    g = applyFoul(g, 4, true); // opponent now plays, awaiting=red
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g = setupFreeBallRed();
  let before = g.current.scores[1]; // opponent (P1) is now current player after foul
  g = applyFreeBall(g, 'yellow');
  assert('11. free ball as yellow when awaiting=red: scores +1 (not +2)', g.current.scores[1] === before + 1);

  let g2 = setupFreeBallRed();
  let before2 = g2.current.scores[1];
  g2 = applyFreeBall(g2, 'black');
  assert('12. free ball as black when awaiting=red: scores +1 (not +7)', g2.current.scores[1] === before2 + 1);

  let g3 = setupFreeBallRed();
  let before3 = g3.current.scores[1];
  g3 = applyFreeBall(g3, 'red');
  assert('13. free ball as red when awaiting=red: scores +1', g3.current.scores[1] === before3 + 1);

  let g4 = setupFreeBallRed();
  g4 = applyFreeBall(g4, 'blue');
  assert('14. after free ball as red: awaiting becomes color', g4.current.awaiting === 'color');

  let g5 = setupFreeBallRed(15);
  g5 = applyFreeBall(g5, 'pink');
  assert('15. after free ball as red: redsRemaining unchanged (still 15)', g5.current.redsRemaining === 15);

  let g6 = setupFreeBallRed();
  g6 = applyFreeBall(g6, 'green');
  assert('16. after free ball as red: phase still reds', g6.current.phase === 'reds');

  let g7 = setupFreeBallRed();
  g7 = applyFreeBall(g7, 'blue');
  assert('17. after free ball: freeBallActive resets to false', g7.current.freeBallActive === false);

  let g8 = setupFreeBallRed();
  const breakBefore = g8.current.currentBreak;
  g8 = applyFreeBall(g8, 'yellow');
  assert('18. after free ball as red: currentBreak increments by 1', g8.current.currentBreak === breakBefore + 1);

  let g9 = setupFreeBallRed();
  const histLen = g9.history.length;
  g9 = applyFreeBall(g9, 'yellow');
  assert('19. applyFreeBall pushes to history', g9.history.length === histLen + 1);

  let g10 = setupFreeBallRed();
  const playerBefore = g10.current.currentPlayer;
  g10 = applyFreeBall(g10, 'yellow');
  assert('20. applyFreeBall does not change currentPlayer', g10.current.currentPlayer === playerBefore);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Free ball: reds phase, awaiting=color
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 4 — Free ball in reds phase, awaiting=color');
{
  // Setup: pot a red, then foul, then declare free ball (awaiting=color)
  function setupFreeBallColor(nReds=15) {
    let g = makeGame(nReds);
    g = applyPot(g, 'red');     // awaiting=color now
    g = applyFoul(g, 4, true);  // foul while awaiting color; opponent plays
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g = setupFreeBallColor();
  const scoreBefore = g.current.scores[1]; // P1 is current (opponent played after foul)
  g = applyFreeBall(g, 'blue');
  assert('21. free ball as blue when awaiting=color: score +5 (blue value)', g.current.scores[1] === scoreBefore + 5);

  let g2 = setupFreeBallColor();
  g2 = applyFreeBall(g2, 'green');
  assert('22. after free ball (awaiting=color): awaiting becomes red', g2.current.awaiting === 'red');

  let g3 = setupFreeBallColor(10);
  const redsBefore = g3.current.redsRemaining;
  g3 = applyFreeBall(g3, 'pink');
  assert('23. after free ball (awaiting=color): redsRemaining unchanged', g3.current.redsRemaining === redsBefore);

  let g4 = setupFreeBallColor();
  g4 = applyFreeBall(g4, 'yellow');
  assert('24. after free ball (awaiting=color): freeBallActive resets to false', g4.current.freeBallActive === false);

  let g5 = setupFreeBallColor();
  g5 = applyFreeBall(g5, 'black');
  assert('25. after free ball (awaiting=color): phase still reds', g5.current.phase === 'reds');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Free ball: colors phase
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 5 — Free ball in colors phase');
{
  function setupFreeBallColorsPhase() {
    let g = makeGame(1); // 1 red for speed
    g = driveToColorsPhase(g); // now in colors phase, on=yellow
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g = setupFreeBallColorsPhase(); // on=yellow (2pts)
  const scoreBefore = g.current.scores[1];
  g = applyFreeBall(g, 'black'); // nominate black, but scores yellow's value
  assert('26. free ball as black in colors phase (on=yellow): score +2', g.current.scores[1] === scoreBefore + 2);

  let g2 = setupFreeBallColorsPhase();
  const score2Before = g2.current.scores[1];
  g2 = applyFreeBall(g2, 'red'); // even red as nominee scores on-color value
  assert('27. free ball as red in colors phase (on=yellow): score +2 (not +1)', g2.current.scores[1] === score2Before + 2);

  let g3 = setupFreeBallColorsPhase();
  g3 = applyFreeBall(g3, 'pink');
  assert('28. after free ball in colors: colorsRemaining advances (yellow removed)', g3.current.colorsRemaining[0] === 'green');

  let g4 = setupFreeBallColorsPhase();
  g4 = applyFreeBall(g4, 'red');
  assert('29. after free ball in colors: freeBallActive resets', g4.current.freeBallActive === false);

  let g5 = setupFreeBallColorsPhase();
  g5 = applyFreeBall(g5, 'blue');
  assert('30. after free ball (on=yellow): next on-ball is green', g5.current.colorsRemaining[0] === 'green');

  let g5b = setupFreeBallColorsPhase();
  g5b = applyFreeBall(g5b, 'red');
  assert('31. after free ball in colors: phase remains colors', g5b.current.phase === 'colors');

  // On green
  function setupFreeBallOnGreen() {
    let g = makeGame(1);
    g = driveToColorsPhase(g); // on=yellow
    g = applyPot(g, 'yellow'); // advance to green
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g6 = setupFreeBallOnGreen(); // on=green (3pts)
  const s6 = g6.current.scores[1];
  g6 = applyFreeBall(g6, 'black');
  assert('32. free ball in colors (on=green): score +3', g6.current.scores[1] === s6 + 3);

  // On blue (4th color)
  function setupFreeBallOnBlue() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    g = applyPot(g, 'yellow');
    g = applyPot(g, 'green');
    g = applyPot(g, 'brown');
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g7 = setupFreeBallOnBlue(); // on=blue (5pts)
  const s7 = g7.current.scores[1];
  g7 = applyFreeBall(g7, 'red');
  assert('33. free ball in colors (on=blue): score +5', g7.current.scores[1] === s7 + 5);

  // On pink
  function setupFreeBallOnPink() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown','blue'].forEach(b => { g = applyPot(g, b); });
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g8 = setupFreeBallOnPink(); // on=pink (6pts)
  const s8 = g8.current.scores[1];
  g8 = applyFreeBall(g8, 'yellow');
  assert('34. free ball in colors (on=pink): score +6', g8.current.scores[1] === s8 + 6);

  // On black (last color)
  function setupFreeBallOnBlack() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown','blue','pink'].forEach(b => { g = applyPot(g, b); });
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g9 = setupFreeBallOnBlack(); // on=black (7pts, last color)
  const s9 = g9.current.scores[1];
  g9 = applyFreeBall(g9, 'yellow');
  assert('35. free ball in colors (on=black, last): score +7', g9.current.scores[1] === s9 + 7);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Free ball on last color (black): frame ends
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 6 — Free ball on last color (black): frame ends');
{
  function setupFreeBallOnBlack() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown','blue','pink'].forEach(b => { g = applyPot(g, b); });
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g = setupFreeBallOnBlack();
  g = applyFreeBall(g, 'red'); // nominate red, but scores black (7)
  assert('36. free ball on black: isFrameOver=true', g.current.isFrameOver === true);
  assert('37. free ball on black: pointsOnTable=0', g.current.pointsOnTable === 0);
  assert('38. free ball on black: colorsRemaining=[]', g.current.colorsRemaining.length === 0);

  let g2 = setupFreeBallOnBlack();
  const sBefore = g2.current.scores[1];
  g2 = applyFreeBall(g2, 'green');
  assert('39. free ball on black: score +=7', g2.current.scores[1] === sBefore + 7);

  let g3 = setupFreeBallOnBlack();
  g3 = applyFreeBall(g3, 'yellow');
  assert('40. free ball on black: freeBallActive=false after frame ends', g3.current.freeBallActive === false);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — pointsOnTable correctness after free ball
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 7 — pointsOnTable correctness after free ball');
{
  // Free ball as red (awaiting=red): redsRemaining unchanged, awaiting becomes color
  // pointsOnTable = 7 + redsRemaining*8 + 27

  let g1 = makeGame(15);
  g1 = applyFoul(g1, 4, true);
  g1 = applyDeclareFreesBall(g1);
  g1 = applyFreeBall(g1, 'blue');
  // redsRemaining=15, awaiting=color: 7 + 15*8 + 27 = 154
  assert('41. 15 reds, free ball as red: pointsOnTable = 154', g1.current.pointsOnTable === 154);

  let g2 = makeGame(10);
  g2 = applyFoul(g2, 4, true);
  g2 = applyDeclareFreesBall(g2);
  g2 = applyFreeBall(g2, 'yellow');
  // redsRemaining=10, awaiting=color: 7 + 10*8 + 27 = 114
  assert('42. 10 reds, free ball as red: pointsOnTable = 114', g2.current.pointsOnTable === 114);

  let g3 = makeGame(6);
  g3 = applyFoul(g3, 4, true);
  g3 = applyDeclareFreesBall(g3);
  g3 = applyFreeBall(g3, 'pink');
  // redsRemaining=6, awaiting=color: 7 + 6*8 + 27 = 82
  assert('43. 6 reds, free ball as red: pointsOnTable = 82', g3.current.pointsOnTable === 82);

  // Colors phase: after free ball on yellow, remaining = [green,brown,blue,pink,black] = 3+4+5+6+7 = 25
  function gColorsYellow() {
    let g = makeGame(1);
    g = driveToColorsPhase(g); // on=yellow
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g4 = gColorsYellow();
  g4 = applyFreeBall(g4, 'black');
  assert('44. colors phase, free ball on yellow: pointsOnTable = 25', g4.current.pointsOnTable === 25);

  // After free ball on green (remaining=[brown,blue,pink,black]=4+5+6+7=22)
  function gColorsGreen() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    g = applyPot(g, 'yellow');
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g5 = gColorsGreen();
  g5 = applyFreeBall(g5, 'red');
  assert('45. colors phase, free ball on green: pointsOnTable = 22', g5.current.pointsOnTable === 22);

  // After free ball on brown (remaining=[blue,pink,black]=5+6+7=18)
  function gColorsBrown() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    g = applyPot(g, 'yellow');
    g = applyPot(g, 'green');
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g6 = gColorsBrown();
  g6 = applyFreeBall(g6, 'yellow');
  assert('46. colors phase, free ball on brown: pointsOnTable = 18', g6.current.pointsOnTable === 18);

  // After free ball on blue (remaining=[pink,black]=6+7=13)
  function gColorsBlue() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown'].forEach(b => { g = applyPot(g, b); });
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g7 = gColorsBlue();
  g7 = applyFreeBall(g7, 'green');
  assert('47. colors phase, free ball on blue: pointsOnTable = 13', g7.current.pointsOnTable === 13);

  // After free ball on pink (remaining=[black]=7)
  function gColorsPink() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown','blue'].forEach(b => { g = applyPot(g, b); });
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g8 = gColorsPink();
  g8 = applyFreeBall(g8, 'red');
  assert('48. colors phase, free ball on pink: pointsOnTable = 7', g8.current.pointsOnTable === 7);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Undo after declareFreesBall
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 8 — Undo after declareFreesBall');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true);
  const stateAfterFoul = g;
  g = applyDeclareFreesBall(g);
  const histLen = g.history.length;
  g = applyUndo(g);

  assert('49. undo after declareFreesBall: freeBallActive goes back to false', g.current.freeBallActive === false);
  assert('50. undo after declareFreesBall: scores unchanged (still 4 to P1)', g.current.scores[1] === 4);
  assert('51. undo after declareFreesBall: awaiting unchanged (still red)', g.current.awaiting === 'red');
  assert('52. undo after declareFreesBall: history.length decrements', g.history.length === histLen - 1);

  // Double undo: undo free ball declaration, then undo foul
  let g2 = makeGame(15);
  g2 = applyFoul(g2, 4, true);
  g2 = applyDeclareFreesBall(g2);
  g2 = applyUndo(g2); // undo declare
  g2 = applyUndo(g2); // undo foul
  assert('53. double undo reverts to pre-foul state: scores [0,0]',
    g2.current.scores[0]===0 && g2.current.scores[1]===0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Undo after applyFreeBall
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 9 — Undo after applyFreeBall');
{
  function setupAndApplyFreeBall() {
    let g = makeGame(15);
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    g = applyFreeBall(g, 'blue');
    return g;
  }

  let g = setupAndApplyFreeBall();
  const scoreBefore = g.current.scores[1];
  const breakBefore = g.current.currentBreak;
  g = applyUndo(g);

  assert('54. undo after applyFreeBall: score reverts (freeBallActive=true again)', g.current.freeBallActive === true);
  assert('55. undo after applyFreeBall: freeBallActive restored to true', g.current.freeBallActive === true);
  assert('56. undo after applyFreeBall: awaiting reverts to red', g.current.awaiting === 'red');
  assert('57. undo after applyFreeBall: redsRemaining reverts', g.current.redsRemaining === 15);
  assert('58. undo after applyFreeBall: currentBreak reverts to 0', g.current.currentBreak === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — Break and highest break tracking
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 10 — Break and highest break tracking');
{
  let g = makeGame(15);
  g = applyFoul(g, 4, true); // P1 gets 4, P1 plays
  g = applyDeclareFreesBall(g);
  g = applyFreeBall(g, 'black'); // free ball as red: scores 1
  assert('59. free ball in reds phase: currentBreak = 1', g.current.currentBreak === 1);

  // Free ball in colors phase on black scores 7
  function gFreeBallBlackColors() {
    let g = makeGame(1);
    g = driveToColorsPhase(g);
    ['yellow','green','brown','blue','pink'].forEach(b => { g = applyPot(g, b); });
    // on=black
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }
  let g2 = gFreeBallBlackColors();
  const breakBefore = g2.current.currentBreak;
  g2 = applyFreeBall(g2, 'yellow');
  assert('60. free ball in colors on black: currentBreak increments by 7', g2.current.currentBreak === breakBefore + 7);

  // Highest break updated
  let g3 = makeGame(15);
  g3 = applyFoul(g3, 4, true);
  g3 = applyDeclareFreesBall(g3);
  g3 = applyFreeBall(g3, 'yellow'); // P1 scored 1
  assert('61. free ball: frameHighestBreak updated if newBreak > previous', g3.frameHighestBreak[1] === 1);

  // Highest break NOT updated if already higher
  let g4 = makeGame(15);
  g4 = applyPot(g4, 'red'); // P0 scores 1
  g4 = applyPot(g4, 'black'); // P0 scores 7 (break=8)
  g4 = applyEndVisit(g4); // P1 plays
  g4 = applyFoul(g4, 4, false); // P0 fouls, P0 plays again (break reset), P1 +4
  // Hmm this is getting complicated. Let's use a simpler setup.
  let g4b = makeGame(15);
  // Build up P0 break to 8 first
  g4b = applyPot(g4b, 'red');
  g4b = applyPot(g4b, 'black'); // break=8, highest=8
  // Now end visit, foul, free ball (scoring 1)
  g4b = applyEndVisit(g4b); // P1's turn
  g4b = applyFoul(g4b, 4, false); // P0 gets 4 pts, P0 plays
  // P0's highest break is currently 8; free ball scores 1, new break = 1, should NOT update highest
  g4b = applyDeclareFreesBall(g4b);
  g4b = applyFreeBall(g4b, 'pink');
  assert('62. free ball: highest break NOT updated when new break < existing highest',
    g4b.frameHighestBreak[0] === 8);

  let g5 = makeGame(15);
  g5 = applyFoul(g5, 4, true);
  g5 = applyDeclareFreesBall(g5);
  g5 = applyFreeBall(g5, 'green');
  // P1 now on break=1; pot a black (7) to extend
  g5 = applyPot(g5, 'black'); // awaiting=color after free ball, pot black: break=8
  assert('63. free ball score counts in cumulative break total', g5.current.currentBreak === 8);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — Guard conditions
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 11 — Guard conditions');
{
  // declareFreesBall when frame is over: no change
  let g1 = makeGame(1);
  g1 = driveToColorsPhase(g1);
  ['yellow','green','brown','blue','pink','black'].forEach(b => { g1 = applyPot(g1, b); });
  // frame should be over now
  const stateWhenOver = g1;
  g1 = applyDeclareFreesBall(g1);
  assert('64. declareFreesBall when isFrameOver: no change (freeBallActive stays false)',
    g1.current.freeBallActive === false);

  // applyFreeBall when freeBallActive=false: no change
  let g2 = makeGame(15);
  g2 = applyFoul(g2, 4, true); // freeBallActive is false
  const scoresBefore2 = [...g2.current.scores];
  g2 = applyFreeBall(g2, 'blue'); // should be ignored
  assert('65. applyFreeBall when freeBallActive=false: no change (scores unchanged)',
    g2.current.scores[0]===scoresBefore2[0] && g2.current.scores[1]===scoresBefore2[1]);

  // applyFreeBall when frame is over: no change
  let g3 = makeGame(1);
  g3 = driveToColorsPhase(g3);
  ['yellow','green','brown','blue','pink','black'].forEach(b => { g3 = applyPot(g3, b); });
  g3.current.freeBallActive = true; // force active manually
  const stateBeforeFB = { ...g3, current: { ...g3.current, freeBallActive: true } };
  const result = applyFreeBall(stateBeforeFB, 'yellow');
  assert('66. applyFreeBall when isFrameOver: no change', result.current.isFrameOver === true && result.current.scores[0] === stateBeforeFB.current.scores[0]);

  // declareFreesBall twice
  let g4 = makeGame(15);
  g4 = applyFoul(g4, 4, true);
  g4 = applyDeclareFreesBall(g4);
  const histAfterFirst = g4.history.length;
  g4 = applyDeclareFreesBall(g4); // second declare
  assert('67. declareFreesBall twice: freeBallActive stays true, history has another entry',
    g4.current.freeBallActive === true && g4.history.length === histAfterFirst + 1);

  // Undo declareFreesBall then try applyFreeBall
  let g5 = makeGame(15);
  g5 = applyFoul(g5, 4, true);
  g5 = applyDeclareFreesBall(g5);
  g5 = applyUndo(g5); // undo: freeBallActive=false
  const scoresBeforeAttempt = [...g5.current.scores];
  g5 = applyFreeBall(g5, 'blue'); // should be ignored
  assert('68. applyFreeBall after undoing declareFreesBall: ignored (scores unchanged)',
    g5.current.scores[0]===scoresBeforeAttempt[0] && g5.current.scores[1]===scoresBeforeAttempt[1]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — Free ball with 1 red remaining
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 12 — Free ball with 1 red remaining');
{
  function setup1RedFreeBall() {
    let g = makeGame(1); // 1 red
    g = applyFoul(g, 4, true);
    g = applyDeclareFreesBall(g);
    return g;
  }

  let g = setup1RedFreeBall();
  g = applyFreeBall(g, 'black');
  assert('69. 1-red game, free ball as red: score +1', g.current.scores[1] === 5); // 4 from foul + 1

  let g2 = setup1RedFreeBall();
  g2 = applyFreeBall(g2, 'yellow');
  assert('70. 1-red game, free ball: redsRemaining still 1', g2.current.redsRemaining === 1);

  let g3 = setup1RedFreeBall();
  g3 = applyFreeBall(g3, 'pink');
  // after free ball: awaiting=color; now pot a color (black)
  g3 = applyPot(g3, 'black'); // awaiting=red now, redsRemaining=1
  assert('71. after free ball+color: can pot the actual last red (awaiting=red)',
    g3.current.awaiting === 'red' && g3.current.redsRemaining === 1);

  let g4 = setup1RedFreeBall();
  g4 = applyFreeBall(g4, 'green');  // free ball as red: redsRemaining=1, awaiting=color
  g4 = applyPot(g4, 'black');       // pot color: awaiting=red, redsRemaining=1
  g4 = applyPot(g4, 'red');         // pot actual last red: redsRemaining=0, awaiting=color
  assert('72. after free ball + color + actual red: redsRemaining=0, awaiting=color',
    g4.current.redsRemaining === 0 && g4.current.awaiting === 'color');

  let g5 = setup1RedFreeBall();
  g5 = applyFreeBall(g5, 'blue');
  g5 = applyPot(g5, 'black');    // color
  g5 = applyPot(g5, 'red');      // last actual red; redsRemaining=0
  g5 = applyPot(g5, 'yellow');   // color with redsRemaining=0 → transitions to colors phase
  assert('73. 1-red game full sequence after free ball: reaches colors phase',
    g5.current.phase === 'colors');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — Full mini-game sequence with free ball
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 13 — Full mini-game sequence with free ball');
{
  // Scenario: free ball as red → pot black → pot actual red → colors phase → frame ends
  let g = makeGame(1); // 1 red
  // Foul at start, opponent plays, declare free ball
  g = applyFoul(g, 4, true);   // P0 fouls, P1 plays; P1 score = 4
  g = applyDeclareFreesBall(g);
  g = applyFreeBall(g, 'pink'); // free ball: P1 scores 1; awaiting=color, redsRemaining=1
  g = applyPot(g, 'black');     // P1 pots black: +7; awaiting=red, redsRemaining=1
  g = applyPot(g, 'red');       // P1 pots actual red: +1; awaiting=color, redsRemaining=0
  g = applyPot(g, 'yellow');    // colors phase transition
  // Now in colors phase
  ['yellow','green','brown','blue','pink','black'].forEach(b => { g = applyPot(g, b); });
  assert('74. full sequence: P1 total = 4+1+7+1+2+2+3+4+5+6+7 = 42', g.current.scores[1] === 42);

  // Two free balls in one frame (two separate fouls)
  let g2 = makeGame(1);
  g2 = applyFoul(g2, 4, true);       // P0 fouls, P1+4; P1 plays
  g2 = applyDeclareFreesBall(g2);
  g2 = applyFreeBall(g2, 'black');    // P1 +1; P1=5
  g2 = applyPot(g2, 'black');         // P1 +7; P1=12, awaiting=red
  g2 = applyEndVisit(g2);             // P0's turn, awaiting=red
  // P0 fouls with opponentPlays=false so P0 plays the second free ball
  g2 = applyFoul(g2, 4, false);       // P0 fouls, P1+4→P1=16; P0 plays again
  g2 = applyDeclareFreesBall(g2);
  g2 = applyFreeBall(g2, 'blue');     // P0 +1 (free ball as red)
  assert('75. two free balls in one frame: second free ball (P0) scores correctly',
    g2.current.scores[0] === 1); // P0 only scored the free ball

  // Free ball in colors phase followed by normal pot
  let g3 = makeGame(1);
  g3 = driveToColorsPhase(g3); // on=yellow
  g3 = applyFoul(g3, 4, true); // foul while in colors
  g3 = applyDeclareFreesBall(g3);
  g3 = applyFreeBall(g3, 'black'); // scores yellow's value (2), advances to green
  g3 = applyPot(g3, 'green');      // normal pot: +3
  assert('76. after free ball in colors, next color pot is green: scores 3',
    g3.current.colorsRemaining[0] === 'brown');

  // Verify final score in a complete 1-red frame with a free ball used
  let g4 = makeGame(1);
  g4 = applyFoul(g4, 4, true);    // P0 fouls; P1 +4
  g4 = applyDeclareFreesBall(g4);
  g4 = applyFreeBall(g4, 'pink'); // P1 +1
  g4 = applyPot(g4, 'black');     // P1 +7; awaiting=red
  g4 = applyPot(g4, 'red');       // P1 +1; redsRemaining=0, awaiting=color
  g4 = applyPot(g4, 'yellow');    // transition to colors: +2
  ['yellow','green','brown','blue','pink','black'].forEach(b => { g4 = applyPot(g4, b); });
  assert('77. complete 1-red frame with free ball: frame ended', g4.current.isFrameOver === true);

  // snookers-needed calc still works after free ball (pointsOnTable is correct)
  let g5 = makeGame(15);
  g5 = applyFoul(g5, 4, true);    // P1 +4, P1 plays
  g5 = applyDeclareFreesBall(g5);
  g5 = applyFreeBall(g5, 'yellow'); // P1 +1; redsRemaining=15, awaiting=color
  // pointsOnTable = 7 + 15*8 + 27 = 154
  // P0=0, P1=5; diff=5; need = max(0, ceil((5-0-154)/7)) = 0
  const [sn0, sn1] = [
    Math.max(0, Math.ceil((g5.current.scores[1] - g5.current.scores[0] - g5.current.pointsOnTable) / 7)),
    Math.max(0, Math.ceil((g5.current.scores[0] - g5.current.scores[1] - g5.current.pointsOnTable) / 7)),
  ];
  assert('78. snookers-needed calc correct after free ball (no snookers needed)', sn0 === 0 && sn1 === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — getAvailableBalls when freeBallActive
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 14 — getAvailableBalls when freeBallActive');
{
  // freeBallActive=true, awaiting=red → all 7 balls available
  let snap1 = { ...makeInitialFrame(15), freeBallActive: true };
  const avail1 = getAvailableBalls(snap1);
  assert('79. freeBallActive=true, awaiting=red: all 7 balls available', avail1.length === 7);

  // freeBallActive=true, phase=colors → all 7 balls available
  let g = makeGame(1);
  g = driveToColorsPhase(g);
  let snap2 = { ...g.current, freeBallActive: true };
  const avail2 = getAvailableBalls(snap2);
  assert('80. freeBallActive=true, phase=colors: all 7 balls available', avail2.length === 7);

  // freeBallActive=false, awaiting=red → only red
  let snap3 = makeInitialFrame(15);
  const avail3 = getAvailableBalls(snap3);
  assert('81. freeBallActive=false, awaiting=red: only red available', avail3.length===1 && avail3[0]==='red');

  // freeBallActive=false, awaiting=color → 6 colors
  let snap4 = { ...makeInitialFrame(15), awaiting: 'color', freeBallActive: false };
  const avail4 = getAvailableBalls(snap4);
  assert('82. freeBallActive=false, awaiting=color: 6 colors available', avail4.length === 6);

  // freeBallActive=true but isFrameOver=true → []
  let snap5 = { ...makeInitialFrame(15), freeBallActive: true, isFrameOver: true };
  const avail5 = getAvailableBalls(snap5);
  assert('83. freeBallActive=true but isFrameOver=true: no balls available', avail5.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — Free ball interactions with foul
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 15 — Free ball interactions with foul');
{
  // Foul value is correctly added to opponent before free ball is declared
  let g1 = makeGame(15);
  g1 = applyFoul(g1, 7, true); // P0 fouls 7pts; P1 +7; P1 plays
  g1 = applyDeclareFreesBall(g1);
  g1 = applyFreeBall(g1, 'yellow'); // P1 +1
  assert('84. foul 7 then free ball: P1 score = 7+1 = 8', g1.current.scores[1] === 8);

  // Free ball declared but current player is still opponent (from foul opponentPlays=true)
  let g2 = makeGame(15);
  g2 = applyFoul(g2, 4, true); // P1 now plays
  g2 = applyDeclareFreesBall(g2);
  assert('85. after foul (opponent plays), current player is P1 when free ball declared', g2.current.currentPlayer === 1);

  // Free ball: fouler plays again (opponentPlays=false), fouler gets free ball
  let g3 = makeGame(15);
  g3 = applyFoul(g3, 4, false); // P0 fouls; P1 +4; P0 plays again
  g3 = applyDeclareFreesBall(g3);
  g3 = applyFreeBall(g3, 'blue'); // P0 +1
  assert('86. free ball when fouler replays: P0 scores the free ball', g3.current.scores[0] === 1);

  // Foul opponentPlays=true → P1 plays, declares free ball → pots it → P1 score
  let g4 = makeGame(15);
  g4 = applyFoul(g4, 5, true); // P1 +5; P1 plays
  g4 = applyDeclareFreesBall(g4);
  g4 = applyFreeBall(g4, 'pink'); // P1 +1
  assert('87. foul(opponent plays)+free ball: P1 score = 5+1 = 6', g4.current.scores[1] === 6);
  assert('88. after free ball, currentPlayer still P1 (P1 continues break)', g4.current.currentPlayer === 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16 — Edge cases
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 16 — Edge cases');
{
  // Free ball as black when awaiting=red: scores 1 (not 7)
  let g1 = makeGame(15);
  g1 = applyFoul(g1, 4, true);
  g1 = applyDeclareFreesBall(g1);
  const sBefore = g1.current.scores[1];
  g1 = applyFreeBall(g1, 'black');
  assert('89. free ball as black when awaiting=red: scores 1 not 7', g1.current.scores[1] === sBefore + 1);

  // Free ball as red when in colors phase (on=yellow): scores yellow's value (2)
  let g2 = makeGame(1);
  g2 = driveToColorsPhase(g2); // on=yellow
  g2 = applyFoul(g2, 4, true);
  g2 = applyDeclareFreesBall(g2);
  const s2Before = g2.current.scores[1];
  g2 = applyFreeBall(g2, 'red'); // nominate red; scores yellow's value = 2
  assert('90. free ball as red in colors phase (on=yellow): scores 2 not 1', g2.current.scores[1] === s2Before + 2);

  // applyFreeBall does not change currentPlayer
  let g3 = makeGame(15);
  g3 = applyFoul(g3, 4, true); // P1 plays
  g3 = applyDeclareFreesBall(g3);
  const playerBefore = g3.current.currentPlayer;
  g3 = applyFreeBall(g3, 'yellow');
  assert('91. applyFreeBall does not change currentPlayer', g3.current.currentPlayer === playerBefore);

  // pointsOnTable after free ball as red (15 reds): awaiting=color → 7+15*8+27 = 154
  let g4 = makeGame(15);
  g4 = applyFoul(g4, 4, true);
  g4 = applyDeclareFreesBall(g4);
  g4 = applyFreeBall(g4, 'green');
  assert('92. pointsOnTable after free ball as red (awaiting=color, 15 reds) = 154',
    g4.current.pointsOnTable === 154);

  // After declaring free ball, all ball colors available to nominate
  let g5 = makeGame(15);
  g5 = applyFoul(g5, 4, true);
  g5 = applyDeclareFreesBall(g5);
  const avail = getAvailableBalls(g5.current);
  assert('93. after declareFreesBall: all 7 ball types available to nominate',
    avail.length === 7 && avail.includes('red') && avail.includes('black'));

  // Free ball in "train mode equivalent" (single player): same logic
  let g6 = makeGame(15, 9999); // train mode uses bestOf=9999
  g6 = applyFoul(g6, 4, true);
  g6 = applyDeclareFreesBall(g6);
  g6 = applyFreeBall(g6, 'blue');
  assert('94. free ball works identically in train-mode config', g6.current.scores[1] === 5 && g6.current.awaiting === 'color');

  // redsRemaining=0, awaiting=color (edge: last red potted, foul during color)
  let g7 = makeGame(1);
  g7 = applyPot(g7, 'red'); // redsRemaining=0, awaiting=color
  g7 = applyFoul(g7, 4, true); // foul while awaiting color with no reds left
  g7 = applyDeclareFreesBall(g7);
  g7 = applyFreeBall(g7, 'blue'); // awaiting=color, redsRemaining=0 → transitions to colors phase
  assert('95. free ball (awaiting=color, redsRemaining=0): transitions to colors phase',
    g7.current.phase === 'colors');

  // Immediate next pot in colors phase is yellow after transition via free ball
  let g8 = makeGame(1);
  g8 = applyPot(g8, 'red');  // redsRemaining=0, awaiting=color
  g8 = applyFoul(g8, 4, true);
  g8 = applyDeclareFreesBall(g8);
  g8 = applyFreeBall(g8, 'green'); // transitions to colors phase
  assert('96. after free ball transition to colors: colorsRemaining starts at yellow',
    g8.current.colorsRemaining[0] === 'yellow');

  // Free ball history chain: declare + pot + undo + undo restores original state
  let g9 = makeGame(15);
  g9 = applyFoul(g9, 4, true);
  const snapAfterFoul = g9.current;
  g9 = applyDeclareFreesBall(g9);
  g9 = applyFreeBall(g9, 'yellow');
  g9 = applyUndo(g9); // undo free ball pot
  g9 = applyUndo(g9); // undo declare
  assert('97. undo chain (declare+pot → undo×2): restores pre-declare state',
    g9.current.freeBallActive === false && g9.current.scores[0] === snapAfterFoul.scores[0]);

  // After free ball (reds phase): can immediately pot a color normally
  let g10 = makeGame(15);
  g10 = applyFoul(g10, 4, true);
  g10 = applyDeclareFreesBall(g10);
  g10 = applyFreeBall(g10, 'pink'); // free ball as red → awaiting=color
  const availAfter = getAvailableBalls(g10.current);
  assert('98. after free ball (awaiting=color): normal color pots available (6 colors)',
    availAfter.length === 6 && !availAfter.includes('red'));

  // applyFreeBall returns same state (no-op) when called twice without declaring
  let g11 = makeGame(15);
  g11 = applyFoul(g11, 4, true);
  g11 = applyDeclareFreesBall(g11);
  g11 = applyFreeBall(g11, 'blue'); // consumes freeBallActive
  const stateAfterFirst = g11;
  g11 = applyFreeBall(g11, 'yellow'); // freeBallActive=false now, should no-op
  assert('99. second applyFreeBall call without re-declaring: no-op',
    g11.current.scores[0] === stateAfterFirst.current.scores[0] &&
    g11.current.scores[1] === stateAfterFirst.current.scores[1]);

  // History length after declare+apply: exactly 2 extra entries (one for declare, one for apply)
  let g12 = makeGame(15);
  g12 = applyFoul(g12, 4, true);
  const histBeforeFreeBall = g12.history.length;
  g12 = applyDeclareFreesBall(g12);
  g12 = applyFreeBall(g12, 'black');
  assert('100. declare+apply adds exactly 2 history entries',
    g12.history.length === histBeforeFreeBall + 2);
}

// ── Final results ─────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
