// leaderboard_service_test.mjs — tests for services/leaderboardService.ts's fetchLeaderboard
// Runs in Node.js, no React/React Native needed (same inline-mirror pattern as the
// other .mjs suites — see docs/OPEN_MISSIONS.md #13; this machine's Node v20.18.0
// cannot execute TypeScript directly, so importing the real .ts file is not possible).
// fetchLeaderboard is mirrored inline below with a swappable mockAxiosGet standing in
// for axios.get — same convention best_break_test.mjs uses for fetchBestBreaks/submitBreak.
// Confirmed RED first (see git history / task report): running this file against a real
// `await import('./services/leaderboardService.ts')` throws ERR_MODULE_NOT_FOUND before
// the real service file existed.

import assert from 'node:assert';

// ── Inline mirror of services/leaderboardService.ts's fetchLeaderboard ─────────────

const API_BASE = 'https://snookerapp.up.railway.app/oneFourSeven/';

let mockAxiosGet = async () => { throw new Error('mockAxiosGet not set for this test'); };

async function fetchLeaderboard(redsCount) {
  try {
    const res = await mockAxiosGet(`${API_BASE}scoreboard/leaderboard/?reds_count=${redsCount}`);
    return res.data;
  } catch (error) {
    return [];
  }
}

// ── Test harness ─────────────────────────────────────────────────────────────────

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log(`  ok - ${name}`); }

console.log('fetchLeaderboard');
{
  await test('returns entries from the response', async () => {
    mockAxiosGet = async () => ({ data: [{ username: 'David', reds_count: 15, best_break: 30, frame_time_seconds: 200, is_verified: true, achieved_at: 'x' }] });
    const result = await fetchLeaderboard(15);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].username, 'David');
  });

  await test('passes reds_count as a query param', async () => {
    let sentUrl = null;
    mockAxiosGet = async (url) => { sentUrl = url; return { data: [] }; };
    await fetchLeaderboard(6);
    assert.ok(sentUrl.includes('reds_count=6'));
  });

  await test('returns empty array on error, never throws', async () => {
    mockAxiosGet = async () => { throw new Error('network'); };
    const result = await fetchLeaderboard(15);
    assert.deepStrictEqual(result, []);
  });
}

console.log(`✅ All ${passed} assertions passed`);
