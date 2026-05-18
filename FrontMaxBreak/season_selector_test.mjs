// Season Selector Test Suite — pure Node.js, no React
// Run: node season_selector_test.mjs

// ── Inline implementations (mirrors hooks/useSeasonSelector.ts) ──────────────

function dateToSeasonYear(isoDate) {
  const fallback = getCurrentSeasonYear();
  if (!isoDate) return fallback;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return fallback;
  const month = d.getMonth();
  const year = d.getFullYear();
  return month >= 4 ? year : year - 1;
}

function getCurrentSeasonYear() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

function seasonDisplayLabel(year) {
  return `${year}/${String(year + 1).slice(2)}`;
}

function centuriesSeasonParam(year) {
  return `${year}-${String(year + 1).slice(2)}`;
}

function statsSeasonParam(year) {
  return year;
}

// Simulate useSeasonSelector initial value logic (pure, no React state)
function computeInitialSeason(availableSeasons) {
  const current = getCurrentSeasonYear();
  if (availableSeasons.length === 0) return current;
  if (availableSeasons.includes(current)) return current;
  return availableSeasons[0];
}

// Simulate calendar filter pipeline
function filterEventsBySeason(events, selectedSeason) {
  return events.filter(t => !t.StartDate || dateToSeasonYear(t.StartDate) === selectedSeason);
}

// Derive available seasons from events (mirrors CalendarEnhanced useMemo)
function deriveAvailableSeasons(events) {
  const years = [...new Set(
    events
      .filter(t => t.StartDate)
      .map(t => dateToSeasonYear(t.StartDate))
  )].sort((a, b) => b - a);
  return years;
}

// Generate stats season list (mirrors StatsScreen)
function generateStatsSeasons(startYear = 2019) {
  const current = getCurrentSeasonYear();
  return Array.from(
    { length: current - startYear + 1 },
    (_, i) => current - i
  );
}

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function section(title) {
  console.log(`\n── ${title}`);
}

// ── 1. dateToSeasonYear — standard dates ─────────────────────────────────────
section('dateToSeasonYear — standard dates');

assert(dateToSeasonYear('2025-08-15') === 2025, 'Aug 2025 → season 2025');
assert(dateToSeasonYear('2025-09-01') === 2025, 'Sep 2025 → season 2025');
assert(dateToSeasonYear('2025-12-31') === 2025, 'Dec 2025 → season 2025');
assert(dateToSeasonYear('2026-01-01') === 2025, 'Jan 2026 → season 2025 (still 25/26)');
assert(dateToSeasonYear('2026-02-20') === 2025, 'Feb 2026 → season 2025 (still 25/26)');
assert(dateToSeasonYear('2026-03-15') === 2025, 'Mar 2026 → season 2025');
assert(dateToSeasonYear('2026-04-29') === 2025, 'Apr 29 2026 → season 2025');

assert(dateToSeasonYear('2024-08-01') === 2024, 'Aug 2024 → season 2024');
assert(dateToSeasonYear('2025-01-10') === 2024, 'Jan 2025 → season 2024 (still 24/25)');
assert(dateToSeasonYear('2025-04-29') === 2024, 'Apr 29 2025 → season 2024');

// ── 2. dateToSeasonYear — season boundary (April 30 / May 1) ─────────────────
section('dateToSeasonYear — boundary dates');

assert(dateToSeasonYear('2025-04-30') === 2024, 'Apr 30 2025 → season 2024 (last day of 24/25)');
assert(dateToSeasonYear('2025-05-01') === 2025, 'May 1 2025 → season 2025 (first day of 25/26)');
assert(dateToSeasonYear('2026-04-30') === 2025, 'Apr 30 2026 → season 2025');
assert(dateToSeasonYear('2026-05-01') === 2026, 'May 1 2026 → season 2026');
assert(dateToSeasonYear('2024-04-30') === 2023, 'Apr 30 2024 → season 2023');
assert(dateToSeasonYear('2024-05-01') === 2024, 'May 1 2024 → season 2024');

