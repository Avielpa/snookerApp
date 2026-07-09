// championship_league_group_test.mjs — tests for groupChampionshipLeague
// Runs in Node.js, no React. Mirrors the logic in utils/championshipLeagueGroup.ts exactly.

const CHAMPIONSHIP_LEAGUE_GROUP_ID = 'championship-league-group';
const CL_PREFIX = 'championship league';

function isChampionshipLeagueSubEvent(name) {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    return lower.startsWith(CL_PREFIX) && lower.length > CL_PREFIX.length;
}

function isChampionshipLeagueRelated(name) {
    if (!name) return false;
    return name.toLowerCase().trim().startsWith(CL_PREFIX);
}

const LEG_GAP_DAYS = 21;

function clusterIntoLegs(sorted) {
    const legs = [];
    let current = [];
    let lastEnd = null;

    for (const item of sorted) {
        const start = item.StartDate ? new Date(item.StartDate).getTime() : null;
        const end = item.EndDate ? new Date(item.EndDate).getTime() : start;
        if (start === null) continue;
        if (lastEnd !== null && (start - lastEnd) / (1000 * 60 * 60 * 24) > LEG_GAP_DAYS) {
            legs.push(current);
            current = [];
        }
        current.push(item);
        lastEnd = lastEnd === null ? end : Math.max(lastEnd, end ?? start);
    }
    if (current.length) legs.push(current);
    return legs;
}

function legDateRange(leg) {
    const starts = leg.map(t => t.StartDate).filter(Boolean);
    const ends = leg.map(t => t.EndDate).filter(Boolean);
    return {
        start: starts.length ? starts.reduce((a, b) => (new Date(a) < new Date(b) ? a : b)) : null,
        end: ends.length ? ends.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null,
    };
}

function groupChampionshipLeague(tournaments) {
    const clItems = tournaments.filter(t => isChampionshipLeagueSubEvent(t.Name));
    if (clItems.length <= 1) return tournaments;

    const others = tournaments.filter(t => !isChampionshipLeagueRelated(t.Name));

    const children = [...clItems].sort((a, b) => {
        const da = a.StartDate ? new Date(a.StartDate).getTime() : 0;
        const db = b.StartDate ? new Date(b.StartDate).getTime() : 0;
        if (da !== db) return da - db;
        return (a.Name || '').localeCompare(b.Name || '');
    });

    const legs = clusterIntoLegs(children);
    const activeLeg = legs.find(leg => leg.some(t => t.status === 'active'));
    const upcomingLeg = legs.find(leg => leg.some(t => t.status === 'upcoming'));
    const relevantLeg = activeLeg || upcomingLeg || legs[legs.length - 1] || children;
    const { start: legStart, end: legEnd } = legDateRange(relevantLeg);

    const status = children.some(t => t.status === 'active')
        ? 'active'
        : children.some(t => t.status === 'upcoming')
        ? 'upcoming'
        : 'past';

    const groupCard = {
        ID: CHAMPIONSHIP_LEAGUE_GROUP_ID,
        Name: 'Championship League',
        StartDate: legStart,
        EndDate: legEnd,
        status,
        isLive: status === 'active',
        isGroup: true,
        children,
        legCount: legs.length,
    };

    return [...others, groupCard];
}

// ── Test harness ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error(`FAIL: ${message}`);
    }
}

function group(name, start, end, status) {
    return { ID: name.replace(/\s+/g, '-'), Name: name, StartDate: start, EndDate: end, status };
}

// ── Basic non-CL passthrough ────────────────────────────────────────────

{
    const input = [group('World Championship', '2026-04-01', '2026-05-01', 'active')];
    const result = groupChampionshipLeague(input);
    assert(result.length === 1, 'single non-CL tournament: length unchanged');
    assert(result[0].Name === 'World Championship', 'single non-CL tournament: name unchanged');
    assert(!result[0].isGroup, 'single non-CL tournament: not flagged as group');
}

