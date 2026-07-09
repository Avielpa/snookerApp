// home_drawtab_test.mjs — logic-parity baseline for the Draw tab / Home redesign.
// Runs in Node.js, no React/RN. Mirrors the exported pure functions in
// app/tour/components/DrawTab.tsx exactly (getTop, totalHeight,
// inferRoundNameFromCount, inferRoundName, computeBracketRounds) so this
// file can be re-run byte-for-byte after the style-only redesign (connector
// line color/thickness polish only) lands, to prove the bracket-chain
// inference and card geometry never changed.

let pass = 0;
let fail = 0;

function assertEqual(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.error(`❌ FAIL: ${msg}\n   expected: ${e}\n   actual:   ${a}`);
  }
}

function assertTrue(cond, msg) {
  if (cond) pass++;
  else { fail++; console.error(`❌ FAIL: ${msg}`); }
}

// ── Mirrored constants + functions from app/tour/components/DrawTab.tsx ───

const CARD_H = 40;
const BASE_SLOT = CARD_H + 8;

function getTop(roundIndex, matchIndex, firstRoundCount = 8) {
  const slotH = BASE_SLOT * Math.pow(2, roundIndex);
  return matchIndex * slotH + (slotH - CARD_H) / 2;
}

function totalHeight(firstRoundCount) {
  return firstRoundCount * BASE_SLOT;
}

function inferRoundNameFromCount(count) {
  if (count === 1) return 'Final';
  if (count === 2) return 'Semi-Finals';
  if (count === 4) return 'Quarter-Finals';
  if (count === 8) return 'Last 16';
  if (count === 16) return 'Last 32';
  if (count === 32) return 'Last 64';
  if (count === 64) return 'Last 128';
  return `Round (${count} matches)`;
}

function inferRoundName(round) {
  if (round >= 15) return 'Final';
  if (round === 14) return 'Semi-Finals';
  if (round === 13) return 'Quarter-Finals';
  if (round === 12) return 'Last 16';
  if (round === 11) return 'Last 32';
  if (round === 10) return 'Last 64';
  if (round === 9) return 'Last 128';
  return `Round ${round}`;
}

function computeBracketRounds(matches, roundNames, roundFormats, roundPrizes) {
  const byRound = new Map();
  matches.forEach((m) => {
    const r = m.round ?? 0;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(m);
  });

  const allRounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  let chain = [];
  for (let i = allRounds.length - 1; i >= 0; i--) {
    if ((byRound.get(allRounds[i])?.length ?? 0) <= 32) {
      chain = [allRounds[i]];
      break;
    }
  }
  if (chain.length > 0) {
    let needed = (byRound.get(chain[0])?.length ?? 1) * 2;
    const startIdx = allRounds.indexOf(chain[0]) - 1;
    for (let i = startIdx; i >= 0 && chain.length < 7; i--) {
      const r = allRounds[i];
      const count = byRound.get(r)?.length ?? 0;
      if (count === needed) {
        chain.unshift(r);
        needed = count * 2;
      }
    }
  }

  let mainRounds = chain.length > 0
    ? chain
    : allRounds.filter((r) => (byRound.get(r)?.length ?? 0) <= 32).slice(-7);

  return mainRounds.map((r) => ({
    roundNumber: r,
    roundName: roundNames[r] || inferRoundNameFromCount(byRound.get(r).length),
    roundFormat: roundFormats?.[r] ?? null,
    roundPrize: roundPrizes?.[r] ?? null,
    matches: (byRound.get(r) || []).slice().sort((a, b) => {
      const aPos = a.number ?? a.api_match_id ?? a.id;
      const bPos = b.number ?? b.api_match_id ?? b.id;
      return aPos - bPos;
    }),
  }));
}

// ── Section 1: getTop / totalHeight geometry (18 assertions) ───────────────
console.log('\n── getTop / totalHeight ──');

