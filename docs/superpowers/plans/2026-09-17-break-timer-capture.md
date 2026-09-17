# Break-Timer Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a live per-break timer to Match/Unlimited mode's scoreboard, save each completed break (for the logged-in "me" player only) to the backend for future personal analytics, and extend the existing personal-best-break leaderboard to also accept Match/Unlimited breaks for that same player.

**Architecture:** A new pure-observer React hook (`useBreakTimer`, mirroring the existing `useFrameTimer` pattern) watches the game reducer's `currentPlayer`/`currentBreak`/`breakBalls` fields and emits a `completedBreak` event whenever a break ends (player switch, foul-forced-forfeit, or frame-over). `game.tsx` reacts to that event by (a) sending it to a new backend model (`BreakTimingRecord`) via a new service/endpoint, and (b) — only for the player slot tagged "me" at match setup — also calling the **existing, untouched** `submitBreak` (best-break leaderboard) function. No changes to `useSnookerGame.ts`'s reducer.

**Tech Stack:** React Native/Expo (TypeScript), Django REST Framework, existing test conventions (`.mjs` pure-function tests on the frontend, Django `TestCase`/`APIClient` on the backend).

**Spec:** `docs/superpowers/specs/2026-09-17-break-timer-capture-design.md`

## Global Constraints

- Never modify `hooks/useSnookerGame.ts`'s reducer — all new hooks are pure observers of `GameState`, per the spec and the existing `useFrameTimer`/`useSessionTimer` convention.
- A completed break must never be attributed to any player slot other than `config.mePlayerIndex` — no backend call (`breakTimingService` or `submitBreak`) may ever fire for the other slot's completed-break events. This is the single most important constraint in this plan (see spec edge case 13).
- Zero-value breaks (`breakValue <= 0`) are never saved anywhere (spec's "Resolved: zero-value breaks").
- Guests (not logged in) never trigger any backend call from this feature — checked before the network call, same as the existing `bestBreakService.ts` pattern.
- Train mode is untouched — no code path added by this plan may run for `isTrainMode === true`.
- Backend test file must be named `tests_break_timing_record.py`, NOT `tests_break_timing.py` — that name is already taken by the existing anti-cheat helper's tests (`oneFourSeven/break_timing.py`'s `is_realistic_frame_time`), and colliding would silently shadow/break existing tests.
- On Windows, run backend tests with dotted labels (`python manage.py test oneFourSeven.tests_break_timing_record`), not the bare app label — see `docs/OPEN_MISSIONS.md` #20.
- After every task that touches `.ts`/`.tsx` files: run `npx tsc --noEmit` from `FrontMaxBreak/` and confirm no errors.
- Preview only — this plan ends at "ready to test on preview," never touches `eas update --channel production` or `git push master` without separate explicit approval (per CLAUDE.md).

---

## Task 1: Backend — `BreakTimingRecord` model + migration

**Files:**
- Modify: `maxBreak/oneFourSeven/models.py` (add new model, immediately after `PlayerBestBreak`, currently ending at line 1272)
- Create: `maxBreak/oneFourSeven/migrations/0028_breaktimingrecord.py` (generated, not hand-written)

**Interfaces:**
- Produces: `BreakTimingRecord` model with fields `user` (FK to `User`), `break_value` (int), `duration_seconds` (int), `mode` (str, `'match'` or `'unlimited'`), `created_at` (auto).

- [ ] **Step 1: Add the model**

In `maxBreak/oneFourSeven/models.py`, immediately after the `PlayerBestBreak` class (after its `__str__` method, currently ending around line 1271-1272), add:

```python
class BreakTimingRecord(models.Model):
    """
    One completed break's duration, from Match/Unlimited mode, for the player slot tagged
    "me" at match setup. Personal analytics only — never a competitive/global leaderboard,
    so (unlike PlayerBestBreak) there is no anti-cheat validation: this is the user's own
    account, no one else's data is at stake, and no reward is gated on accuracy.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='break_timings')
    break_value = models.IntegerField()
    duration_seconds = models.IntegerField()
    mode = models.CharField(max_length=16, choices=[('match', 'Match'), ('unlimited', 'Unlimited')])
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Break Timing Record"
        verbose_name_plural = "Break Timing Records"

    def __str__(self):
        return f"{self.user.username} / {self.mode} / break {self.break_value} in {self.duration_seconds}s"
```