{
    const input = [
        group('World Championship', '2026-04-01', '2026-05-01', 'active'),
        group('UK Championship', '2025-11-01', '2025-12-01', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    assert(result.length === 2, 'two non-CL tournaments: length unchanged');
    assert(result.every(t => !t.isGroup), 'two non-CL tournaments: none flagged as group');
}

// ── Single CL event: no grouping (parent-only or one stage) ────────────────

{
    const input = [
        group('Championship League', '2026-06-22', '2026-07-15', 'active'),
        group('World Championship', '2026-04-01', '2026-05-01', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    assert(result.length === 2, 'bare "Championship League" parent alone: not grouped (no sub-events)');
}

{
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('World Championship', '2026-04-01', '2026-05-01', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    assert(result.length === 2, 'exactly one CL sub-event: not grouped (threshold is >1)');
}

// ── Multiple CL sub-events: grouped into one card ───────────────────────────

{
    const clEvents = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage One Group 2', '2026-06-24', '2026-06-25', 'past'),
        group('Championship League Stage Two Group A', '2026-07-10', '2026-07-15', 'active'),
    ];
    const other = group('World Championship', '2026-04-01', '2026-05-01', 'past');
    const input = [...clEvents, other];
    const result = groupChampionshipLeague(input);

    assert(result.length === 2, 'multiple CL sub-events: collapsed to 1 group + other events');

    const groupCard = result.find(t => t.isGroup);
    assert(!!groupCard, 'multiple CL sub-events: a group card exists');
    assert(groupCard.ID === CHAMPIONSHIP_LEAGUE_GROUP_ID, 'group card has stable synthetic ID');
    assert(groupCard.Name === 'Championship League', 'group card is named "Championship League"');
    assert(groupCard.children.length === 3, 'group card contains all 3 sub-events as children');
    assert(
        groupCard.children.map(c => c.Name).join('|') ===
            'Championship League Stage One Group 1|Championship League Stage One Group 2|Championship League Stage Two Group A',
        'group card children sorted by start date'
    );
    assert(groupCard.StartDate === '2026-06-22', 'group card StartDate = earliest child start');
    assert(groupCard.EndDate === '2026-07-15', 'group card EndDate = latest child end');
    assert(groupCard.status === 'active', 'group card status = active when any child is active');
    assert(groupCard.isLive === true, 'group card isLive true when status active');

    const untouched = result.find(t => t.Name === 'World Championship');
    assert(!!untouched, 'non-CL event passed through untouched');
}

// ── Parent "Championship League" event coexists with sub-events ────────────

{
    const input = [
        group('Championship League', '2026-06-22', '2026-07-15', 'active'),
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage One Group 2', '2026-06-24', '2026-06-25', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    assert(result.length === 1, 'bare parent + sub-events: parent excluded, only group card remains');
    assert(result[0].isGroup, 'result is the group card');
    assert(result[0].children.length === 2, 'group card children exclude the bare parent event');
}

// ── Status aggregation ──────────────────────────────────────────────────────

{
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage One Group 2', '2026-07-20', '2026-07-25', 'upcoming'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);
    assert(groupCard.status === 'upcoming', 'group status = upcoming when no child is active but one is upcoming');
    assert(groupCard.isLive === false, 'group isLive false when status is upcoming');
}

{
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage One Group 2', '2026-06-24', '2026-06-25', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);
    assert(groupCard.status === 'past', 'group status = past when all children are past');
}

// ── Case-insensitivity ──────────────────────────────────────────────────────

{
    const input = [
        group('CHAMPIONSHIP LEAGUE Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('championship league stage one group 2', '2026-06-24', '2026-06-25', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    assert(result.length === 1 && result[0].isGroup, 'grouping is case-insensitive');
    assert(result[0].children.length === 2, 'case-insensitive matches both children');
}

// ── Multi-leg: CL played in separate blocks across a season ────────────────
// (the real bug: CL runs Jun-Jul, then again Dec-Jan — a raw min/max span
// would misleadingly show one continuous 7-month "tournament")

{
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage One Group 2', '2026-06-24', '2026-06-25', 'past'),
        group('Championship League Stage Three Group A', '2026-12-21', '2026-12-22', 'upcoming'),
        group('Championship League Winners Group', '2027-01-05', '2027-01-06', 'upcoming'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);

    assert(groupCard.legCount === 2, 'multi-leg: 4 events across a 6-month gap cluster into 2 legs');
    assert(groupCard.status === 'upcoming', 'multi-leg: status reflects any non-past leg');
    assert(
        groupCard.StartDate === '2026-12-21' && groupCard.EndDate === '2027-01-06',
        'multi-leg: displayed date range is the upcoming leg\'s span, not the full min/max across all legs'
    );
    assert(groupCard.children.length === 4, 'multi-leg: all children still present regardless of leg');
}

{
    // Live leg takes priority for display even if a later leg is also upcoming.
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-07-15', 'active'),
        group('Championship League Winners Group', '2027-01-22', '2027-01-23', 'upcoming'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);
    assert(groupCard.legCount === 2, 'multi-leg with live leg: still counts 2 legs');
    assert(groupCard.status === 'active', 'multi-leg with live leg: status is active');
    assert(
        groupCard.StartDate === '2026-06-22' && groupCard.EndDate === '2026-07-15',
        'multi-leg with live leg: displayed date range is the LIVE leg\'s span, not the future leg'
    );
}

{
    // All legs in the past: falls back to the most recent one.
    const input = [
        group('Championship League Stage One Group 1', '2025-06-22', '2025-06-23', 'past'),
        group('Championship League Winners Group', '2026-01-22', '2026-01-23', 'past'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);
    assert(groupCard.legCount === 2, 'multi-leg all past: still counts 2 legs');
    assert(groupCard.status === 'past', 'multi-leg all past: status is past');
    assert(
        groupCard.StartDate === '2026-01-22' && groupCard.EndDate === '2026-01-23',
        'multi-leg all past: displayed date range is the most recent (last) leg'
    );
}

{
    // Events close together (gap <= 21 days) stay in a single leg.
    const input = [
        group('Championship League Stage One Group 1', '2026-06-22', '2026-06-23', 'past'),
        group('Championship League Stage Two Group A', '2026-07-10', '2026-07-15', 'active'),
    ];
    const result = groupChampionshipLeague(input);
    const groupCard = result.find(t => t.isGroup);
    assert(groupCard.legCount === 1, 'single leg: events within the gap threshold stay together');
    assert(
        groupCard.StartDate === '2026-06-22' && groupCard.EndDate === '2026-07-15',
        'single leg: date range spans the whole (single) leg as before'
    );
}

// ── Empty input ──────────────────────────────────────────────────────────

{
    const result = groupChampionshipLeague([]);
    assert(Array.isArray(result) && result.length === 0, 'empty input returns empty array');
}

// ── Summary ──────────────────────────────────────────────────────────────

console.log(`\n${passed}/${passed + failed} assertions passed`);
if (failed > 0) {
    console.log(`❌ ${failed} assertion(s) failed`);
    process.exit(1);
} else {
    console.log('✅ All assertions passed');
}
