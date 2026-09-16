// history_tab_param_test.mjs — tests for app/scoreboard/history.tsx's resolveInitialTab,
// which validates the ?tab= deep-link param (used by the new "🏆 Leaderboard" shortcut
// button on the Play Mode setup screen) against the known tab set. Runs in Node.js —
// same inline-mirror pattern as the other .mjs suites (see docs/OPEN_MISSIONS.md #13;
// this machine's Node v20.18.0 cannot execute TypeScript directly).

import assert from 'node:assert';

// ── Inline mirror of app/scoreboard/history.tsx's resolveInitialTab ────────────────

function resolveInitialTab(param) {
  const value = Array.isArray(param) ? param[0] : param;
  return value === 'training' || value === 'leaderboard' ? value : 'matches';
}

// ── Test harness ─────────────────────────────────────────────────────────────────

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok - ${name}`); }

console.log('resolveInitialTab');
{
  test('undefined param (no deep link) defaults to matches', () => {
    assert.strictEqual(resolveInitialTab(undefined), 'matches');
  });

  test('?tab=leaderboard resolves to the leaderboard tab', () => {
    assert.strictEqual(resolveInitialTab('leaderboard'), 'leaderboard');
  });

  test('?tab=training resolves to the training tab', () => {
    assert.strictEqual(resolveInitialTab('training'), 'training');
  });

  test('?tab=matches resolves to matches explicitly', () => {
    assert.strictEqual(resolveInitialTab('matches'), 'matches');
  });

  test('unrecognized value falls back to matches, not a crash', () => {
    assert.strictEqual(resolveInitialTab('bogus'), 'matches');
  });

  test('empty string falls back to matches', () => {
    assert.strictEqual(resolveInitialTab(''), 'matches');
  });

  test('expo-router can deliver a param as an array — first element wins', () => {
    assert.strictEqual(resolveInitialTab(['leaderboard', 'training']), 'leaderboard');
  });

  test('an array with an unrecognized first element falls back to matches', () => {
    assert.strictEqual(resolveInitialTab(['bogus']), 'matches');
  });
}

console.log(`✅ All ${passed} assertions passed`);
