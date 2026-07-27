// pinned_matches_test.mjs — tests for pinMatchesToTop
// Runs in Node.js, no React needed. Logic mirrors app/home/utils/pinnedMatches.ts exactly.

const PINNED_SECTION_ID = 'statusHeader-pinned';

function pinMatchesToTop(items, pinnedMatchIds) {
  if (pinnedMatchIds.size === 0) return items;

  const pinned = [];
  const rest = [];

  for (const item of items) {
    if (item.type === 'match') {
      const matchId = item.api_match_id ?? item.id;
      if (matchId != null && pinnedMatchIds.has(matchId)) {
        pinned.push(item);
        continue;
      }
    }
    rest.push(item);
  }

  if (pinned.length === 0) return rest;

  const hasAnyMatchLeft = rest.some((item) => item.type === 'match');
  const roundsWithMatches = new Set(
    rest.filter((item) => item.type === 'match').map((item) => item.round ?? null)
  );

  const cleaned = rest.filter((item) => {
    if (item.type === 'match') return true;
    if (item.type === 'statusHeader') return hasAnyMatchLeft;
    return item.round == null ? hasAnyMatchLeft : roundsWithMatches.has(item.round);
  });

  return [
    { type: 'statusHeader', title: 'Pinned Matches', iconName: 'star', id: PINNED_SECTION_ID },
    ...pinned,
    ...cleaned,
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function match(id, apiMatchId, round = 1, extra = {}) {
  return { type: 'match', id, api_match_id: apiMatchId, round, ...extra };
}
function statusHeader(id, title = id) {
  return { type: 'statusHeader', id: `statusHeader-${id}`, title, iconName: 'star' };
}
function roundHeader(id, round, roundName = id) {
  return { type: 'roundHeader', id: `roundHeader-${id}`, roundName, round };
}

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 1 — No pinned matches
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 1 — No pinned matches');

{
  const items = [statusHeader('livePlaying'), match(1, 101), match(2, 102)];
  const result = pinMatchesToTop(items, new Set());
  assertEq(result, items, 'empty pinned set returns the original list unchanged');
}

{
  const items = [statusHeader('livePlaying'), match(1, 101)];
  const result = pinMatchesToTop(items, new Set([999])); // id not present in list
  assertEq(result, items, 'pinned set with an id not present in the list changes nothing');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 2 — Basic pinning
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 2 — Basic pinning');

{
  // statusHeader is immediately followed by a roundHeader (not a match) in
  // real data — must not be mistaken for "empty" just because of that.
  const items = [
    statusHeader('livePlaying'),
    roundHeader('r1', 1),
    match(1, 101, 1),
    match(2, 102, 1),
  ];
  const result = pinMatchesToTop(items, new Set([102]));
  assertEq(result[0], { type: 'statusHeader', title: 'Pinned Matches', iconName: 'star', id: PINNED_SECTION_ID }, 'new Pinned Matches header is first');
  assertEq(result[1], match(2, 102, 1), 'pinned match immediately follows the Pinned header');
  assertEq(result.slice(2), [statusHeader('livePlaying'), roundHeader('r1', 1), match(1, 101, 1)], 'original statusHeader + roundHeader + remaining unpinned match all survive');
}

{
  // Multiple pinned matches preserve their relative order from the original list
  const items = [
    statusHeader('livePlaying'),
    match(1, 101, 1),
    match(2, 102, 1),
    match(3, 103, 1),
  ];
  const result = pinMatchesToTop(items, new Set([103, 101]));
  assertEq(result.slice(1, 3), [match(1, 101, 1), match(3, 103, 1)], 'pinned matches appear in original relative order, not pin-set order');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 3 — Empty-header cleanup (round-based matching)
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 3 — Dropping headers left with zero matches of their own round');

{
  // Round 1's only match gets pinned away -> round 1's header must be dropped,
  // even though round 2's header/match immediately follow it positionally.
  const items = [
    statusHeader('livePlaying'),
    roundHeader('r1', 1),
    match(1, 101, 1),
    roundHeader('r2', 2),
    match(2, 102, 2),
  ];
  const result = pinMatchesToTop(items, new Set([101]));
  const rest = result.slice(2); // after Pinned header + pinned match
  assertEq(rest, [statusHeader('livePlaying'), roundHeader('r2', 2), match(2, 102, 2)], 'round-1 header dropped (no round-1 match left), round-2 header kept (its match survives)');
}

{
  // The whole status section becomes empty (only match pinned away) -> statusHeader itself dropped too
  const items = [
    statusHeader('livePlaying'),
    match(1, 101, 1),
  ];
  const result = pinMatchesToTop(items, new Set([101]));
  assertEq(result, [
    { type: 'statusHeader', title: 'Pinned Matches', iconName: 'star', id: PINNED_SECTION_ID },
    match(1, 101, 1),
  ], 'statusHeader with its only match pinned away is dropped entirely from rest');
}

{
  // Header at the very end of the list, with the section's only match pinned away
  const items = [match(1, 101, 1), statusHeader('trailing')];
  const result = pinMatchesToTop(items, new Set([101]));
  assertEq(result.slice(2), [], 'trailing header with no matches left anywhere is dropped from the non-pinned rest');
}

{
  // Round-less "divider" header (e.g. "To Be Continued", round: null) is kept
  // as long as ANYTHING remains in the section, even if not literally round: null.
  const items = [
    statusHeader('upcoming'),
    roundHeader('divider', null, 'To Be Continued'),
    roundHeader('r5', 5),
    match(1, 101, 5),
  ];
  const result = pinMatchesToTop(items, new Set([999])); // nothing pinned from this list
  assertEq(result, items, 'sanity: nothing pinned means nothing changes even with a null-round divider present');
}

{
  const items = [
    statusHeader('upcoming'),
    roundHeader('divider', null, 'To Be Continued'),
    roundHeader('r5', 5),
    match(1, 101, 5),
    match(2, 102, 6), // pulled from elsewhere just to have a 2nd pin target
  ];
  const result = pinMatchesToTop(items, new Set([101]));
  const rest = result.slice(2);
  // round-5 header dropped (its only match pinned), divider kept (match 102 with round 6 still exists somewhere in section)
  assertEq(rest, [statusHeader('upcoming'), roundHeader('divider', null, 'To Be Continued'), match(2, 102, 6)], 'null-round divider survives on "anything remains" while the now-empty round-5 header is dropped');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 4 — Matching by id fallback
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 4 — Matching by id when api_match_id is null');

{
  const items = [match(55, null, 1)];
  const result = pinMatchesToTop(items, new Set([55]));
  assert(result.length === 2 && result[1].id === 55, 'falls back to internal id when api_match_id is null');
}

{
  const items = [match(55, null, 1)];
  const result = pinMatchesToTop(items, new Set([999]));
  assertEq(result, items, 'no match when pin set only contains an id that matches neither api_match_id nor id');
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Sanity checks
// ════════════════════════════════════════════════════════════════════════════
console.log('\nSECTION 5 — Sanity checks');

{
  const items = [statusHeader('livePlaying'), match(1, 101, 1)];
  const result = pinMatchesToTop(items, new Set([101]));
  assert(result.filter((i) => i.type === 'match').length === 1, 'exactly one match item present, none duplicated');
}

{
  // Empty items array
  const result = pinMatchesToTop([], new Set([101]));
  assertEq(result, [], 'empty items array with a non-empty pin set returns an empty array, no crash');
}

// ── Final summary ────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
