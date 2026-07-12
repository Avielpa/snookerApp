// Rivalry-tendency test suite — mirrors services/rivalryInsights.ts.
// Run: node rivalry_insights_test.mjs

const MIN_SAMPLE = 3;

function isRelevantDecisiveMatch(m, p1, p2) {
  if (!m.isComplete || m.frameResults.length === 0) return false;
  if (m.mode && m.mode !== 'match') return false;
  if (m.bestOf === null || m.bestOf < 3) return false;
  const names = [m.player1Name.trim().toLowerCase(), m.player2Name.trim().toLowerCase()];
  return names.includes(p1.toLowerCase()) && names.includes(p2.toLowerCase());
}

function computeRivalryTendencies(matches, rivalry) {
  const tendencies = [];
  const relevant = matches.filter(m => isRelevantDecisiveMatch(m, rivalry.player1, rivalry.player2));
  if (relevant.length < MIN_SAMPLE) return tendencies;

  let player1Deciders = 0, player2Deciders = 0;

  for (const m of relevant) {
    const target = Math.ceil(m.bestOf / 2);
    const framesBeforeLast = m.frameResults.length - 1;
    if (framesBeforeLast < 0) continue;
    let p1WinsBeforeLast = 0, p2WinsBeforeLast = 0;
    const isP1 = m.player1Name.trim().toLowerCase() === rivalry.player1.toLowerCase();
    for (let i = 0; i < framesBeforeLast; i++) {
      const winner = m.frameResults[i].winner;
      const rivalryP1Won = isP1 ? winner === 0 : winner === 1;
      if (rivalryP1Won) p1WinsBeforeLast++; else p2WinsBeforeLast++;
    }
    const wasDecider = p1WinsBeforeLast < target && p2WinsBeforeLast < target
      && p1WinsBeforeLast === target - 1 && p2WinsBeforeLast === target - 1;
    if (!wasDecider) continue;

    const lastWinner = m.frameResults[m.frameResults.length - 1].winner;
    const rivalryP1WonDecider = isP1 ? lastWinner === 0 : lastWinner === 1;
    if (rivalryP1WonDecider) player1Deciders++; else player2Deciders++;
  }

  const totalDeciders = player1Deciders + player2Deciders;
  if (totalDeciders >= MIN_SAMPLE && player1Deciders !== player2Deciders) {
    const leaderName = player1Deciders > player2Deciders ? rivalry.player1 : rivalry.player2;
    const record = player1Deciders > player2Deciders
      ? `${player1Deciders}-${player2Deciders}`
      : `${player2Deciders}-${player1Deciders}`;
    tendencies.push({ text: `Deciding frames are ${record} in ${leaderName}'s favour`, strength: totalDeciders });
  }

  return tendencies;
}

// ── Fixture helpers ──────────────────────────────────────────────────────────
function frame(winner) { return { winner, scores: [0, 0], highestBreak: [0, 0] }; }

// Builds a BO5 (target=3) match that goes to a decider (2-2 before the last frame),
// with `deciderWinner` (0=player1Name, 1=player2Name) winning the final frame.
function makeDeciderMatch(player1Name, player2Name, deciderWinner) {
  return {
    id: Math.random().toString(36),
    player1Name, player2Name,
    numberOfReds: 15, bestOf: 5, isComplete: true, mode: 'match',
    framesWon: deciderWinner === 0 ? [3, 2] : [2, 3],
    frameResults: [frame(0), frame(1), frame(0), frame(1), frame(deciderWinner)],
  };
}

// A BO5 match that was NOT a decider (won 3-0 or 3-1, i.e. clinched before frame 5).
function makeNonDeciderMatch(player1Name, player2Name, winner) {
  return {
    id: Math.random().toString(36),
    player1Name, player2Name,
    numberOfReds: 15, bestOf: 5, isComplete: true, mode: 'match',
    framesWon: winner === 0 ? [3, 0] : [0, 3],
    frameResults: [frame(winner), frame(winner), frame(winner)],
  };
}

const rivalry = { player1: 'Aviel', player2: 'Ronnie' };

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

section('SECTION 1 — Below minimum sample size: no tendency surfaced');
{
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('1. only 2 relevant matches: no tendency surfaced (below MIN_SAMPLE=3)', t.length === 0);
}

section('SECTION 2 — At minimum sample size, a clear pattern IS surfaced');
{
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('2. tendency surfaced at exactly 3 deciders', t.length === 1);
  assert('3. text names the correct leader (Aviel)', t[0].text.includes('Aviel'));
  assert('4. text has the correct record (3-0)', t[0].text.includes('3-0'));
  assert('5. strength equals the sample size (3)', t[0].strength === 3);
}

section('SECTION 3 — An even split produces no tendency (nothing to report)');
{
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 1),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 1),
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('6. a 2-2 even split surfaces nothing', t.length === 0);
}

section('SECTION 4 — Name order in the stored match does not matter (symmetric handling)');
{
  const matches = [
    makeDeciderMatch('Ronnie', 'Aviel', 1), // Aviel (rivalry.player1) is player2Name here, still wins the decider
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Ronnie', 'Aviel', 1),
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('7. Aviel correctly credited as decider-winner regardless of player1Name/player2Name order', t[0].text.includes('Aviel'));
  assert('8. record is 3-0 despite mixed name ordering across matches', t[0].text.includes('3-0'));
}

section('SECTION 5 — Non-decider matches (clinched early) are excluded from the count');
{
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeNonDeciderMatch('Aviel', 'Ronnie', 1), // 3-0 romp, never reached 2-2 — should not count
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('9. the 3-0 non-decider match does not dilute or flip the deciders record', t[0].text.includes('3-0') && t[0].text.includes('Aviel'));
}

section('SECTION 6 — Train/unlimited-mode matches and single-frame matches are excluded entirely');
{
  const trainMatch = { id: 'x', player1Name: 'Aviel', player2Name: '', numberOfReds: 15, bestOf: null, isComplete: true, mode: 'train', framesWon: [5, 0], frameResults: [frame(0), frame(0), frame(0), frame(0), frame(0)] };
  const singleFrameMatch = { id: 'y', player1Name: 'Aviel', player2Name: 'Ronnie', numberOfReds: 15, bestOf: null, isComplete: true, mode: 'match', framesWon: [1, 0], frameResults: [frame(0)] };
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    trainMatch,
    singleFrameMatch,
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('10. train-mode and single-frame matches do not corrupt the decider record', t[0].strength === 3);
}

section('SECTION 7 — Incomplete matches and matches against a different opponent are excluded');
{
  const incomplete = makeDeciderMatch('Aviel', 'Ronnie', 0); incomplete.isComplete = false;
  const otherOpponent = makeDeciderMatch('Aviel', 'Judd', 0);
  const matches = [
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    makeDeciderMatch('Aviel', 'Ronnie', 0),
    incomplete,
    otherOpponent,
  ];
  const t = computeRivalryTendencies(matches, rivalry);
  assert('11. incomplete match excluded, unrelated-opponent match excluded, strength stays 3', t[0].strength === 3);
}

section('SECTION 8 — Empty match list produces no tendencies without throwing');
{
  const t = computeRivalryTendencies([], rivalry);
  assert('12. empty input returns an empty array', Array.isArray(t) && t.length === 0);
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