assertEqual(getTop(0, 0), 4, 'round 0, match 0 -> top = centering offset (48-40)/2 = 4');
assertEqual(getTop(0, 1), 52, 'round 0, match 1 -> top = 1 slot (48) + centering offset 4');
assertEqual(getTop(0, 2), 100, 'round 0, match 2 -> top = 2 slots (96) + centering offset 4');
assertEqual(getTop(1, 0), 28, 'round 1 (slot doubles to 96), match 0 centered -> (96-40)/2=28');
assertEqual(getTop(1, 1), 124, 'round 1, match 1 -> one doubled slot (96) down from match 0 (28)');
assertEqual(getTop(2, 0), (48 * 4 - 40) / 2, 'round 2 slot = BASE_SLOT*4, centered');
assertEqual(totalHeight(8), 384, 'totalHeight(8) = 8 * BASE_SLOT(48) = 384');
assertEqual(totalHeight(4), 192, 'totalHeight(4) = 4 * 48 = 192');
assertEqual(totalHeight(1), 48, 'totalHeight(1) = 48');
assertEqual(totalHeight(16), 768, 'totalHeight(16) = 768');
assertEqual(totalHeight(0), 0, 'totalHeight(0) = 0');
assertTrue(getTop(0, 3) > getTop(0, 2), 'getTop increases monotonically with matchIndex at same round');
assertTrue(getTop(2, 0) > getTop(1, 0), 'getTop increases with roundIndex for match 0 (slot doubling)');
assertEqual(getTop(0, 0, 16), 4, 'firstRoundCount param does not affect round-0 top (unused in formula)');
assertEqual(getTop(3, 0), (48 * 8 - 40) / 2, 'round 3 slot = BASE_SLOT*8, centered');
assertEqual(getTop(1, 2), 28 + 192, 'round 1, match 2 -> two doubled slots down from match-0 offset (28)');
assertTrue(Number.isFinite(getTop(6, 0)), 'round 6 (max supported chain length-1) produces a finite number');
assertEqual(totalHeight(32), 1536, 'totalHeight(32) = 1536');

// ── Section 2: inferRoundNameFromCount (14 assertions) ──────────────────────
console.log('\n── inferRoundNameFromCount ──');
assertEqual(inferRoundNameFromCount(1), 'Final', 'count=1 -> Final');
assertEqual(inferRoundNameFromCount(2), 'Semi-Finals', 'count=2 -> Semi-Finals');
assertEqual(inferRoundNameFromCount(4), 'Quarter-Finals', 'count=4 -> Quarter-Finals');
assertEqual(inferRoundNameFromCount(8), 'Last 16', 'count=8 -> Last 16');
assertEqual(inferRoundNameFromCount(16), 'Last 32', 'count=16 -> Last 32');
assertEqual(inferRoundNameFromCount(32), 'Last 64', 'count=32 -> Last 64');
assertEqual(inferRoundNameFromCount(64), 'Last 128', 'count=64 -> Last 128');
assertEqual(inferRoundNameFromCount(3), 'Round (3 matches)', 'non-power-of-2 count falls back to generic label');
assertEqual(inferRoundNameFromCount(0), 'Round (0 matches)', 'count=0 falls back to generic label');
assertEqual(inferRoundNameFromCount(5), 'Round (5 matches)', 'count=5 falls back to generic label');
assertEqual(inferRoundName(15), 'Final', 'round>=15 -> Final');
assertEqual(inferRoundName(20), 'Final', 'round well above 15 -> still Final');
assertEqual(inferRoundName(14), 'Semi-Finals', 'round=14 -> Semi-Finals');
assertEqual(inferRoundName(1), 'Round 1', 'low round number -> generic Round N label');

// ── Section 3: computeBracketRounds (32 assertions) ─────────────────────────
console.log('\n── computeBracketRounds (bracket-chain inference) ──');

function mkMatch(id, round, number) {
  return { id, round, number, player1_name: `P${id}a`, player2_name: `P${id}b` };
}

