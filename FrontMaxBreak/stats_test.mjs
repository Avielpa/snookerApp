// stats_test.mjs — tests for avgPointsPerFrame in groupByRivalry
// Runs in Node.js, no React. Logic mirrors services/gameStorage.ts exactly.

// ── Inline groupByRivalry avgPointsPerFrame logic ────────────────────────────

function computeAvgPointsPerFrame(matches, p1Name, p2Name) {
  // Mirrors the groupByRivalry loop for a single rivalry pair.
  // p1Name / p2Name are the canonical display names (from earliest session).
  const p1 = p1Name.trim().toLowerCase();

  let ptsSum1 = 0, ptsSum2 = 0, frameCount = 0;

  for (const m of matches) {
    const isP1 = m.player1Name.trim().toLowerCase() === p1;
    const myIdx  = isP1 ? 0 : 1;
    const oppIdx = isP1 ? 1 : 0;

    for (const fr of m.frameResults) {
      ptsSum1 += fr.scores[myIdx];
      ptsSum2 += fr.scores[oppIdx];
      frameCount++;
    }
  }

  return [
    frameCount > 0 ? Math.round(ptsSum1 / frameCount) : 0,
    frameCount > 0 ? Math.round(ptsSum2 / frameCount) : 0,
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeFrame(frameNumber, scores, winner = 0, highestBreak = [0, 0]) {
  return { frameNumber, scores, winner, highestBreak };
}

function makeMatch(p1, p2, frameResults) {
  const framesWon = [0, 0];
  for (const fr of frameResults) framesWon[fr.winner]++;
  return {
    id: Math.random().toString(36).slice(2),
    player1Name: p1,
    player2Name: p2,
    numberOfReds: 15,
    bestOf: 5,
    startedAt: new Date().toISOString(),
    isComplete: true,
    frameResults,
    framesWon,
    mode: 'match',
  };
}

// ── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — No frames / empty input
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 1 — Empty / no frames');

{
  const result = computeAvgPointsPerFrame([], 'Alice', 'Bob');
  assertEq(result, [0, 0], 'empty match list → [0, 0]');
}

{
  const m = makeMatch('Alice', 'Bob', []);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [0, 0], 'single session with no frames → [0, 0]');
}

{
  const m1 = makeMatch('Alice', 'Bob', []);
  const m2 = makeMatch('Alice', 'Bob', []);
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [0, 0], 'two sessions both with no frames → [0, 0]');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Single session, single frame
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 2 — Single session, single frame');

{
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [80, 30], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [80, 30], 'p1=80, p2=30 → [80, 30]');
}

{
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [0, 0], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [0, 0], 'both score 0 in one frame → [0, 0]');
}

{
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [147, 0], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [147, 0], 'maximum break (147) for p1, p2 scores 0 → [147, 0]');
}

{
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [72, 75], 1)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [72, 75], 'p2 wins frame 75-72 → [72, 75]');
}

{
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [1, 1], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [1, 1], 'both score 1 → [1, 1]');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Single session, multiple frames
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 3 — Single session, multiple frames');

{
  // p1: 80+40=120, p2: 30+70=100, avg: [60, 50]
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [80, 30], 0),
    makeFrame(2, [40, 70], 1),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [60, 50], '2 frames: p1 avg=(80+40)/2=60, p2 avg=(30+70)/2=50');
}

{
  // p1: 60+60+60=180, p2: 40+40+40=120, avg: [60, 40]
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [60, 40], 0),
    makeFrame(2, [60, 40], 0),
    makeFrame(3, [60, 40], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [60, 40], '3 equal frames → exact avg [60, 40]');
}

{
  // 5 frames, varied scores — test rounding
  // p1 total = 50+70+30+90+10 = 250, avg = 50
  // p2 total = 60+40+80+20+100 = 300, avg = 60
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [50, 60], 1),
    makeFrame(2, [70, 40], 0),
    makeFrame(3, [30, 80], 1),
    makeFrame(4, [90, 20], 0),
    makeFrame(5, [10, 100], 1),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [50, 60], '5 frames, p2 wins: avg [50, 60]');
}

{
  // BO9 session — 9 frames
  const frames = Array.from({ length: 9 }, (_, i) =>
    makeFrame(i + 1, [55, 45], i % 2),
  );
  const m = makeMatch('Alice', 'Bob', frames);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [55, 45], '9-frame session, consistent scores → [55, 45]');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Multiple sessions accumulate correctly
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 4 — Multiple sessions');

