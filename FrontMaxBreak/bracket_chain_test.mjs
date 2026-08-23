// bracket_chain_test.mjs — logic-parity baseline for app/tour/utils/bracketChain.ts.
// Runs in Node.js, no React/RN. Mirrors the exported pure functions
// (representativeDateMs is internal, inlined here) exactly, so this file
// can be re-run after any future change to bracketChain.ts to prove the
// knockout-chain inference didn't regress.
//
// Covers the real bug this file fixes: China Open's Wild Card Round
// (round 16, 2 matches, played BEFORE the main draw) was being mistaken
// for the Final in the Results tab (duplicate "Final" header) and for the
// Semi-Finals in the Draw tab bracket (dropping the real Final/SF).

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

// ── Mirrored from app/tour/utils/bracketChain.ts ────────────────────────────

const MAX_CHAIN_DEPTH = 7;

function representativeDateMs(matches) {
  const times = matches
    .map((m) => {
      const raw = m.scheduled_date || m.start_date || m.end_date;
      if (!raw) return null;
      const t = new Date(raw).getTime();
      return isNaN(t) ? null : t;
    })
    .filter((t) => t !== null);
  if (times.length === 0) return 0;
  return Math.min(...times);
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

function computeKnockoutChain(matches) {
  const byRound = new Map();
  matches.forEach((m) => {
    const r = m.round;
    if (r === null || r === undefined) return;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r).push(m);
  });

  const rounds = Array.from(byRound.keys());
  if (rounds.length === 0) return new Map();

  const MAX_ANCHOR_COUNT = 32;
  let anchor = null;
  let anchorCount = Infinity;
  let anchorDate = -Infinity;
  for (const r of rounds) {
    const ms = byRound.get(r);
    const count = ms.length;
    if (count === 0 || count > MAX_ANCHOR_COUNT) continue;
    const date = representativeDateMs(ms);
    if (count < anchorCount || (count === anchorCount && date > anchorDate)) {
      anchor = r;
      anchorCount = count;
      anchorDate = date;
    }
  }
  if (anchor === null) return new Map();

  const chain = [anchor];
  const used = new Set([anchor]);
  let neededCount = anchorCount * 2;
  let earliestDateInChain = anchorDate;

  while (chain.length < MAX_CHAIN_DEPTH) {
    let bestBefore = null;
    let bestAfter = null;

    for (const r of rounds) {
      if (used.has(r)) continue;
      const ms = byRound.get(r);
      if (ms.length !== neededCount) continue;
      const date = representativeDateMs(ms);
      const diff = earliestDateInChain - date;
      if (diff >= 0) {
        if (!bestBefore || diff < bestBefore.diff) bestBefore = { r, date, diff };
      } else {
        const absDiff = -diff;
        if (!bestAfter || absDiff < bestAfter.diff) bestAfter = { r, date, diff: absDiff };
      }
    }

    const chosen = bestBefore ?? bestAfter;
    if (!chosen) break;

    chain.unshift(chosen.r);
    used.add(chosen.r);
    earliestDateInChain = chosen.date;
    neededCount *= 2;
  }

  const result = new Map();
  chain.forEach((r, idx) => {
    result.set(r, { roundNumber: r, matchCount: byRound.get(r).length, chainIndex: idx });
  });
  return result;
}

