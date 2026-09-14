// share_test.mjs — tests for services/shareService.ts's pure message/link builders
// Runs in Node.js, no React/React Native needed. Logic mirrors shareService.ts exactly
// (the same inline-mirror pattern used by game_test.mjs/train_test.mjs/etc. — this repo's
// .mjs suites can't import TS/RN directly, see docs/OPEN_MISSIONS.md #13).

// ── Inline mirror of services/shareService.ts's pure functions ──────────────────────────

const PLAY_STORE_PACKAGE = 'com.avielpahima.maxbreaksnooker';
const APPLE_APP_STORE_ID = '6762826909';

function buildPlayStoreLink() {
  const inner = 'utm_source=app&utm_medium=referral&utm_campaign=frame_share';
  return `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}&referrer=${encodeURIComponent(inner)}`;
}

function buildAppStoreLink() {
  return `https://apps.apple.com/app/id${APPLE_APP_STORE_ID}`;
}

function buildStoreLinksBlock() {
  return `${buildPlayStoreLink()}\n📱 iPhone: ${buildAppStoreLink()}`;
}

function buildBreakShareMessage(breakScore) {
  const scoreLabel = breakScore === 0 ? 'a break' : `a break of ${breakScore}`;
  return `🎱 I just made ${scoreLabel} on MaxBreak147! Think you can beat it?\n\n${buildStoreLinksBlock()}`;
}

function buildFrameShareMessage(winnerName, scoreline) {
  const name = winnerName.trim() || 'I';
  return `🎱 ${name} won ${scoreline} on MaxBreak147 — track your own frames free:\n\n${buildStoreLinksBlock()}`;
}

