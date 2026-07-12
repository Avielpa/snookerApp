// Insight-template engine test suite — mirrors services/insightTemplates.ts.
// Run: node insight_templates_test.mjs

const TEMPLATES = {
  century: [
    '{player} compiles a century! {n} and counting',
    'Century break for {player} — {n} points in one visit',
    '{n}! {player} crosses the century mark',
  ],
  highestBreakSoFar: [
    "{player}'s break of {n} is the highest of the match so far",
    "That's a new match-high break for {player} — {n}",
    '{player} finds form with a break of {n}, the best of the match',
    'A break of {n} from {player} sets the new match high',
  ],
  decidingFrame: [
    'This is the decider — winner takes the match',
    'Everything comes down to this final frame',
    'Winner takes it all in this deciding frame',
  ],
  whitewash: [
    '{player} is well clear here, {n} ahead',
    'One-way traffic — {player} leads by {n}',
    '{player} in control, {n} points to the good',
  ],
  tightFrame: [
    'Nothing in it — {player} edges ahead by just {n}',
    'As tight as it gets, {n} the difference',
    '{player} holds the slenderest of leads, {n} points',
  ],
};

function seededIndex(seed, length) {
  const h = Math.abs(Math.sin(seed + 1) * 10000);
  return Math.floor((h - Math.floor(h)) * length);
}

