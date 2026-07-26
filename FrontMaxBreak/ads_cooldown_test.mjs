// ads_cooldown_test.mjs — tests for isMediaInterstitialCooldownElapsed
// Runs in Node.js, no React/RN needed. Logic mirrors services/adsService.ts exactly.

// ── Inline isMediaInterstitialCooldownElapsed logic ─────────────────────────

const MEDIA_INTERSTITIAL_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

function isMediaInterstitialCooldownElapsed(lastShownAt, now, cooldownMs = MEDIA_INTERSTITIAL_COOLDOWN_MS) {
  if (lastShownAt === null) return true;
  return now - lastShownAt >= cooldownMs;
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
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${actual}, expected ${expected}`);
    failed++;
  }
}

const HOUR = 60 * 60 * 1000;

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — Never shown before (null lastShownAt)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 1 — Never shown before');

{
  assertEq(isMediaInterstitialCooldownElapsed(null, 0), true, 'null lastShownAt at now=0 → true (never shown, always allowed)');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(null, Date.now()), true, 'null lastShownAt at real "now" → true');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(null, -1), true, 'null lastShownAt even with a negative "now" → true (short-circuits before math)');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Default 4-hour cooldown boundary behaviour
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 2 — Default 4h cooldown boundary');

{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt), false, 'elapsed=0 → false (just shown)');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + MEDIA_INTERSTITIAL_COOLDOWN_MS - 1), false, '1ms before the 4h boundary → false');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + MEDIA_INTERSTITIAL_COOLDOWN_MS), true, 'exactly at the 4h boundary → true (inclusive)');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + MEDIA_INTERSTITIAL_COOLDOWN_MS + 1), true, '1ms after the 4h boundary → true');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + 1 * HOUR), false, '1h elapsed of 4h cooldown → false');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + 3 * HOUR + 59 * 60 * 1000), false, '3h59m elapsed → false, still just under 4h');
}
{
  const lastShownAt = 1_000_000;
  assertEq(isMediaInterstitialCooldownElapsed(lastShownAt, lastShownAt + 24 * HOUR), true, '24h elapsed (well past 4h cooldown) → true');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Custom cooldown windows (override default)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 3 — Custom cooldown windows');

{
  assertEq(isMediaInterstitialCooldownElapsed(0, 30 * 60 * 1000, HOUR), false, 'custom 1h cooldown, 30min elapsed → false');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(0, HOUR, HOUR), true, 'custom 1h cooldown, exactly 1h elapsed → true');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(0, 23 * HOUR, 24 * HOUR), false, 'custom 24h cooldown, 23h elapsed → false');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(0, 0, 0), true, 'zero-length cooldown, no time elapsed → true (0 >= 0)');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Clock skew / unexpected inputs
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 4 — Clock skew and unexpected inputs');

{
  // "now" before lastShownAt (e.g. device clock adjusted backwards) — must not
  // incorrectly allow a re-show from a negative elapsed time.
  assertEq(isMediaInterstitialCooldownElapsed(10_000, 5_000), false, 'now before lastShownAt (clock skew) → false, never allows negative elapsed to pass');
}
{
  assertEq(isMediaInterstitialCooldownElapsed(10_000, 5_000, 0), false, 'clock skew even with zero-length cooldown → still false (diff is negative)');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Determinism / no side effects
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 5 — Determinism');

{
  const a = isMediaInterstitialCooldownElapsed(1000, 2000);
  const b = isMediaInterstitialCooldownElapsed(1000, 2000);
  assertEq(a, b, 'repeated calls with identical inputs return identical results (pure function)');
}
{
  assertEq(MEDIA_INTERSTITIAL_COOLDOWN_MS, 14_400_000, 'default cooldown constant is exactly 4 hours in ms');
}

// ── Final summary ────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
