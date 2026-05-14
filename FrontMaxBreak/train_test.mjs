// Train mode logic test — runs in Node.js (no React needed)
// Tests the pure state-machine logic extracted from useSnookerGame + gameStorage computeTrainingStats

// ── Inline game logic (mirrors hooks/useSnookerGame.ts) ──────────────────────

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27;

function calcPointsOnTable(phase, redsRemaining, awaiting, colorsRemaining) {
  if (phase === 'colors') return colorsRemaining.reduce((s,b) => s + BALL_VALUES[b], 0);
  if (awaiting === 'color') return 7 + redsRemaining * 8 + COLORS_TOTAL;
  return redsRemaining * 8 + COLORS_TOTAL;
}

function makeInitialFrame(numberOfReds, currentPlayer=0) {
  return {
    scores: [0,0], currentBreak: 0, currentPlayer,
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
  if (!available.includes(ball)) throw new Error(`Cannot pot ${ball} now. Available: ${available}`);

  const points = BALL_VALUES[ball];
  const newScores = [...snap.scores];
  newScores[snap.currentPlayer] += points;
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

function applyEndVisit(state) {
  const snap = state.current;
  return { ...state, current: { ...snap, currentPlayer: snap.currentPlayer === 0 ? 1 : 0, currentBreak: 0 }, history: [...state.history, snap] };
}

function applyConcede(state) {
  const snap = state.current;
  return { ...state, current: { ...snap, isFrameOver: true }, history: [...state.history, snap] };
}

function applyUndo(state) {
  if (state.history.length === 0) return state;
  const hist = [...state.history];
  const prev = hist.pop();
  return { ...state, current: prev, history: hist };
}

function applyFoul(state, foulValue, opponentPlays=false) {
  const snap = state.current;
  const opponent = snap.currentPlayer === 0 ? 1 : 0;
  const newScores = [...snap.scores];
  newScores[opponent] += foulValue;
  const newPlayer = opponentPlays ? opponent : snap.currentPlayer;
  const newAwaiting = snap.phase === 'reds' && snap.redsRemaining > 0 ? 'red' : snap.awaiting;
  return { ...state, current: { ...snap, scores: newScores, currentBreak: 0, currentPlayer: newPlayer, awaiting: newAwaiting }, history: [...state.history, snap] };
}

function confirmFrameEnd(state, winner, numberOfReds, nextBreakerOverride=undefined) {
  const result = { frameNumber: state.frameNumber, winner, scores: [...state.current.scores], highestBreak: [...state.frameHighestBreak] };
  const newFramesWon = [...state.framesWon]; newFramesWon[winner]++;
  const nextBreaker = nextBreakerOverride !== undefined ? nextBreakerOverride : (state.frameNumber % 2 === 0 ? 0 : 1);
  let isMatchOver = false, matchWinner = null;
  if (state.config.bestOf === null) { isMatchOver = true; matchWinner = winner; }
  else {
    const target = Math.ceil(state.config.bestOf / 2);
    if (newFramesWon[0] >= target) { isMatchOver = true; matchWinner = 0; }
    else if (newFramesWon[1] >= target) { isMatchOver = true; matchWinner = 1; }
  }
  return { ...state, framesWon: newFramesWon, frameResults: [...state.frameResults, result], frameNumber: state.frameNumber + 1, current: makeInitialFrame(numberOfReds, nextBreaker), history: [], frameHighestBreak: [0,0], isMatchOver, matchWinner };
}

function makeGame(numberOfReds, bestOf=99) {
  return { config: { numberOfReds, bestOf }, framesWon: [0,0], frameResults: [], frameNumber: 1, current: makeInitialFrame(numberOfReds, 0), history: [], frameHighestBreak: [0,0], isMatchOver: false, matchWinner: null };
}

// ── Inline training stats (mirrors services/gameStorage.ts) ──────────────────

function computeTrainingStats(sessions) {
  let totalBreaks=0, highestBreak=0, breakSum=0, breaksOver25=0, breaksOver50=0;
  for (const s of sessions) {
    for (const fr of s.frameResults) {
      const b = fr.highestBreak[0];
      totalBreaks++;
      if (b > highestBreak) highestBreak = b;
      breakSum += b;
      if (b >= 25) breaksOver25++;
      if (b >= 50) breaksOver50++;
    }
  }
  return { totalBreaks, highestBreak, avgBreak: totalBreaks > 0 ? Math.round(breakSum/totalBreaks) : 0, breaksOver25, breaksOver50 };
}

function computePlayerStats(matches, playerName) {
  const relevant = matches.filter(m => m.isComplete && (!m.mode || m.mode === 'match') && (m.player1Name === playerName || m.player2Name === playerName));
  let totalFramesPlayed=0, totalFramesWon=0, highestBreak=0, totalBreakSum=0, totalBreakCount=0, totalMatchesWon=0;
  for (const match of relevant) {
    const pIdx = match.player1Name === playerName ? 0 : 1;
    totalFramesPlayed += match.frameResults.length;
    totalFramesWon += match.framesWon[pIdx];
    if (match.framesWon[pIdx] > match.framesWon[1-pIdx]) totalMatchesWon++;
    for (const fr of match.frameResults) {
      const hb = fr.highestBreak[pIdx];
      if (hb > highestBreak) highestBreak = hb;
      if (hb > 0) { totalBreakSum += hb; totalBreakCount++; }
    }
  }
  return { totalFramesPlayed, totalFramesWon, winRate: totalFramesPlayed>0?Math.round(totalFramesWon/totalFramesPlayed*100):0, highestBreak, avgBreak: totalBreakCount>0?Math.round(totalBreakSum/totalBreakCount):0, totalMatches: relevant.length, totalMatchesWon };
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed=0, failed=0;
function assert(label, condition, extra='') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ' — ' + extra : ''}`); failed++; }
}

// ── TEST 1: Basic 6-red train break ──────────────────────────────────────────
console.log('\nTEST 1: Basic 6-red train break — pot red+black x3 then concede');
{
  let g = makeGame(6);
  assert('initial frame — 6 reds, awaiting red', g.current.redsRemaining === 6 && g.current.awaiting === 'red');
  assert('initial points on table', g.current.pointsOnTable === 6*8+27);

  g = applyPot(g, 'red');   // 1
  g = applyPot(g, 'black'); // 8
  g = applyPot(g, 'red');   // 9
  g = applyPot(g, 'black'); // 16
  g = applyPot(g, 'red');   // 17
  g = applyPot(g, 'black'); // 24

  assert('score after 3 red+black', g.current.scores[0] === 24);
  assert('break is 24', g.current.currentBreak === 24);
  assert('frameHighestBreak updated', g.frameHighestBreak[0] === 24);

  g = applyConcede(g); // end the break
  assert('frame is over after concede', g.current.isFrameOver === true);
  assert('score preserved after concede', g.current.scores[0] === 24);
}

// ── TEST 2: New break after first one ────────────────────────────────────────
console.log('\nTEST 2: Second break in same session');
{
  let g = makeGame(6);
  g = applyPot(g,'red'); g = applyPot(g,'black'); // 8
  g = applyConcede(g); // end break 1

  // Simulate confirmFrameEnd (like handleNextFrame does)
  g = confirmFrameEnd(g, 0, 6, 0);

  assert('frameResults has 1 entry after break 1', g.frameResults.length === 1);
  assert('frameResults[0] score = 8', g.frameResults[0].scores[0] === 8);
  assert('framesWon[0] = 1', g.framesWon[0] === 1);
  assert('frameNumber is now 2', g.frameNumber === 2);
  assert('new frame starts fresh — score 0', g.current.scores[0] === 0);
  assert('new frame starts fresh — break 0', g.current.currentBreak === 0);
  assert('frameHighestBreak reset', g.frameHighestBreak[0] === 0);
  assert('match NOT over (bestOf=99)', g.isMatchOver === false);
}

// ── TEST 3: Multiple breaks, sessionBest logic ────────────────────────────────
console.log('\nTEST 3: Three breaks — sessionBest tracks across completed breaks');
{
  let g = makeGame(15);
  // Break 1: pot 5 reds + blacks = 5*(1+7) = 40
  for (let i=0; i<5; i++) { g = applyPot(g,'red'); g = applyPot(g,'black'); }
  g = applyConcede(g);
  g = confirmFrameEnd(g, 0, 15, 0);

  // Break 2: just 1 red then concede
  g = applyPot(g,'red');
  g = applyConcede(g);
  g = confirmFrameEnd(g, 0, 15, 0);

  // Break 3: pot 10 reds + pinks = 10*(1+6) = 70
  for (let i=0; i<10; i++) { g = applyPot(g,'red'); g = applyPot(g,'pink'); }
  g = applyConcede(g);
  g = confirmFrameEnd(g, 0, 15, 0);

  const sessionBest = g.frameResults.reduce((best, fr) => Math.max(best, fr.highestBreak[0]), 0);
  assert('3 breaks completed', g.frameResults.length === 3);
  assert('break 1 score=40', g.frameResults[0].scores[0] === 40);
  assert('break 2 score=1', g.frameResults[1].scores[0] === 1);
  assert('break 3 score=70', g.frameResults[2].scores[0] === 70);
  assert('sessionBest = 70', sessionBest === 70);
}

// ── TEST 4: Undo in train mode ────────────────────────────────────────────────
console.log('\nTEST 4: Undo reverts last ball');
{
  let g = makeGame(6);
  g = applyPot(g,'red');   // score=1
  g = applyPot(g,'black'); // score=8
  assert('score before undo = 8', g.current.scores[0] === 8);
  g = applyUndo(g);
  assert('score after undo = 1 (back to after red)', g.current.scores[0] === 1);
  assert('awaiting = color after undo', g.current.awaiting === 'color');
}

// ── TEST 5: Foul in train mode ────────────────────────────────────────────────
console.log('\nTEST 5: Foul gives points to "opponent" (same player in train) — break resets');
{
  let g = makeGame(6);
  g = applyPot(g,'red'); // break=1
  g = applyFoul(g, 4, false); // foul, fouling player plays again
  assert('foul adds 4 to player index 1 (opponent slot)', g.current.scores[1] === 4);
  assert('break resets to 0 after foul', g.current.currentBreak === 0);
  assert('same player continues (opponentPlays=false)', g.current.currentPlayer === 0);
  assert('awaiting reset to red', g.current.awaiting === 'red');
}

// ── TEST 6: Zero breaks — end session early ───────────────────────────────────
console.log('\nTEST 6: Session with 0 completed breaks');
{
  let g = makeGame(6);
  // No breaks completed; user taps "End Session" immediately
  assert('frameResults is empty', g.frameResults.length === 0);
  assert('framesWon both 0', g.framesWon[0] === 0 && g.framesWon[1] === 0);
  // In handleTrainEndSession, breaksDone===0 → no saveMatch call (just navigate)
  // No assertion needed; just verifying the data shape
}

// ── TEST 7: computeTrainingStats ─────────────────────────────────────────────
console.log('\nTEST 7: computeTrainingStats aggregates correctly');
{
  const sessions = [
    { mode:'train', isComplete:true, player1Name:'Alice', player2Name:'',
      frameResults:[{frameNumber:1,winner:0,scores:[30,0],highestBreak:[30,0]},{frameNumber:2,winner:0,scores:[12,0],highestBreak:[12,0]}], framesWon:[2,0] },
    { mode:'train', isComplete:true, player1Name:'Alice', player2Name:'',
      frameResults:[{frameNumber:1,winner:0,scores:[60,0],highestBreak:[60,0]},{frameNumber:2,winner:0,scores:[5,0],highestBreak:[5,0]}], framesWon:[2,0] },
  ];
  const stats = computeTrainingStats(sessions);
  assert('totalBreaks = 4', stats.totalBreaks === 4);
  assert('highestBreak = 60', stats.highestBreak === 60);
  assert('avgBreak = (30+12+60+5)/4 = 27', stats.avgBreak === 27);
  assert('breaksOver25 = 2 (30 and 60)', stats.breaksOver25 === 2);
  assert('breaksOver50 = 1 (60)', stats.breaksOver50 === 1);
}

// ── TEST 8: computePlayerStats excludes train sessions ────────────────────────
console.log('\nTEST 8: computePlayerStats must not count training sessions');
{
  const allMatches = [
    { mode:'match', isComplete:true, player1Name:'Bob', player2Name:'Charlie',
      frameResults:[{frameNumber:1,winner:0,scores:[80,40],highestBreak:[35,20]}], framesWon:[1,0], bestOf:null },
    { mode:'train', isComplete:true, player1Name:'Bob', player2Name:'',
      frameResults:[{frameNumber:1,winner:0,scores:[100,0],highestBreak:[100,0]}], framesWon:[1,0], bestOf:null },
  ];
  const stats = computePlayerStats(allMatches, 'Bob');
  assert('only 1 frame from match (not train)', stats.totalFramesPlayed === 1);
  assert('highestBreak=35 (not 100 from train)', stats.highestBreak === 35);
  assert('1 match played', stats.totalMatches === 1);
}

// ── TEST 9: Full 6-red clearance (all reds → colors phase) ───────────────────
console.log('\nTEST 9: Full 6-red clearance — pot last red+black triggers colors phase');
{
  let g = makeGame(6);
  // Pot 5 reds + black each
  for (let i=0; i<5; i++) { g = applyPot(g,'red'); g = applyPot(g,'black'); }
  assert('5 reds done, 1 remaining', g.current.redsRemaining === 1);
  assert('still in reds phase', g.current.phase === 'reds');
  // Pot last red
  g = applyPot(g,'red');
  assert('redsRemaining = 0 after last red', g.current.redsRemaining === 0);
  assert('awaiting color after last red', g.current.awaiting === 'color');
  assert('still reds phase (last color not yet potted)', g.current.phase === 'reds');
  // Pot the last "free" color — this transitions to colors phase
  g = applyPot(g,'black');
  assert('phase = colors after last free black', g.current.phase === 'colors');
  assert('colorsRemaining has all 6 colors', g.current.colorsRemaining.length === 6);
  // Clear the 6 colors in sequence
  for (const col of ['yellow','green','brown','blue','pink','black']) {
    g = applyPot(g, col);
  }
  assert('frame over after clearing all colors', g.current.isFrameOver === true);
  const maxBreak = 6*(1+7) + 2+3+4+5+6+7; // 48 + 27 = 75 for 6-red max
  assert(`score = max 6-red break (${maxBreak})`, g.current.scores[0] === maxBreak, `got ${g.current.scores[0]}`);
}

// ── TEST 10: Concede mid-reds (break ends, score preserved) ───────────────────
console.log('\nTEST 10: Concede mid-break — no balls were potted');
{
  let g = makeGame(6);
  g = applyConcede(g);
  assert('frame over immediately', g.current.isFrameOver === true);
  assert('score = 0 (no balls potted)', g.current.scores[0] === 0);
  assert('history has 1 entry', g.history.length === 1);
}

// ── TEST 11: Train mode never triggers isMatchOver (bestOf=99) ────────────────
console.log('\nTEST 11: Train mode (bestOf=99) — match never ends automatically');
{
  let g = makeGame(6, 9999); // train mode simulation (target=5000, never reachable)
  // Complete 50 breaks
  for (let i=0; i<50; i++) {
    g = applyPot(g,'red'); g = applyConcede(g);
    g = confirmFrameEnd(g, 0, 6, 0);
  }
  assert('50 breaks completed, match NOT over', g.isMatchOver === false);
  assert('framesWon[0] = 50', g.framesWon[0] === 50);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.log(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
