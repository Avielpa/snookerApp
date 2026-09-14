// best_break_test.mjs — tests for services/bestBreakService.ts's pure decision logic
// Runs in Node.js, no React/React Native needed (same inline-mirror pattern as the
// other .mjs suites — see docs/OPEN_MISSIONS.md #13). The network-calling functions
// (submitBreak, fetchBestBreaks) aren't covered here since they need RN/axios/auth
// mocks — this file covers isPotentialNewRecord, the one pure/testable piece.

// ── Inline mirror of services/bestBreakService.ts's pure function ───────────────────────

function isPotentialNewRecord(breakValue, knownBest) {
  if (knownBest === null) return breakValue > 0;
  return breakValue > knownBest;
}

// ── Test harness ──────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAILED: ${message}`);
  }
}
function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── Section 1: no known best yet (first-ever break for this reds_count) ─────────────

assertEqual(isPotentialNewRecord(1, null), true, 'any positive break is potentially a record when nothing is known yet');
assertEqual(isPotentialNewRecord(36, null), true, 'a mid-value break is potentially a record with no known best');
assertEqual(isPotentialNewRecord(147, null), true, 'the maximum break is potentially a record with no known best');
assertEqual(isPotentialNewRecord(0, null), false, 'a zero break is never worth submitting, even with no known best');

// ── Section 2: a known best exists — must be strictly higher ────────────────────────

const knownBestCases = [
  [1, 0, true],      // beats a best of 0
  [0, 0, false],      // equal to 0 — not higher
  [1, 1, false],      // equal — not a new record
  [40, 39, true],      // beats by 1
  [39, 40, false],      // below — not a record
  [147, 146, true],      // beats the second-highest possible value
  [147, 147, false],     // matches the max — not a new record
  [0, 5, false],      // zero never beats anything
  [100, 99, true],
  [99, 100, false],
];
for (const [breakValue, knownBest, expected] of knownBestCases) {
  assertEqual(
    isPotentialNewRecord(breakValue, knownBest),
    expected,
    `break ${breakValue} vs known best ${knownBest} should be ${expected}`
  );
}

// ── Section 3: monotonic sanity — every value below a known best is never a record ──

for (let known = 1; known <= 147; known += 13) {
  for (let value = 0; value < known; value++) {
    assert(
      isPotentialNewRecord(value, known) === false,
      `${value} must never be a potential record when known best is ${known}`
    );
  }
  assert(isPotentialNewRecord(known + 1, known) === true, `${known + 1} must beat a known best of ${known}`);
}

// ── Report ────────────────────────────────────────────────────────────────────────────

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed}/${passed + failed} assertions passed`);
if (failed > 0) process.exit(1);
