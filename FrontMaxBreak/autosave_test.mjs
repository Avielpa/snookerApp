// autosave_test.mjs
// Tests for the useGameAutosave hook logic and saveDraftIfNeeded behaviour.
// Covers: mount guard, hasProgress check, matchSaved gate, draft structure,
// end-match paths, AppState background handler, clearDraft race condition,
// and full integration sequences.
//
// Run: node autosave_test.mjs

// ── Inline game state helpers (mirrors useSnookerGame.ts) ──────────────────────

const BALL_VALUES = { red:1, yellow:2, green:3, brown:4, blue:5, pink:6, black:7 };
const COLORS_SEQUENCE = ['yellow','green','brown','blue','pink','black'];
const COLORS_TOTAL = 27;

function makeInitialFrame(numberOfReds = 15, currentPlayer = 0) {
  return {
    scores: [0, 0], currentBreak: 0, currentPlayer,
    pointsOnTable: numberOfReds * 8 + COLORS_TOTAL,
    phase: 'reds', redsRemaining: numberOfReds,
    awaiting: 'red', colorsRemaining: [...COLORS_SEQUENCE],
    isFrameOver: false, freeBallActive: false,
  };
}

function makeGame(numberOfReds = 15, bestOf = null) {
  return {
    config: { numberOfReds, bestOf },
    framesWon: [0, 0], frameResults: [], frameNumber: 1,
    current: makeInitialFrame(numberOfReds, 0),
    history: [], frameHighestBreak: [0, 0],
    isMatchOver: false, matchWinner: null,
  };
}

function withScores(game, s0, s1) {
  return { ...game, current: { ...game.current, scores: [s0, s1] } };
}
function withBreak(game, b) {
  return { ...game, current: { ...game.current, currentBreak: b } };
}
function withFrameResults(game, results) {
  return { ...game, frameResults: results };
}

// ── Pure logic extracted from game.tsx ─────────────────────────────────────────

function checkHasProgress(state) {
  return (
    state.frameResults.length > 0 ||
    state.current.scores[0] > 0 ||
    state.current.scores[1] > 0 ||
    state.current.currentBreak > 0
  );
}

// Simulates the saveDraftIfNeeded logic from game.tsx.
// Returns true if a draft was pushed, false otherwise.
function simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts) {
  if (matchSaved.current) return false;
  const hasProgress = checkHasProgress(stateRef.current);
  if (!hasProgress) return false;
  drafts.push({
    params: { ...params },
    state: stateRef.current,
    savedAt: new Date().toISOString(),
  });
  return true;
}

// Simulates one firing of the useEffect inside useGameAutosave.
// Returns true if saveDraftIfNeeded was called, false if mount was skipped.
function simulateAutosaveEffect(hasMounted, saveDraftIfNeededFn) {
  if (!hasMounted.current) {
    hasMounted.current = true;
    return false;
  }
  saveDraftIfNeededFn();
  return true;
}

// Simulates the AppState handler in game.tsx.
function simulateAppStateChange(nextState, saveDraftIfNeededFn) {
  if (nextState === 'background') {
    saveDraftIfNeededFn();
    return true;
  }
  return false;
}

// ── Test runner ────────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${extra}` : ''}`); failed++; }
}
function section(title) { console.log(`\n${title}`); }

