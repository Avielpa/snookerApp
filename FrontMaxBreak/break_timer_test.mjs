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
  if (input.frameNumber !== prev.frameNumber) {
    return {
      player: input.currentPlayer,
      startedAt: input.breakBallsLength > 0 ? now : null,
      frozenElapsedMs: null,
      lastKnownBreakValue: input.currentBreak,
      completedBreak: prev.completedBreak,
      frameNumber: input.frameNumber,
    };
  }
  if (input.currentPlayer !== prev.player) {
    const completed = finalizeBreak(prev, input, now);
    return {
      player: input.currentPlayer,
      startedAt: input.breakBallsLength > 0 ? now : null,
      frozenElapsedMs: null,
      lastKnownBreakValue: input.currentBreak,
      completedBreak: completed ?? prev.completedBreak,
      frameNumber: input.frameNumber,
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

const INITIAL = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null, frameNumber: 1 };

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('computeBreakTimerState');

test('no pot yet: not running, no start time', () => {
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 },
    INITIAL,
    1000,
  );
  assert.strictEqual(s.startedAt, null);
});

test('first pot starts the timer for player 0', () => {
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 8, breakBallsLength: 1, isFrameOver: false, frameNumber: 1 },
    INITIAL,
    1000,
  );
  assert.strictEqual(s.startedAt, 1000);
  assert.strictEqual(s.lastKnownBreakValue, 8);
});

test('same player continuing: startedAt preserved, lastKnownBreakValue tracks currentBreak', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 8, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 16, breakBallsLength: 2, isFrameOver: false, frameNumber: 1 },
    prev,
    5000,
  );
  assert.strictEqual(s.startedAt, 1000);
  assert.strictEqual(s.lastKnownBreakValue, 16);
});

test('player switch (normal miss/end-visit): emits completed break for outgoing player', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 24, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 },
    prev,
    9000,
  );
  assert.strictEqual(s.player, 1);
  assert.deepStrictEqual(s.completedBreak, { player: 0, breakValue: 24, durationSeconds: 8, completedAt: 9000 });
  assert.strictEqual(s.startedAt, null, 'incoming player has not potted yet');
});

test('player switch where outgoing player never started (immediate foul, no pot): no event', () => {
  const prev = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 },
    prev,
    2000,
  );
  assert.strictEqual(s.completedBreak, null);
});

test('foul-forced-forfeit: currentBreak reset to 0 in same transition, but Math.max recovers real value', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 40, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: true, frameNumber: 1 },
    prev,
    6000,
  );
  assert.strictEqual(s.completedBreak.breakValue, 40, 'must use lastKnownBreakValue, not the reset-to-0 currentBreak');
});

test('frame ends via normal pot-out, same player, currentBreak intact: emits final break', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 100, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 147, breakBallsLength: 15, isFrameOver: true, frameNumber: 1 },
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
    completedBreak: { player: 0, breakValue: 147, durationSeconds: 5, completedAt: 6000 }, frameNumber: 1,
  };
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 147, breakBallsLength: 15, isFrameOver: true, frameNumber: 1 },
    prev,
    9000,
  );
  assert.strictEqual(s, prev, 'must return the exact same object, not recompute');
});

test('zero-value break (edge case: started but net value is 0) is never emitted', () => {
  const prev = { player: 0, startedAt: 1000, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null, frameNumber: 1 };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 },
    prev,
    2000,
  );
  assert.strictEqual(s.completedBreak, null);
});

test('rapid consecutive breaks: each switch produces its own distinct completedAt/value, not coalesced', () => {
  let state = { player: 0, startedAt: null, frozenElapsedMs: null, lastKnownBreakValue: 0, completedBreak: null, frameNumber: 1 };
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 10, breakBallsLength: 1, isFrameOver: false, frameNumber: 1 }, state, 1000);
  state = computeBreakTimerState({ currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 }, state, 3000);
  const firstEvent = state.completedBreak;
  assert.strictEqual(firstEvent.breakValue, 10);
  assert.strictEqual(firstEvent.player, 0);

  state = computeBreakTimerState({ currentPlayer: 1, currentBreak: 5, breakBallsLength: 1, isFrameOver: false, frameNumber: 1 }, state, 3500);
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 }, state, 4200);
  const secondEvent = state.completedBreak;
  assert.strictEqual(secondEvent.breakValue, 5);
  assert.strictEqual(secondEvent.player, 1);
  assert.notStrictEqual(firstEvent.completedAt, secondEvent.completedAt);
});

test('an unrelated re-render (no player/break/frame change relevant) never loses the last completedBreak', () => {
  const prev = {
    player: 1, startedAt: 4000, frozenElapsedMs: null, lastKnownBreakValue: 0,
    completedBreak: { player: 0, breakValue: 10, durationSeconds: 2, completedAt: 3000 }, frameNumber: 1,
  };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 1 },
    prev,
    4001,
  );
  assert.strictEqual(s, prev, 'no meaningful change: identity preserved, completedBreak untouched');
});

console.log('computeBreakTimerState — frame-boundary reset (finding I1)');

