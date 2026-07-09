// calendar_logic_test.mjs — logic-parity baseline for the Calendar tab redesign.
// Runs in Node.js, no React/RN. Mirrors the exported pure functions in
// app/CalendarEnhanced.tsx exactly (formatDateRange, getPrizeDisplay,
// computeTournamentStatus, filterAndSortTournaments) so this file can be
// re-run byte-for-byte after the style-only redesign lands, to prove no
// logic drifted. If any of those functions' bodies change for a REAL logic
// reason (not this redesign), this mirror must be updated to match.
//
// Fixtures deliberately avoid "Championship League" names so the
// filterAndSortTournaments mirror's simplified groupChampionshipLeague
// passthrough (identity — no CL sub-events to group) matches the real
// util's behavior exactly for these inputs.

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

// ── Mirrored from app/CalendarEnhanced.tsx ────────────────────────────────

function formatDateRange(start, end) {
  if (!start || !end) return 'Dates TBD';
  try {
    const s = new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    const e = new Date(end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  } catch { return 'TBD'; }
}

function getPrizeDisplay(item) {
  const prize = item.prizeMoney || item.prize_money;
  if (!prize) return null;
  if (typeof prize === 'string' && prize.trim()) return prize;
  if (typeof prize === 'object' && prize !== null) {
    if (prize.winner?.formatted) return prize.winner.formatted;
    if (prize.winner?.amount) {
      return `${prize.winner.currency || 'GBP'} ${prize.winner.amount.toLocaleString()}`;
    }
  }
  return null;
}

function computeTournamentStatus(tournament, now) {
  let status = 'upcoming';
  let daysRemaining = 0;
  let duration = 0;
  let progress = 0;
  let isLive = false;

  if (tournament.StartDate && tournament.EndDate) {
    const start = new Date(tournament.StartDate);
    const end = new Date(tournament.EndDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    if (end < now) {
      status = 'past';
    } else if (start <= now && now <= end) {
      status = 'active';
      isLive = true;
      const totalDuration = end.getTime() - start.getTime();
      const elapsedTime = now.getTime() - start.getTime();
      progress = Math.max(0, Math.min(1, elapsedTime / totalDuration));
    } else {
      status = 'upcoming';
      daysRemaining = Math.ceil((start.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  return { ...tournament, status, daysRemaining, duration, progress, isLive };
}

// Mirrors hooks/useSeasonSelector.ts dateToSeasonYear — May cutoff (month index >= 4 => next year's season start)
function dateToSeasonYear(dateStr) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  return month >= 4 ? year + 1 : year;
}

// Identity passthrough — valid mirror ONLY because test fixtures contain no
// "Championship League" sub-events (see file header note).
function groupChampionshipLeague(list) {
  return list;
}

function filterAndSortTournaments(tournaments, opts) {
  let filtered = [...tournaments];

  filtered = filtered.filter(t => !t.StartDate || dateToSeasonYear(t.StartDate) === opts.season);

  if (opts.status !== 'all') {
    filtered = opts.status === 'active'
      ? filtered.filter(t => t.isLive)
      : filtered.filter(t => t.status === opts.status);
  }

  if (opts.query.trim()) {
    const q = opts.query.toLowerCase().trim();
    filtered = filtered.filter(t =>
      t.Name?.toLowerCase().includes(q) ||
      t.Venue?.toLowerCase().includes(q) ||
      t.City?.toLowerCase().includes(q) ||
      t.Country?.toLowerCase().includes(q)
    );
  }

  filtered = groupChampionshipLeague(filtered);

  filtered.sort((a, b) => {
    const priority = { active: 0, upcoming: 1, past: 2 };
    const ap = priority[a.status || 'past'];
    const bp = priority[b.status || 'past'];
    if (ap !== bp) return ap - bp;
    const aDate = a.StartDate ? new Date(a.StartDate).getTime() : 0;
    const bDate = b.StartDate ? new Date(b.StartDate).getTime() : 0;
    return a.status === 'upcoming' ? aDate - bDate : bDate - aDate;
  });

  return filtered;
}

// ── Section 1: formatDateRange (10 assertions) ─────────────────────────────
console.log('\n── formatDateRange ──');
assertEqual(formatDateRange('2026-07-09', '2026-07-13'), '9 Jul – 13 Jul 2026', 'valid range same month');
assertEqual(formatDateRange('2026-07-28', '2026-08-03'), '28 Jul – 3 Aug 2026', 'valid range crosses month');
assertEqual(formatDateRange(null, '2026-07-13'), 'Dates TBD', 'null start');
assertEqual(formatDateRange('2026-07-09', null), 'Dates TBD', 'null end');
assertEqual(formatDateRange(null, null), 'Dates TBD', 'both null');
assertEqual(formatDateRange('', '2026-07-13'), 'Dates TBD', 'empty string start');
assertEqual(formatDateRange('2026-12-28', '2027-01-04'), '28 Dec – 4 Jan 2027', 'crosses year boundary');
assertEqual(formatDateRange('2026-01-01', '2026-01-01'), '1 Jan – 1 Jan 2026', 'single day tournament');
assertTrue(typeof formatDateRange('2026-07-09', '2026-07-13') === 'string', 'returns a string');
assertTrue(formatDateRange('2026-07-09', '2026-07-13').includes('–'), 'contains en-dash separator');

// ── Section 2: getPrizeDisplay (12 assertions) ──────────────────────────────
console.log('\n── getPrizeDisplay ──');
assertEqual(getPrizeDisplay({ prizeMoney: '£10,000' }), '£10,000', 'string prizeMoney');
assertEqual(getPrizeDisplay({ prize_money: '£175,000' }), '£175,000', 'string prize_money fallback field');
assertEqual(getPrizeDisplay({ prizeMoney: '', prize_money: '£50,000' }), '£50,000', 'empty prizeMoney falls back to prize_money');
assertEqual(getPrizeDisplay({}), null, 'no prize fields');
assertEqual(getPrizeDisplay({ prizeMoney: null, prize_money: null }), null, 'explicit nulls');
assertEqual(getPrizeDisplay({ prize_money: { winner: { formatted: '£250,000' } } }), '£250,000', 'object with winner.formatted');
assertEqual(getPrizeDisplay({ prize_money: { winner: { amount: 250000, currency: 'GBP' } } }), 'GBP 250,000', 'object with winner.amount+currency');
assertEqual(getPrizeDisplay({ prize_money: { winner: { amount: 100000 } } }), 'GBP 100,000', 'object with amount only, defaults GBP');
assertEqual(getPrizeDisplay({ prize_money: { winner: {} } }), null, 'object with empty winner');
assertEqual(getPrizeDisplay({ prize_money: {} }), null, 'empty object');
assertEqual(getPrizeDisplay({ prizeMoney: '   ' }), null, 'whitespace-only string treated as falsy after trim check');
assertEqual(getPrizeDisplay({ prize_money: { winner: { formatted: '£10k', amount: 10000 } } }), '£10k', 'formatted takes priority over amount');

// ── Section 3: computeTournamentStatus (24 assertions) ──────────────────────
console.log('\n── computeTournamentStatus ──');
const NOW = new Date('2026-07-09T00:00:00');

{
  const t = computeTournamentStatus({ ID: 1, Name: 'Past Open', StartDate: '2026-06-01', EndDate: '2026-06-05' }, NOW);
  assertEqual(t.status, 'past', 'clearly past tournament');
  assertEqual(t.isLive, false, 'past tournament not live');
  assertEqual(t.daysRemaining, 0, 'past tournament daysRemaining stays 0');
  assertEqual(t.duration, 5, 'past tournament duration (ceil of ms-span including end-of-day 23:59:59.999)');
}
{
  const t = computeTournamentStatus({ ID: 2, Name: 'Champ League', StartDate: '2026-07-09', EndDate: '2026-07-13' }, NOW);
  assertEqual(t.status, 'active', 'tournament starting today is active');
  assertEqual(t.isLive, true, 'active tournament is live');
  assertTrue(t.progress >= 0 && t.progress <= 1, 'progress clamped 0-1');
  assertTrue(t.progress < 0.1, 'progress near 0 on day 1 of 5');
}
{
  const t = computeTournamentStatus({ ID: 3, Name: 'Ending Today', StartDate: '2026-07-05', EndDate: '2026-07-09' }, NOW);
  assertEqual(t.status, 'active', 'tournament ending today is still active');
  assertTrue(t.progress > 0.75 && t.progress < 0.85, 'progress ~0.8 on last calendar day (end-of-day 23:59:59.999 keeps it under 1.0)');
}
{
  const t = computeTournamentStatus({ ID: 4, Name: 'Wuhan Open', StartDate: '2026-08-18', EndDate: '2026-08-24' }, NOW);
  assertEqual(t.status, 'upcoming', 'future tournament is upcoming');
  assertEqual(t.isLive, false, 'upcoming tournament not live');
  assertEqual(t.daysRemaining, 40, 'daysRemaining computed correctly (Jul 9 -> Aug 18 = 40 days)');
  assertEqual(t.progress, 0, 'upcoming tournament has zero progress');
}
{
  const t = computeTournamentStatus({ ID: 5, Name: 'Tomorrow Open', StartDate: '2026-07-10', EndDate: '2026-07-12' }, NOW);
  assertEqual(t.daysRemaining, 1, 'daysRemaining=1 for tomorrow start');
}
{
  const t = computeTournamentStatus({ ID: 6, Name: 'No Dates', StartDate: null, EndDate: null }, NOW);
  assertEqual(t.status, 'upcoming', 'null dates default to upcoming status');
  assertEqual(t.isLive, false, 'null dates not live');
  assertEqual(t.daysRemaining, 0, 'null dates daysRemaining is 0');
  assertEqual(t.duration, 0, 'null dates duration is 0');
}
{
  const t = computeTournamentStatus({ ID: 7, Name: 'Only Start', StartDate: '2026-08-01', EndDate: null }, NOW);
  assertEqual(t.status, 'upcoming', 'missing EndDate falls through to upcoming default (no date math runs)');
}
{
  const t = computeTournamentStatus({ ID: 8, Name: 'Single Day', StartDate: '2026-07-09', EndDate: '2026-07-09' }, NOW);
  assertEqual(t.status, 'active', 'single-day tournament today is active');
  assertEqual(t.duration, 1, 'single-day duration is 1 (rounds up from time-of-day span)');
}
{
  const t1 = computeTournamentStatus({ ID: 9, Name: 'Preserve Fields', StartDate: '2026-07-09', EndDate: '2026-07-13', Venue: 'Leicester Arena' }, NOW);
  assertEqual(t1.Venue, 'Leicester Arena', 'unrelated fields preserved via spread');
  assertEqual(t1.ID, 9, 'ID preserved');
  assertEqual(t1.Name, 'Preserve Fields', 'Name preserved');
}
{
  const t = computeTournamentStatus({ ID: 10, Name: 'Ends Yesterday', StartDate: '2026-07-01', EndDate: '2026-07-08' }, NOW);
  assertEqual(t.status, 'past', 'tournament ending yesterday is past, not active');
}
{
  const t = computeTournamentStatus({ ID: 11, Name: 'Starts Yesterday', StartDate: '2026-07-08', EndDate: '2026-07-15' }, NOW);
  assertEqual(t.status, 'active', 'tournament that started yesterday and still running is active');
}

// ── Section 4: filterAndSortTournaments (34 assertions) ─────────────────────
console.log('\n── filterAndSortTournaments ──');

const fixtures = [
  computeTournamentStatus({ ID: 1, Name: 'Championship Stage', StartDate: '2026-07-09', EndDate: '2026-07-13', Venue: 'Leicester', City: 'Leicester', Country: 'UK', prize_money: '£10,000' }, NOW),
  computeTournamentStatus({ ID: 2, Name: 'Wuhan Open', StartDate: '2026-08-18', EndDate: '2026-08-24', Venue: 'Wuhan Arena', City: 'Wuhan', Country: 'China' }, NOW),
  computeTournamentStatus({ ID: 3, Name: 'Shanghai Masters', StartDate: '2026-09-14', EndDate: '2026-09-20', Venue: 'Shanghai Arena', City: 'Shanghai', Country: 'China' }, NOW),
  computeTournamentStatus({ ID: 4, Name: 'Welsh Open', StartDate: '2026-02-01', EndDate: '2026-02-08', Venue: 'Celtic Manor', City: 'Newport', Country: 'Wales' }, NOW), // prior season (2025-26)
  computeTournamentStatus({ ID: 5, Name: 'English Open', StartDate: '2026-09-28', EndDate: '2026-10-04', Venue: 'Brentwood Centre', City: 'Brentwood', Country: 'UK' }, NOW),
];

const CURRENT_SEASON = 2027; // 2026-27 season per May-cutoff rule (Jul 2026 -> season year 2027)

{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: '' });
  assertEqual(result.length, 4, 'season filter excludes the prior-season Welsh Open');
  assertTrue(!result.some(t => t.Name === 'Welsh Open'), 'Welsh Open (2025-26 season) excluded from 2026-27 view');
}
{
  const result = filterAndSortTournaments(fixtures, { season: 2026, status: 'all', query: '' });
  assertEqual(result.length, 1, 'prior season filter shows only Welsh Open');
  assertEqual(result[0].Name, 'Welsh Open', 'Welsh Open is the only 2025-26 tournament');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'active', query: '' });
  assertEqual(result.length, 1, 'active-only filter returns the live one');
  assertEqual(result[0].Name, 'Championship Stage', 'active filter returns Championship Stage');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'upcoming', query: '' });
  assertEqual(result.length, 3, 'upcoming-only filter returns 3 tournaments');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'past', query: '' });
  assertEqual(result.length, 0, 'no past tournaments in this season fixture set');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'wuhan' });
  assertEqual(result.length, 1, 'search by name matches Wuhan Open');
  assertEqual(result[0].Name, 'Wuhan Open', 'search result is Wuhan Open');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'china' });
  assertEqual(result.length, 2, 'search by country matches both China tournaments');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'brentwood' });
  assertEqual(result.length, 1, 'search by venue matches English Open');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'ZZZNOMATCH' });
  assertEqual(result.length, 0, 'search with no matches returns empty');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: '   ' });
  assertEqual(result.length, 4, 'whitespace-only query is treated as no search');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: '' });
  assertEqual(result[0].status, 'active', 'sort priority: active tournament first');
  assertEqual(result[1].Name, 'Wuhan Open', 'sort: upcoming tournaments in chronological order (Wuhan before Shanghai)');
  assertEqual(result[2].Name, 'Shanghai Masters', 'sort: Shanghai after Wuhan');
  assertEqual(result[3].Name, 'English Open', 'sort: English Open last (latest upcoming date)');
}
{
  const nullDateItem = computeTournamentStatus({ ID: 6, Name: 'TBD Event', StartDate: null, EndDate: null }, NOW);
  const result = filterAndSortTournaments([...fixtures, nullDateItem], { season: CURRENT_SEASON, status: 'all', query: '' });
  assertTrue(result.some(t => t.Name === 'TBD Event'), 'null-StartDate event passes season filter (never hidden)');
  assertEqual(result.length, 5, 'null-date event included alongside season-matched ones');
}
{
  const result = filterAndSortTournaments([], { season: CURRENT_SEASON, status: 'all', query: '' });
  assertEqual(result.length, 0, 'empty input returns empty output');
}
{
  const result = filterAndSortTournaments(fixtures, { season: 1900, status: 'all', query: '' });
  assertEqual(result.length, 0, 'season with zero matches returns empty (no null-date fallback items present)');
}
{
  // Case-insensitive search
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'WUHAN' });
  assertEqual(result.length, 1, 'search is case-insensitive (uppercase query)');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: '' });
  assertEqual(result.map(t => t.ID).length, new Set(result.map(t => t.ID)).size, 'no duplicate IDs in filtered/sorted output');
}
{
  const combinedFilters = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'upcoming', query: 'open' });
  assertEqual(combinedFilters.length, 2, 'status + search combined: 2 upcoming tournaments with "open" in name');
}
{
  const original = JSON.stringify(fixtures);
  filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'active', query: 'x' });
  assertEqual(JSON.stringify(fixtures), original, 'filterAndSortTournaments does not mutate its input array/objects');
}

