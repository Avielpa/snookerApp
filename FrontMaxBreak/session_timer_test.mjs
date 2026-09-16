import assert from 'node:assert';
import { formatElapsed } from './hooks/useSessionTimer.ts';

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ok - ${name}`);
}

console.log('formatElapsed');
test('zero seconds', () => assert.strictEqual(formatElapsed(0), '0:00'));
test('under a minute', () => assert.strictEqual(formatElapsed(45), '0:45'));
test('exactly one minute', () => assert.strictEqual(formatElapsed(60), '1:00'));
test('minutes and seconds', () => assert.strictEqual(formatElapsed(200), '3:20'));
test('single-digit seconds are zero-padded', () => assert.strictEqual(formatElapsed(65), '1:05'));
test('under an hour, no hour segment', () => assert.strictEqual(formatElapsed(3599), '59:59'));
test('exactly one hour', () => assert.strictEqual(formatElapsed(3600), '1:00:00'));
test('hours minutes seconds', () => assert.strictEqual(formatElapsed(3725), '1:02:05'));
test('negative input clamps to zero', () => assert.strictEqual(formatElapsed(-5), '0:00'));

console.log(`✅ All ${passed} assertions passed`);