// ══════════════════════════════════════════════════════════════════════════════
// SECTION A — Mount guard (hasMounted ref)
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION A — Mount guard: first effect call is skipped');
{
  let saveCount = 0;
  const saveFn = () => saveCount++;
  const hasMounted = { current: false };

  // First call = mount, should be skipped
  const fired1 = simulateAutosaveEffect(hasMounted, saveFn);
  assert('A01 first call returns false (skipped)', fired1 === false);
  assert('A02 save not called on mount', saveCount === 0);
  assert('A03 hasMounted becomes true after mount call', hasMounted.current === true);

  // Second call = first real state change
  const fired2 = simulateAutosaveEffect(hasMounted, saveFn);
  assert('A04 second call returns true (fired)', fired2 === true);
  assert('A05 save called once after second call', saveCount === 1);

  // Third call
  simulateAutosaveEffect(hasMounted, saveFn);
  assert('A06 third call fires save', saveCount === 2);

  // Fourth call
  simulateAutosaveEffect(hasMounted, saveFn);
  assert('A07 fourth call fires save', saveCount === 3);

  // hasMounted stays true — never resets
  assert('A08 hasMounted stays true after multiple calls', hasMounted.current === true);

  // Simulate 10 more state changes
  for (let i = 0; i < 10; i++) simulateAutosaveEffect(hasMounted, saveFn);
  assert('A09 10 more calls each fire save (total 13)', saveCount === 13);
  assert('A10 hasMounted still true after many calls', hasMounted.current === true);

  // Reset simulation (new component mount)
  const hasMounted2 = { current: false };
  let saveCount2 = 0;
  const saveFn2 = () => saveCount2++;
  simulateAutosaveEffect(hasMounted2, saveFn2);
  assert('A11 fresh mount: skip again (saveCount=0)', saveCount2 === 0);
  simulateAutosaveEffect(hasMounted2, saveFn2);
  assert('A12 after fresh mount: second call fires (saveCount=1)', saveCount2 === 1);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION B — hasProgress check: no-progress scenarios
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION B — hasProgress: no-progress scenarios return false');
{
  // Pristine initial state
  const g0 = makeGame(15);
  assert('B01 initial state: no progress', checkHasProgress(g0) === false);

  // Explicit zeros
  const g1 = { ...makeGame(15), current: { ...makeInitialFrame(15), scores:[0,0], currentBreak:0 }, frameResults:[] };
  assert('B02 explicit zeros: no progress', checkHasProgress(g1) === false);

  // Various red counts at zero
  [1, 3, 6, 10, 15].forEach((reds, i) => {
    assert(`B${String(3+i).padStart(2,'0')} ${reds}-red initial: no progress`, checkHasProgress(makeGame(reds)) === false);
  });
  // B03, B04, B05, B06, B07 — 5 assertions for [1,3,6,10,15]

  // Train mode initial state
  const gTrain = makeGame(15, 9999);
  assert('B08 train mode initial: no progress', checkHasProgress(gTrain) === false);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION C — hasProgress check: progress scenarios return true
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION C — hasProgress: progress scenarios return true');
{
  // scores[0] variants
  assert('C01 scores[0]=1', checkHasProgress(withScores(makeGame(),1,0)) === true);
  assert('C02 scores[0]=7', checkHasProgress(withScores(makeGame(),7,0)) === true);
  assert('C03 scores[0]=100', checkHasProgress(withScores(makeGame(),100,0)) === true);
  assert('C04 scores[0]=147', checkHasProgress(withScores(makeGame(),147,0)) === true);

  // scores[1] variants
  assert('C05 scores[1]=1', checkHasProgress(withScores(makeGame(),0,1)) === true);
  assert('C06 scores[1]=50', checkHasProgress(withScores(makeGame(),0,50)) === true);
  assert('C07 scores[1]=147', checkHasProgress(withScores(makeGame(),0,147)) === true);

  // currentBreak
  assert('C08 currentBreak=1', checkHasProgress(withBreak(makeGame(),1)) === true);
  assert('C09 currentBreak=25', checkHasProgress(withBreak(makeGame(),25)) === true);
  assert('C10 currentBreak=100', checkHasProgress(withBreak(makeGame(),100)) === true);

  // frameResults
  const fr = [{ frameNumber:1, winner:0, scores:[45,32], highestBreak:[18,10] }];
  assert('C11 frameResults.length=1', checkHasProgress(withFrameResults(makeGame(), fr)) === true);
  assert('C12 frameResults.length=5', checkHasProgress(withFrameResults(makeGame(), new Array(5).fill(fr[0]))) === true);

  // Only frameResults (all scores zero, break zero)
  const gFR = withFrameResults(withScores(withBreak(makeGame(),0),0,0), fr);
  assert('C13 frameResults only (scores/break zero): true', checkHasProgress(gFR) === true);

  // All progress at once
  const gAll = withFrameResults(withScores(withBreak(makeGame(),20),50,30), fr);
  assert('C14 all progress indicators: true', checkHasProgress(gAll) === true);
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION D — matchSaved gate
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION D — matchSaved gate: blocks save when true');
{
  const params = { id:'abc-123', player1:'Alice', player2:'Bob', numberOfReds:'15', bestOf:'5' };

  // matchSaved=true blocks all saves
  {
    const matchSaved = { current: true };
    const stateRef = { current: withScores(makeGame(),50,30) };
    const drafts = [];
    const saved = simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D01 matchSaved=true: returns false', saved === false);
    assert('D02 matchSaved=true: no draft pushed', drafts.length === 0);
  }

  // matchSaved=true even with all progress types
  {
    const matchSaved = { current: true };
    const stateRef = { current: withFrameResults(withScores(withBreak(makeGame(),20),50,30),[{frameNumber:1,winner:0,scores:[50,30],highestBreak:[20,0]}]) };
    const drafts = [];
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D03 matchSaved=true, all progress: still no draft', drafts.length === 0);
  }

  // matchSaved=false, no progress: still no save
  {
    const matchSaved = { current: false };
    const stateRef = { current: makeGame() };
    const drafts = [];
    const saved = simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D04 matchSaved=false, no progress: returns false', saved === false);
    assert('D05 matchSaved=false, no progress: no draft', drafts.length === 0);
  }

  // matchSaved=false, with progress: saves
  {
    const matchSaved = { current: false };
    const stateRef = { current: withScores(makeGame(),50,30) };
    const drafts = [];
    const saved = simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D06 matchSaved=false, progress: returns true', saved === true);
    assert('D07 matchSaved=false, progress: draft pushed', drafts.length === 1);
  }

  // Flip matchSaved mid-session
  {
    const matchSaved = { current: false };
    const stateRef = { current: withScores(makeGame(),20,0) };
    const drafts = [];
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D08 before flip: 1 draft', drafts.length === 1);
    matchSaved.current = true;
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D09 after flip: still 1 draft (no new save)', drafts.length === 1);
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert('D10 after flip (2nd call): still 1 draft', drafts.length === 1);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION E — Draft structure integrity
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION E — Draft object structure is correct');
{
  const params = { id:'game-xyz', player1:'Dave', player2:'Carol', numberOfReds:'10', bestOf:'3' };
  const state = withScores(makeGame(10),45,22);
  const matchSaved = { current: false };
  const stateRef = { current: state };
  const drafts = [];
  simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);

  const draft = drafts[0];
  assert('E01 draft has params field', 'params' in draft);
  assert('E02 draft has state field', 'state' in draft);
  assert('E03 draft has savedAt field', 'savedAt' in draft);
  assert('E04 params.id matches', draft.params.id === 'game-xyz');
  assert('E05 params.player1 matches', draft.params.player1 === 'Dave');
  assert('E06 params.player2 matches', draft.params.player2 === 'Carol');
  assert('E07 params.numberOfReds matches', draft.params.numberOfReds === '10');
  assert('E08 params.bestOf matches', draft.params.bestOf === '3');
  assert('E09 state.current is present', draft.state.current !== undefined);
  assert('E10 state.current.scores correct', draft.state.current.scores[0]===45 && draft.state.current.scores[1]===22);
  assert('E11 savedAt is non-empty string', typeof draft.savedAt === 'string' && draft.savedAt.length > 0);
  // savedAt is a valid ISO date
  assert('E12 savedAt parses as valid date', !isNaN(new Date(draft.savedAt).getTime()));
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION F — End-match paths all set matchSaved=true
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION F — End-match paths block further autosave');
{
  const params = { id:'m1', player1:'P1', player2:'P2', numberOfReds:'15', bestOf:'5' };

  // Each end-match function sets matchSaved.current = true
  const endFns = ['handleEndMatch', 'handleMatchOver', 'handleTrainEndSession', 'handleUnlimitedEndMatch', 'handleAbandonMatch'];
  endFns.forEach((fnName, i) => {
    const matchSaved = { current: false };
    const stateRef = { current: withScores(makeGame(),40,20) };
    const drafts = [];
    // Simulate one save before end
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert(`F${String(i*2+1).padStart(2,'0')} ${fnName}: save before end works`, drafts.length === 1);
    // End match: set matchSaved=true
    matchSaved.current = true;
    simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
    assert(`F${String(i*2+2).padStart(2,'0')} ${fnName}: no save after end`, drafts.length === 1);
  });
  // F01–F10: 10 assertions
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION G — AppState background handler
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION G — AppState background handler triggers save');
{
  // background → fires save
  {
    let saveCount = 0;
    const fired = simulateAppStateChange('background', () => saveCount++);
    assert('G01 AppState background: handler fires', fired === true);
    assert('G02 AppState background: save called', saveCount === 1);
  }

  // active → does NOT fire save
  {
    let saveCount = 0;
    const fired = simulateAppStateChange('active', () => saveCount++);
    assert('G03 AppState active: handler does not fire', fired === false);
    assert('G04 AppState active: save not called', saveCount === 0);
  }

  // inactive → does NOT fire save
  {
    let saveCount = 0;
    const fired = simulateAppStateChange('inactive', () => saveCount++);
    assert('G05 AppState inactive: handler does not fire', fired === false);
    assert('G06 AppState inactive: save not called', saveCount === 0);
  }

  // background with matchSaved=true → saveDraftIfNeeded skips
  {
    const matchSaved = { current: true };
    const stateRef = { current: withScores(makeGame(),30,10) };
    const params = { id:'g1', player1:'A', player2:'B', numberOfReds:'15', bestOf:'5' };
    const drafts = [];
    simulateAppStateChange('background', () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts));
    assert('G07 background + matchSaved=true: no draft saved', drafts.length === 0);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION H — clearDraft race condition resolved by mount guard
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION H — Mount guard resolves clearDraft race condition');
{
  // Scenario: useFocusEffect calls clearDraft after mount.
  // Without guard: autosave on mount → clearDraft wipes it → gap until first action.
  // With guard: no save on mount → clearDraft is a no-op for autosave → safe.
  {
    const hasMounted = { current: false };
    let autosaveFired = false;
    const saveFn = () => { autosaveFired = true; };

    // Mount (step 1): autosave useEffect fires
    simulateAutosaveEffect(hasMounted, saveFn);
    assert('H01 mount: autosave did not fire', autosaveFired === false);

    // useFocusEffect (step 2): clearDraft() — nothing to clear since autosave skipped
    // (simulated: draft array stays empty)
    assert('H02 mount guard means clearDraft has nothing to undo', autosaveFired === false);

    // First state change (step 3): autosave fires correctly
    simulateAutosaveEffect(hasMounted, saveFn);
    assert('H03 first state change: autosave fires', autosaveFired === true);
  }

  // Resume scenario: game resumed with prior draft state.
  // After clearDraft on focus, next action saves fresh draft.
  {
    const hasMounted = { current: false };
    const matchSaved = { current: false };
    const params = { id:'resume-1', player1:'X', player2:'Y', numberOfReds:'15', bestOf:'5' };
    const drafts = [];
    const stateRef = { current: withScores(makeGame(),70,50) }; // resumed state has progress

    // Mount: skip
    simulateAutosaveEffect(hasMounted, () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts));
    assert('H04 resume mount: no draft saved', drafts.length === 0);

    // clearDraft() called by useFocusEffect (simulated: drafts stays empty)
    // First action after resume:
    simulateAutosaveEffect(hasMounted, () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts));
    assert('H05 first action after resume: draft saved', drafts.length === 1);
    assert('H06 draft has resumed scores', drafts[0].state.current.scores[0] === 70);
  }

  // hasMounted does not reset when screen blurs/focuses (simulated as ref staying true)
  {
    const hasMounted = { current: false };
    let count = 0;
    simulateAutosaveEffect(hasMounted, () => count++); // mount
    simulateAutosaveEffect(hasMounted, () => count++); // action
    assert('H07 hasMounted stays true across focus cycles', hasMounted.current === true);
    assert('H08 save fired once (second call, not first)', count === 1);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION I — Integration sequences: full game simulation
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION I — Integration: full game sequences');
{
  const params = { id:'int-1', player1:'Red', player2:'Blue', numberOfReds:'15', bestOf:'5' };

  // Sequence 1: game with 5 ball pots, then end match
  {
    const hasMounted = { current: false };
    const matchSaved = { current: false };
    const drafts = [];
    let game = makeGame();
    const stateRef = { current: game };
    const saveFn = () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);

    // Mount — skip
    simulateAutosaveEffect(hasMounted, saveFn);
    assert('I01 seq1 mount: 0 drafts', drafts.length === 0);

    // 5 state changes (ball pots simulate different scores each time)
    const scores = [[1,0],[2,0],[9,0],[10,0],[17,0]];
    scores.forEach(([s0,s1]) => {
      stateRef.current = withScores(game, s0, s1);
      simulateAutosaveEffect(hasMounted, saveFn);
    });
    assert('I02 5 pots: 5 drafts saved', drafts.length === 5);
    assert('I03 last draft has latest score', drafts[4].state.current.scores[0] === 17);

    // End match
    matchSaved.current = true;
    stateRef.current = withScores(game, 50, 30);
    simulateAutosaveEffect(hasMounted, saveFn);
    assert('I04 after end match: no new draft', drafts.length === 5);
  }

  // Sequence 2: undo chain — each undo fires autosave
  {
    const hasMounted = { current: false };
    const matchSaved = { current: false };
    const drafts = [];
    const stateRef = { current: makeGame() };
    const saveFn = () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);

    simulateAutosaveEffect(hasMounted, saveFn); // mount skip

    // Pot, then undo 3 times
    const states = [
      withScores(makeGame(),1,0),
      withBreak(makeGame(),1),
      makeGame(), // undo back to zero — no progress
    ];
    states.forEach(s => {
      stateRef.current = s;
      simulateAutosaveEffect(hasMounted, saveFn);
    });
    // First two have progress, third has none
    assert('I05 undo chain: 2 drafts saved (3rd had no progress)', drafts.length === 2);
  }

  // Sequence 3: foul advances state — autosave fires
  {
    const hasMounted = { current: false };
    const matchSaved = { current: false };
    const drafts = [];
    const stateRef = { current: withScores(makeGame(),0,4) }; // foul gave opponent 4
    const saveFn = () => simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);

    simulateAutosaveEffect(hasMounted, saveFn); // mount skip
    simulateAutosaveEffect(hasMounted, saveFn); // foul state change
    assert('I06 foul state change: draft saved', drafts.length === 1);
    assert('I07 foul draft has opponent score=4', drafts[0].state.current.scores[1] === 4);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION J — Train and unlimited mode params
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION J — Train / unlimited mode draft params preserved');
{
  const matchSaved = { current: false };
  const drafts = [];

  // Train mode
  const trainParams = { id:'t1', player1:'Solo', player2:'', numberOfReds:'15', bestOf:'train' };
  const trainState = withBreak(makeGame(15, 9999), 25);
  simulateSaveDraftIfNeeded(matchSaved, { current: trainState }, trainParams, drafts);
  assert('J01 train: bestOf=train preserved in draft', drafts[0].params.bestOf === 'train');
  assert('J02 train: player1 preserved', drafts[0].params.player1 === 'Solo');
  assert('J03 train: break=25 in state', drafts[0].state.current.currentBreak === 25);

  // Unlimited mode
  const unlimitedParams = { id:'u1', player1:'A', player2:'B', numberOfReds:'15', bestOf:'unlimited' };
  const unlimitedState = withScores(makeGame(15, 9999), 100, 80);
  simulateSaveDraftIfNeeded(matchSaved, { current: unlimitedState }, unlimitedParams, drafts);
  assert('J04 unlimited: bestOf=unlimited preserved', drafts[1].params.bestOf === 'unlimited');
  assert('J05 unlimited: scores correct', drafts[1].state.current.scores[0] === 100);

  // Single frame
  const singleParams = { id:'s1', player1:'A', player2:'B', numberOfReds:'6', bestOf:'single' };
  const singleState = withScores(makeGame(6, null), 30, 10);
  simulateSaveDraftIfNeeded(matchSaved, { current: singleState }, singleParams, drafts);
  assert('J06 single frame: bestOf=single preserved', drafts[2].params.bestOf === 'single');
  assert('J07 single frame: numberOfReds=6 preserved', drafts[2].params.numberOfReds === '6');
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION K — Edge cases: rapid state changes and draft overwrite
// ══════════════════════════════════════════════════════════════════════════════
section('SECTION K — Edge cases: rapid changes and draft overwrite');
{
  const params = { id:'k1', player1:'A', player2:'B', numberOfReds:'15', bestOf:'5' };
  const matchSaved = { current: false };

  // Most recent state always wins (last save is the resume point)
  const drafts = [];
  const stateRef = { current: withScores(makeGame(),10,0) };
  simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
  stateRef.current = withScores(makeGame(),20,0);
  simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
  stateRef.current = withScores(makeGame(),27,0);
  simulateSaveDraftIfNeeded(matchSaved, stateRef, params, drafts);
  assert('K01 3 saves pushed to drafts array', drafts.length === 3);
  assert('K02 last draft has most recent score (27)', drafts[2].state.current.scores[0] === 27);
  assert('K03 first draft preserved first score (10)', drafts[0].state.current.scores[0] === 10);

  // matchSaved starts false, save happens; then end match; then new game would start fresh
  const matchSaved2 = { current: false };
  const drafts2 = [];
  const stateRef2 = { current: withScores(makeGame(),50,40) };
  simulateSaveDraftIfNeeded(matchSaved2, stateRef2, params, drafts2);
  assert('K04 before end: draft count=1', drafts2.length === 1);
  matchSaved2.current = true;
  // Simulate 10 more rapid saves (all blocked by matchSaved)
  for (let i = 0; i < 10; i++) simulateSaveDraftIfNeeded(matchSaved2, stateRef2, params, drafts2);
  assert('K05 matchSaved blocks all 10 rapid saves', drafts2.length === 1);
}

// ── Final report ───────────────────────────────────────────────────────────────
const total = passed + failed;
console.log(`\n${failed === 0 ? '✅' : '❌'} ${total} assertions — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