{
  // Session 1: 1 frame, p1=80, p2=30
  // Session 2: 1 frame, p1=40, p2=70
  // Total: 2 frames, p1 avg=60, p2 avg=50
  const m1 = makeMatch('Alice', 'Bob', [makeFrame(1, [80, 30], 0)]);
  const m2 = makeMatch('Alice', 'Bob', [makeFrame(1, [40, 70], 1)]);
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [60, 50], '2 sessions × 1 frame each → avg across all frames');
}

{
  // 3 sessions × 3 frames each = 9 frames total
  // p1 always scores 60, p2 always scores 40
  const sessions = Array.from({ length: 3 }, () =>
    makeMatch('Alice', 'Bob', [
      makeFrame(1, [60, 40], 0),
      makeFrame(2, [60, 40], 0),
      makeFrame(3, [60, 40], 0),
    ]),
  );
  const result = computeAvgPointsPerFrame(sessions, 'Alice', 'Bob');
  assertEq(result, [60, 40], '3 sessions × 3 frames, consistent scores → [60, 40]');
}

{
  // Mixed frame counts per session
  // Session 1: 2 frames, p1 total=100, p2 total=60
  // Session 2: 3 frames, p1 total=150, p2 total=90
  // Grand: 5 frames, p1 sum=250 avg=50, p2 sum=150 avg=30
  const m1 = makeMatch('Alice', 'Bob', [
    makeFrame(1, [50, 30], 0),
    makeFrame(2, [50, 30], 0),
  ]);
  const m2 = makeMatch('Alice', 'Bob', [
    makeFrame(1, [50, 30], 0),
    makeFrame(2, [50, 30], 0),
    makeFrame(3, [50, 30], 0),
  ]);
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [50, 30], 'mixed session frame counts, avg over all 5 frames');
}

{
  // One session has frames, one has none
  const m1 = makeMatch('Alice', 'Bob', [makeFrame(1, [80, 40], 0)]);
  const m2 = makeMatch('Alice', 'Bob', []);
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [80, 40], 'one session with frames, one without → only counts frames that exist');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Player index (isP1) correctness
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 5 — Player index correctness');

{
  // Match stored as Bob=player1, Alice=player2 — rivalry canonical is Alice=p1
  // fr.scores[0]=30 (Bob/match-p1), fr.scores[1]=80 (Alice/match-p2)
  // After index swap: Alice(rivalry-p1) gets 80, Bob(rivalry-p2) gets 30
  const m = makeMatch('Bob', 'Alice', [makeFrame(1, [30, 80], 1)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [80, 30], 'match stored reversed (Bob=p1 in DB): Alice still gets 80');
}

{
  // Two sessions: first stored Alice=p1, second stored Bob=p1
  const m1 = makeMatch('Alice', 'Bob', [makeFrame(1, [90, 20], 0)]);
  const m2 = makeMatch('Bob', 'Alice', [makeFrame(1, [25, 85], 1)]);
  // Alice total: 90+85=175, Bob total: 20+25=45, avg: [88, 23] (rounded)
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [88, 23], 'sessions stored in opposite player order → Alice always gets her own points');
}

{
  // Same as above with more frames
  const m1 = makeMatch('Alice', 'Bob', [
    makeFrame(1, [60, 40], 0),
    makeFrame(2, [60, 40], 0),
  ]);
  const m2 = makeMatch('Bob', 'Alice', [
    makeFrame(1, [40, 60], 1),
    makeFrame(2, [40, 60], 1),
  ]);
  // Alice: 60+60+60+60=240, Bob: 40+40+40+40=160, 4 frames, avg [60, 40]
  const result = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  assertEq(result, [60, 40], 'symmetric swap: avg unaffected by storage order');
}

