import assert from 'node:assert';

// Inlined copy of computeBreakTimerState from ./hooks/useBreakTimer.ts —
// duplicated here because this machine's Node cannot import TypeScript
// directly (same pattern as frame_timer_test.mjs). Must stay byte-for-byte
// logic-identical to the exported version. See docs/OPEN_MISSIONS.md #13.
function finalizeBreak(prev, input, now) {
  if (prev.startedAt === null) return null;
  const breakValue = Math.max(input.currentBreak, prev.lastKnownBreakValue);
  if (breakValue <= 0) return null;
  return {
    player: prev.player,
    breakValue,
    durationSeconds: Math.floor((now - prev.startedAt) / 1000),
    completedAt: now,
  };
}

function computeBreakTimerState(input, prev, now) {
  if (input.currentPlayer !== prev.player) {
    const completed = finalizeBreak(prev, input, now);
    return {
      player: input.currentPlayer,
      startedAt: input.breakBallsLength > 0 ? now : null,
      frozenElapsedMs: null,
      lastKnownBreakValue: input.currentBreak,
      completedBreak: completed ?? prev.completedBreak,
    };
  }
  if (input.isFrameOver) {
    if (prev.frozenElapsedMs !== null) return prev;
    const completed = finalizeBreak(prev, input, now);
    return {
      ...prev,
      frozenElapsedMs: prev.startedAt !== null ? now - prev.startedAt : 0,
      lastKnownBreakValue: Math.max(input.currentBreak, prev.lastKnownBreakValue),
      completedBreak: completed ?? prev.completedBreak,
    };
  }
  const nextStartedAt = prev.startedAt === null && input.breakBallsLength > 0 ? now : prev.startedAt;
  if (nextStartedAt === prev.startedAt && input.currentBreak === prev.lastKnownBreakValue) return prev;
  return { ...prev, startedAt: nextStartedAt, lastKnownBreakValue: input.currentBreak };
}

const INITIAL = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null };

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('computeBreakTimerState');

test('no pot yet: not running, no start time', () => {
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false },
    INITIAL,
    1000,
  );
  assert.strictEqual(s.startedAt, null);
});

test('first pot starts the timer for player 0', () => {
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 8, breakBallsLength: 1, isFrameOver: false },
    INITIAL,
    1000,
  );
  assert.strictEqual(s.startedAt, 1000);
  assert.strictEqual(s.lastKnownBreakValue, 8);
});

test('same player continuing: startedAt preserved, lastKnownBreakValue tracks currentBreak', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 8, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 16, breakBallsLength: 2, isFrameOver: false },
    prev,
    5000,
  );
  assert.strictEqual(s.startedAt, 1000);
  assert.strictEqual(s.lastKnownBreakValue, 16);
});

test('player switch (normal miss/end-visit): emits completed break for outgoing player', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 24, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false },
    prev,
    9000,
  );
  assert.strictEqual(s.player, 1);
  assert.deepStrictEqual(s.completedBreak, { player: 0, breakValue: 24, durationSeconds: 8, completedAt: 9000 });
  assert.strictEqual(s.startedAt, null, 'incoming player has not potted yet');
});

test('player switch where outgoing player never started (immediate foul, no pot): no event', () => {
  const prev = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false },
    prev,
    2000,
  );
  assert.strictEqual(s.completedBreak, null);
});

test('foul-forced-forfeit: currentBreak reset to 0 in same transition, but Math.max recovers real value', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 40, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: true },
    prev,
    6000,
  );
  assert.strictEqual(s.completedBreak.breakValue, 40, 'must use lastKnownBreakValue, not the reset-to-0 currentBreak');
});

test('frame ends via normal pot-out, same player, currentBreak intact: emits final break', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 100, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 147, breakBallsLength: 15, isFrameOver: true },
    prev,
    6000,
  );
  assert.strictEqual(s.frozenElapsedMs, 5000);
  assert.strictEqual(s.completedBreak.breakValue, 147);
  assert.strictEqual(s.completedBreak.player, 0);
});

test('already frozen: does not re-finalize or duplicate the event', () => {
  const prev = {
    player: 0, startedAt: 1000, frozenElapsedMs: 5000, lastKnownBreakValue: 147,
    completedBreak: { player: 0, breakValue: 147, durationSeconds: 5, completedAt: 6000 },
  };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 147, breakBallsLength: 15, isFrameOver: true },
    prev,
    9000,
  );
  assert.strictEqual(s, prev, 'must return the exact same object, not recompute');
});

test('zero-value break (edge case: started but net value is 0) is never emitted', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false },
    prev,
    2000,
  );
  assert.strictEqual(s.completedBreak, null);
});

test('rapid consecutive breaks: each switch produces its own distinct completedAt/value, not coalesced', () => {
  let state = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null };
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 10, breakBallsLength: 1, isFrameOver: false }, state, 1000);
  state = computeBreakTimerState({ currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false }, state, 3000);
  const firstEvent = state.completedBreak;
  assert.strictEqual(firstEvent.breakValue, 10);
  assert.strictEqual(firstEvent.player, 0);

  state = computeBreakTimerState({ currentPlayer: 1, currentBreak: 5, breakBallsLength: 1, isFrameOver: false }, state, 3500);
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false }, state, 4200);
  const secondEvent = state.completedBreak;
  assert.strictEqual(secondEvent.breakValue, 5);
  assert.strictEqual(secondEvent.player, 1);
  assert.notStrictEqual(firstEvent.completedAt, secondEvent.completedAt);
});

test('an unrelated re-render (no player/break/frame change relevant) never loses the last completedBreak', () => {
  const prev = {
    player: 1, startedAt: 4000, frozenElapsedMs: null, lastKnownBreakValue: 0,
    completedBreak: { player: 0, breakValue: 10, durationSeconds: 2, completedAt: 3000 },
  };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false },
    prev,
    4001,
  );
  assert.strictEqual(s, prev, 'no meaningful change: identity preserved, completedBreak untouched');
});

console.log('shouldSubmitCompletedBreak (safety gate)');

function shouldSubmitCompletedBreak(completedBreak, mePlayerIndex, isTrainMode) {
  if (isTrainMode) return false;
  if (!completedBreak) return false;
  if (completedBreak.breakValue <= 0) return false;
  return completedBreak.player === mePlayerIndex;
}

test('"me" player\'s completed break: submits', () => {
  const cb = { player: 0, breakValue: 40, durationSeconds: 30, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, 0, false), true);
});

test('the OTHER local player\'s completed break: never submits (the exact 2026-09-14 bug class)', () => {
  const cb = { player: 1, breakValue: 60, durationSeconds: 20, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, 0, false), false);
});

test('"me" tagged as player 1 instead: player 1\'s break submits, player 0\'s does not', () => {
  const cbForP1 = { player: 1, breakValue: 40, durationSeconds: 30, completedAt: 1000 };
  const cbForP0 = { player: 0, breakValue: 90, durationSeconds: 10, completedAt: 2000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cbForP1, 1, false), true);
  assert.strictEqual(shouldSubmitCompletedBreak(cbForP0, 1, false), false);
});

test('Train mode: never submits via this path regardless of player/value', () => {
  const cb = { player: 0, breakValue: 100, durationSeconds: 5, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, 0, true), false);
});

test('no completed break yet: never submits', () => {
  assert.strictEqual(shouldSubmitCompletedBreak(null, 0, false), false);
});

test('zero-value completed break: never submits even if it somehow reached here', () => {
  const cb = { player: 0, breakValue: 0, durationSeconds: 30, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, 0, false), false);
});

console.log(`✅ All ${passed} assertions passed`);
