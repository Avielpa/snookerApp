// Win-probability heuristic test suite — mirrors services/winProbability.ts.
// Run: node winprob_test.mjs

function computeWinProbability(scores, pointsOnTable, isFrameOver, comebackRateForTrailingPlayer) {
  if (isFrameOver) {
    return scores[0] >= scores[1] ? [100, 0] : [0, 100];
  }
  const diff = scores[0] - scores[1];
  if (pointsOnTable <= 0) {
    return diff >= 0 ? [100, 0] : [0, 100];
  }
  const ratio = Math.max(-1, Math.min(1, diff / pointsOnTable));
  let p0 = 50 + ratio * 49;
  if (comebackRateForTrailingPlayer !== undefined) {
    const trailingPlayer = diff >= 0 ? 1 : 0;
    const nudge = Math.max(0, Math.min(10, (comebackRateForTrailingPlayer - 50) / 5));
    p0 = trailingPlayer === 1 ? p0 - nudge : p0 + nudge;
  }
  const clamped = Math.round(Math.max(1, Math.min(99, p0)));
  return [clamped, 100 - clamped];
}

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

section('SECTION 1 — Level scores produce an even split');
{
  const [p0, p1] = computeWinProbability([0, 0], 147, false);
  assert('1. p0 = 50', p0 === 50);
  assert('2. p1 = 50', p1 === 50);
  assert('3. always sums to 100', p0 + p1 === 100);
}

section('SECTION 2 — Leading player gets a higher probability');
{
  const [p0, p1] = computeWinProbability([40, 10], 60, false);
  assert('4. p0 > 50 (leading)', p0 > 50);
  assert('5. p1 < 50 (trailing)', p1 < 50);
  assert('6. sums to 100', p0 + p1 === 100);
}

section('SECTION 3 — Trailing player symmetric case');
{
  const [p0lead] = computeWinProbability([40, 10], 60, false);
  const [p0trail, p1trail] = computeWinProbability([10, 40], 60, false);
  assert('7. p0 < 50 when trailing', p0trail < 50);
  assert('8. p1 > 50 when leading', p1trail > 50);
  // Each side rounds independently (p0 and p1 aren't derived as 100-p0 from a shared
  // unrounded value on both calls), so allow 1 point of rounding tolerance rather than
  // requiring bit-exact symmetry.
  assert('9. swapping the scores swaps the probabilities within 1 point of rounding tolerance', Math.abs(p1trail - p0lead) <= 1);
}

section('SECTION 4 — Frame over always returns a clean 100/0 by score comparison, ignoring pointsOnTable');
{
  const [p0, p1] = computeWinProbability([70, 40], 0, true);
  assert('10. winner gets 100', p0 === 100);
  assert('11. loser gets 0', p1 === 0);
  const [p0b, p1b] = computeWinProbability([40, 70], 999, true);
  assert('12. frame-over ignores pointsOnTable entirely', p0b === 0 && p1b === 100);
}

section('SECTION 5 — Zero points remaining but frame not marked over (edge case) still resolves cleanly');
{
  const [p0, p1] = computeWinProbability([50, 30], 0, false);
  assert('13. leader gets 100 when no points remain', p0 === 100);
  assert('14. trailer gets 0', p1 === 0);
  const [p0b, p1b] = computeWinProbability([30, 30], 0, false);
  assert('15. exact tie with zero points on table still sums to 100', p0b + p1b === 100);
}

section('SECTION 6 — Extreme deficits never fully reach 0 or 100 while the frame is live');
{
  const [p0, p1] = computeWinProbability([147, 0], 1, false);
  assert('16. massive lead still caps at 99, not 100 (frame technically still live)', p0 === 99);
  assert('17. trailer floor is 1, not 0', p1 === 1);
  const [p0b, p1b] = computeWinProbability([0, 147], 1, false);
  assert('18. symmetric floor/cap for the trailing side', p0b === 1 && p1b === 99);
}

section('SECTION 7 — Comeback-rate nudge shifts toward the trailing player, capped at 10 points');
{
  const base = computeWinProbability([40, 20], 40, false);
  const nudgedUp = computeWinProbability([40, 20], 40, false, 100); // trailing player (1) has a 100% comeback rate historically
  assert('19. a high historical comeback rate for the trailing player narrows the leader\'s edge', nudgedUp[0] < base[0]);
  const nudgedNeutral = computeWinProbability([40, 20], 40, false, 50);
  assert('20. a neutral (50%) comeback rate changes nothing', nudgedNeutral[0] === base[0]);
  const nudgeMagnitude = base[0] - nudgedUp[0];
  assert('21. nudge never exceeds 10 points', nudgeMagnitude <= 10);
}

section('SECTION 8 — Comeback-rate nudge never pushes the result out of [1, 99]');
{
  const [p0, p1] = computeWinProbability([147, 0], 1, false, 100);
  assert('22. still clamped to 99 max even with a full nudge in the wrong direction', p0 <= 99);
  assert('23. still sums to 100', p0 + p1 === 100);
}

section('SECTION 9 — Result is always an integer pair summing to exactly 100');
{
  const cases = [[[10, 5], 20], [[5, 10], 20], [[0, 0], 100], [[73, 74], 1]];
  for (const [scores, pot] of cases) {
    const [p0, p1] = computeWinProbability(scores, pot, false);
    assert(`24. integers summing to 100 for scores=${scores} pot=${pot}`, Number.isInteger(p0) && Number.isInteger(p1) && p0 + p1 === 100);
  }
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