- [ ] **Step 2: Generate the migration**

Run (from `maxBreak/`, with the venv active per CLAUDE.md):
```bash
python manage.py makemigrations oneFourSeven
```
Expected output: `Migrations for 'oneFourSeven': oneFourSeven/migrations/0028_breaktimingrecord.py - Create model BreakTimingRecord`

- [ ] **Step 3: Apply the migration locally and verify**

```bash
python manage.py migrate oneFourSeven
```
Expected: `Applying oneFourSeven.0028_breaktimingrecord... OK`

- [ ] **Step 4: Commit**

```bash
git add maxBreak/oneFourSeven/models.py maxBreak/oneFourSeven/migrations/0028_breaktimingrecord.py
git commit -m "feat: add BreakTimingRecord model for personal break-duration analytics"
```

---

## Task 2: Backend — serializer, view, URL

**Files:**
- Modify: `maxBreak/oneFourSeven/serializers.py` (add serializer after `LeaderboardEntrySerializer`, currently ending line 258-259)
- Modify: `maxBreak/oneFourSeven/views.py` (add view after `best_break_view`, before the `# ================== Global Leaderboard ==================` section header currently at line 2592; add `BreakTimingRecord` to the model import at line 26)
- Modify: `maxBreak/oneFourSeven/urls.py` (add import + path entry)

**Interfaces:**
- Consumes: `BreakTimingRecord` from Task 1.
- Produces: `POST /oneFourSeven/scoreboard/break-timing/`, auth required, body `{ break_value: int, duration_seconds: int, mode: 'match' | 'unlimited' }`, returns the created row `{ break_value, duration_seconds, mode, created_at }` with status 201, or `400` for bad input.

- [ ] **Step 1: Add the serializer**

In `maxBreak/oneFourSeven/serializers.py`, immediately after `LeaderboardEntrySerializer` (after its `Meta` class, currently ending around line 258-259), add:

```python
class BreakTimingRecordSerializer(serializers.ModelSerializer):
    """Serializes one completed break-duration event for the authenticated user."""
    class Meta:
        model = BreakTimingRecord
        fields = ['break_value', 'duration_seconds', 'mode', 'created_at']
        read_only_fields = ['created_at']
```

Also add `BreakTimingRecord` to the model import at the top of `serializers.py` (find the line importing `PlayerBestBreak` and add `BreakTimingRecord` alongside it).

- [ ] **Step 2: Add the view**

In `maxBreak/oneFourSeven/views.py`, add `BreakTimingRecord` to the model import list on line 26 (alongside `PlayerBestBreak`), and add `BreakTimingRecordSerializer` to the serializer import block (alongside `PlayerBestBreakSerializer`, around line 31).

Then, immediately after `best_break_view`'s closing (right before the `# ================== Global Leaderboard ==================` comment, currently line 2592), add:

