// match_status_progress_test.mjs — tests for getMatchStatusLabel and the
// match-detail progress calculation. Runs in Node.js, no React needed.
// Logic mirrors app/match/utils/matchStatusLabel.ts and the matchStats
// useMemo in app/match/MatchEnhanced.tsx exactly.

function getMatchStatusLabel(statusCode) {
  switch (statusCode) {
    case 0: return 'Scheduled';
    case 1: return 'Live';
    case 2: return 'On Break';
    case 3: return 'Finished';
    default: return 'Status Unknown';
  }
}

function computeProgress(statusCode, score1, score2, format) {
  if (statusCode === 3) return 1;
  if (format > 0) {
    const framesPlayed = (score1 || 0) + (score2 || 0);
    return Math.min(framesPlayed / format, 0.95);
  }
  return 0;
}

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${actual}, expected ${expected}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — getMatchStatusLabel
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 1 — getMatchStatusLabel uses status_code, not status_display');

assertEq(getMatchStatusLabel(0), 'Scheduled', 'status_code 0 -> "Scheduled"');
assertEq(getMatchStatusLabel(1), 'Live', 'status_code 1 -> "Live"');
assertEq(getMatchStatusLabel(2), 'On Break', 'status_code 2 -> "On Break" (the actual bug: backend status_display would say "Finished" here)');
assertEq(getMatchStatusLabel(3), 'Finished', 'status_code 3 -> "Finished"');
assertEq(getMatchStatusLabel(null), 'Status Unknown', 'null status_code -> "Status Unknown"');
assertEq(getMatchStatusLabel(undefined), 'Status Unknown', 'undefined status_code -> "Status Unknown"');
assertEq(getMatchStatusLabel(99), 'Status Unknown', 'unrecognized status_code -> "Status Unknown", not a crash');

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Progress: 100% ONLY when actually finished
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 2 — Progress is 100% only for status_code 3');

assertEq(computeProgress(3, 10, 8, 19), 1, 'finished match (status_code 3) is always 100%, regardless of score/format');
assertEq(computeProgress(3, 0, 0, 0), 1, 'finished match with no format/score data still reports 100%');

{
  // The actual bug: format unresolved (0) for a live match must NOT read 100%
  const result = computeProgress(1, 3, 2, 0);
  assertEq(result, 0, 'live match with unresolved format (0) is 0 (indeterminate), never 100%');
}
{
  const result = computeProgress(2, 5, 4, 0);
  assertEq(result, 0, 'on-break match with unresolved format (0) is 0 (indeterminate), never 100%');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Progress: real calculation when format is known
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 3 — Real progress fraction when format is known');

{
  // Best of 19 (framesToWin 10), 5 frames played -> 5/19 ≈ 0.263
  const result = computeProgress(1, 3, 2, 19);
  assertEq(Math.round(result * 1000) / 1000, Math.round((5 / 19) * 1000) / 1000, 'live, 5/19 frames played -> ~26.3%');
}

{
  // Match at match-point (e.g. 9-9 in a Bo19) but NOT yet marked finished
  // must still read below 100%, not exactly 100%.
  const result = computeProgress(1, 9, 9, 19);
  assert_progress_below_one(result, 'live match at 18/19 frames played is capped below 100%, not exactly 100%');
}

function assert_progress_below_one(value, label) {
  const ok = value < 1 && value > 0;
  if (ok) {
    console.log(`  ✓ ${label} (${value})`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${value}`);
    failed++;
  }
}

{
  // Even score1+score2 >= format (shouldn't normally happen pre-finish, but
  // guard against ever hitting exactly 1.0 or over while not finished)
  const result = computeProgress(2, 10, 10, 19);
  assert_progress_below_one(result, 'on-break with played frames >= format is still capped below 100% (only status_code 3 can reach 100%)');
}

{
  const result = computeProgress(0, 0, 0, 19);
  assertEq(result, 0, 'scheduled match (0 frames played) -> 0% progress');
}

// ── Final summary ────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