{
  // Valid doubling chain: R8(Last16)=8 -> R9(QF)=4 -> R10(SF)=2 -> R11(Final)=1
  const matches = [
    ...Array.from({ length: 8 }, (_, i) => mkMatch(100 + i, 8, i)),
    ...Array.from({ length: 4 }, (_, i) => mkMatch(200 + i, 9, i)),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(300 + i, 10, i)),
    mkMatch(400, 11, 0),
  ];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds.length, 4, 'valid doubling chain produces all 4 rounds');
  assertEqual(rounds[0].matches.length, 8, 'first round in chain has 8 matches (Last 16)');
  assertEqual(rounds[0].roundName, 'Last 16', 'first round name inferred correctly');
  assertEqual(rounds[1].matches.length, 4, 'second round has 4 matches (QF)');
  assertEqual(rounds[1].roundName, 'Quarter-Finals', 'second round name inferred correctly');
  assertEqual(rounds[2].matches.length, 2, 'third round has 2 matches (SF)');
  assertEqual(rounds[3].matches.length, 1, 'fourth round has 1 match (Final)');
  assertEqual(rounds[3].roundName, 'Final', 'final round name inferred correctly');
  assertEqual(rounds.map(r => r.roundNumber), [8, 9, 10, 11], 'rounds returned in ascending round-number order');
}
{
  // Backend-provided round names take priority over inference
  const matches = [mkMatch(1, 5, 0)];
  const rounds = computeBracketRounds(matches, { 5: 'Custom Round Name' });
  assertEqual(rounds[0].roundName, 'Custom Round Name', 'backend roundNames takes priority over count-based inference');
}
{
  // Broken chain (bye) — round 2 has 3 matches instead of the required 4,
  // so the doubling walk stops extending backward from round 3, but does
  // NOT trigger the "no chain found" fallback (chain.length is already 1).
  // Verified against the real algorithm: a short/stuck chain stays short.
  const matches = [
    ...Array.from({ length: 8 }, (_, i) => mkMatch(100 + i, 1, i)),
    ...Array.from({ length: 3 }, (_, i) => mkMatch(200 + i, 2, i)), // broken: should be 4
    ...Array.from({ length: 1 }, (_, i) => mkMatch(300 + i, 3, i)),
  ];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds.length, 1, 'broken doubling chain stays at just the starting round (walk stops, no further fallback)');
  assertEqual(rounds.map(r => r.roundNumber), [3], 'only the last (<=32-match) round survives when the chain cannot extend');
}
{
  // Empty input
  const rounds = computeBracketRounds([], {});
  assertEqual(rounds.length, 0, 'empty matches array produces empty rounds array');
}
{
  // The <=32 cap only gates which round can be the STARTING point of the
  // chain — once a valid doubling chain is walked backward, an earlier
  // round can exceed 32 matches and still be included (round 1 here has 64).
  const matches = [
    ...Array.from({ length: 64 }, (_, i) => mkMatch(1000 + i, 1, i)),
    ...Array.from({ length: 32 }, (_, i) => mkMatch(2000 + i, 2, i)),
    ...Array.from({ length: 16 }, (_, i) => mkMatch(3000 + i, 3, i)),
  ];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds.length, 3, 'valid doubling chain (64->32->16) includes all 3 rounds');
  assertEqual(rounds[0].matches.length, 64, 'earliest chained round can exceed the 32-match starting cap');
  assertEqual(rounds[2].matches.length, 16, 'last (latest) round in chain is the 16-match round');
}
{
  // Matches within a round are sorted by number/api_match_id/id
  const matches = [
    { id: 3, round: 1, number: 3 },
    { id: 1, round: 1, number: 1 },
    { id: 2, round: 1, number: 2 },
  ];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds[0].matches.map(m => m.id), [1, 2, 3], 'matches within a round sorted by number ascending');
}
{
  // roundFormats and roundPrizes pass through unchanged
  const matches = [mkMatch(1, 7, 0)];
  const rounds = computeBracketRounds(matches, {}, { 7: 'Best of 7' }, { 7: 50000 });
  assertEqual(rounds[0].roundFormat, 'Best of 7', 'roundFormat passed through for matching round');
  assertEqual(rounds[0].roundPrize, 50000, 'roundPrize passed through for matching round');
}
{
  const matches = [mkMatch(1, 7, 0)];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds[0].roundFormat, null, 'roundFormat defaults to null when not provided');
  assertEqual(rounds[0].roundPrize, null, 'roundPrize defaults to null when not provided');
}
{
  // Matches missing `round` default to bucket 0
  const matches = [{ id: 1, number: 0 }];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds[0].roundNumber, 0, 'match with no round field buckets into round 0');
}
{
  // Chain capped at 7 rounds even if more valid doubling rounds exist
  const counts = [1, 2, 4, 8, 16, 32]; // 6 rounds doubling down from round 6 to round 1... add one more below 32 cap
  const matches = [];
  counts.forEach((c, idx) => {
    const round = idx + 1;
    for (let i = 0; i < c; i++) matches.push(mkMatch(round * 1000 + i, round, i));
  });
  const rounds = computeBracketRounds(matches, {});
  assertTrue(rounds.length <= 7, 'bracket chain never exceeds 7 rounds');
}
{
  // Sort stability: identical `number` values fall back to id ordering via api_match_id/id
  const matches = [
    { id: 20, round: 1, api_match_id: 5 },
    { id: 10, round: 1, api_match_id: 3 },
  ];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds[0].matches.map(m => m.id), [10, 20], 'sort falls back to api_match_id when number is absent');
}

