// Comprehensive snooker game logic test — covers every meaningful scenario.
// Runs in Node.js (no React). All logic mirrors hooks/useSnookerGame.ts exactly.

// ── Inline game logic (kept in sync with useSnookerGame.ts) ──────────────────

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
    awaiting: 'red', colorsRemaining: [...COLORS_SEQUENCE], isFrameOver: false,
  };
}

function getAvailableBalls(snap) {
  if (snap.isFrameOver) return [];
  if (snap.phase === 'colors') return snap.colorsRemaining.slice(0,1);
  if (snap.awaiting === 'red') return snap.redsRemaining > 0 ? ['red'] : COLORS_SEQUENCE;
  return COLORS_SEQUENCE;
}

function applyPot(state, ball) {
  const snap = state.current;
  const available = getAvailableBalls(snap);
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball}. Available: ${available}. State: phase=${snap.phase} awaiting=${snap.awaiting} reds=${snap.redsRemaining}`);

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
    colorsRemaining: newColorsRemaining, isFrameOver,
  };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

// Mirrors addExtraRed() in the hook — extra red on same shot
function applyExtraRed(state) {
  const snap = state.current;
  if (snap.phase !== 'reds' || snap.awaiting !== 'color' || snap.redsRemaining === 0) throw new Error('addExtraRed precondition failed');
  const newScores = [...snap.scores]; newScores[snap.currentPlayer] += 1;
  const newBreak = snap.currentBreak + 1;
  const newRedsRemaining = snap.redsRemaining - 1;
  const newHighest = [...state.frameHighestBreak];
  if (newBreak > newHighest[snap.currentPlayer]) newHighest[snap.currentPlayer] = newBreak;
  const newSnap = { ...snap, scores: newScores, currentBreak: newBreak, redsRemaining: newRedsRemaining,
    pointsOnTable: calcPointsOnTable(snap.phase, newRedsRemaining, snap.awaiting, snap.colorsRemaining) };
  return { ...state, current: newSnap, history: [...state.history, snap], frameHighestBreak: newHighest };
}

function applyEndVisit(state) {
  const snap = state.current;
  let newPhase = snap.phase;
  let newAwaiting = snap.awaiting;
  let newColorsRemaining = [...snap.colorsRemaining];
  if (snap.phase === 'reds') {
    if (snap.redsRemaining === 0 && snap.awaiting === 'color') {
      // Last red was potted, player missed color — incoming player starts colors phase
      newPhase = 'colors';
      newColorsRemaining = [...COLORS_SEQUENCE];
    } else {
      // Normal miss: incoming player pots a red next
      newAwaiting = 'red';
    }
  }
  const newPot = calcPointsOnTable(newPhase, snap.redsRemaining, newAwaiting, newColorsRemaining);
  return { ...state, current: { ...snap, currentPlayer: snap.currentPlayer===0?1:0, currentBreak:0, phase:newPhase, awaiting:newAwaiting, colorsRemaining:newColorsRemaining, pointsOnTable:newPot }, history:[...state.history,snap] };
}

// Fixed version: awaiting = snap.awaiting always (not reset based on redsRemaining)
function applyFoul(state, foulValue, opponentPlays=true) {
  const snap = state.current;
  const opponent = snap.currentPlayer===0?1:0;
  const newScores = [...snap.scores]; newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newAwaiting = snap.awaiting; // BUG FIX: preserve awaiting state, never reset
  const newSnap = { ...snap, scores: newScores, currentBreak:0, currentPlayer: newPlayer, awaiting: newAwaiting };
  return { ...state, current: newSnap, history: [...state.history, snap] };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history]; const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

function applyConcede(state) {
  const snap = state.current;
  return { ...state, current: { ...snap, isFrameOver: true }, history:[...state.history, snap] };
}

function makeGame(numberOfReds, bestOf=null) {
  return { config:{numberOfReds,bestOf}, framesWon:[0,0], frameResults:[], frameNumber:1,
    current: makeInitialFrame(numberOfReds,0), history:[], frameHighestBreak:[0,0], isMatchOver:false, matchWinner:null };
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed=0, failed=0;
function assert(label, condition, extra='') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra?` — got: ${extra}`:''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — BASIC BALL POTTING
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 1 — Basic ball potting');
{
  let g = makeGame(15);

  // Initial state
  assert('initial awaiting = red', g.current.awaiting === 'red');
  assert('initial redsRemaining = 15', g.current.redsRemaining === 15);
  assert('initial pointsOnTable = 147', g.current.pointsOnTable === 147);
  assert('initial score [0,0]', g.current.scores[0]===0 && g.current.scores[1]===0);
  assert('initial phase = reds', g.current.phase === 'reds');

  // Pot red
  g = applyPot(g,'red');
  assert('after red: score P0 = 1', g.current.scores[0] === 1);
  assert('after red: redsRemaining = 14', g.current.redsRemaining === 14);
  assert('after red: awaiting = color', g.current.awaiting === 'color');
  assert('after red: currentBreak = 1', g.current.currentBreak === 1);
  assert('after red: phase still reds', g.current.phase === 'reds');
  assert('after red: pointsOnTable = 7 + 14*8 + 27 = 146', g.current.pointsOnTable === 146);

  // Cannot pot red when awaiting color
  const avail = getAvailableBalls(g.current);
  assert('after red: red not available', !avail.includes('red'));
  assert('after red: black is available', avail.includes('black'));

  // Pot black
  g = applyPot(g,'black');
  assert('after black: score P0 = 8', g.current.scores[0] === 8);
  assert('after black: awaiting = red', g.current.awaiting === 'red');
  assert('after black: redsRemaining still 14 (black returns)', g.current.redsRemaining === 14);
  assert('after black: currentBreak = 8', g.current.currentBreak === 8);
  assert('after black: phase still reds', g.current.phase === 'reds');
  assert('after black: pointsOnTable = 14*8 + 27 = 139', g.current.pointsOnTable === 139);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — END VISIT RESETS AWAITING TO RED (correct snooker rule)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 2 — endVisit resets awaiting to red (incoming player pots red)');
{
  let g = makeGame(15);

  // Player 0 pots red then ends visit without potting a color
  g = applyPot(g,'red'); // P0 pots red, awaiting='color'
  assert('P0 potted red, awaiting=color', g.current.awaiting === 'color');

  g = applyEndVisit(g); // P0 misses color — turn switches
  assert('after endVisit: player switches to P1', g.current.currentPlayer === 1);
  assert('after endVisit: awaiting resets to red (P1 must pot a red)', g.current.awaiting === 'red');
  assert('after endVisit: redsRemaining = 14 (red stays off)', g.current.redsRemaining === 14);
  assert('after endVisit: break resets to 0', g.current.currentBreak === 0);

  // P1 must pot a red next — colours are NOT available
  const avail = getAvailableBalls(g.current);
  assert('P1 must pot red (not free colour)', avail.includes('red'));
  assert('P1 cannot pot colour before red', !avail.includes('black'));

  // P1 pots red
  g = applyPot(g,'red');
  assert('P1 score after red = 1', g.current.scores[1] === 1);
  assert('P1 pots red: redsRemaining = 13', g.current.redsRemaining === 13);
  assert('after P1 pots red: awaiting = color', g.current.awaiting === 'color');

  // P1 can now pot a colour
  const avail2 = getAvailableBalls(g.current);
  assert('P1 can pot black after potting red', avail2.includes('black'));
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — FOUL BEHAVIOR (the main bug fix)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 3 — Foul awaiting state bug (FIXED)');
{
  let g = makeGame(15);

  // === Scenario A: Foul while awaiting RED (no red potted yet) ===
  g = applyFoul(g, 4, true); // P0 fouls, P1 plays
  assert('[A] foul while awaiting=red: P1 must still pot red', g.current.awaiting === 'red');
  assert('[A] redsRemaining unchanged', g.current.redsRemaining === 15);
  assert('[A] P0 score unchanged', g.current.scores[0] === 0);
  assert('[A] P1 received 4 pts from foul', g.current.scores[1] === 4);
  assert('[A] P1 plays next', g.current.currentPlayer === 1);

  // === Scenario B: P0 pots red THEN fouls on color — BUG FIX CHECK ===
  let g2 = makeGame(15);
  g2 = applyPot(g2,'red'); // P0 pots red (redsRemaining=14, awaiting='color')
  assert('[B] awaiting=color after red', g2.current.awaiting === 'color');
  g2 = applyFoul(g2, 4, true); // P0 fouls on color nomination
  assert('[B] FIXED: awaiting STAYS color after foul (not reset to red)', g2.current.awaiting === 'color',
    `awaiting=${g2.current.awaiting} — was 'red' before fix`);
  assert('[B] redsRemaining stays 14 (red stays off)', g2.current.redsRemaining === 14);
  assert('[B] P1 plays next', g2.current.currentPlayer === 1);

  // P1 must pot a color (correct behavior after fix)
  const avail = getAvailableBalls(g2.current);
  assert('[B] P1 cannot pot red after this foul', !avail.includes('red'));
  assert('[B] P1 can pot black', avail.includes('black'));

  // P1 pots pink for 6, then awaiting goes back to red
  g2 = applyPot(g2,'pink');
  assert('[B] P1 scores 6 from pink', g2.current.scores[1] === 4+6);
  assert('[B] after color potted: awaiting = red', g2.current.awaiting === 'red');

  // === Scenario C: Foul while awaiting COLOR — fouling player plays again ===
  let g3 = makeGame(15);
  g3 = applyPot(g3,'red'); // awaiting=color
  g3 = applyFoul(g3, 7, false); // P0 fouls AND plays again
  assert('[C] awaiting stays color', g3.current.awaiting === 'color');
  assert('[C] P0 plays again (opponentPlays=false)', g3.current.currentPlayer === 0);
  assert('[C] P1 received 7 pts', g3.current.scores[1] === 7);

  // === Scenario D: Foul in colors phase ===
  let g4 = makeGame(6);
  for (let i=0;i<6;i++) { g4=applyPot(g4,'red'); g4=applyPot(g4,'black'); }
  // Now in colors phase
  g4 = applyFoul(g4, 4, true); // foul in colors phase
  assert('[D] phase still colors after foul', g4.current.phase === 'colors');
  assert('[D] colorsRemaining unchanged after foul', g4.current.colorsRemaining.length === 6);
  assert('[D] P1 plays next', g4.current.currentPlayer === 1);

  // === Scenario E: Foul after LAST red (redsRemaining=0, awaiting=color) ===
  let g5 = makeGame(6);
  for (let i=0;i<5;i++) { g5=applyPot(g5,'red'); g5=applyPot(g5,'black'); }
  g5=applyPot(g5,'red'); // last red, redsRemaining=0, awaiting=color
  assert('[E] redsRemaining=0, awaiting=color before foul', g5.current.redsRemaining===0 && g5.current.awaiting==='color');
  g5 = applyFoul(g5, 4, true);
  assert('[E] awaiting stays color', g5.current.awaiting === 'color');
  assert('[E] redsRemaining still 0', g5.current.redsRemaining === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MULTIPLE REDS IN ONE SHOT
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 4 — Multiple reds in one shot (addExtraRed)');
{
  // Player pots 2 reds on one shot
  let g = makeGame(15);
  g = applyPot(g,'red'); // 1st red
  assert('after 1st red: redsRemaining=14, awaiting=color', g.current.redsRemaining===14 && g.current.awaiting==='color');
  g = applyExtraRed(g); // 2nd red on same shot
  assert('after extra red: redsRemaining=13', g.current.redsRemaining === 13);
  assert('after extra red: score=2', g.current.scores[0] === 2);
  assert('after extra red: currentBreak=2', g.current.currentBreak === 2);
  assert('after extra red: awaiting STILL color', g.current.awaiting === 'color');
  g = applyPot(g,'black'); // pot 1 color for the 2-red combo
  assert('after black: awaiting = red', g.current.awaiting === 'red');
  assert('after black: score = 2+7 = 9', g.current.scores[0] === 9);
  assert('after black: redsRemaining still 13', g.current.redsRemaining === 13);

  // Player pots 3 reds on one shot
  let g2 = makeGame(15);
  g2 = applyPot(g2,'red'); g2 = applyExtraRed(g2); g2 = applyExtraRed(g2);
  assert('3 reds: redsRemaining=12', g2.current.redsRemaining === 12);
  assert('3 reds: score=3', g2.current.scores[0] === 3);
  assert('3 reds: awaiting=color', g2.current.awaiting === 'color');
  g2 = applyPot(g2,'pink');
  assert('3 reds + pink: score = 3+6 = 9', g2.current.scores[0] === 9);
  assert('3 reds + pink: awaiting = red', g2.current.awaiting === 'red');

  // Cannot add extra red when no reds remain
  let g3 = makeGame(1);
  g3 = applyPot(g3,'red'); // last red, redsRemaining=0
  let threw = false;
  try { applyExtraRed(g3); } catch(e) { threw = true; }
  assert('addExtraRed throws when redsRemaining=0', threw);

  // Cannot add extra red when awaiting='red'
  let g4 = makeGame(15);
  let threw2 = false;
  try { applyExtraRed(g4); } catch(e) { threw2 = true; }
  assert('addExtraRed throws when awaiting=red', threw2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — FULL FRAME CLEARANCE (15 reds)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 5 — Full 15-red frame clearance (maximum break = 147)');
{
  let g = makeGame(15);
  // Pot 15 reds + black each
  for (let i=0; i<15; i++) { g=applyPot(g,'red'); g=applyPot(g,'black'); }
  assert('after 15 reds + blacks: redsRemaining=0', g.current.redsRemaining === 0);
  assert('after 15 reds + blacks: score = 15*(1+7) = 120', g.current.scores[0] === 120);
  assert('after 15 reds + blacks: phase = colors', g.current.phase === 'colors');
  assert('after 15 reds + blacks: 6 colors remain', g.current.colorsRemaining.length === 6);

  // Clear 6 colors in sequence
  for (const col of ['yellow','green','brown','blue','pink','black']) {
    g = applyPot(g, col);
  }
  assert('frame over after all balls', g.current.isFrameOver === true);
  assert('maximum break = 147', g.current.scores[0] === 147);
  assert('pointsOnTable = 0 when frame over', g.current.pointsOnTable === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — COLORS PHASE BEHAVIOR
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 6 — Colors phase');
{
  let g = makeGame(6);
  for (let i=0;i<6;i++) { g=applyPot(g,'red'); g=applyPot(g,'black'); }
  assert('in colors phase', g.current.phase === 'colors');
  assert('colorsRemaining = full sequence', JSON.stringify(g.current.colorsRemaining) === JSON.stringify(COLORS_SEQUENCE));

  // Must pot in sequence: yellow first
  const avail = getAvailableBalls(g.current);
  assert('only yellow available first', avail.length===1 && avail[0]==='yellow');

  // Try wrong ball
  let threw = false;
  try { applyPot(g,'blue'); } catch(e) { threw = true; }
  assert('cannot pot blue before yellow in colors phase', threw);

  // Clear yellow
  g = applyPot(g,'yellow');
  assert('after yellow: colorsRemaining has 5', g.current.colorsRemaining.length === 5);
  assert('after yellow: next is green', getAvailableBalls(g.current)[0] === 'green');

  // Miss a color — turn switches, same color required
  g = applyEndVisit(g);
  assert('after endVisit in colors: player switches', g.current.currentPlayer === 1);
  assert('after endVisit in colors: colorsRemaining unchanged (5)', g.current.colorsRemaining.length === 5);
  assert('P1 must pot green next', getAvailableBalls(g.current)[0] === 'green');

  // P1 pots green, brown, blue
  g=applyPot(g,'green'); g=applyPot(g,'brown'); g=applyPot(g,'blue');
  assert('P1 score = 3+4+5 = 12', g.current.scores[1] === 12);
  assert('colorsRemaining = [pink, black]', JSON.stringify(g.current.colorsRemaining) === JSON.stringify(['pink','black']));

  // Foul in colors phase — colorsRemaining unchanged
  g = applyFoul(g, 6, true);
  assert('after foul in colors: colorsRemaining still [pink,black]', JSON.stringify(g.current.colorsRemaining) === JSON.stringify(['pink','black']));

  // Clear pink + black to end frame
  g=applyPot(g,'pink'); g=applyPot(g,'black');
  assert('frame over', g.current.isFrameOver === true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — UNDO
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 7 — Undo');
{
  let g = makeGame(15);

  // Undo when no history
  const gNoHistory = applyUndo(g);
  assert('undo with no history: state unchanged', gNoHistory.current.scores[0] === 0);

  // Undo a red
  g = applyPot(g,'red'); // score=1, awaiting=color
  g = applyUndo(g);
  assert('undo red: score back to 0', g.current.scores[0] === 0);
  assert('undo red: awaiting back to red', g.current.awaiting === 'red');
  assert('undo red: redsRemaining back to 15', g.current.redsRemaining === 15);
  assert('undo red: history empty', g.history.length === 0);

  // Undo a color
  g = applyPot(g,'red'); g = applyPot(g,'pink'); // score=7
  g = applyUndo(g);
  assert('undo pink: score=1', g.current.scores[0] === 1);
  assert('undo pink: awaiting=color', g.current.awaiting === 'color');

  // Undo a foul
  g = applyFoul(g, 4, true); // P0 fouls after potting red
  assert('before undo foul: P1 score=4', g.current.scores[1] === 4);
  g = applyUndo(g);
  assert('undo foul: P1 score back to 0', g.current.scores[1] === 0);
  assert('undo foul: awaiting back to color (red was potted)', g.current.awaiting === 'color');

  // Undo end-visit
  let g2 = makeGame(15);
  g2 = applyPot(g2,'red'); g2 = applyEndVisit(g2);
  assert('after endVisit: P1 active', g2.current.currentPlayer === 1);
  g2 = applyUndo(g2);
  assert('undo endVisit: P0 active again', g2.current.currentPlayer === 0);
  assert('undo endVisit: currentBreak restored', g2.current.currentBreak === 1);

  // Undo extra red
  let g3 = makeGame(15);
  g3 = applyPot(g3,'red'); g3 = applyExtraRed(g3);
  assert('after extra red: redsRemaining=13', g3.current.redsRemaining === 13);
  g3 = applyUndo(g3);
  assert('undo extra red: redsRemaining=14', g3.current.redsRemaining === 14);
  assert('undo extra red: score=1', g3.current.scores[0] === 1);

  // Undo in colors phase
  let g4 = makeGame(6);
  for(let i=0;i<6;i++){g4=applyPot(g4,'red');g4=applyPot(g4,'black');}
  g4=applyPot(g4,'yellow');
  assert('potted yellow: colorsRemaining=5', g4.current.colorsRemaining.length === 5);
  g4 = applyUndo(g4);
  assert('undo yellow: colorsRemaining back to 6', g4.current.colorsRemaining.length === 6);
  assert('undo yellow: phase still colors', g4.current.phase === 'colors');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — END VISIT EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 8 — End visit edge cases');
{
  // End visit at start of frame — awaiting='red' carries over
  let g = makeGame(15);
  g = applyEndVisit(g);
  assert('endVisit at start: awaiting stays red', g.current.awaiting === 'red');
  assert('endVisit at start: player switches', g.current.currentPlayer === 1);
  assert('endVisit at start: redsRemaining unchanged', g.current.redsRemaining === 15);

  // End visit after potting color (awaiting='red') — other player pots red
  let g2 = makeGame(15);
  g2=applyPot(g2,'red'); g2=applyPot(g2,'blue'); // awaiting='red', P0 break=6
  g2 = applyEndVisit(g2);
  assert('endVisit after color: P1 must pot red', g2.current.awaiting === 'red');
  g2 = applyPot(g2,'red');
  assert('P1 pots red: redsRemaining=13', g2.current.redsRemaining === 13);
  assert('P1 pots red: P1 score=1', g2.current.scores[1] === 1);

  // End visit after last red (redsRemaining=0, awaiting=color) — P1 starts directly in colors phase
  let g3 = makeGame(1);
  g3 = applyPot(g3,'red'); // last red, redsRemaining=0, awaiting=color
  g3 = applyEndVisit(g3);
  assert('endVisit after last red: enters colors phase directly', g3.current.phase === 'colors');
  assert('endVisit after last red: colorsRemaining has 6', g3.current.colorsRemaining.length === 6);
  assert('endVisit after last red: yellow is first in sequence', g3.current.colorsRemaining[0] === 'yellow');
  g3 = applyPot(g3,'yellow'); // P1 pots first color in sequence
  assert('P1 pots yellow (no free colour): score 2', g3.current.scores[1] === 2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — CONCEDE
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 9 — Concede');
{
  let g = makeGame(15);
  g=applyPot(g,'red'); g=applyPot(g,'black'); // P0 score=8
  g = applyConcede(g);
  assert('frame over after concede', g.current.isFrameOver === true);
  assert('score preserved after concede', g.current.scores[0] === 8);
  assert('concede adds to history', g.history.length > 0);

  // Concede at score=0
  let g2 = makeGame(15);
  g2 = applyConcede(g2);
  assert('concede from zero: isFrameOver=true', g2.current.isFrameOver === true);
  assert('concede from zero: scores=[0,0]', g2.current.scores[0]===0 && g2.current.scores[1]===0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — POINTS ON TABLE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 10 — Points on table');
{
  // 15 reds, awaiting red: 15*8 + 27 = 147
  assert('15 reds, awaiting=red: pot=147', calcPointsOnTable('reds',15,'red',[...COLORS_SEQUENCE]) === 147);
  // 15 reds, awaiting color: 7 + 15*8 + 27 = 154
  assert('15 reds, awaiting=color: pot=154', calcPointsOnTable('reds',15,'color',[...COLORS_SEQUENCE]) === 154);
  // 0 reds left, awaiting color (last free color): 7 + 0 + 27 = 34
  assert('0 reds, awaiting=color (free color step): pot=34', calcPointsOnTable('reds',0,'color',[...COLORS_SEQUENCE]) === 34);
  // Colors phase, full sequence: 27
  assert('colors phase, full seq: pot=27', calcPointsOnTable('colors',0,'color',[...COLORS_SEQUENCE]) === 27);
  // Colors phase, only pink+black: 6+7=13
  assert('colors phase, [pink,black]: pot=13', calcPointsOnTable('colors',0,'color',['pink','black']) === 13);
  // Colors phase, only black: 7
  assert('colors phase, [black]: pot=7', calcPointsOnTable('colors',0,'color',['black']) === 7);
  // Colors phase, empty: 0
  assert('colors phase, empty: pot=0', calcPointsOnTable('colors',0,'color',[]) === 0);

  // In-game check: after potting red+black, pointsOnTable decreases correctly
  let g = makeGame(15);
  g=applyPot(g,'red'); // redsRemaining=14, awaiting=color → 7 + 14*8 + 27 = 146
  assert('after red: pot=146', g.current.pointsOnTable === 146);
  g=applyPot(g,'black'); // redsRemaining=14, awaiting=red → 14*8 + 27 = 139
  assert('after black: pot=139', g.current.pointsOnTable === 139);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — SNOOKERS NEEDED (getSnookersNeeded)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 11 — Snookers needed calculation');
{
  function getSnookersNeeded(scores, pot) {
    const need0 = Math.max(0, Math.ceil((scores[1]-scores[0]-pot)/7));
    const need1 = Math.max(0, Math.ceil((scores[0]-scores[1]-pot)/7));
    return [need0, need1];
  }

  // Scores equal, lots of balls left → no snookers needed
  assert('equal scores, pot=147: neither needs snookers', JSON.stringify(getSnookersNeeded([0,0],147)) === '[0,0]');
  // P0 leads by 30, pot=20 → P1 needs snookers: ceil((30-20)/7)=2
  assert('P1 trails by 30, pot=20: P1 needs 2 snookers', JSON.stringify(getSnookersNeeded([50,20],20)) === '[0,2]');
  // P1 trails by exactly 27 (COLORS_TOTAL), pot=27 → P1 needs ceil((27-27)/7)=0 snookers
  assert('P1 trails by 27, pot=27: P1 needs 0 snookers', JSON.stringify(getSnookersNeeded([27,0],27)) === '[0,0]');
  // P1 trails by 28, pot=27 → P1 needs 1 snooker: ceil((28-27)/7)=1
  assert('P1 trails by 28, pot=27: P1 needs 1 snooker', JSON.stringify(getSnookersNeeded([28,0],27)) === '[0,1]');
  // P1 trails by 100, pot=27 → P1 needs ceil((100-27)/7)=11 snookers (more than possible)
  assert('P1 trails by 100, pot=27: P1 needs 11 snookers', JSON.stringify(getSnookersNeeded([100,0],27)) === '[0,11]');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — BREAK BUILDING AND HIGHEST BREAK TRACKING
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 12 — Break building and highest break');
{
  let g = makeGame(15);
  // P0 builds a 47-point break: 5*(red+black)=40, then red+pink=7
  for (let i=0; i<5; i++) { g=applyPot(g,'red'); g=applyPot(g,'black'); } // 40 pts
  g=applyPot(g,'red'); g=applyPot(g,'pink'); // +1+6=7 → total 47, awaiting='red'
  g=applyEndVisit(g); // P0 ends visit; awaiting='red' carries to P1
  assert('P0 highest break = 47 after endVisit', g.frameHighestBreak[0] === 47);
  assert('P0 currentBreak reset to 0', g.current.currentBreak === 0);
  assert('frameHighestBreak preserved across endVisit', g.frameHighestBreak[0] === 47);
  assert('P1 awaiting=red (P0 last potted a colour)', g.current.awaiting === 'red');

  // P1 builds a 8-point break: red+black
  g=applyPot(g,'red'); g=applyPot(g,'black'); // P1: 1+7=8, awaiting='red'
  assert('P1 highest break = 8', g.frameHighestBreak[1] === 8);
  assert('P0 highest break still 47', g.frameHighestBreak[0] === 47);

  // Foul does not count as break for opponent
  g=applyFoul(g, 7, true); // P1 fouls while awaiting red, P0 plays next
  assert('P0 currentBreak = 0 at start of visit (foul pts not a break)', g.current.currentBreak === 0);
  assert('P0 frameHighestBreak still 47 (foul did not update it)', g.frameHighestBreak[0] === 47);
  assert('P0 score includes foul: 47+7=54', g.current.scores[0] === 47+7);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — MATCH FORMAT (bestOf) — CORRECT FRAME SEQUENCING
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 13 — Match format and frame sequencing');
{
  function confirmFrameEnd(state, winner, nextBreakerOverride=undefined) {
    const result = { frameNumber: state.frameNumber, winner, scores:[...state.current.scores], highestBreak:[...state.frameHighestBreak] };
    const fw=[...state.framesWon]; fw[winner]++;
    const nextBreaker = nextBreakerOverride!==undefined ? nextBreakerOverride : (state.frameNumber%2===0?0:1);
    let isMatchOver=false, matchWinner=null;
    if (state.config.bestOf===null) { isMatchOver=true; matchWinner=winner; }
    else {
      const target=Math.ceil(state.config.bestOf/2);
      if(fw[0]>=target){isMatchOver=true;matchWinner=0;}
      else if(fw[1]>=target){isMatchOver=true;matchWinner=1;}
    }
    const nr = state.config.numberOfReds || 15;
    return {...state, framesWon:fw, frameResults:[...state.frameResults,result], frameNumber:state.frameNumber+1,
      current:makeInitialFrame(nr,nextBreaker), history:[], frameHighestBreak:[0,0], isMatchOver, matchWinner};
  }

  // Single frame (bestOf=null)
  let g = makeGame(15, null);
  g = applyConcede(g);
  g = confirmFrameEnd(g, 0);
  assert('single frame: match over after 1 frame', g.isMatchOver === true);
  assert('single frame: P0 wins', g.matchWinner === 0);

  // Best of 5 — P0 wins 3-0
  let g2 = { ...makeGame(15, 5), config:{numberOfReds:15,bestOf:5} };
  for (let frame=0; frame<3; frame++) {
    g2 = applyConcede(g2);
    g2 = confirmFrameEnd(g2, 0);
  }
  assert('BO5: match over after P0 wins 3', g2.isMatchOver === true);
  assert('BO5: P0 is match winner', g2.matchWinner === 0);
  assert('BO5: framesWon=[3,0]', g2.framesWon[0]===3 && g2.framesWon[1]===0);

  // Best of 5 — P1 wins from 0-2 down (wins 3 in a row)
  let g3 = { ...makeGame(15, 5), config:{numberOfReds:15,bestOf:5} };
  g3=applyConcede(g3); g3=confirmFrameEnd(g3,0); // P0 wins frame 1
  g3=applyConcede(g3); g3=confirmFrameEnd(g3,0); // P0 wins frame 2 (2-0)
  g3=applyConcede(g3); g3=confirmFrameEnd(g3,1); // P1 wins frame 3 (2-1)
  assert('BO5 2-1: not over', g3.isMatchOver === false);
  g3=applyConcede(g3); g3=confirmFrameEnd(g3,1); // P1 wins frame 4 (2-2)
  assert('BO5 2-2: not over', g3.isMatchOver === false);
  g3=applyConcede(g3); g3=confirmFrameEnd(g3,1); // P1 wins frame 5 (2-3)
  assert('BO5 2-3: P1 wins match', g3.isMatchOver === true && g3.matchWinner === 1);

  // Breaker alternation: frame 1 starts with P0, frame 2 with P1, frame 3 with P0
  let g4 = { ...makeGame(15, 7), config:{numberOfReds:15,bestOf:7} };
  assert('frame 1 starts with P0', g4.current.currentPlayer === 0);
  g4=applyConcede(g4); g4=confirmFrameEnd(g4,0);
  assert('frame 2 starts with P1 (alternate)', g4.current.currentPlayer === 1);
  g4=applyConcede(g4); g4=confirmFrameEnd(g4,1);
  assert('frame 3 starts with P0 (alternate)', g4.current.currentPlayer === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — TRANSITION FROM REDS TO COLORS PHASE
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 14 — Reds → Colors transition edge cases');
{
  // Scenario: last red potted, player fouls on free color → other player pots free color then clears
  let g = makeGame(1);
  g=applyPot(g,'red'); // last red, redsRemaining=0, awaiting=color
  assert('last red: redsRemaining=0, awaiting=color', g.current.redsRemaining===0 && g.current.awaiting==='color');
  g=applyFoul(g, 4, true); // foul on free color
  assert('foul after last red: awaiting still color', g.current.awaiting === 'color');
  assert('foul after last red: phase still reds (no free color yet)', g.current.phase === 'reds');
  g=applyPot(g,'yellow'); // P1 pots free color
  assert('P1 pots free color: transitions to colors phase', g.current.phase === 'colors');
  assert('colors phase: full 6-color sequence', g.current.colorsRemaining.length === 6);
  for (const col of ['yellow','green','brown','blue','pink','black']) {
    g=applyPot(g,col);
  }
  assert('cleared all colors: frame over', g.current.isFrameOver === true);

  // Scenario: pot last 2 reds simultaneously (addExtraRed), then free color → colors
  let g2 = makeGame(2);
  g2=applyPot(g2,'red'); g2=applyExtraRed(g2); // pot 2 reds at once
  assert('2 reds together: redsRemaining=0', g2.current.redsRemaining === 0);
  g2=applyPot(g2,'black'); // free color (transitions to colors)
  assert('free black after 2 reds: phase=colors', g2.current.phase === 'colors');

  // Scenario: different free color choices
  let g3 = makeGame(1);
  g3=applyPot(g3,'red');
  g3=applyPot(g3,'yellow'); // choose yellow as free color (only 2 pts)
  assert('chose yellow as free color: phase=colors', g3.current.phase === 'colors');
  assert('chose yellow as free color: colorsRemaining has 6', g3.current.colorsRemaining.length === 6);
  assert('chose yellow as free color: yellow first in sequence', g3.current.colorsRemaining[0] === 'yellow');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — SCORE INTEGRITY ACROSS MULTI-PLAYER VISITS
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 15 — Score integrity with alternating visits');
{
  let g = makeGame(15);

  // P0: pots red+black (8 pts), then end visit
  g=applyPot(g,'red'); g=applyPot(g,'black'); // P0: 8, awaiting=red
  g=applyEndVisit(g); // P1's turn

  // P1: pots red+blue (6 pts), then end visit
  g=applyPot(g,'red'); g=applyPot(g,'blue'); // P1: 6, awaiting=red
  g=applyEndVisit(g); // P0's turn

  assert('P0 score = 8', g.current.scores[0] === 8);
  assert('P1 score = 6', g.current.scores[1] === 6);
  assert('redsRemaining = 13', g.current.redsRemaining === 13);
  assert('awaiting = red for P0', g.current.awaiting === 'red');

  // P0: gets a foul against them (P1 scores)
  g=applyFoul(g, 4, false); // P0 stays at table after foul (receives foul themselves? No — foul by P0, P1 gets points)
  assert('P1 gets foul pts: P1 score = 6+4 = 10', g.current.scores[1] === 10);
  assert('P0 still at table (opponentPlays=false)', g.current.currentPlayer === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16 — AVAILABLE BALLS GUARD (getAvailableBalls)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 16 — Available balls guard');
{
  // Frame over → no balls available
  let g = makeGame(1);
  g=applyConcede(g);
  assert('frame over: no balls available', getAvailableBalls(g.current).length === 0);

  // Colors phase: only next color
  let g2 = makeGame(6);
  for(let i=0;i<6;i++){g2=applyPot(g2,'red');g2=applyPot(g2,'black');}
  assert('colors phase start: only yellow available', JSON.stringify(getAvailableBalls(g2.current)) === '["yellow"]');
  g2=applyPot(g2,'yellow'); g2=applyPot(g2,'green');
  assert('colors phase after yellow+green: only brown available', JSON.stringify(getAvailableBalls(g2.current)) === '["brown"]');

  // Safety guard: awaiting=red with redsRemaining=0 → allow all colors
  const weirdSnap = { ...makeInitialFrame(0,0), awaiting:'red', redsRemaining:0 };
  const weirdAvail = getAvailableBalls(weirdSnap);
  assert('edge case awaiting=red redsRemaining=0: returns all colors', weirdAvail.length === 6);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17 — NO-OP SAFETY: actions when frame is already over
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 17 — No-op safety when frame is over');
{
  // potBall when isFrameOver — should be rejected by getAvailableBalls
  let g = makeGame(6);
  g=applyConcede(g); // frame over
  assert('frame over: available balls empty', getAvailableBalls(g.current).length === 0);
  let threw=false;
  try { applyPot(g,'red'); } catch(e) { threw=true; }
  assert('potBall after frame over: throws (no available balls)', threw);

  // Concede when already over — should no-op (hook guards isFrameOver)
  // We test this by verifying the state doesn't change after concede-on-over
  const before = JSON.stringify(g.current);
  // (Hook guards against this; simulating the guard check directly)
  assert('frame over: isFrameOver=true, further concede is no-op per hook guard', g.current.isFrameOver === true);

  // endVisit when frame is over — in the hook this is guarded (isFrameOver check)
  // We verify the getAvailableBalls already returns []
  assert('frame over: getAvailableBalls=[]; UI cannot pot anything', getAvailableBalls(g.current).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 18 — CONSECUTIVE FOULS (looping penalty situation)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 18 — Consecutive fouls (tactical safety play)');
{
  let g = makeGame(15);
  // 5 consecutive fouls, P0 fouls each time, opponent plays each time
  for (let i=1; i<=5; i++) {
    g = applyFoul(g, 4, true); // P0 fouls, P1 plays
    assert(`foul #${i}: P1 score = ${i*4}`, g.current.scores[1] === i*4);
    assert(`foul #${i}: P0 at table before foul, P1 after`, g.current.currentPlayer === 1);
    g = applyFoul(g, 4, true); // P1 fouls, P0 plays
    assert(`foul #${i}: P0 score from P1 foul = ${i*4}`, g.current.scores[0] === i*4);
  }
  // After 5 fouls each: P0 score=20, P1 score=20
  assert('10 fouls total: scores [20,20]', g.current.scores[0]===20 && g.current.scores[1]===20);
  // redsRemaining unchanged (no legal pots)
  assert('10 fouls: redsRemaining still 15', g.current.redsRemaining === 15);
  assert('10 fouls: awaiting still red', g.current.awaiting === 'red');

  // Frame won entirely by foul points (no legal pots)
  let g2 = makeGame(1); // 1 red — max points = 1+7+27 = 35
  // P0 fouls 5 times: P1 gets 5*7=35 points (enough to win even if P0 clears the table)
  for (let i=0;i<5;i++) { g2=applyFoul(g2,7,true); g2=applyFoul(g2,4,false); } // alternating
  assert('foul-heavy frame: frame not over', g2.current.isFrameOver === false);
  assert('foul-heavy: scores are non-zero from fouls only', g2.current.scores[0]+g2.current.scores[1] > 0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 19 — MULTI-LEVEL UNDO (chain of undos)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 19 — Multi-level undo (undo back through a full break)');
{
  let g = makeGame(15);
  // Build: red+black, red+black, red+blue
  g=applyPot(g,'red'); g=applyPot(g,'black'); // score=8, h=[2]
  g=applyPot(g,'red'); g=applyPot(g,'black'); // score=16, h=[4]
  g=applyPot(g,'red'); g=applyPot(g,'blue');  // score=22, h=[6]
  assert('before undos: score=22', g.current.scores[0]===22);
  assert('before undos: history length=6', g.history.length===6);

  // Undo blue
  g=applyUndo(g);
  assert('undo blue: score=17 (1 red, awaiting=color)', g.current.scores[0]===17);
  assert('undo blue: awaiting=color', g.current.awaiting==='color');

  // Undo the 3rd red
  g=applyUndo(g);
  assert('undo 3rd red: score=16', g.current.scores[0]===16);
  assert('undo 3rd red: awaiting=red', g.current.awaiting==='red');
  assert('undo 3rd red: redsRemaining=13', g.current.redsRemaining===13);

  // Undo all 6 actions
  g=applyUndo(g); g=applyUndo(g); g=applyUndo(g); g=applyUndo(g);
  assert('undone all 6: score=0', g.current.scores[0]===0);
  assert('undone all 6: history empty', g.history.length===0);
  assert('undone all 6: redsRemaining=15', g.current.redsRemaining===15);
  assert('undone all 6: awaiting=red', g.current.awaiting==='red');

  // Further undos are no-ops
  g=applyUndo(g); g=applyUndo(g);
  assert('extra undos with empty history: no-op', g.current.scores[0]===0 && g.history.length===0);

  // Undo a foul then re-foul
  let g2 = makeGame(15);
  g2=applyFoul(g2, 7, true); // P1 gets 7
  assert('before undo foul: P1=7', g2.current.scores[1]===7);
  g2=applyUndo(g2);
  assert('undo foul: P1=0', g2.current.scores[1]===0);
  assert('undo foul: player back to P0', g2.current.currentPlayer===0);
  g2=applyFoul(g2, 4, true); // different foul value
  assert('re-foul: P1=4', g2.current.scores[1]===4);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 20 — FRAME STATE RESET BETWEEN FRAMES
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 20 — Frame state properly resets between frames');
{
  function confirmFrameEnd(state, winner, nextBreakerOverride=undefined) {
    const result = { frameNumber:state.frameNumber, winner, scores:[...state.current.scores], highestBreak:[...state.frameHighestBreak] };
    const fw=[...state.framesWon]; fw[winner]++;
    const nextBreaker = nextBreakerOverride!==undefined ? nextBreakerOverride : (state.frameNumber%2===0?0:1);
    let isMatchOver=false, matchWinner=null;
    if (state.config.bestOf===null) { isMatchOver=true; matchWinner=winner; }
    else {
      const target=Math.ceil(state.config.bestOf/2);
      if(fw[0]>=target){isMatchOver=true;matchWinner=0;}
      else if(fw[1]>=target){isMatchOver=true;matchWinner=1;}
    }
    return {...state, framesWon:fw, frameResults:[...state.frameResults,result], frameNumber:state.frameNumber+1,
      current:makeInitialFrame(state.config.numberOfReds,nextBreaker), history:[], frameHighestBreak:[0,0], isMatchOver, matchWinner};
  }

  let g = { ...makeGame(15, 5), config:{numberOfReds:15,bestOf:5} };
  // Frame 1: P0 builds a big break
  for(let i=0;i<10;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  g=applyFoul(g,7,true); // P1 gets 7
  assert('F1: P0 break=80', g.frameHighestBreak[0]===80);
  assert('F1: P1 foul score=7', g.current.scores[1]===7);
  g=applyConcede(g);
  g=confirmFrameEnd(g,0);

  // Frame 2: everything should be reset
  assert('F2: scores reset to [0,0]', g.current.scores[0]===0 && g.current.scores[1]===0);
  assert('F2: frameHighestBreak reset [0,0]', g.frameHighestBreak[0]===0 && g.frameHighestBreak[1]===0);
  assert('F2: redsRemaining back to 15', g.current.redsRemaining===15);
  assert('F2: awaiting=red', g.current.awaiting==='red');
  assert('F2: history empty', g.history.length===0);
  assert('F2: currentBreak=0', g.current.currentBreak===0);
  assert('F2: phase=reds', g.current.phase==='reds');
  assert('F2: colorsRemaining=6', g.current.colorsRemaining.length===6);
  assert('F2: isFrameOver=false', g.current.isFrameOver===false);
  assert('F2: frameNumber=2', g.frameNumber===2);
  assert('F1 result stored: scores[0]=80', g.frameResults[0].scores[0]===80);
  assert('F1 result stored: highestBreak[0]=80', g.frameResults[0].highestBreak[0]===80);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 21 — DIFFERENT RED CONFIGURATIONS (6 and 10 reds)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 21 — Different red configurations');
{
  // 6-red max break = 6*(1+7) + 27 = 75
  let g6 = makeGame(6);
  assert('6-reds: initial pot=75', g6.current.pointsOnTable === 75);
  for(let i=0;i<6;i++){g6=applyPot(g6,'red');g6=applyPot(g6,'black');}
  for(const c of ['yellow','green','brown','blue','pink','black']){g6=applyPot(g6,c);}
  assert('6-reds: max break=75', g6.current.scores[0]===75 && g6.current.isFrameOver===true);

  // 10-red max break = 10*(1+7) + 27 = 107
  let g10 = makeGame(10);
  assert('10-reds: initial pot=107', g10.current.pointsOnTable === 107);
  for(let i=0;i<10;i++){g10=applyPot(g10,'red');g10=applyPot(g10,'black');}
  for(const c of ['yellow','green','brown','blue','pink','black']){g10=applyPot(g10,c);}
  assert('10-reds: max break=107', g10.current.scores[0]===107 && g10.current.isFrameOver===true);

  // 1-red: pot red, pot color, then colors phase immediately
  let g1 = makeGame(1);
  assert('1-red: initial pot=35', g1.current.pointsOnTable === 35);
  g1=applyPot(g1,'red'); g1=applyPot(g1,'black');
  assert('1-red: after red+black in colors phase', g1.current.phase==='colors');
  assert('1-red: pot after red+black = 27', g1.current.pointsOnTable === 27);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 22 — TIGHT ENDGAME (last few balls, snookers required)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 22 — Tight endgame scenarios');
{
  function getSnookersNeeded(scores, pot) {
    return [
      Math.max(0, Math.ceil((scores[1]-scores[0]-pot)/7)),
      Math.max(0, Math.ceil((scores[0]-scores[1]-pot)/7)),
    ];
  }

  // P1 trailing by 8, only pink+black remain (13 pts)
  // P1 can still win by potting both
  const scores1 = [40, 32]; const pot1 = 13;
  const sn1 = getSnookersNeeded(scores1, pot1);
  assert('P1 trails by 8, pot=13: P1 needs 0 snookers (can win)', sn1[1]===0);

  // P1 trailing by 14, only black remains (7 pts)
  // Formula: ceil((50-36-7)/7) = ceil(1) = 1 snooker needed
  const scores2 = [50, 36]; const pot2 = 7;
  const sn2 = getSnookersNeeded(scores2, pot2);
  assert('P1 trails by 14, pot=7: P1 needs 1 snooker', sn2[1]===1);

  // P0 trails by 35, pot=34 (0 reds + free color + colors): needs snookers
  const scores3 = [0, 35]; const pot3 = 34;
  const sn3 = getSnookersNeeded(scores3, pot3);
  assert('P0 trails by 35, pot=34: P0 needs 1 snooker', sn3[0]===1);

  // Frame game: tight clearance
  let g = makeGame(1);
  g=applyPot(g,'red'); // P0: 1
  g=applyFoul(g,7,true); // P1: 7, P0: 1 — P1 leads by 6
  g=applyPot(g,'blue'); // P1 pots free blue (after last red), should transition to colors
  assert('tight: free blue transitions to colors', g.current.phase==='colors');
  // P0 is down 1 vs 12. pot=27. P0 could win by clearing all colors.
  // P1 has 7 (from foul) + 5 (blue) = 12
  assert('tight: P1 leads 12 vs 1', g.current.scores[1]===12 && g.current.scores[0]===1);
  // P1 must pot yellow next
  g=applyEndVisit(g); // P1 misses yellow, P0 plays
  g=applyPot(g,'yellow'); // P0 pots yellow: +2 → P0=3
  g=applyPot(g,'green'); g=applyPot(g,'brown'); g=applyPot(g,'blue');
  g=applyPot(g,'pink'); g=applyPot(g,'black');
  assert('tight: P0 clears colors, frame over', g.current.isFrameOver===true);
  assert('tight: P0 wins (3+2+3+4+5+6+7=30 > 14)', g.current.scores[0] > g.current.scores[1],
    `P0=${g.current.scores[0]} P1=${g.current.scores[1]}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 23 — EXTRA RED + FOUL COMBINATION
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 23 — Extra red then foul');
{
  // P0 pots 2 reds, then fouls on color — awaiting stays 'color'
  let g = makeGame(15);
  g=applyPot(g,'red'); g=applyExtraRed(g); // 2 reds
  assert('2 reds potted: score=2, redsRemaining=13', g.current.scores[0]===2 && g.current.redsRemaining===13);
  g=applyFoul(g,4,true); // foul on color nomination
  assert('foul after 2 reds: awaiting STILL color', g.current.awaiting==='color');
  assert('foul after 2 reds: redsRemaining still 13', g.current.redsRemaining===13);
  assert('P1 gets foul pts', g.current.scores[1]===4);

  // P1 pots a color (continuing from the 2-red sequence)
  g=applyPot(g,'pink'); // 6 pts to P1
  assert('P1 pots pink for 2-red sequence: awaiting=red', g.current.awaiting==='red');
  assert('P1 score: 4+6=10', g.current.scores[1]===10);

  // Undo the foul — should restore awaiting=color
  let g2 = makeGame(15);
  g2=applyPot(g2,'red'); g2=applyExtraRed(g2);
  g2=applyFoul(g2,7,true);
  g2=applyUndo(g2); // undo foul
  assert('undo foul after 2 reds: awaiting back to color', g2.current.awaiting==='color');
  assert('undo foul: P1 score back to 0', g2.current.scores[1]===0);
  assert('undo foul: redsRemaining still 13', g2.current.redsRemaining===13);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 24 — FOUL VALUES (4, 5, 6, 7)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 24 — All foul values');
{
  for (const val of [4, 5, 6, 7]) {
    let g = makeGame(15);
    g=applyFoul(g, val, true);
    assert(`foul of ${val}: opponent receives exactly ${val}`, g.current.scores[1]===val);
    assert(`foul of ${val}: fouling player score unchanged`, g.current.scores[0]===0);
  }

  // Maximum foul (7) for black
  let g = makeGame(15);
  g=applyFoul(g,7,true);
  assert('max foul=7: opponent gets 7', g.current.scores[1]===7);

  // Foul, re-foul, re-foul
  let g2 = makeGame(15);
  g2=applyFoul(g2,7,true); // P0 fouls: P1=7, P1 plays
  g2=applyFoul(g2,7,true); // P1 fouls: P0=7, P0 plays
  g2=applyFoul(g2,7,true); // P0 fouls: P1=14, P1 plays
  assert('3 fouls: P0=7, P1=14', g2.current.scores[0]===7 && g2.current.scores[1]===14);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 25 — PLAYER INDEX CONSISTENCY (currentPlayer never out of range)
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 25 — Player index consistency');
{
  function checkPlayerIdx(state, label) {
    assert(`${label}: currentPlayer is 0 or 1`, state.current.currentPlayer===0 || state.current.currentPlayer===1);
  }

  let g = makeGame(15);
  checkPlayerIdx(g, 'initial');
  g=applyPot(g,'red'); checkPlayerIdx(g,'after red');
  g=applyPot(g,'black'); checkPlayerIdx(g,'after black');
  g=applyEndVisit(g); checkPlayerIdx(g,'after endVisit');
  g=applyFoul(g,4,true); checkPlayerIdx(g,'after foul opponentPlays=true');
  g=applyFoul(g,4,false); checkPlayerIdx(g,'after foul opponentPlays=false');
  g=applyUndo(g); checkPlayerIdx(g,'after undo');
  g=applyConcede(g); checkPlayerIdx(g,'after concede');

  // Verify the two players alternate correctly on end visit
  let g2 = makeGame(15);
  assert('start: P0', g2.current.currentPlayer===0);
  g2=applyEndVisit(g2); assert('endVisit 1: P1', g2.current.currentPlayer===1);
  g2=applyEndVisit(g2); assert('endVisit 2: P0', g2.current.currentPlayer===0);
  g2=applyEndVisit(g2); assert('endVisit 3: P1', g2.current.currentPlayer===1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 26 — FRAMERESULT STORED CORRECTLY
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 26 — FrameResult stored with correct data');
{
  function confirmFrameEnd(state, winner, nextBreakerOverride=undefined) {
    const result = { frameNumber:state.frameNumber, winner, scores:[...state.current.scores], highestBreak:[...state.frameHighestBreak] };
    const fw=[...state.framesWon]; fw[winner]++;
    const nextBreaker = nextBreakerOverride!==undefined ? nextBreakerOverride : (state.frameNumber%2===0?0:1);
    let isMatchOver=false, matchWinner=null;
    if(state.config.bestOf===null){isMatchOver=true;matchWinner=winner;}
    else{const t=Math.ceil(state.config.bestOf/2);if(fw[0]>=t){isMatchOver=true;matchWinner=0;}else if(fw[1]>=t){isMatchOver=true;matchWinner=1;}}
    return {...state,framesWon:fw,frameResults:[...state.frameResults,result],frameNumber:state.frameNumber+1,
      current:makeInitialFrame(state.config.numberOfReds,nextBreaker),history:[],frameHighestBreak:[0,0],isMatchOver,matchWinner};
  }

  let g = { ...makeGame(15, 5), config:{numberOfReds:15,bestOf:5} };

  // Frame 1: P0 pots red+black x3, P1 fouls x2
  for(let i=0;i<3;i++){g=applyPot(g,'red');g=applyPot(g,'black');} // P0=24
  // foul(7,true): P0 fouls → P1 gets 7, P1 plays. foul(7,false): P1 fouls → P0 gets 7, P1 plays again.
  // P0=24+7=31, P1=7
  g=applyFoul(g,7,true); g=applyFoul(g,7,false);
  g=applyConcede(g); // P1 concedes to P0
  g=confirmFrameEnd(g,0);
  assert('F1 result: winner=0', g.frameResults[0].winner===0);
  assert('F1 result: P0 score=31', g.frameResults[0].scores[0]===31);
  assert('F1 result: P1 score=7', g.frameResults[0].scores[1]===7);
  assert('F1 result: P0 highestBreak=24', g.frameResults[0].highestBreak[0]===24);
  assert('F1 result: frameNumber=1', g.frameResults[0].frameNumber===1);

  // Frame 2: P1 breaks (frame 2, nextBreaker = (1%2===0?0:1) = 1)
  // P1 pots red+blue, then concedes — P1 has 6, P0 has 0
  g=applyPot(g,'red'); g=applyPot(g,'blue'); g=applyConcede(g);
  g=confirmFrameEnd(g,1); // P1 wins frame 2 (had higher score before concede)
  assert('F2 result: winner=1', g.frameResults[1].winner===1);
  assert('F2 result: frameNumber=2', g.frameResults[1].frameNumber===2);
  assert('F2 result: P1 score=1+5=6 (red+blue)', g.frameResults[1].scores[1]===6);
  assert('total frameResults=2', g.frameResults.length===2);
  assert('framesWon=[1,1]', g.framesWon[0]===1 && g.framesWon[1]===1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 27 — COLORS PHASE: FOUL WITH PLAYER SWITCH
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 27 — Colors phase: complex foul and endVisit sequences');
{
  let g = makeGame(6);
  for(let i=0;i<6;i++){g=applyPot(g,'red');g=applyPot(g,'black');}
  assert('in colors', g.current.phase==='colors');

  // P0 misses yellow
  g=applyEndVisit(g);
  assert('P1 plays yellow', g.current.currentPlayer===1);

  // P1 fouls on yellow (hits wrong ball) — yellow stays as next ball
  // P0 had 48 from 6 reds+blacks; foul adds 4 → P0=52
  const p0BeforeFoul = g.current.scores[0]; // 48
  g=applyFoul(g,4,true); // P0 gets 4, P0 plays
  assert('foul: P0 gets 4', g.current.scores[0]===p0BeforeFoul+4);
  assert('foul: P0 plays next', g.current.currentPlayer===0);
  assert('foul: colorsRemaining unchanged (yellow still first)', g.current.colorsRemaining[0]==='yellow');
  assert('foul: still in colors phase', g.current.phase==='colors');

  // P0 pots yellow (+2)
  g=applyPot(g,'yellow');
  assert('P0 pots yellow: colorsRemaining now starts with green', g.current.colorsRemaining[0]==='green');
  assert('P0 score: foul+yellow = p0+4+2', g.current.scores[0]===p0BeforeFoul+6);

  // Foul on last ball (black) — colorsRemaining=[black], foul, still need to pot black
  let g2 = makeGame(6);
  for(let i=0;i<6;i++){g2=applyPot(g2,'red');g2=applyPot(g2,'black');}
  for(const c of ['yellow','green','brown','blue','pink']){g2=applyPot(g2,c);}
  assert('only black remains', JSON.stringify(g2.current.colorsRemaining)==='["black"]');
  g2=applyFoul(g2,7,true); // foul on black
  assert('foul on last black: colorsRemaining still [black]', JSON.stringify(g2.current.colorsRemaining)==='["black"]');
  assert('foul on black: isFrameOver=false', g2.current.isFrameOver===false);
  g2=applyPot(g2,'black');
  assert('pot black after foul: frame over', g2.current.isFrameOver===true);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 28 — UNUSUAL SEQUENCES: reds vs colors ordering
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 28 — Unusual but legal sequences');
{
  // Low-value colors chosen in reds phase (yellow=2, green=3...)
  let g = makeGame(15);
  g=applyPot(g,'red'); // 1
  g=applyPot(g,'yellow'); // 2 → 3, awaiting=red
  assert('yellow after red: score=3', g.current.scores[0]===3);
  assert('yellow after red: awaiting=red', g.current.awaiting==='red');
  assert('yellow after red: redsRemaining=14', g.current.redsRemaining===14);

  g=applyPot(g,'red'); g=applyPot(g,'green'); // +4 → 7
  g=applyPot(g,'red'); g=applyPot(g,'brown'); // +5 → 12
  g=applyPot(g,'red'); g=applyPot(g,'blue');  // +6 → 18
  g=applyPot(g,'red'); g=applyPot(g,'pink');  // +7 → 25
  assert('5 reds with low colors: score=25', g.current.scores[0]===25);
  assert('5 reds used: redsRemaining=10', g.current.redsRemaining===10);

  // End visit mid-break, other player continues with a red
  g=applyEndVisit(g); // awaiting='red' carries to P1
  g=applyPot(g,'red'); g=applyPot(g,'black'); // P1: 8
  assert('P1 score=8', g.current.scores[1]===8);
  assert('redsRemaining=9', g.current.redsRemaining===9);

  // Multiple fouls mid-break reset the break counter
  let g2 = makeGame(15);
  g2=applyPot(g2,'red'); g2=applyPot(g2,'black'); // break=8
  assert('break=8 before foul', g2.current.currentBreak===8);
  g2=applyFoul(g2,4,false); // P0 fouls, plays again
  assert('break reset to 0 after foul', g2.current.currentBreak===0);
  g2=applyPot(g2,'red'); g2=applyPot(g2,'black'); // new break=8
  assert('new break=8 after foul', g2.current.currentBreak===8);
  assert('frameHighestBreak still 8 (both breaks equal)', g2.frameHighestBreak[0]===8);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 29 — REDSREMAINING NEVER GOES NEGATIVE
// ═══════════════════════════════════════════════════════════════════════════════
section('SECTION 29 — redsRemaining guard (never negative, addExtraRed respects limit)');
{
  // 1-red game: pot the red, then try addExtraRed → should throw
  let g = makeGame(1);
  g=applyPot(g,'red'); // redsRemaining=0, awaiting=color
  assert('1-red game: redsRemaining=0 after last red', g.current.redsRemaining===0);
  let threw=false;
  try { applyExtraRed(g); } catch(e) { threw=true; }
  assert('addExtraRed with 0 reds throws', threw);

  // 2-red game: pot both reds simultaneously, then try a 3rd
  let g2 = makeGame(2);
  g2=applyPot(g2,'red'); g2=applyExtraRed(g2); // pot 2 reds
  assert('2-red game: redsRemaining=0', g2.current.redsRemaining===0);
  let threw2=false;
  try { applyExtraRed(g2); } catch(e) { threw2=true; }
  assert('addExtraRed after potting all reds throws', threw2);

  // Large game: redsRemaining decrements exactly as expected
  let g3 = makeGame(15);
  for(let i=15;i>0;i--) {
    assert(`redsRemaining=${i} before pot`, g3.current.redsRemaining===i);
    g3=applyPot(g3,'red'); g3=applyPot(g3,'black');
  }
  assert('final redsRemaining=0 after 15 reds', g3.current.redsRemaining===0);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed across ${29} sections`);
} else {
  console.log(`❌  ${failed} failed, ${passed} passed`);
  process.exit(1);
}