function computeKnockoutChainsByEvent(matches) {
  const byEvent = new Map();
  matches.forEach((m) => {
    const key = String(m.event_id ?? 'unknown');
    if (!byEvent.has(key)) byEvent.set(key, []);
    byEvent.get(key).push(m);
  });

  const result = new Map();
  byEvent.forEach((eventMatches, eventKey) => {
    const chain = computeKnockoutChain(eventMatches);
    chain.forEach((round, roundNumber) => {
      result.set(`${eventKey}:${roundNumber}`, round);
    });
  });
  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────
function mkMatch(id, round, opts = {}) {
  return { id, round, number: opts.number ?? id, scheduled_date: opts.date ?? null, event_id: opts.eventId ?? null };
}

function chainRoundNumbers(chain) {
  return Array.from(chain.values()).sort((a, b) => a.chainIndex - b.chainIndex).map((c) => c.roundNumber);
}

// ── Section 1: inferRoundNameFromCount (10 assertions) ──────────────────────
console.log('\n── inferRoundNameFromCount ──');
assertEqual(inferRoundNameFromCount(1), 'Final', 'count=1 -> Final');
assertEqual(inferRoundNameFromCount(2), 'Semi-Finals', 'count=2 -> Semi-Finals');
assertEqual(inferRoundNameFromCount(4), 'Quarter-Finals', 'count=4 -> Quarter-Finals');
assertEqual(inferRoundNameFromCount(8), 'Last 16', 'count=8 -> Last 16');
assertEqual(inferRoundNameFromCount(16), 'Last 32', 'count=16 -> Last 32');
assertEqual(inferRoundNameFromCount(32), 'Last 64', 'count=32 -> Last 64');
assertEqual(inferRoundNameFromCount(64), 'Last 128', 'count=64 -> Last 128');
assertEqual(inferRoundNameFromCount(3), 'Round (3 matches)', 'non-power-of-2 count -> generic label');
assertEqual(inferRoundNameFromCount(0), 'Round (0 matches)', 'count=0 -> generic label');
assertEqual(inferRoundNameFromCount(128), 'Round (128 matches)', 'count exceeding named thresholds -> generic label');

// ── Section 2: the real reported bug — China Open shape (10 assertions) ─────
console.log('\n── China Open regression (Wild Card Round numbered above the Final) ──');
{
  // Real shape from production DB: round 7=R1(16), 8=R2(8), 13=QF(4), 14=SF(2),
  // 15=Final(1), 16=Wild Card Round(2, played BEFORE round 7).
  const matches = [
    ...Array.from({ length: 16 }, (_, i) => mkMatch(700 + i, 7, { date: '2026-08-08T06:00:00Z' })),
    ...Array.from({ length: 8 }, (_, i) => mkMatch(800 + i, 8, { date: '2026-08-10T10:00:00Z' })),
    ...Array.from({ length: 4 }, (_, i) => mkMatch(1300 + i, 13, { date: '2026-08-12T10:00:00Z' })),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(1400 + i, 14, { date: '2026-08-15T10:00:00Z' })),
    mkMatch(1500, 15, { date: '2026-08-16T11:30:00Z' }),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(1600 + i, 16, { date: '2026-08-08T01:30:00Z' })),
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [7, 8, 13, 14, 15], 'chain is exactly the real knockout rounds, ascending by depth');
  assertTrue(!chain.has(16), 'Wild Card Round (16) is excluded from the chain entirely');
  assertEqual(chain.get(15).matchCount, 1, 'Final (round 15) has 1 match');
  assertEqual(inferRoundNameFromCount(chain.get(15).matchCount), 'Final', 'round 15 labels as Final');
  assertEqual(chain.get(14).matchCount, 2, 'Semi-Finals (round 14) has 2 matches');
  assertEqual(inferRoundNameFromCount(chain.get(14).matchCount), 'Semi-Finals', 'round 14 labels as Semi-Finals, not round 16');
  assertEqual(chain.get(7).chainIndex, 0, 'round 7 (Round 1) is chain index 0 (earliest)');
  assertEqual(chain.get(15).chainIndex, 4, 'round 15 (Final) is the last chain index (depth 5, index 4)');
  assertTrue(chain.size === 5, 'exactly 5 rounds in the chain — Wild Card never counted');
  // The critical disambiguation: round 14 (real SF) and round 16 (Wild Card)
  // both have exactly 2 matches — only chronology correctly picks round 14.
  assertTrue(chain.get(14) !== undefined && !chain.has(16), 'count-tie between real SF and Wild Card resolved correctly via date');
}

