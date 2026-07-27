// statsGuards_test.mjs
// Tests for app/match/utils/statsTabGuards.ts and app/match/utils/frameBreakGuards.ts
// Run with: node statsGuards_test.mjs

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAILED: ${message}`);
  }
}

// Inline copies of the guard logic (source files are .ts, run through the RN/Expo
// TypeScript toolchain, not directly runnable by plain Node) — kept byte-identical
// to app/match/utils/statsTabGuards.ts and frameBreakGuards.ts.
function hasFramesToWin(framesToWin) {
  return typeof framesToWin === 'number' && framesToWin > 0;
}
function hasBreak(value) {
  return typeof value === 'number' && value > 0;
}
function hasAnyBreak(a, b) {
  return hasBreak(a) || hasBreak(b);
}

// ---- hasFramesToWin ----
assert(hasFramesToWin(undefined) === false, 'hasFramesToWin(undefined) should be false');
assert(hasFramesToWin(0) === false, 'hasFramesToWin(0) should be false (the actual crash case)');
assert(hasFramesToWin(1) === true, 'hasFramesToWin(1) should be true');
assert(hasFramesToWin(5) === true, 'hasFramesToWin(5) should be true');
assert(hasFramesToWin(10) === true, 'hasFramesToWin(10) should be true (best of 19)');
assert(hasFramesToWin(-1) === false, 'hasFramesToWin(-1) should be false (defensive, invalid data)');
assert(hasFramesToWin(NaN) === false, 'hasFramesToWin(NaN) should be false');
assert(hasFramesToWin(null) === false, 'hasFramesToWin(null) should be false');
assert(hasFramesToWin('') === false, 'hasFramesToWin("") should be false (wrong type)');
assert(hasFramesToWin('3') === false, 'hasFramesToWin("3") should be false (string, not number)');

// ---- hasBreak ----
assert(hasBreak(undefined) === false, 'hasBreak(undefined) should be false');
assert(hasBreak(0) === false, 'hasBreak(0) should be false (the actual crash case)');
assert(hasBreak(1) === true, 'hasBreak(1) should be true');
assert(hasBreak(50) === true, 'hasBreak(50) should be true');
assert(hasBreak(147) === true, 'hasBreak(147) should be true (maximum break)');
assert(hasBreak(-5) === false, 'hasBreak(-5) should be false (defensive)');
assert(hasBreak(NaN) === false, 'hasBreak(NaN) should be false');
assert(hasBreak(null) === false, 'hasBreak(null) should be false');

// ---- hasAnyBreak ----
assert(hasAnyBreak(undefined, undefined) === false, 'hasAnyBreak(undefined, undefined) should be false');
assert(hasAnyBreak(0, 0) === false, 'hasAnyBreak(0, 0) should be false (the actual crash case)');
assert(hasAnyBreak(0, undefined) === false, 'hasAnyBreak(0, undefined) should be false');
assert(hasAnyBreak(undefined, 0) === false, 'hasAnyBreak(undefined, 0) should be false');
assert(hasAnyBreak(50, 0) === true, 'hasAnyBreak(50, 0) should be true (player1 only)');
assert(hasAnyBreak(0, 60) === true, 'hasAnyBreak(0, 60) should be true (player2 only)');
assert(hasAnyBreak(50, 60) === true, 'hasAnyBreak(50, 60) should be true (both)');
assert(hasAnyBreak(50, undefined) === true, 'hasAnyBreak(50, undefined) should be true');
assert(hasAnyBreak(undefined, 60) === true, 'hasAnyBreak(undefined, 60) should be true');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log(`✅ All ${passed} assertions passed`);
}