// ── 3. dateToSeasonYear — real snooker events ─────────────────────────────────
section('dateToSeasonYear — real snooker events');

// World Championship (last main-tour event) starts late April
assert(dateToSeasonYear('2025-04-19') === 2024, 'World Champ start Apr 19 2025 → 24/25 season ✓');
assert(dateToSeasonYear('2024-04-20') === 2023, 'World Champ start Apr 20 2024 → 23/24 season ✓');

// Q-School (first qualifying for new season) starts June
assert(dateToSeasonYear('2025-06-10') === 2025, 'Q-School Jun 2025 → 25/26 season ✓');
assert(dateToSeasonYear('2026-06-05') === 2026, 'Q-School Jun 2026 → 26/27 season ✓');

// Women's World Championship (October/November)
assert(dateToSeasonYear('2025-10-15') === 2025, "Women's WC Oct 2025 → 25/26 season ✓");
assert(dateToSeasonYear('2025-11-01') === 2025, "Women's WC Nov 2025 → 25/26 season ✓");

// Seniors events (post-May)
assert(dateToSeasonYear('2025-08-20') === 2025, 'Seniors event Aug 2025 → 25/26 ✓');

// January / February main-tour events (still in same season)
assert(dateToSeasonYear('2026-01-15') === 2025, 'Main tour Jan 2026 → still 25/26 ✓');
assert(dateToSeasonYear('2026-02-08') === 2025, 'Main tour Feb 2026 → still 25/26 ✓');

// Opening event of main tour (August)
assert(dateToSeasonYear('2025-08-05') === 2025, 'Opening event Aug 2025 → 25/26 ✓');

// ── 4. dateToSeasonYear — null / malformed (crash-proof) ──────────────────────
section('dateToSeasonYear — null/malformed inputs (no crash)');

const current = getCurrentSeasonYear();
assert(typeof dateToSeasonYear(null) === 'number',        'null → returns number (no throw)');
assert(typeof dateToSeasonYear(undefined) === 'number',   'undefined → returns number (no throw)');
assert(typeof dateToSeasonYear('') === 'number',          'empty string → returns number (no throw)');
assert(typeof dateToSeasonYear('not-a-date') === 'number','gibberish → returns number (no throw)');
assert(typeof dateToSeasonYear('2025-13-45') === 'number','invalid month/day → returns number (no throw)');
assert(dateToSeasonYear(null) === current,        'null → falls back to currentSeasonYear');
assert(dateToSeasonYear(undefined) === current,   'undefined → falls back to currentSeasonYear');
assert(dateToSeasonYear('') === current,          'empty string → falls back to currentSeasonYear');
assert(dateToSeasonYear('not-a-date') === current,'gibberish → falls back to currentSeasonYear');

// ── 5. getCurrentSeasonYear ───────────────────────────────────────────────────
section('getCurrentSeasonYear');

const seasonYear = getCurrentSeasonYear();
assert(typeof seasonYear === 'number',         'returns a number');
assert(Number.isInteger(seasonYear),            'returns an integer');
assert(seasonYear >= 2025,                      'season year is >= 2025');
assert(seasonYear <= new Date().getFullYear(),  'season year <= current calendar year');
// validate consistency: dateToSeasonYear(today) === getCurrentSeasonYear()
const todayISO = new Date().toISOString().slice(0, 10);
assert(dateToSeasonYear(todayISO) === getCurrentSeasonYear(), "dateToSeasonYear(today) === getCurrentSeasonYear()");

// ── 6. seasonDisplayLabel ─────────────────────────────────────────────────────
section('seasonDisplayLabel');