function pickInsight(situations, seed) {
  if (situations.length === 0) return null;
  const top = [...situations].sort((a, b) => b.priority - a.priority)[0];
  const pool = TEMPLATES[top.key];
  const idx = seededIndex(seed, pool.length);
  let text = pool[idx];
  for (const [key, value] of Object.entries(top.values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

function makeState({ currentBreak = 0, currentPlayer = 0, isFrameOver = false, scores = [0, 0], bestOf = null, framesWon = [0, 0] } = {}) {
  return {
    config: { bestOf },
    framesWon,
    current: { currentBreak, currentPlayer, isFrameOver, scores },
  };
}

function detectGameSituations(state, sessionBest, playerNames) {
  const snap = state.current;
  const results = [];

  if (snap.currentBreak >= 100) {
    results.push({ key: 'century', priority: 100, values: { player: playerNames[snap.currentPlayer], n: snap.currentBreak } });
  } else if (snap.currentBreak > 0 && snap.currentBreak > sessionBest) {
    results.push({ key: 'highestBreakSoFar', priority: 80, values: { player: playerNames[snap.currentPlayer], n: snap.currentBreak } });
  }

  if (!snap.isFrameOver && state.config.bestOf !== null && state.config.bestOf < 9999) {
    const target = Math.ceil(state.config.bestOf / 2);
    if (state.framesWon[0] === target - 1 && state.framesWon[1] === target - 1) {
      results.push({ key: 'decidingFrame', priority: 90, values: {} });
    }
  }

  const diff = snap.scores[0] - snap.scores[1];
  const totalScored = snap.scores[0] + snap.scores[1];
  if (!snap.isFrameOver && Math.abs(diff) >= 30) {
    const leader = diff > 0 ? 0 : 1;
    results.push({ key: 'whitewash', priority: 50, values: { player: playerNames[leader], n: Math.abs(diff) } });
  } else if (!snap.isFrameOver && diff !== 0 && Math.abs(diff) <= 10 && totalScored > 20) {
    const leader = diff > 0 ? 0 : 1;
    results.push({ key: 'tightFrame', priority: 40, values: { player: playerNames[leader], n: Math.abs(diff) } });
  }

  return results;
}

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

const NAMES = ['Aviel', 'Ronnie'];

section('SECTION 1 — No situation detected on ordinary quiet play');
{
  const s = detectGameSituations(makeState({ currentBreak: 8, scores: [8, 5] }), 41, NAMES);
  assert('1. no situations flagged', s.length === 0);
  assert('2. pickInsight returns null for empty situations', pickInsight(s, 1) === null);
}

section('SECTION 2 — Century takes priority over everything else');
{
  const s = detectGameSituations(makeState({ currentBreak: 104, currentPlayer: 1, scores: [10, 104] }), 60, NAMES);
  assert('3. century situation detected', s.some(x => x.key === 'century'));
  const text = pickInsight(s, 5);
  assert('4. picked text mentions the potting player', text.includes('Ronnie'));
  assert('5. picked text mentions the real break value (104)', text.includes('104'));
}

section('SECTION 3 — New match-high break (not yet a century)');
{
  const s = detectGameSituations(makeState({ currentBreak: 55, currentPlayer: 0, scores: [55, 10] }), 41, NAMES);
  assert('6. highestBreakSoFar detected', s.some(x => x.key === 'highestBreakSoFar'));
  const text = pickInsight(s, 2);
  assert('7. text mentions the real value (55)', text.includes('55'));
  assert('8. text mentions the potting player (Aviel)', text.includes('Aviel'));
}

section('SECTION 4 — Break equal to (not exceeding) session best does NOT flag');
{
  const s = detectGameSituations(makeState({ currentBreak: 41, scores: [41, 0] }), 41, NAMES);
  assert('9. no highestBreakSoFar when break merely ties the session best', !s.some(x => x.key === 'highestBreakSoFar'));
}

section('SECTION 5 — Deciding frame detection (winner-takes-all)');
{
  // BO5 -> target 3; 2-2 on frames means this frame decides it.
  const s = detectGameSituations(makeState({ bestOf: 5, framesWon: [2, 2], scores: [10, 10] }), 41, NAMES);
  assert('10. decidingFrame detected at 2-2 in a BO5', s.some(x => x.key === 'decidingFrame'));

  const s2 = detectGameSituations(makeState({ bestOf: 5, framesWon: [1, 2], scores: [10, 10] }), 41, NAMES);
  assert('11. NOT a decider at 1-2 in a BO5 (someone can still win without a decider)', !s2.some(x => x.key === 'decidingFrame'));
}

section('SECTION 6 — Unlimited-mode sentinel (bestOf=9999) never flags a deciding frame');
{
  const s = detectGameSituations(makeState({ bestOf: 9999, framesWon: [4998, 4998], scores: [0, 0] }), 0, NAMES);
  assert('12. unlimited mode never treats any frame as a decider', !s.some(x => x.key === 'decidingFrame'));
}

section('SECTION 7 — Single-frame mode (bestOf=null) never flags a deciding frame either');
{
  const s = detectGameSituations(makeState({ bestOf: null, framesWon: [0, 0], scores: [10, 10] }), 0, NAMES);
  assert('13. bestOf=null never triggers decidingFrame (guarded by the null check)', !s.some(x => x.key === 'decidingFrame'));
}

section('SECTION 8 — Whitewash vs tight-frame thresholds');
{
  const wide = detectGameSituations(makeState({ scores: [60, 20] }), 0, NAMES);
  assert('14. a 40-point gap flags whitewash', wide.some(x => x.key === 'whitewash'));
  assert('15. a 40-point gap does NOT also flag tightFrame', !wide.some(x => x.key === 'tightFrame'));

  const tight = detectGameSignal(30, 25);
  assert('16. a 5-point gap with meaningful scores flags tightFrame', tight.some(x => x.key === 'tightFrame'));
  assert('17. a 5-point gap does NOT flag whitewash', !tight.some(x => x.key === 'whitewash'));

  function detectGameSignal(a, b) { return detectGameSituations(makeState({ scores: [a, b] }), 0, NAMES); }
}

section('SECTION 9 — Tight-frame requires meaningful scores (not two low, near-tied opening shots)');
{
  const s = detectGameSituations(makeState({ scores: [3, 1] }), 0, NAMES);
  assert('18. a trivial 2-point gap at low total score does not flag tightFrame (guarded by totalScored>20)', !s.some(x => x.key === 'tightFrame'));
}

section('SECTION 10 — Frame-over state never flags whitewash/tight/decider (frame already decided)');
{
  const s = detectGameSituations(makeState({ isFrameOver: true, scores: [80, 10], bestOf: 5, framesWon: [2, 2] }), 0, NAMES);
  assert('19. no whitewash once frame is over', !s.some(x => x.key === 'whitewash'));
  assert('20. no decidingFrame once frame is over', !s.some(x => x.key === 'decidingFrame'));
}

section('SECTION 11 — pickInsight is deterministic for a given seed, and every {slot} is substituted');
{
  const s = detectGameSituations(makeState({ currentBreak: 60, scores: [60, 0] }), 41, NAMES);
  const a = pickInsight(s, 7);
  const b = pickInsight(s, 7);
  assert('21. same seed always yields the same phrasing', a === b);
  assert('22. no leftover {slot} placeholders in the output', !/\{[a-z]+\}/.test(a));
}

section('SECTION 12 — Different seeds can (not must, but can) select different phrasings across the pool');
{
  const s = detectGameSituations(makeState({ currentBreak: 60, scores: [60, 0] }), 41, NAMES);
  const outputs = new Set();
  for (let seed = 0; seed < 20; seed++) outputs.add(pickInsight(s, seed));
  assert('23. more than one distinct phrasing appears across 20 different seeds', outputs.size > 1);
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