test('frame boundary, SAME player breaks first in the new frame: resets, does not carry stale frozen time', () => {
  // Frame 1 just ended: player 0 potted out, break frozen at 5000ms with a
  // completedBreak already emitted (mirrors the real flow — the freeze
  // branch runs on the render where isFrameOver first becomes true, well
  // before the user taps "Next Frame" and frameNumber actually increments).
  const prev = {
    player: 0, startedAt: 1000, frozenElapsedMs: 5000, lastKnownBreakValue: 147,
    completedBreak: { player: 0, breakValue: 147, durationSeconds: 5, completedAt: 6000 },
    frameNumber: 1,
  };
  // Frame 2 begins, same player (0) breaks first, hasn't potted anything yet.
  const s = computeBreakTimerState(
    { currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 2 },
    prev,
    20000, // long after the frame-summary dwell time
  );
  assert.strictEqual(s.frameNumber, 2);
  assert.strictEqual(s.startedAt, null, 'not potted yet in the new frame');
  assert.strictEqual(s.frozenElapsedMs, null, 'must not carry the old frame\'s frozen time');
  assert.strictEqual(s.lastKnownBreakValue, 0);
  assert.strictEqual(s.player, 0);
  // The live badge (elapsedMs computation in useBreakTimer) would read 0 here,
  // not the stale 5000ms from frame 1.
});

test('frame boundary, SAME player breaks first and already potted the first ball by the time this fires: starts live from now', () => {
  const prev = {
    player: 1, startedAt: 2000, frozenElapsedMs: 3000, lastKnownBreakValue: 50,
    completedBreak: { player: 1, breakValue: 50, durationSeconds: 3, completedAt: 5000 },
    frameNumber: 3,
  };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 4, breakBallsLength: 1, isFrameOver: false, frameNumber: 4 },
    prev,
    50000,
  );
  assert.strictEqual(s.frameNumber, 4);
  assert.strictEqual(s.startedAt, 50000, 'starts fresh from "now", not inherited from frame 3');
  assert.strictEqual(s.frozenElapsedMs, null);
  assert.strictEqual(s.lastKnownBreakValue, 4);
});

test('frame boundary, DIFFERENT player breaks first in the new frame: still resets cleanly (already worked via player-switch, verifying the frame-boundary check does not break it)', () => {
  const prev = {
    player: 0, startedAt: 1000, frozenElapsedMs: 4000, lastKnownBreakValue: 60,
    completedBreak: { player: 0, breakValue: 60, durationSeconds: 4, completedAt: 5000 },
    frameNumber: 1,
  };
  const s = computeBreakTimerState(
    { currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 2 },
    prev,
    30000,
  );
  assert.strictEqual(s.frameNumber, 2);
  assert.strictEqual(s.player, 1);
  assert.strictEqual(s.startedAt, null);
  assert.strictEqual(s.frozenElapsedMs, null);
  assert.strictEqual(s.lastKnownBreakValue, 0);
  // completedBreak from frame 1 is preserved (not re-finalized, not lost) —
  // it was already finalized by the freeze branch before this transition.
  assert.strictEqual(s.completedBreak, prev.completedBreak);
});

test('frame boundary reset does not inflate the NEXT break\'s eventual submitted duration with anything from the previous frame', () => {
  // Frame boundary at t=20000 (long dwell in frame-summary UI), same player breaks first.
  let state = {
    player: 0, startedAt: 1000, frozenElapsedMs: 5000, lastKnownBreakValue: 147,
    completedBreak: { player: 0, breakValue: 147, durationSeconds: 5, completedAt: 6000 },
    frameNumber: 1,
  };
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 2 }, state, 20000);
  assert.strictEqual(state.startedAt, null);
  // Player pots the first ball of the new break at t=20500.
  state = computeBreakTimerState({ currentPlayer: 0, currentBreak: 4, breakBallsLength: 1, isFrameOver: false, frameNumber: 2 }, state, 20500);
  assert.strictEqual(state.startedAt, 20500, 'break timer starts from the actual first pot of the new frame, not t=1000 from the old frame');
  // Player switches out at t=25500 (5 real seconds into the new break).
  state = computeBreakTimerState({ currentPlayer: 1, currentBreak: 0, breakBallsLength: 0, isFrameOver: false, frameNumber: 2 }, state, 25500);
  assert.strictEqual(state.completedBreak.breakValue, 4);
  assert.strictEqual(state.completedBreak.durationSeconds, 5, 'must be exactly the new break\'s real duration (25500-20500=5000ms), not inflated by the 19s dwell/old-frame time');
});

console.log('shouldSubmitCompletedBreak (safety gate)');

function shouldSubmitCompletedBreak(completedBreak, mePlayerIndex, isTrainMode) {
  if (isTrainMode) return false;
  if (mePlayerIndex === null) return false;
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

console.log('shouldSubmitCompletedBreak — mePlayerIndex: null (finding C1: never confirmed "who am I")');

test('mePlayerIndex null: player 0\'s completed break never submits (picker never touched, or legacy draft with no field at all)', () => {
  const cb = { player: 0, breakValue: 50, durationSeconds: 20, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, null, false), false);
});

test('mePlayerIndex null: player 1\'s completed break never submits either', () => {
  const cb = { player: 1, breakValue: 80, durationSeconds: 20, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, null, false), false);
});

test('mePlayerIndex null combined with Train mode: still never submits (belt and braces)', () => {
  const cb = { player: 0, breakValue: 147, durationSeconds: 60, completedAt: 1000 };
  assert.strictEqual(shouldSubmitCompletedBreak(cb, null, true), false);
});

test('mePlayerIndex null with no completed break: still false, not a crash', () => {
  assert.strictEqual(shouldSubmitCompletedBreak(null, null, false), false);
});

console.log(`✅ All ${passed} assertions passed`);