// ── Test harness ──────────────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
function assert(condition, message) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAILED: ${message}`);
  }
}
function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function assertIncludes(haystack, needle, message) {
  assert(haystack.includes(needle), `${message} — expected to include ${JSON.stringify(needle)} in ${JSON.stringify(haystack)}`);
}

// ── Section 1: buildPlayStoreLink — the Android link ─────────────────────────────────

{
  const link = buildPlayStoreLink();
  assertIncludes(link, 'https://play.google.com/store/apps/details?id=com.avielpahima.maxbreaksnooker', 'Play link has correct base Play Store URL');
  assertIncludes(link, 'referrer=', 'Play link has a referrer param');
  assertIncludes(link, encodeURIComponent('utm_source=app'), 'Play link referrer contains utm_source=app');
  assertIncludes(link, encodeURIComponent('utm_medium=referral'), 'Play link referrer contains utm_medium=referral');
  assertIncludes(link, encodeURIComponent('utm_campaign=frame_share'), 'Play link referrer contains utm_campaign=frame_share');
  assert(!link.includes(' '), 'Play link has no raw spaces (properly encoded)');
  assert(link.startsWith('https://'), 'Play link uses https');
  assertEqual(buildPlayStoreLink(), link, 'buildPlayStoreLink is deterministic across calls');
}

// ── Section 2: buildAppStoreLink — the iOS link ──────────────────────────────────────

{
  const link = buildAppStoreLink();
  assertEqual(link, 'https://apps.apple.com/app/id6762826909', 'App Store link is the exact expected URL');
  assert(link.startsWith('https://'), 'App Store link uses https');
  assert(!link.includes(' '), 'App Store link has no raw spaces');
  assertEqual(buildAppStoreLink(), link, 'buildAppStoreLink is deterministic across calls');
}

// ── Section 3: buildStoreLinksBlock — both links together ───────────────────────────

{
  const block = buildStoreLinksBlock();
  assertIncludes(block, buildPlayStoreLink(), 'store links block includes the full Play Store link');
  assertIncludes(block, buildAppStoreLink(), 'store links block includes the full App Store link');
  assertIncludes(block, 'iPhone', 'store links block labels the iOS link');
  // Play link must come first, App Store link second (matches FB post convention).
  assert(block.indexOf(buildPlayStoreLink()) < block.indexOf(buildAppStoreLink()), 'Play link appears before the App Store link');
}

// ── Section 4: buildBreakShareMessage — Train mode ───────────────────────────────────

const breakScoresToTest = [0, 1, 4, 8, 15, 27, 36, 40, 50, 74, 99, 100, 120, 136, 147];
for (const score of breakScoresToTest) {
  const msg = buildBreakShareMessage(score);
  assertIncludes(msg, 'MaxBreak147', `break message for score ${score} mentions MaxBreak147`);
  assertIncludes(msg, buildPlayStoreLink(), `break message for score ${score} includes the Play Store link`);
  assertIncludes(msg, buildAppStoreLink(), `break message for score ${score} includes the App Store link`);
  assertIncludes(msg, '🎱', `break message for score ${score} has the ball emoji`);
  assert(msg.length > 0, `break message for score ${score} is non-empty`);
  if (score === 0) {
    assertIncludes(msg, 'a break', 'zero-score break message reads "a break" (no confusing "of 0")');
    assert(!msg.includes('of 0'), 'zero-score break message does not say "of 0"');
  } else {
    assertIncludes(msg, `a break of ${score}`, `break message for score ${score} states the exact score`);
  }
}

// Boundary: max possible snooker break (147) renders correctly.
assertIncludes(buildBreakShareMessage(147), 'a break of 147', 'maximum break (147) renders correctly');
// Negative/unexpected input never crashes and still produces a message (defensive).
assert(typeof buildBreakShareMessage(-1) === 'string', 'negative break score does not throw');
assertIncludes(buildBreakShareMessage(-1), 'a break of -1', 'negative break score still includes the raw value');

// ── Section 5: buildFrameShareMessage — Match/Unlimited mode ────────────────────────

const nameScorelineCases = [
  ['Aviel', '3–1'],
  ['Rival', '1–0'],
  ["Ronnie O'Sullivan", '4–2'],
  ['Judd Trump', '10–7'],
  ['A', '1–1'],
  ['Player With A Very Long Display Name Indeed', '2–0'],
  ['李明', '3–2'], // non-Latin name
  ['Jean-Paul', '5–4'],
];
for (const [name, scoreline] of nameScorelineCases) {
  const msg = buildFrameShareMessage(name, scoreline);
  assertIncludes(msg, name, `frame message includes winner name "${name}"`);
  assertIncludes(msg, scoreline, `frame message includes scoreline "${scoreline}" for ${name}`);
  assertIncludes(msg, 'MaxBreak147', `frame message for ${name} mentions MaxBreak147`);
  assertIncludes(msg, buildPlayStoreLink(), `frame message for ${name} includes the Play Store link`);
  assertIncludes(msg, buildAppStoreLink(), `frame message for ${name} includes the App Store link`);
  assertIncludes(msg, 'won', `frame message for ${name} uses "won"`);
}

// Whitespace-padded name is trimmed before use.
assertEqual(
  buildFrameShareMessage('  Aviel  ', '3–1'),
  buildFrameShareMessage('Aviel', '3–1'),
  'leading/trailing whitespace in winner name is trimmed'
);

// Empty/blank name falls back to "I" rather than an empty/broken sentence.
assertIncludes(buildFrameShareMessage('', '3–1'), 'I won 3–1', 'empty winner name falls back to "I"');
assertIncludes(buildFrameShareMessage('   ', '3–1'), 'I won 3–1', 'whitespace-only winner name falls back to "I"');

// ── Section 6: message shape sanity (won't silently break the native Share sheet) ───

for (const score of breakScoresToTest) {
  const msg = buildBreakShareMessage(score);
  assert(msg.length < 600, `break message for score ${score} stays well under a reasonable share-sheet length`);
}
for (const [name, scoreline] of nameScorelineCases) {
  const msg = buildFrameShareMessage(name, scoreline);
  assert(msg.length < 600, `frame message for ${name} stays well under a reasonable share-sheet length`);
}

// Both message builders end with the App Store link last (so a truncating preview still
// shows the human-readable line and the Play link first).
assert(buildBreakShareMessage(36).endsWith(buildAppStoreLink()), 'break message ends with the App Store link');
assert(buildFrameShareMessage('Aviel', '3–1').endsWith(buildAppStoreLink()), 'frame message ends with the App Store link');

// ── Report ────────────────────────────────────────────────────────────────────────────

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed}/${passed + failed} assertions passed`);
if (failed > 0) process.exit(1);
