// Momentum series test suite — mirrors services/momentum.ts.
// Run: node momentum_test.mjs

function computeMomentumSeries(current, history) {
  return [...history, current].map(snap => snap.scores[0] - snap.scores[1]);
}

function snap(s0, s1) { return { scores: [s0, s1] }; }

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

section('SECTION 1 — Empty history, single current snapshot');
{
  const series = computeMomentumSeries(snap(0, 0), []);
  assert('1. length is 1 (just current)', series.length === 1);
  assert('2. value is 0 (level)', series[0] === 0);
}

section('SECTION 2 — Growing history reflects the running diff');
{
  const history = [snap(0, 0), snap(1, 0), snap(1, 3)];
  const series = computeMomentumSeries(snap(8, 3), history);
  assert('3. length is 4 (3 history + current)', series.length === 4);
  assert('4. series[0] = 0', series[0] === 0);
  assert('5. series[1] = 1', series[1] === 1);
  assert('6. series[2] = -2', series[2] === -2);
  assert('7. series[3] (current) = 5', series[3] === 5);
}

section('SECTION 3 — Player 1 leading produces negative values');
{
  const series = computeMomentumSeries(snap(2, 10), [snap(0, 0), snap(2, 5)]);
  assert('8. series[0] = 0', series[0] === 0);
  assert('9. series[1] = -3', series[1] === -3);
  assert('10. series[2] (current) = -8', series[2] === -8);
}

section('SECTION 4 — Level scores throughout produce an all-zero series');
{
  const series = computeMomentumSeries(snap(40, 40), [snap(0, 0), snap(20, 20), snap(30, 30)]);
  assert('11. all values are 0', series.every(v => v === 0));
  assert('12. length matches history+1', series.length === 4);
}

section('SECTION 5 — Order preserved (history first, current last)');
{
  const h = [snap(5, 0), snap(5, 3), snap(9, 3)];
  const series = computeMomentumSeries(snap(9, 10), h);
  assert('13. first entry matches earliest history snapshot', series[0] === 5);
  assert('14. last entry is the current snapshot, not a history one', series[3] === -1);
  assert('15. array is not mutated in place (history untouched)', h.length === 3);
}

section('SECTION 6 — Large single-frame swing (near-maximum break scenario)');
{
  const series = computeMomentumSeries(snap(140, 0), [snap(0, 0)]);
  assert('16. reflects a full 140-point swing', series[1] === 140);
}

section('SECTION 7 — Function is pure (no shared mutation across calls)');
{
  const history = [snap(1, 1)];
  const a = computeMomentumSeries(snap(2, 1), history);
  const b = computeMomentumSeries(snap(2, 5), history);
  assert('17. first call unaffected by second call', a[1] === 1);
  assert('18. second call computes independently', b[1] === -3);
  assert('19. shared history array untouched between calls', history.length === 1);
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
