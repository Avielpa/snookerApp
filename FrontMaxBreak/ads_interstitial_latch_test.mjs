// ads_interstitial_latch_test.mjs — tests for the once-interstitial "armed" latch
// state machine used by createOnceInterstitialHook in services/adsService.ts.
//
// Runs in Node.js, no React/RN needed. This repo has no React hook-testing
// setup (no React Testing Library / RN testing environment — confirmed via
// package.json devDependencies), so the fix's decision logic is modeled here
// as the same pure reducer the hook's two effects perform:
//
//   effect 1 (latch):  armed' = armed || trigger      // fires on every `trigger` change
//   effect 2 (guard):  schedule = armed && ADS_ENABLED && !alreadyShown && !!adUnitId
//                                                       // fires on every `armed` change
//
// This mirrors adsService.ts exactly:
//   useEffect(() => { if (trigger) setArmed(true); }, [trigger]);
//   useEffect(() => {
//     if (!armed || !ADS_ENABLED || shownThisSessionByLabel[label] || !INTERSTITIAL_AD_UNIT_ID) return;
//     ...schedules delayTimer...
//   }, [armed]);

// ── Inlined mirror of the fix's logic ───────────────────────────────────────

// The latch reducer: once true, `trigger` going false again cannot un-arm it.
function armedReducer(prevArmed, trigger) {
  return prevArmed || trigger;
}

// Simulates React re-running the latch effect once per entry in
// triggerSequence (in mount order), returning the final `armed` value and
// how many times `setArmed(true)` would actually have been called (i.e. how
// many times armed transitioned false -> true — must be at most 1).
function simulateArmedSequence(triggerSequence) {
  let armed = false;
  let armTransitions = 0;
  for (const trigger of triggerSequence) {
    const next = armedReducer(armed, trigger);
    if (next && !armed) armTransitions++;
    armed = next;
  }
  return { armed, armTransitions };
}

// The guard effect: mirrors the exact `if (...) return;` condition gating
// the timer schedule in adsService.ts, given the latched `armed` value.
function shouldScheduleTimer(armed, { adsEnabled, alreadyShownForLabel, adUnitId }) {
  return !!(armed && adsEnabled && !alreadyShownForLabel && adUnitId);
}

// ── Assertion helpers (same style as ads_cooldown_test.mjs) ────────────────

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
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} (expected ${expected}, got ${actual})`);
    failed++;
  }
}

const okGuards = { adsEnabled: true, alreadyShownForLabel: false, adUnitId: 'unit-123' };

console.log('\n--- Edge case 1: false -> true, no further changes ---');
{
  const { armed, armTransitions } = simulateArmedSequence([false, true]);
  assertEq(armed, true, 'armed becomes true');
  assertEq(armTransitions, 1, 'armed transitions exactly once');
  assert(shouldScheduleTimer(armed, okGuards), 'timer would be scheduled');
}

console.log('\n--- Edge case 2: false -> true -> false within delay window (exact repro) ---');
{
  const { armed, armTransitions } = simulateArmedSequence([false, true, false]);
  assertEq(armed, true, 'armed stays true after trigger flips back to false');
  assertEq(armTransitions, 1, 'armed transitioned exactly once (no re-arm, no un-arm)');
  assert(
    shouldScheduleTimer(armed, okGuards),
    'timer is still schedulable — the false flip does NOT cancel it (this is the bug repro)'
  );
}

console.log('\n--- Edge case 3: false -> true -> false -> true -> false rapid cycling ---');
{
  const { armed, armTransitions } = simulateArmedSequence([false, true, false, true, false]);
  assertEq(armed, true, 'armed remains true through rapid cycling');
  assertEq(armTransitions, 1, 'armed set exactly once, on the first true — unaffected by later cycling');
}

console.log('\n--- Edge case 4: session-cap guard preserved regardless of armed state ---');
{
  const { armed } = simulateArmedSequence([false, true]);
  assertEq(armed, true, 'sanity: armed is true');
  const scheduled = shouldScheduleTimer(armed, { ...okGuards, alreadyShownForLabel: true });
  assertEq(scheduled, false, 'no timer scheduled when shownThisSessionByLabel[label] is already true');
}

console.log('\n--- Edge case 5: ADS_ENABLED === false guard preserved ---');
{
  const { armed } = simulateArmedSequence([false, true]);
  const scheduled = shouldScheduleTimer(armed, { ...okGuards, adsEnabled: false });
  assertEq(scheduled, false, 'no timer scheduled when ADS_ENABLED is false');
}

console.log('\n--- Edge case 6: INTERSTITIAL_AD_UNIT_ID falsy guard preserved ---');
{
  const { armed } = simulateArmedSequence([false, true]);
  assertEq(shouldScheduleTimer(armed, { ...okGuards, adUnitId: null }), false, 'no timer scheduled when adUnitId is null');
  assertEq(shouldScheduleTimer(armed, { ...okGuards, adUnitId: '' }), false, 'no timer scheduled when adUnitId is empty string');
  assertEq(shouldScheduleTimer(armed, { ...okGuards, adUnitId: undefined }), false, 'no timer scheduled when adUnitId is undefined');
}

console.log('\n--- Edge case 7: trigger never becomes true (component whole life) ---');
{
  const { armed, armTransitions } = simulateArmedSequence([false, false, false]);
  assertEq(armed, false, 'armed never set');
  assertEq(armTransitions, 0, 'zero arm transitions');
  assertEq(shouldScheduleTimer(armed, okGuards), false, 'timer never scheduled — original "never before first frame" intent preserved');
}

console.log('\n--- Extra: single-value sequences (no prior false) still latch correctly ---');
{
  assertEq(simulateArmedSequence([true]).armed, true, 'trigger starting true still arms');
  assertEq(simulateArmedSequence([]).armed, false, 'empty sequence (mount with no effect runs) stays unarmed');
}

console.log('\n--- Extra: armed reducer is monotonic (never returns false once true) ---');
{
  let armed = false;
  const sequence = [true, false, false, true, false, true, false, false];
  let sawTrue = false;
  for (const t of sequence) {
    armed = armedReducer(armed, t);
    if (armed) sawTrue = true;
    if (sawTrue) assert(armed === true, `armed stays true after first arm (trigger=${t})`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ Some assertions failed');
  process.exit(1);
} else {
  console.log(`✅ All ${passed} assertions passed`);
}