assert(seasonDisplayLabel(2025) === '2025/26', '2025 → "2025/26"');
assert(seasonDisplayLabel(2024) === '2024/25', '2024 → "2024/25"');
assert(seasonDisplayLabel(2023) === '2023/24', '2023 → "2023/24"');
assert(seasonDisplayLabel(2019) === '2019/20', '2019 → "2019/20"');
assert(seasonDisplayLabel(2029) === '2029/30', '2029 → "2029/30"');
assert(seasonDisplayLabel(2099) === '2099/00', '2099 → "2099/00" (century rollover handled)');
assert(typeof seasonDisplayLabel(2025) === 'string', 'returns a string');
assert(seasonDisplayLabel(2025).includes('/'), 'contains slash separator');

// ── 7. centuriesSeasonParam ───────────────────────────────────────────────────
section('centuriesSeasonParam');

assert(centuriesSeasonParam(2025) === '2025-26', '2025 → "2025-26"');
assert(centuriesSeasonParam(2024) === '2024-25', '2024 → "2024-25"');
assert(centuriesSeasonParam(2019) === '2019-20', '2019 → "2019-20"');
assert(centuriesSeasonParam(2029) === '2029-30', '2029 → "2029-30"');
assert(typeof centuriesSeasonParam(2025) === 'string', 'returns a string');
assert(centuriesSeasonParam(2025).includes('-'), 'uses dash separator (not slash)');
assert(!centuriesSeasonParam(2025).includes('/'), 'does NOT use slash (that would be display format)');
// 2-digit suffix
assert(centuriesSeasonParam(2025).endsWith('26'), 'ends with 2-digit next year');
assert(centuriesSeasonParam(2019).endsWith('20'), 'ends with 2-digit next year (boundary)');

// ── 8. statsSeasonParam ───────────────────────────────────────────────────────
section('statsSeasonParam');

assert(statsSeasonParam(2025) === 2025, '2025 → 2025 (integer identity)');
assert(statsSeasonParam(2019) === 2019, '2019 → 2019');
assert(typeof statsSeasonParam(2025) === 'number', 'returns a number');
assert(Number.isInteger(statsSeasonParam(2025)), 'returns an integer');

// ── 9. computeInitialSeason (useSeasonSelector logic) ────────────────────────
section('computeInitialSeason — default season selection');

assert(computeInitialSeason([]) === getCurrentSeasonYear(),
  'empty seasons array → defaults to getCurrentSeasonYear()');
assert(computeInitialSeason([2025, 2024, 2023]) === (
  [2025, 2024, 2023].includes(getCurrentSeasonYear()) ? getCurrentSeasonYear() : 2025
), 'current season present in list → selects current season');
assert(computeInitialSeason([2024, 2023]) === (
  [2024, 2023].includes(getCurrentSeasonYear()) ? getCurrentSeasonYear() : 2024
), 'current season absent → falls back to first (newest) in list');
assert(computeInitialSeason([2025]) === (
  getCurrentSeasonYear() === 2025 ? 2025 : 2025
), 'single-season list → returns that season');
assert(typeof computeInitialSeason([2025, 2024]) === 'number', 'returns a number');

// ── 10. deriveAvailableSeasons from events ────────────────────────────────────
section('deriveAvailableSeasons — from events array');

const events_mixed = [
  { StartDate: '2025-08-10' },  // 2025
  { StartDate: '2026-01-15' },  // 2025 (same season)
  { StartDate: '2024-09-01' },  // 2024
  { StartDate: '2025-04-19' },  // 2024 (World Champ)
];
const derived1 = deriveAvailableSeasons(events_mixed);
assert(derived1.length === 2,        'mixed events → 2 unique seasons');
assert(derived1[0] === 2025,         'newest season first (2025)');
assert(derived1[1] === 2024,         'older season second (2024)');
assert(!derived1.includes(2026),     'no spurious 2026 year');

const events_all_null = [
  { StartDate: null },
  { StartDate: null },
];
const derived2 = deriveAvailableSeasons(events_all_null);
assert(derived2.length === 0, 'all-null StartDates → empty available seasons');

