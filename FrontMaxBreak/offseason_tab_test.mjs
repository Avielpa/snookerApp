// offseason_tab_test.mjs — tests for the off-season Results tab auto-switch logic
// Runs in Node.js, no React. Mirrors the two useEffect conditions in app/index.tsx exactly.

// ── Inline logic mirrored from app/index.tsx ─────────────────────────────────

/**
 * Decides which tab should be auto-selected given processedListData.
 * Mirrors the two useEffect blocks in HomeScreen:
 *   1. Live auto-switch  (hasAutoSwitchedToLive ref)
 *   2. Results auto-switch (hasAutoSwitchedToResults ref)
 *
 * Returns the final activeFilter value after both effects run once.
 */
function resolveAutoTab(processedListData) {
    let activeFilter = 'upcoming'; // default useState initial value
    let hasAutoSwitchedToLive = false;
    let hasAutoSwitchedToResults = false;

    // Effect 1: auto-switch to live
    if (!hasAutoSwitchedToLive) {
        const hasLive = processedListData.some(
            item => item.type === 'match' && item.matchCategory === 'livePlaying'
        );
        if (hasLive) {
            activeFilter = 'livePlaying';
            hasAutoSwitchedToLive = true;
        }
    }

    // Effect 2: auto-switch to results (off-season)
    if (!hasAutoSwitchedToResults && !hasAutoSwitchedToLive && processedListData.length > 0) {
        const hasActiveMatch = processedListData.some(
            item => item.type === 'match' &&
                (item.matchCategory === 'livePlaying' || item.matchCategory === 'onBreak' || item.matchCategory === 'upcoming')
        );
        const hasFinished = processedListData.some(
            item => item.type === 'match' && item.matchCategory === 'finished'
        );
        if (!hasActiveMatch && hasFinished) {
            activeFilter = 'finished';
            hasAutoSwitchedToResults = true;
        }
    }

    return activeFilter;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMatch(matchCategory) {
    return { type: 'match', matchCategory };
}
function makeHeader(category) {
    return { type: 'statusHeader', id: `statusHeader-${category}`, title: category };
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
    if (condition) {
        passed++;
    } else {
        failed++;
        console.error(`  ❌ FAIL: ${label}`);
    }
}

function section(title) {
    console.log(`\n── ${title}`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

section('Empty data (still loading)');
assert(resolveAutoTab([]) === 'upcoming', 'empty list → stays upcoming');
assert(resolveAutoTab(null ?? []) === 'upcoming', 'null-like empty → stays upcoming');

section('Off-season: only finished matches (Priority 3)');
{
    const data = [
        makeHeader('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'finished', 'all finished → switches to results');
}
{
    const data = [makeMatch('finished')];
    assert(resolveAutoTab(data) === 'finished', 'single finished match → switches to results');
}
{
    const data = [
        makeHeader('finished'),
        ...Array.from({ length: 15 }, () => makeMatch('finished')),
    ];
    assert(resolveAutoTab(data) === 'finished', '15 finished matches (full recent fallback) → results');
}

section('Active tournament: has upcoming matches');
{
    const data = [
        makeHeader('upcoming'),
        makeMatch('upcoming'),
        makeMatch('upcoming'),
        makeHeader('finished'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'upcoming + finished → stays upcoming');
}
{
    const data = [makeMatch('upcoming')];
    assert(resolveAutoTab(data) === 'upcoming', 'single upcoming → stays upcoming');
}
{
    const data = [
        makeMatch('upcoming'),
        makeMatch('upcoming'),
        makeMatch('upcoming'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'all upcoming → stays upcoming');
}

section('Active tournament: has live matches');
{
    const data = [
        makeMatch('livePlaying'),
        makeMatch('upcoming'),
    ];
    assert(resolveAutoTab(data) === 'livePlaying', 'live + upcoming → live wins');
}
{
    const data = [
        makeMatch('livePlaying'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'livePlaying', 'live + finished → live wins (not results)');
}
{
    const data = [makeMatch('livePlaying')];
    assert(resolveAutoTab(data) === 'livePlaying', 'only live → live tab');
}
{
    const data = [
        makeMatch('livePlaying'),
        makeMatch('livePlaying'),
        makeMatch('livePlaying'),
    ];
    assert(resolveAutoTab(data) === 'livePlaying', 'multiple live → live tab');
}

section('Active tournament: on break matches');
{
    const data = [
        makeMatch('onBreak'),
        makeMatch('upcoming'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'onBreak + upcoming → stays upcoming');
}
{
    const data = [
        makeMatch('onBreak'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'onBreak + finished → stays upcoming (onBreak is active)');
}
{
    const data = [makeMatch('onBreak')];
    assert(resolveAutoTab(data) === 'upcoming', 'only onBreak → stays upcoming (active match, not off-season)');
}

section('Live takes priority over results — never both fire');
{
    // If live is present, results effect must be skipped
    const data = [makeMatch('livePlaying'), makeMatch('finished')];
    const result = resolveAutoTab(data);
    assert(result === 'livePlaying', 'live present with finished → live, not results');
    assert(result !== 'finished', 'live present → never switches to finished');
}

section('Mixed: upcoming fallback (Priority 2)');
{
    // Priority 2 produces upcoming matches from a future tournament
    const data = [
        makeHeader('upcoming'),
        makeMatch('upcoming'),
        makeMatch('upcoming'),
        makeMatch('upcoming'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'upcoming-only fallback → stays upcoming');
}

section('Headers only (no match items)');
{
    // processedListData could theoretically have only headers
    const data = [makeHeader('finished'), makeHeader('upcoming')];
    assert(resolveAutoTab(data) === 'upcoming', 'headers without match items → stays upcoming');
}
{
    const data = [makeHeader('finished')];
    assert(resolveAutoTab(data) === 'upcoming', 'finished header but no match items → stays upcoming');
}

section('Off-season with headers interleaved');
{
    const data = [
        makeHeader('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'finished', 'header + 5 finished → results');
}

section('All categories present (full active tournament)');
{
    const data = [
        makeMatch('livePlaying'),
        makeMatch('onBreak'),
        makeMatch('upcoming'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'livePlaying', 'all categories → live wins');
}
{
    // No live, but has upcoming and finished
    const data = [
        makeMatch('onBreak'),
        makeMatch('upcoming'),
        makeMatch('finished'),
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'onBreak+upcoming+finished → stays upcoming');
}

section('Transition: off-season data, then live data arrives (session guard)');
{
    // Simulate: first render with only finished → switches to results.
    // Second render with live added → live switch fires.
    // This confirms live can override results if it arrives late.
    let activeFilter = 'upcoming';
    let hasAutoSwitchedToLive = false;
    let hasAutoSwitchedToResults = false;

    // Render 1: only finished data (off-season)
    const render1 = [makeMatch('finished'), makeMatch('finished')];
    if (!hasAutoSwitchedToLive) {
        const hasLive = render1.some(i => i.type === 'match' && i.matchCategory === 'livePlaying');
        if (hasLive) { activeFilter = 'livePlaying'; hasAutoSwitchedToLive = true; }
    }
    if (!hasAutoSwitchedToResults && !hasAutoSwitchedToLive && render1.length > 0) {
        const hasActive = render1.some(i => i.type === 'match' && (i.matchCategory === 'livePlaying' || i.matchCategory === 'onBreak' || i.matchCategory === 'upcoming'));
        const hasFin = render1.some(i => i.type === 'match' && i.matchCategory === 'finished');
        if (!hasActive && hasFin) { activeFilter = 'finished'; hasAutoSwitchedToResults = true; }
    }
    assert(activeFilter === 'finished', 'render1 off-season → results tab');

    // Render 2: live match arrives (e.g. data refreshed)
    const render2 = [makeMatch('livePlaying'), makeMatch('finished')];
    if (!hasAutoSwitchedToLive) {
        const hasLive = render2.some(i => i.type === 'match' && i.matchCategory === 'livePlaying');
        if (hasLive) { activeFilter = 'livePlaying'; hasAutoSwitchedToLive = true; }
    }
    assert(activeFilter === 'livePlaying', 'render2 live arrives → overrides to live tab');
    assert(hasAutoSwitchedToLive === true, 'live ref set after live detected');
}

section('Session guard: results switch fires only once');
{
    // After hasAutoSwitchedToResults is true, a second render must not re-fire.
    let activeFilter = 'upcoming';
    let hasAutoSwitchedToLive = false;
    let hasAutoSwitchedToResults = false;

    function applyEffects(data) {
        if (!hasAutoSwitchedToLive) {
            const hasLive = data.some(i => i.type === 'match' && i.matchCategory === 'livePlaying');
            if (hasLive) { activeFilter = 'livePlaying'; hasAutoSwitchedToLive = true; }
        }
        if (!hasAutoSwitchedToResults && !hasAutoSwitchedToLive && data.length > 0) {
            const hasActive = data.some(i => i.type === 'match' && (i.matchCategory === 'livePlaying' || i.matchCategory === 'onBreak' || i.matchCategory === 'upcoming'));
            const hasFin = data.some(i => i.type === 'match' && i.matchCategory === 'finished');
            if (!hasActive && hasFin) { activeFilter = 'finished'; hasAutoSwitchedToResults = true; }
        }
    }

    applyEffects([makeMatch('finished')]);
    assert(activeFilter === 'finished', 'first render → results');
    assert(hasAutoSwitchedToResults === true, 'ref set');

    // User manually switches to draw tab
    activeFilter = 'draw';

    // Data re-renders (e.g. focus refresh returns same finished data)
    applyEffects([makeMatch('finished'), makeMatch('finished')]);
    assert(activeFilter === 'draw', 'second render after user changed tab → stays on draw (ref guards re-fire)');
}

section('Session guard: live switch fires only once');
{
    let activeFilter = 'upcoming';
    let hasAutoSwitchedToLive = false;
    let hasAutoSwitchedToResults = false;

    function applyLiveEffect(data) {
        if (!hasAutoSwitchedToLive) {
            const hasLive = data.some(i => i.type === 'match' && i.matchCategory === 'livePlaying');
            if (hasLive) { activeFilter = 'livePlaying'; hasAutoSwitchedToLive = true; }
        }
    }

    applyLiveEffect([makeMatch('livePlaying')]);
    assert(activeFilter === 'livePlaying', 'live detected → live tab');

    activeFilter = 'upcoming'; // user switches back
    applyLiveEffect([makeMatch('livePlaying')]);
    assert(activeFilter === 'upcoming', 'live effect already fired → does not re-override');
}

section('No data at all — stays upcoming');
{
    assert(resolveAutoTab([]) === 'upcoming', 'empty array → upcoming');
}

section('Only non-match items (e.g. only headers)');
{
    const data = [
        { type: 'statusHeader', id: 'statusHeader-finished', title: 'Results' },
        { type: 'roundHeader', roundName: 'Final' },
    ];
    assert(resolveAutoTab(data) === 'upcoming', 'no match items → stays upcoming');
}

section('Finished matches without headers (edge case)');
{
    const data = [makeMatch('finished')];
    assert(resolveAutoTab(data) === 'finished', 'finished match with no header → still switches to results');
}

section('Large off-season dataset');
{
    const data = Array.from({ length: 50 }, () => makeMatch('finished'));
    assert(resolveAutoTab(data) === 'finished', '50 finished matches → results tab');
}

section('Single upcoming match — no results switch');
{
    assert(resolveAutoTab([makeMatch('upcoming')]) === 'upcoming', '1 upcoming → no switch');
}

section('Priority order: live > results > upcoming (default)');
{
    assert(resolveAutoTab([makeMatch('livePlaying')]) === 'livePlaying', 'live alone → live');
    assert(resolveAutoTab([makeMatch('finished')]) === 'finished', 'finished alone → results');
    assert(resolveAutoTab([makeMatch('upcoming')]) === 'upcoming', 'upcoming alone → upcoming');
    assert(resolveAutoTab([makeMatch('onBreak')]) === 'upcoming', 'onBreak alone → upcoming (not results)');
    assert(resolveAutoTab([makeMatch('livePlaying'), makeMatch('finished')]) === 'livePlaying', 'live+finished → live wins');
    assert(resolveAutoTab([makeMatch('upcoming'), makeMatch('finished')]) === 'upcoming', 'upcoming+finished → upcoming wins');
}

// ── Result ────────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
if (failed === 0) {
    console.log(`✅ All ${passed} assertions passed`);
} else {
    console.log(`❌ ${failed} failed, ${passed} passed`);
    process.exit(1);
}