// ── Section 3: computeKnockoutChain edge cases (18 assertions) ──────────────
console.log('\n── computeKnockoutChain edge cases ──');
{
  // Standard tournament, no extra rounds — must behave identically to a
  // plain doubling chain (regression check).
  const matches = [
    ...Array.from({ length: 8 }, (_, i) => mkMatch(100 + i, 1, { date: `2026-01-0${i % 9 + 1}` })),
    ...Array.from({ length: 4 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-05' })),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(300 + i, 3, { date: '2026-01-06' })),
    mkMatch(400, 4, { date: '2026-01-07' }),
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [1, 2, 3, 4], 'standard 4-round tournament chains correctly, no extra rounds');
}
{
  // Empty input
  const chain = computeKnockoutChain([]);
  assertEqual(chain.size, 0, 'empty matches array produces an empty chain');
}
{
  // Live/ongoing tournament: Final + SF placeholders already exist (TBD vs
  // TBD, no scores) even though only R1 has actually been played.
  const matches = [
    ...Array.from({ length: 4 }, (_, i) => mkMatch(100 + i, 1, { date: '2026-01-01' })),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-03' })),
    mkMatch(300, 3, { date: '2026-01-05' }), // Final placeholder, TBD vs TBD, unplayed
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [1, 2, 3], 'anchor selection works even when the Final is an unplayed placeholder');
}
{
  // No round has exactly 1 match yet (very early in the tournament, Final
  // row not generated) — chain builder must degrade gracefully, not throw.
  const matches = [
    ...Array.from({ length: 8 }, (_, i) => mkMatch(100 + i, 1, { date: '2026-01-01' })),
    ...Array.from({ length: 4 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-03' })),
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [1, 2], 'no 1-match round yet: anchors on the smallest available round instead, chain builds from there');
}
{
  // Bye: round 2 has 3 matches instead of the required 4 — walk stops
  // extending backward from round 3, chain stays short (no crash).
  const matches = [
    ...Array.from({ length: 8 }, (_, i) => mkMatch(100 + i, 1, { date: '2026-01-01' })),
    ...Array.from({ length: 3 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-03' })), // broken: should be 4
    mkMatch(300, 3, { date: '2026-01-05' }),
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [3], 'a bye/broken doubling count stops the backward walk cleanly, no crash');
}
{
  // Missing/null date fields on some matches — must not crash, falls back
  // to representative date 0 for those matches.
  const matches = [
    { id: 1, round: 1 }, // no date fields at all
    { id: 2, round: 2, scheduled_date: null, start_date: null, end_date: null },
  ];
  const chain = computeKnockoutChain(matches);
  assertTrue(chain.size >= 0, 'missing date fields on all matches does not throw');
}
{
  // Round-robin / group stage (no valid doubling chain at all): every round
  // has a different, non-doubling count — chain degrades to just the anchor.
  const matches = [
    ...Array.from({ length: 5 }, (_, i) => mkMatch(100 + i, 1, { date: '2026-01-01' })),
    ...Array.from({ length: 3 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-03' })),
    mkMatch(300, 3, { date: '2026-01-05' }),
  ];
  const chain = computeKnockoutChain(matches);
  assertEqual(chainRoundNumbers(chain), [3], 'round-robin shape with no valid doubling neighbour collapses to just the anchor round');
}
{
  // Chain capped at 7 rounds even with more valid doubling rounds available.
  const counts = [64, 32, 16, 8, 4, 2, 1, 1]; // 8 "valid" steps if uncapped (note: two round-1-match rounds can't both chain, so build a real 8-deep doubling instead)
  const matches = [];
  [128, 64, 32, 16, 8, 4, 2, 1].forEach((c, idx) => {
    const round = idx + 1;
    for (let i = 0; i < c; i++) matches.push(mkMatch(round * 10000 + i, round, { date: `2026-01-${String(idx + 1).padStart(2, '0')}` }));
  });
  const chain = computeKnockoutChain(matches);
  assertTrue(chain.size <= MAX_CHAIN_DEPTH, 'chain never exceeds the 7-round depth cap even with 8 valid doubling rounds available');
}
{
  // A single oversized round (40 matches, no other rounds at all) must
  // never be treated as a 1-round "chain" — 40 matches can never
  // plausibly be a Final. The ≤32 anchor guard (mirrors the old
  // round-number-scanning algorithm's own starting-point cap) must
  // reject it, yielding an empty chain, not a bogus single-round bracket.
  const matches = Array.from({ length: 40 }, (_, i) => mkMatch(i, 1, { date: '2026-01-01' }));
  const chain = computeKnockoutChain(matches);
  assertEqual(chain.size, 0, 'a single round exceeding 32 matches is never chosen as anchor — empty chain, not a false 1-round bracket');
}
{
  // Two separate 1-match rounds tied for anchor (unusual but possible) —
  // date tiebreak picks the later one as the true Final.
  const matches = [
    mkMatch(1, 5, { date: '2026-01-01' }), // an isolated single match, e.g. a dead qualifier
    mkMatch(2, 6, { date: '2026-01-10' }), // the real Final
  ];
  const chain = computeKnockoutChain(matches);
  assertTrue(chain.has(6) && chain.get(6).chainIndex === 0, 'when two 1-match rounds tie on count, the chronologically later one is chosen as anchor');
}

// ── Section 4: computeKnockoutChainsByEvent (8 assertions) ──────────────────
console.log('\n── computeKnockoutChainsByEvent (multi-event Home feed) ──');
{
  // Two concurrent events reusing the same round numbers, with DIFFERENT
  // shapes — proves matches are grouped per-event before chaining, not
  // merged across events (which would corrupt the doubling-count check).
  const matches = [
    ...Array.from({ length: 2 }, (_, i) => mkMatch(100 + i, 14, { date: '2026-01-01', eventId: 1 })),
    mkMatch(150, 15, { date: '2026-01-02', eventId: 1 }),
    // Event 2's round 14 has 4 matches (doesn't double from its own round
    // 15's count of 1) — if event grouping were broken and this merged
    // with event 1's round-14 data, it could wrongly appear to chain.
    ...Array.from({ length: 4 }, (_, i) => mkMatch(200 + i, 14, { date: '2026-02-01', eventId: 2 })),
    mkMatch(250, 15, { date: '2026-02-02', eventId: 2 }),
  ];
  const chains = computeKnockoutChainsByEvent(matches);
  assertEqual(chains.get('1:14').matchCount, 2, 'event 1 round 14 correctly has 2 matches and joins its own chain');
  assertEqual(chains.get('1:15').matchCount, 1, 'event 1 round 15 (Final) correct');
  assertEqual(chains.get('2:15').matchCount, 1, 'event 2 round 15 (Final) correct');
  assertTrue(chains.get('2:14') === undefined, "event 2's round 14 (4 matches, non-doubling) is correctly excluded — no cross-event contamination from event 1's round 14");
}
{
  // Matches with no event_id at all group under 'unknown' without crashing.
  const matches = [mkMatch(1, 1, {}), mkMatch(2, 1, {})];
  const chains = computeKnockoutChainsByEvent(matches);
  assertEqual(chains.get('unknown:1').matchCount, 2, 'matches with no event_id group under the "unknown" bucket');
}
{
  const chains = computeKnockoutChainsByEvent([]);
  assertEqual(chains.size, 0, 'empty input produces an empty map');
}
{
  // Single event still works the same as computeKnockoutChain directly.
  const matches = [
    ...Array.from({ length: 4 }, (_, i) => mkMatch(100 + i, 1, { date: '2026-01-01', eventId: 9 })),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(200 + i, 2, { date: '2026-01-03', eventId: 9 })),
    mkMatch(300, 3, { date: '2026-01-05', eventId: 9 }),
  ];
  const chains = computeKnockoutChainsByEvent(matches);
  assertTrue(chains.has('9:1') && chains.has('9:2') && chains.has('9:3'), 'single-event input produces the full chain keyed by event');
}

function sequentialRoundName(chainIndex) {
  return `Round ${chainIndex + 1}`;
}

function buildSequentialRoundLabels(matches) {
  const chain = computeKnockoutChain(matches);
  const labels = new Map();
  const ordered = Array.from(chain.values()).sort((a, b) => a.chainIndex - b.chainIndex);
  ordered.forEach((entry, index) => {
    labels.set(entry.roundNumber, sequentialRoundName(index));
  });
  const leftover = [...new Set(matches.map((m) => m.round).filter((r) => r != null && !labels.has(r)))].sort((a, b) => a - b);
  leftover.forEach((roundNumber, index) => {
    labels.set(roundNumber, sequentialRoundName(ordered.length + index));
  });
  return labels;
}

console.log('\n── sequential Round 1..N labels ──');
{
  const matches = [
    ...Array.from({ length: 32 }, (_, i) => mkMatch(i, 7, { date: '2026-08-23' })),
    ...Array.from({ length: 16 }, (_, i) => mkMatch(100 + i, 8, { date: '2026-08-25' })),
    ...Array.from({ length: 8 }, (_, i) => mkMatch(200 + i, 9, { date: '2026-08-27' })),
    ...Array.from({ length: 4 }, (_, i) => mkMatch(300 + i, 13, { date: '2026-08-28' })),
    ...Array.from({ length: 2 }, (_, i) => mkMatch(400 + i, 14, { date: '2026-08-29' })),
    mkMatch(500, 15, { date: '2026-08-30' }),
  ];
  const labels = buildSequentialRoundLabels(matches);
  assertEqual(labels.get(7), 'Round 1', 'last-64 stage is Round 1');
  assertEqual(labels.get(8), 'Round 2', 'last-32 stage is Round 2');
  assertEqual(labels.get(9), 'Round 3', 'last-16 stage is Round 3');
  assertEqual(labels.get(13), 'Round 4', 'quarter-final stage is Round 4');
  assertEqual(labels.get(14), 'Round 5', 'semi-final stage is Round 5');
  assertEqual(labels.get(15), 'Round 6', 'final stage is Round 6');
}
assertEqual(sequentialRoundName(0), 'Round 1', 'index 0 -> Round 1');

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} assertions passed`);
if (fail > 0) process.exit(1);