const events_empty = [];
const derived3 = deriveAvailableSeasons(events_empty);
assert(derived3.length === 0, 'empty events array → empty available seasons');

const events_single_season = [
  { StartDate: '2025-08-01' },
  { StartDate: '2025-11-15' },
  { StartDate: '2026-02-10' },
];
const derived4 = deriveAvailableSeasons(events_single_season);
assert(derived4.length === 1,    'all events same season → 1 unique season');
assert(derived4[0] === 2025,     'single season is 2025');

// Q-School and Women's events correctly bucketed
const events_cross_tour = [
  { StartDate: '2025-06-10' },  // Q-School → 2025
  { StartDate: '2025-10-15' },  // Women's WC → 2025
  { StartDate: '2025-04-19' },  // World Champ → 2024
];
const derived5 = deriveAvailableSeasons(events_cross_tour);
assert(derived5.includes(2025), 'cross-tour: season 2025 present');
assert(derived5.includes(2024), 'cross-tour: season 2024 present');
assert(derived5.length === 2,   'cross-tour: exactly 2 seasons');

// ── 11. filterEventsBySeason ──────────────────────────────────────────────────
section('filterEventsBySeason — calendar filter pipeline');

const allEvents = [
  { StartDate: '2025-08-10', Name: 'Event A' },   // season 2025
  { StartDate: '2026-01-15', Name: 'Event B' },   // season 2025
  { StartDate: '2025-04-19', Name: 'Event C' },   // season 2024 (World Champ)
  { StartDate: '2024-09-01', Name: 'Event D' },   // season 2024
  { StartDate: null,          Name: 'Event E' },   // null → passes through
];

const filtered2025 = filterEventsBySeason(allEvents, 2025);
assert(filtered2025.some(e => e.Name === 'Event A'), 'Event A (Aug 2025) included in 2025 filter');
assert(filtered2025.some(e => e.Name === 'Event B'), 'Event B (Jan 2026) included in 2025 filter');
assert(!filtered2025.some(e => e.Name === 'Event C'), 'Event C (Apr 2025, World Champ) excluded from 2025 filter');
assert(!filtered2025.some(e => e.Name === 'Event D'), 'Event D (Sep 2024) excluded from 2025 filter');
assert(filtered2025.some(e => e.Name === 'Event E'), 'Event E (null date) passes through filter (not hidden)');

const filtered2024 = filterEventsBySeason(allEvents, 2024);
assert(!filtered2024.some(e => e.Name === 'Event A'), 'Event A excluded from 2024 filter');
assert(filtered2024.some(e => e.Name === 'Event C'), 'Event C (World Champ) included in 2024 filter');
assert(filtered2024.some(e => e.Name === 'Event D'), 'Event D included in 2024 filter');
assert(filtered2024.some(e => e.Name === 'Event E'), 'Event E (null date) passes through 2024 filter too');

// Empty result — no crash
const filteredFuture = filterEventsBySeason(allEvents, 2030);
assert(Array.isArray(filteredFuture),   'future season filter → returns array (no crash)');
assert(filteredFuture.length === 1,     'future season filter → only null-date event passes through');
assert(filteredFuture[0].Name === 'Event E', 'only null-date event survives future season filter');

// All-null events
const nullEvents = [{ StartDate: null }, { StartDate: null }];
const filteredNull = filterEventsBySeason(nullEvents, 2025);
assert(filteredNull.length === 2, 'all-null StartDate events → all pass through any season filter');

// ── 12. generateStatsSeasons ──────────────────────────────────────────────────
section('generateStatsSeasons — stats screen season list');