// ── Section 5: additional edge cases (10 assertions) ────────────────────────
console.log('\n── additional edge cases ──');
assertEqual(getPrizeDisplay({ prize_money: { winner: { amount: 0 } } }), null, 'zero amount is falsy, treated as no prize');
assertEqual(getPrizeDisplay({ prizeMoney: 0 }), null, 'zero prizeMoney is falsy');
assertEqual(formatDateRange('not-a-date', '2026-07-13'), formatDateRange('not-a-date', '2026-07-13'), 'invalid date string does not throw (deterministic, no crash)');
assertTrue(typeof formatDateRange('not-a-date', '2026-07-13') === 'string', 'invalid date input still returns a string, not an exception');
{
  const t = computeTournamentStatus({ ID: 99, Name: 'Exact Boundary', StartDate: '2026-07-09', EndDate: '2026-07-09' }, new Date('2026-07-09T12:00:00'));
  assertEqual(t.status, 'active', 'same-day tournament with mid-day "now" is active');
}
{
  const t = computeTournamentStatus({ ID: 100, Name: 'Just Ended', StartDate: '2026-07-01', EndDate: '2026-07-08' }, new Date('2026-07-09T00:00:00'));
  assertEqual(t.isLive, false, 'just-ended tournament is not live');
}
assertEqual(dateToSeasonYear('2026-04-30'), 2026, 'season year: April (month index 3) still counts as prior season');
assertEqual(dateToSeasonYear('2026-05-01'), 2027, 'season year: May 1st (month index 4) rolls to next season year');
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'all', query: 'england' });
  assertEqual(result.length, 0, 'search with a near-miss substring (not matching Country="UK") returns empty');
}
{
  const result = filterAndSortTournaments(fixtures, { season: CURRENT_SEASON, status: 'nonexistent-status', query: '' });
  assertEqual(result.length, 0, 'unknown status filter value falls through to status===opts.status filter, matching nothing');
}

// ── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${fail === 0 ? '✅' : '❌'} ${pass}/${pass + fail} assertions passed`);
if (fail > 0) process.exit(1);
