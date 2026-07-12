// Century-trigger test suite — mirrors services/centuryTrigger.ts.
// Run: node century_trigger_test.mjs

function shouldTriggerCentury(currentBreak, lastCelebratedFrame, frameNumber) {
  return currentBreak >= 100 && lastCelebratedFrame !== frameNumber;
}

let passed = 0, failed = 0;
function assert(label, condition, extra = '') {
  if (condition) { console.log(`  ✓ ${label}`); passed++; }
  else { console.error(`  ✗ ${label}${extra ? ` — got: ${JSON.stringify(extra)}` : ''}`); failed++; }
}
function section(t) { console.log(`\n${t}`); }

section('SECTION 1 — Boundary: 99 never fires, 100 always does');
{
  assert('1. 99 does not trigger', shouldTriggerCentury(99, null, 1) === false);
  assert('2. 100 triggers', shouldTriggerCentury(100, null, 1) === true);
  assert('3. 147 (maximum) triggers', shouldTriggerCentury(147, null, 1) === true);
  assert('4. 0 does not trigger', shouldTriggerCentury(0, null, 1) === false);
}

section('SECTION 2 — Fires once per frame, not on every subsequent shot past 100');
{
  let lastCelebrated = null;
  const frame = 1;
  assert('5. first shot at 100: fires', shouldTriggerCentury(100, lastCelebrated, frame) === true);
  lastCelebrated = frame; // simulates the caller recording it after firing
  assert('6. next shot at 107 (same frame, same break continuing): does NOT re-fire', shouldTriggerCentury(107, lastCelebrated, frame) === false);
  assert('7. further shot at 140 (same frame): still does NOT re-fire', shouldTriggerCentury(140, lastCelebrated, frame) === false);
}

section('SECTION 3 — Re-arms on a new frame');
{
  let lastCelebrated = 1; // celebrated in frame 1
  assert('8. frame 2 at 100: fires again (new frame)', shouldTriggerCentury(100, lastCelebrated, 2) === true);
}

section('SECTION 4 — null lastCelebratedFrame (fresh match/session) always allows the first trigger');
{
  assert('9. lastCelebratedFrame=null, currentBreak=100: fires', shouldTriggerCentury(100, null, 1) === true);
  assert('10. lastCelebratedFrame=null, currentBreak=50: does not fire', shouldTriggerCentury(50, null, 1) === false);
}

section('SECTION 5 — Works identically regardless of frameNumber value (train mode uses frameNumber as a break counter)');
{
  assert('11. train-mode-style break counter (frameNumber=42) at 100: fires', shouldTriggerCentury(100, null, 42) === true);
  assert('12. train-mode-style break counter: does not re-fire within the same "break number"', shouldTriggerCentury(120, 42, 42) === false);
  assert('13. train-mode-style break counter: re-arms on the next break (43)', shouldTriggerCentury(100, 42, 43) === true);
}

section('SECTION 6 — A break that never reaches 100 never fires, across a whole frame of shots');
{
  const breaks = [1, 8, 15, 23, 30, 41, 55, 62, 70, 81, 95, 99];
  let lastCelebrated = null;
  const fired = breaks.some(b => shouldTriggerCentury(b, lastCelebrated, 1));
  assert('14. no shot below 100 ever triggers the celebration', fired === false);
}

section('SECTION 7 — Exactly-100 and just-above-100 both trigger identically (no off-by-one at the threshold)');
{
  assert('15. exactly 100 fires', shouldTriggerCentury(100, null, 1) === true);
  assert('16. 101 fires', shouldTriggerCentury(101, null, 1) === true);
}

console.log(`\n${'═'.repeat(60)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.error(`❌ ${failed} failed, ${passed} passed`);
  process.exit(1);
}