const statsSeasons = generateStatsSeasons(2019);
assert(Array.isArray(statsSeasons),            'returns an array');
assert(statsSeasons.length >= 1,               'at least 1 season');
assert(statsSeasons[0] === getCurrentSeasonYear(), 'first entry is current season (newest first)');
assert(statsSeasons.includes(2019),            'includes 2019');
assert(statsSeasons.includes(getCurrentSeasonYear()), 'includes current season');
// sorted newest first
for (let i = 0; i < statsSeasons.length - 1; i++) {
  assert(statsSeasons[i] > statsSeasons[i + 1], `statsSeasons[${i}] > statsSeasons[${i + 1}] (newest first)`);
}
assert(statsSeasons.every(y => Number.isInteger(y)), 'all entries are integers');
assert(statsSeasons.every(y => y >= 2019 && y <= 2100), 'all entries in plausible year range');

// ── 13. SeasonPicker display logic (pure) ────────────────────────────────────
section('SeasonPicker — display logic (pure)');

// Display year when seasons list is non-empty
function pickerDisplayYear(seasons, selected) {
  return seasons.length > 0 ? selected : getCurrentSeasonYear();
}
assert(pickerDisplayYear([2025, 2024], 2025) === 2025, 'non-empty list → shows selected year');
assert(pickerDisplayYear([2025, 2024], 2024) === 2024, 'non-empty list → shows 2024');
assert(pickerDisplayYear([], 2025) === getCurrentSeasonYear(), 'empty list → shows current year (no crash)');

// canOpen guard
function canOpen(seasons) { return seasons.length > 0; }
assert(canOpen([2025, 2024]) === true,  'non-empty seasons → picker is openable');
assert(canOpen([2025]) === true,        'single season → picker is openable');
assert(canOpen([]) === false,           'empty seasons → picker is NOT openable (prevents empty modal crash)');

// ── 14. Cross-tour season consistency ────────────────────────────────────────
section('Cross-tour — Main and Others tab events bucketed identically');

const mainTourEvents = [
  { StartDate: '2025-08-05', Name: 'Tour Championship' },  // 2025
  { StartDate: '2025-04-19', Name: 'World Championship' }, // 2024
];
const otherTourEvents = [
  { StartDate: '2025-06-10', Name: 'Q-School' },          // 2025
  { StartDate: '2025-10-15', Name: "Women's WC" },        // 2025
  { StartDate: '2025-08-20', Name: 'Seniors Masters' },   // 2025
];

const mainIn2025 = filterEventsBySeason(mainTourEvents, 2025);
const otherIn2025 = filterEventsBySeason(otherTourEvents, 2025);

assert(mainIn2025.some(e => e.Name === 'Tour Championship'),    'Main: Tour Championship in 2025 ✓');
assert(!mainIn2025.some(e => e.Name === 'World Championship'),  'Main: World Champ NOT in 2025 (it\'s 24/25) ✓');
assert(otherIn2025.some(e => e.Name === 'Q-School'),            'Others: Q-School in 2025 ✓');
assert(otherIn2025.some(e => e.Name === "Women's WC"),          'Others: Women\'s WC in 2025 ✓');
assert(otherIn2025.some(e => e.Name === 'Seniors Masters'),     'Others: Seniors Masters in 2025 ✓');

const mainIn2024 = filterEventsBySeason(mainTourEvents, 2024);
assert(mainIn2024.some(e => e.Name === 'World Championship'),   'Main: World Champ in 2024 (24/25) ✓');

// ── 15. Edge cases — extreme / unusual dates ──────────────────────────────────
section('Edge cases — unusual dates');

assert(dateToSeasonYear('2020-05-01') === 2020, '2020 May 1 → season 2020');
assert(dateToSeasonYear('2019-04-30') === 2018, '2019 Apr 30 → season 2018');
assert(dateToSeasonYear('2030-12-31') === 2030, '2030 Dec 31 → season 2030');
assert(dateToSeasonYear('2025-05-31') === 2025, 'May 31 → season 2025 (still new season)');
assert(typeof dateToSeasonYear('2025-13-01') === 'number', 'invalid month 13 → no crash');

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ All ${passed} assertions passed`);
} else {
  console.log(`❌ ${failed} assertion(s) FAILED — ${passed} passed`);
  process.exit(1);
}