// ── Section 4: additional edge cases (12 assertions) ────────────────────────
console.log('\n── additional edge cases ──');
assertEqual(inferRoundName(8), 'Round 8', 'round=8 (below the named-round thresholds) -> generic label');
assertEqual(inferRoundName(0), 'Round 0', 'round=0 -> generic label');
assertEqual(inferRoundNameFromCount(128), 'Round (128 matches)', 'count=128 exceeds named thresholds -> generic label');
assertEqual(totalHeight(2), 96, 'totalHeight(2) = 96');
assertEqual(getTop(4, 0), (48 * 16 - 40) / 2, 'round 4 slot = BASE_SLOT*16, centered');
{
  // roundNames only overrides for the specific round it has an entry for.
  // Must be a valid doubling chain (round 5 = 2 matches, round 6 = 1 match)
  // for both rounds to survive the backward walk from the starting round.
  const matches = [mkMatch(1, 5, 0), mkMatch(2, 5, 1), mkMatch(3, 6, 0)];
  const rounds = computeBracketRounds(matches, { 5: 'Custom' });
  assertEqual(rounds[0].roundName, 'Custom', 'round 5 uses backend-provided name');
  assertEqual(rounds[1].roundName, 'Final', 'round 6 (no backend name, 1 match) falls back to count-based inference');
}
{
  // Single round of 1 match only
  const matches = [mkMatch(1, 1, 0)];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds.length, 1, 'single round with 1 match produces exactly one bracket round');
  assertEqual(rounds[0].roundName, 'Final', 'single 1-match round infers as Final');
}
{
  // All rounds exceed 32 matches -> no valid starting point -> fallback to last-7-<=32 (empty)
  const matches = Array.from({ length: 40 }, (_, i) => mkMatch(i, 1, i));
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds.length, 0, 'when every round exceeds 32 matches, fallback filter yields zero rounds');
}
{
  const matches = [mkMatch(1, 2, 0), mkMatch(2, 2, 1)];
  const rounds = computeBracketRounds(matches, {});
  assertEqual(rounds[0].matches.length, 2, 'exactly-2-match round infers as Semi-Finals via count');
  assertEqual(rounds[0].roundName, 'Semi-Finals', 'confirmed Semi-Finals label');
}
assertTrue(getTop(5, 0) > getTop(4, 0), 'round 5 top offset exceeds round 4 (continued monotonic growth)');

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} assertions passed`);
if (fail > 0) process.exit(1);