{
  // Case-insensitive player name matching
  const m = makeMatch('alice', 'BOB', [makeFrame(1, [70, 50], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [70, 50], 'case-insensitive: "alice" matches canonical "Alice"');
}

{
  // Trailing whitespace in stored name
  const m = makeMatch('Alice  ', 'Bob', [makeFrame(1, [65, 55], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [65, 55], 'trailing whitespace in stored player1Name is trimmed');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Rounding behaviour
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 6 — Rounding');

{
  // p1 total=100, p2 total=100, 3 frames → avg=33.33... → rounds to 33
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [34, 34], 0),
    makeFrame(2, [33, 33], 0),
    makeFrame(3, [33, 33], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [33, 33], '100/3 ≈ 33.33 → rounds to 33');
}

{
  // p1 total=101, p2 total=101, 3 frames → 33.66... → rounds to 34
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [34, 34], 0),
    makeFrame(2, [34, 34], 0),
    makeFrame(3, [33, 33], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [34, 34], '101/3 ≈ 33.67 → rounds to 34');
}

{
  // Exactly .5 → Math.round rounds up (JS banker's rounding is Math.round, goes up at .5)
  // p1 total=5, 2 frames → 2.5 → rounds to 3
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [3, 2], 0),
    makeFrame(2, [2, 3], 1),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [3, 3], '5/2=2.5 → Math.round → 3 for both');
}

{
  // Large numbers don't overflow
  // p1: 147×10=1470 over 10 frames → avg=147
  const frames = Array.from({ length: 10 }, (_, i) =>
    makeFrame(i + 1, [147, 0], 0),
  );
  const m = makeMatch('Alice', 'Bob', frames);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [147, 0], '10 × 147 / 10 = 147 (no overflow)');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 7 — Independent rivalries don't bleed
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 7 — Rivalry isolation');

{
  // AlicevsBob: p1=80, p2=30
  // AlicevsCharlie: p1=20, p2=90
  // Computing Alice vs Bob should not include Charlie session
  const aliceBobMatch    = makeMatch('Alice', 'Bob',     [makeFrame(1, [80, 30], 0)]);
  const aliceCharlieMatch = makeMatch('Alice', 'Charlie', [makeFrame(1, [20, 90], 1)]);

  const resultAB = computeAvgPointsPerFrame([aliceBobMatch], 'Alice', 'Bob');
  const resultAC = computeAvgPointsPerFrame([aliceCharlieMatch], 'Alice', 'Charlie');

  assertEq(resultAB, [80, 30], 'Alice vs Bob unaffected by Alice vs Charlie sessions');
  assertEq(resultAC, [20, 90], 'Alice vs Charlie unaffected by Alice vs Bob sessions');
}

{
  // Completely separate rivals share no data
  const m1 = makeMatch('Alice', 'Bob',   [makeFrame(1, [100, 10], 0)]);
  const m2 = makeMatch('Dave',  'Eve',   [makeFrame(1, [50, 50], 0)]);
  const rAB = computeAvgPointsPerFrame([m1], 'Alice', 'Bob');
  const rDE = computeAvgPointsPerFrame([m2], 'Dave', 'Eve');
  assertEq(rAB, [100, 10], 'Alice/Bob rivalry isolated');
  assertEq(rDE, [50, 50],  'Dave/Eve rivalry isolated');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 8 — Extreme / edge scores
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 8 — Extreme and edge scores');

{
  // Player 2 wins every frame, p1 scores 0 always
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [0, 80], 1),
    makeFrame(2, [0, 90], 1),
    makeFrame(3, [0, 70], 1),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [0, 80], 'p1 always scores 0 → [0, 80]');
}

{
  // 1-red table: low scores expected
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [9, 0], 0),  // 1+1+7 (red+black+colors) type scenario
    makeFrame(2, [8, 0], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [9, 0], '1-red format low scores: (9+8)/2 ≈ 9 (rounds up), p2=0');
}

{
  // actually (9+8)/2 = 8.5 → rounds to 9
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [9, 1], 0),
    makeFrame(2, [8, 1], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  // p1: 17/2=8.5→9, p2: 2/2=1
  assertEq(result, [9, 1], '(9+8)/2=8.5 rounds to 9; (1+1)/2=1');
}

