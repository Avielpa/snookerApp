// leaderboard_tab_test.mjs — tests for app/components/scoreboard/LeaderboardTab.tsx's
// forceLtr pure helper (bidi-override for numeral+punctuation rank text on RTL-locale
// devices). Runs in Node.js — same inline-mirror pattern as the other .mjs suites (see
// docs/OPEN_MISSIONS.md #13; this machine's Node v20.18.0 cannot execute TypeScript
// directly, so importing the real .tsx file is not possible).
//
// Found on a real Hebrew-locale S24 during device verification: RN's `writingDirection`
// Text style is iOS-only, so it silently did nothing on Android — the fix that actually
// works on both platforms is wrapping the string in Unicode LRO/PDF override marks.

import assert from 'node:assert';

// ── Inline mirror of LeaderboardTab.tsx's forceLtr ─────────────────────────────────

const LRO = '‭'; // Left-to-Right Override
const PDF = '‬'; // Pop Directional Formatting
function forceLtr(text) {
  return `${LRO}${text}${PDF}`;
}

// ── Test harness ─────────────────────────────────────────────────────────────────

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok - ${name}`); }

console.log('forceLtr');
{
  test('wraps the string with LRO at the start and PDF at the end', () => {
    const result = forceLtr('1.');
    assert.strictEqual(result, `${LRO}1.${PDF}`);
    assert.strictEqual(result[0], LRO);
    assert.strictEqual(result[result.length - 1], PDF);
  });

  test('preserves the original text between the override marks', () => {
    const result = forceLtr('12.');
    assert.strictEqual(result.slice(1, -1), '12.');
  });

  test('empty string still gets wrapped without throwing', () => {
    assert.strictEqual(forceLtr(''), `${LRO}${PDF}`);
  });
}

console.log(`✅ All ${passed} assertions passed`);