```python
# ================== Break Timing (personal analytics) ==================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def break_timing_view(request):
    """
    POST — record one completed break's duration for the authenticated user.
    Body: { break_value: int, duration_seconds: int, mode: 'match' | 'unlimited' }.
    Every call creates a new row (no upsert — unlike PlayerBestBreak, every
    individual break is its own event, feeding future personal-analytics
    aggregation rather than a single "best" record). No anti-cheat check:
    see BreakTimingRecord's docstring.
    """
    break_value = request.data.get('break_value')
    duration_seconds = request.data.get('duration_seconds')
    mode = request.data.get('mode')

    if break_value is None or duration_seconds is None or mode is None:
        return Response({'error': 'break_value, duration_seconds, and mode are required'}, status=status.HTTP_400_BAD_REQUEST)
    if mode not in ('match', 'unlimited'):
        return Response({'error': "mode must be 'match' or 'unlimited'"}, status=status.HTTP_400_BAD_REQUEST)
    try:
        break_value = int(break_value)
        duration_seconds = int(duration_seconds)
    except (TypeError, ValueError):
        return Response({'error': 'break_value and duration_seconds must be integers'}, status=status.HTTP_400_BAD_REQUEST)
    if break_value <= 0:
        return Response({'error': 'break_value must be positive'}, status=status.HTTP_400_BAD_REQUEST)
    if duration_seconds < 0:
        return Response({'error': 'duration_seconds must not be negative'}, status=status.HTTP_400_BAD_REQUEST)

    record = BreakTimingRecord.objects.create(
        user=request.user,
        break_value=break_value,
        duration_seconds=duration_seconds,
        mode=mode,
    )
    serializer = BreakTimingRecordSerializer(record)
    return Response(serializer.data, status=status.HTTP_201_CREATED)
```

- [ ] **Step 3: Add the URL**

In `maxBreak/oneFourSeven/urls.py`, add `break_timing_view` to the view import block (alongside `best_break_view`, around line 75), and add the path entry immediately after the `scoreboard/best-break/` line (currently line 201):

```python
    path('scoreboard/break-timing/', break_timing_view, name='scoreboard-break-timing'),
```

- [ ] **Step 4: Manual smoke test**