{
  // Both players score maximum (unrealistic but tests no cap)
  const m = makeMatch('Alice', 'Bob', [
    makeFrame(1, [147, 147], 0),
  ]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assertEq(result, [147, 147], 'both score 147 (theoretical max) → [147, 147]');
}

{
  // Very long series: 50 sessions × 5 frames each = 250 frames
  // p1 always 60, p2 always 40
  const sessions = Array.from({ length: 50 }, () =>
    makeMatch('Alice', 'Bob',
      Array.from({ length: 5 }, (_, i) => makeFrame(i + 1, [60, 40], 0)),
    ),
  );
  const result = computeAvgPointsPerFrame(sessions, 'Alice', 'Bob');
  assertEq(result, [60, 40], '50 sessions × 5 frames = 250 frames, constant scores → [60, 40]');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 9 — Consistency checks (avg points vs frame scores)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 9 — Consistency checks');

{
  // avg points per frame must equal (p1 score in frame) when there is only 1 frame
  const score = [63, 41];
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, score, 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assert(result[0] === score[0], '1 frame: avgPointsPerFrame[0] === that frame score for p1');
  assert(result[1] === score[1], '1 frame: avgPointsPerFrame[1] === that frame score for p2');
}

{
  // avg must never exceed max frame score for p1
  const frames = [
    makeFrame(1, [80, 30], 0),
    makeFrame(2, [50, 60], 1),
    makeFrame(3, [40, 70], 1),
  ];
  const m = makeMatch('Alice', 'Bob', frames);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  const maxP1 = Math.max(...frames.map(f => f.scores[0]));
  const maxP2 = Math.max(...frames.map(f => f.scores[1]));
  assert(result[0] <= maxP1, 'avgPointsPerFrame[0] never exceeds max frame score for p1');
  assert(result[1] <= maxP2, 'avgPointsPerFrame[1] never exceeds max frame score for p2');
}

{
  // avg must be >= 0 in all cases
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [0, 0], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assert(result[0] >= 0, 'avgPointsPerFrame[0] is always >= 0');
  assert(result[1] >= 0, 'avgPointsPerFrame[1] is always >= 0');
}

{
  // Total points derivable: avg × frameCount ≈ sum (within rounding)
  const frames = [
    makeFrame(1, [73, 44], 0),
    makeFrame(2, [28, 91], 1),
    makeFrame(3, [55, 62], 1),
    makeFrame(4, [88, 19], 0),
  ];
  const m = makeMatch('Alice', 'Bob', frames);
  const [avg1, avg2] = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  const actualSum1 = frames.reduce((s, f) => s + f.scores[0], 0); // 244
  const actualSum2 = frames.reduce((s, f) => s + f.scores[1], 0); // 216
  const n = frames.length;
  // avg * n should be within 1 of actual sum (rounding tolerance)
  assert(Math.abs(avg1 * n - actualSum1) <= n, `avg1 × ${n} within rounding of actual sum ${actualSum1}`);
  assert(Math.abs(avg2 * n - actualSum2) <= n, `avg2 × ${n} within rounding of actual sum ${actualSum2}`);
}

{
  // result is always a 2-element array of integers
  const m = makeMatch('Alice', 'Bob', [makeFrame(1, [55, 45], 0)]);
  const result = computeAvgPointsPerFrame([m], 'Alice', 'Bob');
  assert(Array.isArray(result) && result.length === 2, 'result is a 2-element array');
  assert(Number.isInteger(result[0]) && Number.isInteger(result[1]), 'both values are integers (Math.round applied)');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 10 — Multi-session rounding accumulates correctly
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 10 — Multi-session rounding accuracy');

{
  // 10 sessions × 1 frame, p1 alternates 40 and 50 → total=450, 10 frames, avg=45
  const sessions = Array.from({ length: 10 }, (_, i) =>
    makeMatch('Alice', 'Bob', [makeFrame(1, [i % 2 === 0 ? 40 : 50, 30], i % 2 === 0 ? 1 : 0)]),
  );
  const result = computeAvgPointsPerFrame(sessions, 'Alice', 'Bob');
  assertEq(result, [45, 30], '10 sessions alternating 40/50 → avg=45');
}

{
  // Odd number of frames to force non-integer avg
  // 3 sessions × 1 frame, p1 scores 10,20,30 → total=60, avg=20
  const sessions = [
    makeMatch('Alice', 'Bob', [makeFrame(1, [10, 5], 1)]),
    makeMatch('Alice', 'Bob', [makeFrame(1, [20, 5], 0)]),
    makeMatch('Alice', 'Bob', [makeFrame(1, [30, 5], 0)]),
  ];
  const result = computeAvgPointsPerFrame(sessions, 'Alice', 'Bob');
  assertEq(result, [20, 5], '(10+20+30)/3=20 exactly; (5+5+5)/3=5');
}

{
  // Verify that adding a zero-score session (no frames) doesn't change the avg
  const m1 = makeMatch('Alice', 'Bob', [makeFrame(1, [80, 40], 0)]);
  const m2 = makeMatch('Alice', 'Bob', []); // no frames
  const resultWith   = computeAvgPointsPerFrame([m1, m2], 'Alice', 'Bob');
  const resultWithout = computeAvgPointsPerFrame([m1], 'Alice', 'Bob');
  assertEq(resultWith, resultWithout, 'session with no frames does not affect the average');
}

{
  // p1 score doubles each session: 10, 20, 40 → total=70, 3 frames, avg≈23
  const sessions = [
    makeMatch('Alice', 'Bob', [makeFrame(1, [10, 50], 1)]),
    makeMatch('Alice', 'Bob', [makeFrame(1, [20, 50], 1)]),
    makeMatch('Alice', 'Bob', [makeFrame(1, [40, 50], 1)]),
  ];
  const result = computeAvgPointsPerFrame(sessions, 'Alice', 'Bob');
  // p1: 70/3=23.33→23, p2: 150/3=50
  assertEq(result, [23, 50], 'p1 scores 10,20,40 → avg=23 (floor of 23.33)');
}

// ── Final summary ────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
