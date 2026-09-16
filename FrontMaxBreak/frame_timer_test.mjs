import assert from 'node:assert';

// Inlined copy of computeFrameTimerState from ./hooks/useFrameTimer.ts —
// duplicated here because this machine's Node (v20.18.0) cannot import
// TypeScript directly. Must stay byte-for-byte logic-identical to the
// exported version in useFrameTimer.ts. See docs/OPEN_MISSIONS.md #13.
function computeFrameTimerState(input, prev, now) {
  if (input.frameNumber !== prev.frameNumber) {
    return {
      frameNumber: input.frameNumber,
      startedAt: input.hasAnyPotThisFrame ? now : null,
      frozenElapsedMs: null,
    };
  }
  if (input.isFrameOver) {
    if (prev.frozenElapsedMs !== null) return prev;
    return { ...prev, frozenElapsedMs: prev.startedAt !== null ? now - prev.startedAt : 0 };
  }
  if (prev.startedAt === null && input.hasAnyPotThisFrame) {
    return { ...prev, startedAt: now };
  }
  return prev;
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('computeFrameTimerState');

test('no pot yet: not running, no start time', () => {
  const s = computeFrameTimerState(
    { frameNumber: 1, isFrameOver: false, hasAnyPotThisFrame: false },
    { frameNumber: 1, startedAt: null, frozenElapsedMs: null },
    1000,
  );
  assert.strictEqual(s.startedAt, null);
  assert.strictEqual(s.frozenElapsedMs, null);
});

test('first pot starts the timer', () => {
  const s = computeFrameTimerState(
    { frameNumber: 1, isFrameOver: false, hasAnyPotThisFrame: true },
    { frameNumber: 1, startedAt: null, frozenElapsedMs: null },
    1000,
  );
  assert.strictEqual(s.startedAt, 1000);
  assert.strictEqual(s.frozenElapsedMs, null);
});

test('already running: startedAt is preserved, not reset', () => {
  const s = computeFrameTimerState(
    { frameNumber: 1, isFrameOver: false, hasAnyPotThisFrame: true },
    { frameNumber: 1, startedAt: 1000, frozenElapsedMs: null },
    5000,
  );
  assert.strictEqual(s.startedAt, 1000);
});

test('frame ends: freezes elapsed time', () => {
  const s = computeFrameTimerState(
    { frameNumber: 1, isFrameOver: true, hasAnyPotThisFrame: true },
    { frameNumber: 1, startedAt: 1000, frozenElapsedMs: null },
    6000,
  );
  assert.strictEqual(s.frozenElapsedMs, 5000);
  assert.strictEqual(s.startedAt, 1000);
});

test('already frozen: stays frozen, does not recompute', () => {
  const s = computeFrameTimerState(
    { frameNumber: 1, isFrameOver: true, hasAnyPotThisFrame: true },
    { frameNumber: 1, startedAt: 1000, frozenElapsedMs: 5000 },
    9000,
  );
  assert.strictEqual(s.frozenElapsedMs, 5000);
});

test('next frame number resets everything', () => {
  const s = computeFrameTimerState(
    { frameNumber: 2, isFrameOver: false, hasAnyPotThisFrame: false },
    { frameNumber: 1, startedAt: 1000, frozenElapsedMs: 5000 },
    9000,
  );
  assert.strictEqual(s.frameNumber, 2);
  assert.strictEqual(s.startedAt, null);
  assert.strictEqual(s.frozenElapsedMs, null);
});

test('new frame with an immediate pot starts fresh from now', () => {
  const s = computeFrameTimerState(
    { frameNumber: 2, isFrameOver: false, hasAnyPotThisFrame: true },
    { frameNumber: 1, startedAt: 1000, frozenElapsedMs: 5000 },
    9000,
  );
  assert.strictEqual(s.frameNumber, 2);
  assert.strictEqual(s.startedAt, 9000);
});

console.log(`✅ All ${passed} assertions passed`);