Run the dev server (`python manage.py runserver`) and, with a real JWT for a test user, verify with curl:
```bash
curl -X POST http://localhost:8000/oneFourSeven/scoreboard/break-timing/ \
  -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \
  -d '{"break_value": 42, "duration_seconds": 65, "mode": "match"}'
```
Expected: HTTP 201, body `{"break_value": 42, "duration_seconds": 65, "mode": "match", "created_at": "..."}`.

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/serializers.py maxBreak/oneFourSeven/views.py maxBreak/oneFourSeven/urls.py
git commit -m "feat: add POST /scoreboard/break-timing/ endpoint"
```

---

## Task 3: Backend — tests for `break_timing_view`

**Files:**
- Create: `maxBreak/oneFourSeven/tests_break_timing_record.py`

**Interfaces:**
- Consumes: `BreakTimingRecord` (Task 1), `break_timing_view` at `/oneFourSeven/scoreboard/break-timing/` (Task 2), `_make_user` helper from `oneFourSeven/tests.py`.

- [ ] **Step 1: Write the test file**

```python
"""
Tests for personal break-duration tracking: POST /oneFourSeven/scoreboard/break-timing/.

Every completed break is its own row (no upsert) — covers input validation, auth gating,
and that multiple submissions for the same user all persist independently.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import BreakTimingRecord
from .tests import _make_user

URL = '/oneFourSeven/scoreboard/break-timing/'


class BreakTimingPostTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bt_user')
        self.client.force_authenticate(user=self.user)

    def test_valid_submission_creates_record(self):
        response = self.client.post(URL, {'break_value': 42, 'duration_seconds': 65, 'mode': 'match'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['break_value'], 42)
        self.assertEqual(response.data['duration_seconds'], 65)
        self.assertEqual(response.data['mode'], 'match')
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 1)

    def test_multiple_submissions_all_persist_independently(self):
        self.client.post(URL, {'break_value': 30, 'duration_seconds': 40, 'mode': 'match'})
        self.client.post(URL, {'break_value': 50, 'duration_seconds': 70, 'mode': 'unlimited'})
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 2)

    def test_zero_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': 0, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 0)

    def test_negative_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': -5, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_negative_duration_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': -1, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_invalid_mode_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': 10, 'mode': 'train'})
        self.assertEqual(response.status_code, 400)

    def test_missing_break_value_rejected(self):
        response = self.client.post(URL, {'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_missing_duration_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_missing_mode_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': 10})
        self.assertEqual(response.status_code, 400)

    def test_non_integer_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': 'not-a-number', 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_records_scoped_to_correct_user(self):
        other_user = _make_user('bt_other_user')
        self.client.post(URL, {'break_value': 20, 'duration_seconds': 30, 'mode': 'match'})
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 1)
        self.assertEqual(BreakTimingRecord.objects.filter(user=other_user).count(), 0)


class BreakTimingAuthTest(TestCase):
    def test_unauthenticated_request_rejected(self):
        client = APIClient()
        response = client.post(URL, {'break_value': 10, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 401)
```

- [ ] **Step 2: Run the tests**

```bash
python manage.py test oneFourSeven.tests_break_timing_record -v 2
```
Expected: all tests pass (13 tests, 0 failures).

- [ ] **Step 3: Commit**

```bash
git add maxBreak/oneFourSeven/tests_break_timing_record.py
git commit -m "test: add coverage for POST /scoreboard/break-timing/"
```

---

## Task 4: Frontend — `useBreakTimer` hook + pure-function tests

**Files:**
- Create: `FrontMaxBreak/hooks/useBreakTimer.ts`
- Create: `FrontMaxBreak/break_timer_test.mjs`

**Interfaces:**
- Produces: `useBreakTimer(input: BreakTimerInput): { elapsedSeconds: number; completedBreak: CompletedBreak | null }`, the exported pure functions `computeBreakTimerState` and `shouldSubmitCompletedBreak(completedBreak, mePlayerIndex, isTrainMode): boolean`, and types `BreakTimerInput`, `BreakTimerState`, `CompletedBreak`.
- Consumed by: Task 8 (`game.tsx`).

- [ ] **Step 1: Write `useBreakTimer.ts`**

```typescript
// FrontMaxBreak/hooks/useBreakTimer.ts
//
// Tracks each individual break (one player's scoring visit) in Match/Unlimited
// mode: starts on the first ball potted in a visit, freezes and emits a
// "completed break" event when the visit ends (player switch, a foul-forced
// forfeit, or the frame ending). Pure observer of GameState fields passed in
// by the caller (game.tsx) — never touches useSnookerGame's reducer, same
// discipline as hooks/useFrameTimer.ts.
import { useEffect, useState } from 'react';

export interface BreakTimerInput {
  currentPlayer: 0 | 1;
  currentBreak: number;
  breakBallsLength: number;
  isFrameOver: boolean;
}

export interface CompletedBreak {
  player: 0 | 1;
  breakValue: number;
  durationSeconds: number;
  completedAt: number;
}

export interface BreakTimerState {
  player: 0 | 1;
  startedAt: number | null;
  frozenElapsedMs: number | null;
  lastKnownBreakValue: number;
  completedBreak: CompletedBreak | null;
}

const INITIAL_STATE: BreakTimerState = {
  player: 0,
  startedAt: null,
  frozenElapsedMs: null,
  lastKnownBreakValue: 0,
  completedBreak: null,
};

/**
 * The reducer can reset currentBreak to 0 in the same transition that ends a
 * break (foul-forced-forfeit paths in useSnookerGame.ts), while a normal
 * frame-winning pot leaves currentBreak intact. Math.max over the live input
 * and the last value we saw while this player was still on strike is correct
 * either way, without branching on which reducer path caused the transition.
 */
function finalizeBreak(prev: BreakTimerState, input: BreakTimerInput, now: number): CompletedBreak | null {
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

/** Pure state transition, fully unit-testable without mounting React. */
export function computeBreakTimerState(
  input: BreakTimerInput,
  prev: BreakTimerState,
  now: number,
): BreakTimerState {
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
    if (prev.frozenElapsedMs !== null) return prev; // already frozen, don't re-finalize
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

/**
 * The single most important safety gate in this feature: decides whether a
 * completed break should ever be submitted to the backend (both the new
 * personal-analytics endpoint and the existing best-break leaderboard).
 * Extracted as a pure function specifically so the "never attribute the
 * other local player's break" rule (the exact bug class fixed 2026-09-14 for
 * Train mode's predecessor feature) has a real, automated test — not just a
 * manual on-device check.
 */
export function shouldSubmitCompletedBreak(
  completedBreak: CompletedBreak | null,
  mePlayerIndex: 0 | 1,
  isTrainMode: boolean,
): boolean {
  if (isTrainMode) return false; // Train mode has its own, separate best-break path
  if (!completedBreak) return false;
  if (completedBreak.breakValue <= 0) return false;
  return completedBreak.player === mePlayerIndex;
}

export function useBreakTimer(input: BreakTimerInput): { elapsedSeconds: number; completedBreak: CompletedBreak | null } {
  const [state, setState] = useState<BreakTimerState>(INITIAL_STATE);
  const [, forceTick] = useState(0);

  useEffect(() => {
    setState(prev => computeBreakTimerState(input, prev, Date.now()));
  }, [input.currentPlayer, input.currentBreak, input.breakBallsLength, input.isFrameOver]);

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedMs = state.frozenElapsedMs !== null
    ? state.frozenElapsedMs
    : state.startedAt !== null
      ? Date.now() - state.startedAt
      : 0;
  return { elapsedSeconds: Math.floor(elapsedMs / 1000), completedBreak: state.completedBreak };
}
```

- [ ] **Step 2: Write `break_timer_test.mjs`**

```javascript
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
  const already = { player: 0, byebye: true }; // sentinel to prove early-return identity
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
```

- [ ] **Step 3: Run typecheck and the new test**

```bash
cd FrontMaxBreak
npx tsc --noEmit
node break_timer_test.mjs
```
Expected: tsc clean, `✅ All 12 assertions passed` (count may vary slightly — verify it matches the number of `test(...)` calls above, all with `ok -` lines and no thrown errors).

- [ ] **Step 4: Commit**

```bash
git add FrontMaxBreak/hooks/useBreakTimer.ts FrontMaxBreak/break_timer_test.mjs
git commit -m "feat: add useBreakTimer hook for per-visit break timing"
```

---

## Task 5: Frontend — `breakTimingService.ts`

**Files:**
- Create: `FrontMaxBreak/services/breakTimingService.ts`

**Interfaces:**
- Consumes: `isLoggedIn`, `getAuthHeader` from `services/authService.ts` (same pattern as `bestBreakService.ts`).
- Produces: `submitBreakTiming(breakValue: number, durationSeconds: number, mode: 'match' | 'unlimited'): Promise<void>`.
- Consumed by: Task 8 (`game.tsx`).

- [ ] **Step 1: Write the service**

```typescript
// FrontMaxBreak/services/breakTimingService.ts
//
// Personal break-duration analytics for Match/Unlimited mode. Fire-and-forget,
// login-gated (mirrors bestBreakService.ts's submitBreak) — guests never
// submit, and a network failure never interrupts play. No response value is
// consumed by callers today; this purely feeds a future personal-stats view.
import axios from 'axios';
import { isLoggedIn, getAuthHeader } from './authService';
import { logger } from '../utils/logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

export type BreakTimingMode = 'match' | 'unlimited';

/** Submit one completed break's duration. No-op for guests or on any error — never throws. */
export async function submitBreakTiming(breakValue: number, durationSeconds: number, mode: BreakTimingMode): Promise<void> {
  if (breakValue <= 0) return; // nothing to record
  const logged = await isLoggedIn();
  if (!logged) return;

  try {
    const header = await getAuthHeader();
    if (!header) return;
    await axios.post(
      `${API_BASE}scoreboard/break-timing/`,
      { break_value: breakValue, duration_seconds: durationSeconds, mode },
      { headers: { Authorization: header } },
    );
  } catch (error: any) {
    logger.warn('[BreakTiming] submitBreakTiming failed:', error?.message);
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
cd FrontMaxBreak && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add FrontMaxBreak/services/breakTimingService.ts
git commit -m "feat: add breakTimingService for personal break-duration submission"
```

---

## Task 6: Frontend — `ScorePanel.tsx` live timer display

**Files:**
- Modify: `FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx`

**Interfaces:**
- Consumes: `formatElapsed` from `hooks/useSessionTimer.ts` (already imported project-wide, e.g. in `FrameSummary.tsx` and `game.tsx`).
- Produces: new optional prop `activeBreakElapsedSeconds?: number` on `ScorePanelProps`.

- [ ] **Step 1: Add the prop and import**

At the top of `ScorePanel.tsx`, add the import:
```typescript
import { formatElapsed } from '../../../hooks/useSessionTimer';
```

In the `ScorePanelProps` interface, add:
```typescript
  /** Optional: live elapsed seconds for the CURRENT break in progress, shown only for the
   * active player. Omit for Train mode or any caller that hasn't adopted break timing —
   * purely additive, existing callers are unaffected. */
  activeBreakElapsedSeconds?: number;
```

Add `activeBreakElapsedSeconds` to the destructured props in the function signature.

- [ ] **Step 2: Render it inside the break badge**

Replace the existing break badge block:
```typescript
        {isActive && currentBreak > 0 && (
          <View style={[styles.breakBadge, { backgroundColor: c.pinGold }]}>
            <Text style={styles.breakBadgeText}>Break {currentBreak}</Text>
          </View>
        )}
```
with:
```typescript
        {isActive && currentBreak > 0 && (
          <View style={[styles.breakBadge, { backgroundColor: c.pinGold }]}>
            <Text style={styles.breakBadgeText}>
              Break {currentBreak}
              {activeBreakElapsedSeconds !== undefined ? ` · ${formatElapsed(activeBreakElapsedSeconds)}` : ''}
            </Text>
          </View>
        )}
```

- [ ] **Step 3: Typecheck**

```bash
cd FrontMaxBreak && npx tsc --noEmit
```
Expected: no errors. (No test file exists for `ScorePanel.tsx` today — this is a pure rendering change verified by typecheck now and manual on-device check in Task 9.)

- [ ] **Step 4: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/ScorePanel.tsx
git commit -m "feat: show live break-elapsed time in the ScorePanel break badge"
```

---

## Task 7: Frontend — "this is me" picker at setup + draft persistence

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/index.tsx`
- Modify: `FrontMaxBreak/services/gameStorage.ts` (`GameDraft.params` type only)

**Interfaces:**
- Produces: `mePlayerIndex` route param (string `'0'` or `'1'`), added to `router.push` params in `startMatch()` and to `GameDraft.params`.
- Consumed by: Task 8 (`game.tsx`).

- [ ] **Step 1: Update `GameDraft`'s type**

In `FrontMaxBreak/services/gameStorage.ts`, update the `GameDraft` interface:
```typescript
export interface GameDraft {
  params: {
    id: string;
    player1: string;
    player2: string;
    numberOfReds: string;
    bestOf: string;
    mePlayerIndex: string;
  };
  state: GameState;
  savedAt: string;
}
```

- [ ] **Step 2: Add the picker state and UI in `index.tsx`**

Add a new state variable near the other setup state (after `const [isUnlimited, setIsUnlimited] = useState(false);`):
```typescript
  const [mePlayerIndex, setMePlayerIndex] = useState<0 | 1>(0);
```

In the JSX, immediately after the block that renders the Player 2 input (find `{!isTrainMode && (` that wraps the Player 2 `TextInput`, currently around line 168), add a new picker row right after that block closes, still inside the `!isTrainMode` guard region — add a second `{!isTrainMode && ( ... )}` block:

```tsx
      {!isTrainMode && (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.label, { color: c.textMuted }]}>WHO ARE YOU?</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
            {([0, 1] as const).map(idx => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionBtn,
                  { borderColor: mePlayerIndex === idx ? c.primary : c.cardBorder },
                  mePlayerIndex === idx && { backgroundColor: 'rgba(255,183,77,0.12)' },
                ]}
                onPress={() => setMePlayerIndex(idx)}
              >
                <Text style={[styles.optionBtnText, { color: mePlayerIndex === idx ? c.primary : c.textSecondary }]}>
                  {idx === 0 ? (player1.trim() || 'Player 1') : (player2.trim() || 'Player 2')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
```

(This reuses the existing `styles.optionBtn`/`styles.optionBtnText` styles already defined in this file for the reds-count picker — verify those style names match what's actually in this file's `StyleSheet.create` block before finalizing; if the existing style names differ, use the actual ones so the picker matches the file's existing visual language exactly.)

- [ ] **Step 3: Include it in the route params and draft**

In `startMatch()`, add `mePlayerIndex: String(mePlayerIndex)` to the `params` object passed to `router.push`:
```typescript
    router.push({
      pathname: '/scoreboard/game' as any,
      params: {
        id,
        player1: player1.trim(),
        player2: isTrainMode ? '' : player2.trim(),
        numberOfReds: String(numberOfReds),
        bestOf: isTrainMode ? 'train' : isUnlimited ? 'unlimited' : (bestOf === null ? 'single' : String(bestOf)),
        mode,
        mePlayerIndex: String(mePlayerIndex),
      },
    });
```

- [ ] **Step 4: Typecheck**

```bash
cd FrontMaxBreak && npx tsc --noEmit
```
Expected: errors, if any, will point at `gameStorage.ts` callers still constructing a `GameDraft` without `mePlayerIndex` — fix those call sites to include it (Task 8 will be the one writing drafts; if tsc flags it before Task 8 is done, that's expected and gets resolved there — re-run tsc again after Task 8's Step 3).

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/index.tsx FrontMaxBreak/services/gameStorage.ts
git commit -m "feat: add 'this is me' player picker to Match/Unlimited setup"
```

---

## Task 8: Frontend — wire it all together in `game.tsx`

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx`

**Interfaces:**
- Consumes: `useBreakTimer` (Task 4), `submitBreakTiming` (Task 5), `activeBreakElapsedSeconds` prop on `ScorePanel` (Task 6), `mePlayerIndex` route param (Task 7), and the **existing, unmodified** `submitBreak` from `services/bestBreakService.ts`.

- [ ] **Step 1: Read the new param and add the hook**

Update the `useLocalSearchParams` type in `GameScreen` (currently line 42-44) to include `mePlayerIndex`:
```typescript
  const params = useLocalSearchParams<{
    id: string; player1: string; player2: string; numberOfReds: string; bestOf: string; mode: string; mePlayerIndex: string;
  }>();
```

Add a parsed constant right after `isUnlimitedMode` (currently line 47):
```typescript
  const mePlayerIndex: 0 | 1 = params.mePlayerIndex === '1' ? 1 : 0;
```

After the existing `useFrameTimer` block (currently lines 64-68), add:
```typescript
  const { elapsedSeconds: activeBreakElapsedSeconds, completedBreak } = useBreakTimer({
    currentPlayer: snap.currentPlayer,
    currentBreak: snap.currentBreak,
    breakBallsLength: snap.breakBalls.length,
    isFrameOver: snap.isFrameOver,
  });
```

Add the import at the top, alongside the existing `useFrameTimer` import:
```typescript
import { useBreakTimer, shouldSubmitCompletedBreak } from '../../hooks/useBreakTimer';
import { submitBreakTiming } from '../../services/breakTimingService';
```

- [ ] **Step 2: React to a completed break — only for Match/Unlimited, only for the "me" player**

Add a new `useEffect`, placed right after the existing `isFrameOver`/personal-best `useEffect` block (currently ending at line 183), with a ref to dedupe by `completedAt` (multiple re-renders must not resubmit the same event):

```typescript
  const lastHandledBreakAt = useRef<number | null>(null);
  useEffect(() => {
    if (!completedBreak) return;
    if (completedBreak.completedAt === lastHandledBreakAt.current) return;
    lastHandledBreakAt.current = completedBreak.completedAt;
    if (!shouldSubmitCompletedBreak(completedBreak, mePlayerIndex, isTrainMode)) return;

    const mode = isUnlimitedMode ? 'unlimited' : 'match';
    submitBreakTiming(completedBreak.breakValue, completedBreak.durationSeconds, mode);
    submitBreak(config.numberOfReds, completedBreak.breakValue, completedBreak.durationSeconds);
  }, [completedBreak, mePlayerIndex, isTrainMode, isUnlimitedMode]);
```

- [ ] **Step 3: Pass the live value into `ScorePanel` and update draft-saving**

Find the `<ScorePanel ... />` usage(s) in the JSX (search for `currentBreak={snap.currentBreak}` or similar prop) and add:
```typescript
            activeBreakElapsedSeconds={isTrainMode ? undefined : activeBreakElapsedSeconds}
```

In `saveDraftIfNeeded` (currently lines 79-101), update the `draft.params` object to include the new field:
```typescript
        params: {
          id: params.id,
          player1: params.player1,
          player2: params.player2,
          numberOfReds: params.numberOfReds,
          bestOf: params.bestOf,
          mePlayerIndex: params.mePlayerIndex,
        },
```

- [ ] **Step 4: Typecheck and run the full test suite**

```bash
cd FrontMaxBreak
npx tsc --noEmit
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs && node best_break_test.mjs && node session_timer_test.mjs && node frame_timer_test.mjs && node break_timer_test.mjs && node leaderboard_service_test.mjs && node leaderboard_tab_test.mjs && node history_tab_param_test.mjs
```
Expected: tsc clean, all 13 test files report `✅ All N assertions passed` with zero failures — this is the BEFORE/AFTER regression check (rule 11b-equivalent for feature work): every pre-existing suite must show identical pass counts to before this plan started, since none of their underlying logic (`useSnookerGame.ts` reducer) was touched.

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "feat: wire break-timer capture into game.tsx (live display + backend save + leaderboard extension)"
```

---

## Task 9: Manual verification on preview

**Files:** none (verification-only task)

- [ ] **Step 1: Publish to preview**

Ask the user for explicit approval before running (per CLAUDE.md — deployment always needs confirmation), then:
```bash
cd FrontMaxBreak
npx eas update --channel preview --message "feat: break-timer capture + leaderboard extension for Match/Unlimited mode"
```

- [ ] **Step 2: Device checklist**

On a real device with the preview build, verify all of the following (logged-in account):
1. Start a Match with "Who are you?" set to Player 1 — the break badge shows `Break N · M:SS` ticking live, only while Player 1 is on strike.
2. Switch to Player 2's turn (tap to end visit) — Player 1's badge disappears, Player 2's break timer does NOT show any elapsed value tied to the "me" flow (since Player 2 isn't "me" — confirm no `submitBreak`/`submitBreakTiming` fires for Player 2 by checking backend state before/after, e.g. via `GET /scoreboard/best-break/`).
3. Complete a break as Player 1 (the "me" player) worth more than any existing best-break for that reds count — confirm the existing "New PB!" celebration still fires correctly (proves the leaderboard extension didn't break the existing Train-mode-tested flow).
4. Repeat the whole flow with "Who are you?" set to Player 2 instead — confirm Player 2's breaks now submit and Player 1's don't.
5. Play Unlimited mode once, confirm the same behavior.
6. Force-close the app mid-break, reopen, resume from the draft card — confirm `mePlayerIndex` survived the resume (test both slots).
7. Play as a guest (logged out) — confirm no crash, no network errors surfaced to the user, and `GET /scoreboard/best-break/` / a backend check confirms zero new rows were created.
8. Play a full Train-mode session — confirm it behaves exactly as before (no break badge timer, since `activeBreakElapsedSeconds` is passed as `undefined` for Train mode; existing Train-mode best-break submission still works unchanged).

- [ ] **Step 3: Report results to the user**

Summarize pass/fail for each of the 8 checks above. Do not proceed to `production` without a separate, explicit approval per CLAUDE.md's deployment rules — this task's only goal is a verified preview build.
