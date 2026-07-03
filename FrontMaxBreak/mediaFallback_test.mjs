// Media fallback redirect test — covers home screen "redirect to Media when no
// decided matches" logic. Runs in Node.js (no React). Mirrors
// app/home/utils/mediaFallback.ts exactly.

const UNKNOWN_PLAYER_ID = 376; // matches utils/constants.ts MATCH_CONSTANTS.UNKNOWN_PLAYER_ID

function shouldRedirectToMedia(listData) {
  const matchItems = listData.filter(item => item.type === 'match');
  const hasDecidedMatch = matchItems.some(
    item => item.player1_id !== UNKNOWN_PLAYER_ID || item.player2_id !== UNKNOWN_PLAYER_ID
  );
  return !hasDecidedMatch;
}

// ── Test harness ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    console.error(`❌ ${label}: expected ${expected}, got ${actual}`);
  }
}

function match(player1_id, player2_id) {
  return { type: 'match', player1_id, player2_id };
}
function statusHeader() {
  return { type: 'statusHeader' };
}
function roundHeader() {
  return { type: 'roundHeader' };
}

// ── General cases ────────────────────────────────────────────────────────

assertEqual(shouldRedirectToMedia([]), true, 'empty list -> redirect');

assertEqual(
  shouldRedirectToMedia([match(1, 2)]),
  false,
  'single decided match -> no redirect'
);

assertEqual(
  shouldRedirectToMedia([match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID)]),
  true,
  'single TBD-vs-TBD match -> redirect'
);

assertEqual(
  shouldRedirectToMedia([match(1, UNKNOWN_PLAYER_ID)]),
  false,
  'one known player, one TBD -> counts as decided, no redirect'
);

assertEqual(
  shouldRedirectToMedia([match(UNKNOWN_PLAYER_ID, 2)]),
  false,
  'TBD player1, known player2 -> counts as decided, no redirect'
);

assertEqual(
  shouldRedirectToMedia([
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    match(3, 4),
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
  ]),
  false,
  'mixed list with at least one decided match among TBDs -> no redirect'
);

assertEqual(
  shouldRedirectToMedia([
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
  ]),
  true,
  'all matches TBD-vs-TBD -> redirect'
);

// ── Edge cases ────────────────────────────────────────────────────────────

assertEqual(
  shouldRedirectToMedia([statusHeader(), roundHeader()]),
  true,
  'non-match items only (headers) -> treated as no decided matches -> redirect'
);

assertEqual(
  shouldRedirectToMedia([
    statusHeader(),
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    roundHeader(),
    match(5, 6),
  ]),
  false,
  'headers interleaved with one decided match -> no redirect'
);

assertEqual(
  shouldRedirectToMedia([match(null, null)]),
  false,
  'null player ids are not the TBD sentinel (376) -> current impl treats null as ' +
    '"decided" since null !== 376; documents actual behavior'
);

assertEqual(
  shouldRedirectToMedia([match(0, 0)]),
  false,
  'player id 0 is not the TBD sentinel -> treated as decided, no redirect'
);

assertEqual(
  shouldRedirectToMedia([match(UNKNOWN_PLAYER_ID, 0)]),
  false,
  'one TBD, one id 0 (falsy but not sentinel) -> decided, no redirect'
);

assertEqual(
  shouldRedirectToMedia([
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID),
    match(7, UNKNOWN_PLAYER_ID),
  ]),
  false,
  'last match in a long TBD run is decided -> no redirect (order independence)'
);

assertEqual(
  shouldRedirectToMedia(
    Array.from({ length: 50 }, () => match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID))
  ),
  true,
  '50 TBD-vs-TBD matches -> redirect'
);

assertEqual(
  shouldRedirectToMedia([
    ...Array.from({ length: 49 }, () => match(UNKNOWN_PLAYER_ID, UNKNOWN_PLAYER_ID)),
    match(9, 10),
  ]),
  false,
  '49 TBD matches + 1 decided match at the end -> no redirect'
);

// ── Summary ───────────────────────────────────────────────────────────────

const total = passed + failed;
if (failed === 0) {
  console.log(`✅ All ${total} assertions passed`);
} else {
  console.error(`❌ ${failed}/${total} assertions failed`);
  process.exit(1);
}
