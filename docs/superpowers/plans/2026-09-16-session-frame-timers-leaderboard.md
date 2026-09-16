# Session Timer, Frame Timer & Global Best-Break Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a session timer (time played today), a frame timer (per-frame duration + anti-cheat signal), and a global best-break leaderboard split by reds_count.

**Architecture:** Two new, isolated React hooks (`useSessionTimer`, `useFrameTimer`) observe existing game state from the outside — `useSnookerGame.ts`'s reducer is never modified. The backend reuses the existing `PlayerBestBreak` table (adds two columns) instead of a new model, and exposes it two ways: the existing per-user endpoint (now also returns timing/verification fields) and a new public top-N-by-reds_count leaderboard endpoint. A pure anti-cheat function flags (never rejects) suspiciously fast breaks.

**Tech Stack:** React Native + Expo (frontend), Django REST Framework (backend), existing AsyncStorage/axios/Django-test patterns already used by the best-break feature.

**Spec:** `docs/superpowers/specs/2026-09-16-session-frame-timers-leaderboard-design.md`

## Global Constraints

- Never modify `useSnookerGame.ts`'s reducer or its existing test suites (`game_test.mjs`, `train_test.mjs`, `mega_test.mjs`, `freeball_test.mjs`, `stats_test.mjs`, `offseason_tab_test.mjs` — 1039 assertions). Both timers are external observers only.
- Best-break/leaderboard submission stays Train-mode-only (existing gate in `game.tsx`, line ~164) — no change to that gate.
- A suspiciously-fast break is always saved and always updates the personal best; it is only ever flagged (`is_verified=False`), never rejected.
- `frame_time_seconds` is optional everywhere (nullable on the model, optional in the API body) — old rows and old callers must keep working unchanged (`is_verified` defaults to `True`).
- `REALISTIC_SECONDS_PER_POINT = 320 / 147` (Ronnie O'Sullivan's fastest official 147, 5:20) is the one anti-cheat constant — no per-ball lookup table.
- No per-shot/tap-interval timing analysis — explicitly out of scope per the spec's Non-goals.
- Session timer does not claim a "today" total for guests — only a live current-session counter (no persisted history exists for guests, per the existing `gameStorage.saveMatch` login gate).
- Backend tests run via `python manage.py test oneFourSeven.<module>` from `maxBreak/` with the venv active. Frontend tests run via `node <file>.mjs` from `FrontMaxBreak/`.

---

## Task 1: `PlayerBestBreak` model — add timing/verification fields

**Files:**
- Modify: `maxBreak/oneFourSeven/models.py:1249-1269` (`PlayerBestBreak` class)
- Create: `maxBreak/oneFourSeven/migrations/0027_playerbestbreak_timing_fields.py`

**Interfaces:**
- Produces: `PlayerBestBreak.frame_time_seconds` (`IntegerField(null=True, blank=True)`), `PlayerBestBreak.is_verified` (`BooleanField(default=True)`) — used by Task 3 (view), Task 4 (leaderboard), and their serializers.

- [ ] **Step 1: Add the two fields to the model**

In `maxBreak/oneFourSeven/models.py`, inside the `PlayerBestBreak` class, change:

```python
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='best_breaks')
    reds_count = models.IntegerField()
    best_break = models.IntegerField()
    achieved_at = models.DateTimeField(auto_now=True)
```

to:

```python
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='best_breaks')
    reds_count = models.IntegerField()
    best_break = models.IntegerField()
    achieved_at = models.DateTimeField(auto_now=True)
    frame_time_seconds = models.IntegerField(null=True, blank=True)
    is_verified = models.BooleanField(default=True)
```

- [ ] **Step 2: Generate the migration**

Run (from `maxBreak/`, venv active):
```bash
python manage.py makemigrations oneFourSeven --name playerbestbreak_timing_fields
```
Expected: creates `maxBreak/oneFourSeven/migrations/0027_playerbestbreak_timing_fields.py` adding both fields.

- [ ] **Step 3: Apply the migration locally and verify**

Run:
```bash
python manage.py migrate oneFourSeven
python manage.py shell -c "from oneFourSeven.models import PlayerBestBreak; print(PlayerBestBreak._meta.get_field('frame_time_seconds'), PlayerBestBreak._meta.get_field('is_verified'))"
```
Expected: no errors, both fields print.

- [ ] **Step 4: Commit**

```bash
git add maxBreak/oneFourSeven/models.py maxBreak/oneFourSeven/migrations/0027_playerbestbreak_timing_fields.py
git commit -m "feat: add frame_time_seconds and is_verified to PlayerBestBreak"
```

---

## Task 2: Anti-cheat pure function `is_realistic_frame_time`

**Files:**
- Create: `maxBreak/oneFourSeven/break_timing.py`
- Test: `maxBreak/oneFourSeven/tests_break_timing.py`

**Interfaces:**
- Consumes: nothing (pure function, no DB).
- Produces: `is_realistic_frame_time(frame_time_seconds: int | None, break_value: int) -> bool` and `REALISTIC_SECONDS_PER_POINT: float` — used by Task 3's view.

- [ ] **Step 1: Write the failing tests**

```python
# maxBreak/oneFourSeven/tests_break_timing.py
from django.test import SimpleTestCase

from .break_timing import is_realistic_frame_time, REALISTIC_SECONDS_PER_POINT


class IsRealisticFrameTimeTest(SimpleTestCase):
    def test_zero_break_is_always_realistic(self):
        self.assertTrue(is_realistic_frame_time(0, 0))
        self.assertTrue(is_realistic_frame_time(1, 0))

    def test_missing_frame_time_is_treated_as_realistic(self):
        self.assertTrue(is_realistic_frame_time(None, 100))

    def test_time_above_floor_is_realistic(self):
        # 147 in 400s is well above Ronnie's 320s floor.
        self.assertTrue(is_realistic_frame_time(400, 147))

    def test_time_exactly_at_floor_is_realistic(self):
        floor = round(REALISTIC_SECONDS_PER_POINT * 147)
        self.assertTrue(is_realistic_frame_time(floor, 147))

    def test_time_below_floor_is_unrealistic(self):
        self.assertFalse(is_realistic_frame_time(60, 147))

    def test_floor_scales_linearly_with_break_value(self):
        # A 30-break floor should be far lower than a 147-break floor.
        self.assertTrue(is_realistic_frame_time(50, 30))
        self.assertFalse(is_realistic_frame_time(5, 30))
```

- [ ] **Step 2: Run to verify it fails**

Run: `python manage.py test oneFourSeven.tests_break_timing -v 2`
Expected: `ModuleNotFoundError: No module named 'oneFourSeven.break_timing'`

- [ ] **Step 3: Write the implementation**

```python
# maxBreak/oneFourSeven/break_timing.py
"""
Anti-cheat check for a submitted break's frame time, used by the best-break
upsert endpoint (views.py::best_break_view). Pure, no DB access — testable
in isolation.
"""

# Ronnie O'Sullivan's fastest official maximum break (147): 5 minutes 20
# seconds (320 seconds), 1997 World Championship. Used as the fastest
# realistic reference point, scaled linearly to any break value.
REALISTIC_SECONDS_PER_POINT = 320 / 147


def is_realistic_frame_time(frame_time_seconds, break_value):
    """
    True if frame_time_seconds is not suspiciously fast for break_value.
    A break_value of 0 is always realistic (nothing to time). A missing
    frame_time_seconds (None) is treated as realistic — no timer data means
    no basis to flag it, matching PlayerBestBreak.is_verified's default of
    True for rows written before this feature existed.
    """
    if break_value <= 0:
        return True
    if frame_time_seconds is None:
        return True
    floor_seconds = REALISTIC_SECONDS_PER_POINT * break_value
    return frame_time_seconds >= floor_seconds
```

- [ ] **Step 4: Run to verify it passes**

Run: `python manage.py test oneFourSeven.tests_break_timing -v 2`
Expected: `OK` (6 tests)

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/break_timing.py maxBreak/oneFourSeven/tests_break_timing.py
git commit -m "feat: add is_realistic_frame_time anti-cheat check"
```

---

## Task 3: Wire anti-cheat into `best_break_view`, expose new fields

**Files:**
- Modify: `maxBreak/oneFourSeven/serializers.py:240-245` (`PlayerBestBreakSerializer`)
- Modify: `maxBreak/oneFourSeven/views.py:2520-2564` (`best_break_view`), and its imports near the top
- Test: `maxBreak/oneFourSeven/tests_best_break.py` (append new test class)

**Interfaces:**
- Consumes: `is_realistic_frame_time` from Task 2.
- Produces: `POST /scoreboard/best-break/` now accepts optional `frame_time_seconds` in the body and returns `frame_time_seconds`/`is_verified` in every response — used by Task 8's `submitBreak()` and Task 4's leaderboard reuses the same model fields.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_best_break.py`:

```python
class BestBreakFrameTimeTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bb_time_user')
        self.client.force_authenticate(user=self.user)

    def test_submission_without_frame_time_is_verified(self):
        """Old-style callers that don't send frame_time_seconds still get is_verified=True."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 40})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_verified'])
        self.assertIsNone(response.data['frame_time_seconds'])

    def test_realistic_frame_time_is_verified(self):
        response = self.client.post(URL, {'reds_count': 15, 'break': 40, 'frame_time_seconds': 300})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_verified'])
        self.assertEqual(response.data['frame_time_seconds'], 300)

    def test_unrealistically_fast_frame_time_is_flagged_not_rejected(self):
        """A suspiciously fast break is still saved and still updates the record — just flagged."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 147, 'frame_time_seconds': 10})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 147)
        self.assertFalse(response.data['is_verified'])
        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 147)

    def test_flag_updates_alongside_a_new_higher_break(self):
        self.client.post(URL, {'reds_count': 15, 'break': 40, 'frame_time_seconds': 200})
        response = self.client.post(URL, {'reds_count': 15, 'break': 147, 'frame_time_seconds': 5})
        self.assertFalse(response.data['is_verified'])
        self.assertEqual(response.data['frame_time_seconds'], 5)

    def test_lower_break_does_not_overwrite_stored_timing(self):
        self.client.post(URL, {'reds_count': 15, 'break': 100, 'frame_time_seconds': 250})
        response = self.client.post(URL, {'reds_count': 15, 'break': 20, 'frame_time_seconds': 1})
        self.assertTrue(response.data['is_verified'], 'a lower break must not touch the stored record at all')
        self.assertEqual(response.data['frame_time_seconds'], 250)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python manage.py test oneFourSeven.tests_best_break -v 2`
Expected: `FAIL` — `KeyError: 'is_verified'` (serializer doesn't expose it yet) or similar.

- [ ] **Step 3: Update the serializer**

In `maxBreak/oneFourSeven/serializers.py`, change:

```python
class PlayerBestBreakSerializer(serializers.ModelSerializer):
    """Serializes a user's per-reds_count personal-best break."""
    class Meta:
        model = PlayerBestBreak
        fields = ['reds_count', 'best_break', 'achieved_at']
        read_only_fields = ['created_at', 'updated_at']
```

to:

```python
class PlayerBestBreakSerializer(serializers.ModelSerializer):
    """Serializes a user's per-reds_count personal-best break."""
    class Meta:
        model = PlayerBestBreak
        fields = ['reds_count', 'best_break', 'achieved_at', 'frame_time_seconds', 'is_verified']
        read_only_fields = ['created_at', 'updated_at']
```

- [ ] **Step 4: Update the view**

In `maxBreak/oneFourSeven/views.py`, add the import near the other local imports (line ~26 area):

```python
from .break_timing import is_realistic_frame_time
```

Then replace the POST branch of `best_break_view` (lines ~2539-2564):

```python
    # POST — upsert-if-higher
    reds_count = request.data.get('reds_count')
    break_value = request.data.get('break')
    if reds_count is None or break_value is None:
        return Response({'error': 'reds_count and break are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reds_count = int(reds_count)
        break_value = int(break_value)
    except (TypeError, ValueError):
        return Response({'error': 'reds_count and break must be integers'}, status=status.HTTP_400_BAD_REQUEST)
    if break_value < 0:
        return Response({'error': 'break must not be negative'}, status=status.HTTP_400_BAD_REQUEST)

    record, created = PlayerBestBreak.objects.get_or_create(
        user=request.user,
        reds_count=reds_count,
        defaults={'best_break': break_value},
    )
    is_new_record = created
    if not created and break_value > record.best_break:
        record.best_break = break_value
        record.save()
        is_new_record = True

    serializer = PlayerBestBreakSerializer(record)
    return Response({**serializer.data, 'is_new_record': is_new_record}, status=status.HTTP_200_OK)
```

with:

```python
    # POST — upsert-if-higher
    reds_count = request.data.get('reds_count')
    break_value = request.data.get('break')
    frame_time_seconds = request.data.get('frame_time_seconds')
    if reds_count is None or break_value is None:
        return Response({'error': 'reds_count and break are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reds_count = int(reds_count)
        break_value = int(break_value)
        frame_time_seconds = int(frame_time_seconds) if frame_time_seconds is not None else None
    except (TypeError, ValueError):
        return Response({'error': 'reds_count, break, and frame_time_seconds must be integers'}, status=status.HTTP_400_BAD_REQUEST)
    if break_value < 0:
        return Response({'error': 'break must not be negative'}, status=status.HTTP_400_BAD_REQUEST)

    is_verified = is_realistic_frame_time(frame_time_seconds, break_value)

    record, created = PlayerBestBreak.objects.get_or_create(
        user=request.user,
        reds_count=reds_count,
        defaults={'best_break': break_value, 'frame_time_seconds': frame_time_seconds, 'is_verified': is_verified},
    )
    is_new_record = created
    if not created and break_value > record.best_break:
        record.best_break = break_value
        record.frame_time_seconds = frame_time_seconds
        record.is_verified = is_verified
        record.save()
        is_new_record = True

    serializer = PlayerBestBreakSerializer(record)
    return Response({**serializer.data, 'is_new_record': is_new_record}, status=status.HTTP_200_OK)
```

- [ ] **Step 5: Run to verify it passes**

Run: `python manage.py test oneFourSeven.tests_best_break -v 2`
Expected: `OK` (all prior + 5 new tests)

- [ ] **Step 6: Commit**

```bash
git add maxBreak/oneFourSeven/serializers.py maxBreak/oneFourSeven/views.py maxBreak/oneFourSeven/tests_best_break.py
git commit -m "feat: wire anti-cheat frame-time check into best-break submission"
```

---

## Task 4: Global leaderboard endpoint

**Files:**
- Modify: `maxBreak/oneFourSeven/serializers.py` (add `LeaderboardEntrySerializer` after `PlayerBestBreakSerializer`)
- Modify: `maxBreak/oneFourSeven/views.py` (add `leaderboard_view` after `best_break_view`)
- Modify: `maxBreak/oneFourSeven/urls.py` (import + route)
- Test: `maxBreak/oneFourSeven/tests_leaderboard.py`

**Interfaces:**
- Consumes: `PlayerBestBreak` rows written by Task 3.
- Produces: `GET /scoreboard/leaderboard/?reds_count=<n>` → JSON array of `{username, reds_count, best_break, frame_time_seconds, is_verified, achieved_at}` — used by Task 9's `leaderboardService.ts`.

- [ ] **Step 1: Write the failing tests**

```python
# maxBreak/oneFourSeven/tests_leaderboard.py
"""Tests for GET /oneFourSeven/scoreboard/leaderboard/."""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PlayerBestBreak
from .tests import _make_user

URL = '/oneFourSeven/scoreboard/leaderboard/'


class LeaderboardViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_requires_reds_count(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 400)

    def test_rejects_non_integer_reds_count(self):
        response = self.client.get(URL, {'reds_count': 'fifteen'})
        self.assertEqual(response.status_code, 400)

    def test_no_auth_required(self):
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(response.status_code, 200)

    def test_empty_when_no_records(self):
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(response.data, [])

    def test_orders_by_best_break_descending(self):
        u1, u2, u3 = _make_user('lb_a'), _make_user('lb_b'), _make_user('lb_c')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=30, frame_time_seconds=200)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=90, frame_time_seconds=300)
        PlayerBestBreak.objects.create(user=u3, reds_count=15, best_break=60, frame_time_seconds=250)
        response = self.client.get(URL, {'reds_count': 15})
        breaks = [row['best_break'] for row in response.data]
        self.assertEqual(breaks, [90, 60, 30])

    def test_faster_time_breaks_a_tie(self):
        u1, u2 = _make_user('lb_tie_a'), _make_user('lb_tie_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=50, frame_time_seconds=400)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=50, frame_time_seconds=200)
        response = self.client.get(URL, {'reds_count': 15})
        usernames = [row['username'] for row in response.data]
        self.assertEqual(usernames, ['lb_tie_b', 'lb_tie_a'])

    def test_null_frame_time_sorts_last_among_ties(self):
        u1, u2 = _make_user('lb_null_a'), _make_user('lb_null_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=50, frame_time_seconds=None)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=50, frame_time_seconds=300)
        response = self.client.get(URL, {'reds_count': 15})
        usernames = [row['username'] for row in response.data]
        self.assertEqual(usernames, ['lb_null_b', 'lb_null_a'])

    def test_filters_by_reds_count(self):
        u1, u2 = _make_user('lb_reds_a'), _make_user('lb_reds_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=6, best_break=51)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=100)
        response = self.client.get(URL, {'reds_count': 6})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['best_break'], 51)

    def test_includes_verification_flag(self):
        u1 = _make_user('lb_flag')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=147, frame_time_seconds=10, is_verified=False)
        response = self.client.get(URL, {'reds_count': 15})
        self.assertFalse(response.data[0]['is_verified'])

    def test_limited_to_top_50(self):
        for i in range(60):
            u = _make_user(f'lb_bulk_{i}')
            PlayerBestBreak.objects.create(user=u, reds_count=15, best_break=i)
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(len(response.data), 50)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python manage.py test oneFourSeven.tests_leaderboard -v 2`
Expected: `FAIL` — 404 (no route yet) or `ImportError`.

- [ ] **Step 3: Add the serializer**

In `maxBreak/oneFourSeven/serializers.py`, after `PlayerBestBreakSerializer`:

```python
class LeaderboardEntrySerializer(serializers.ModelSerializer):
    """
    Serializes one row of the global best-break leaderboard. Includes
    username (unlike PlayerBestBreakSerializer, which is scoped to 'my own
    records' via request.user and has no need to expose whose row it is).
    """
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = PlayerBestBreak
        fields = ['username', 'reds_count', 'best_break', 'frame_time_seconds', 'is_verified', 'achieved_at']
```

- [ ] **Step 4: Add the view**

In `maxBreak/oneFourSeven/views.py`, add the import next to `PlayerBestBreakSerializer`'s import:

```python
from .serializers import (
    EventSerializer, MatchesOfAnEventSerializer, PlayerSerializer,
    RankingSerializer, UserSerializer, PlayerMatchHistorySerializer,
    ScoreboardMatchSerializer,
    PlayerBestBreakSerializer,
    LeaderboardEntrySerializer,
)
```

Add `from django.db.models import F` near the other Django imports at the top of the file.

Then add the view after `best_break_view` (after line ~2564, before the `Account Deletion` section):

```python
# ================== Global Leaderboard ==================

@api_view(['GET'])
@permission_classes([AllowAny])
def leaderboard_view(request):
    """
    GET /scoreboard/leaderboard/?reds_count=<n> — top 50 personal-best
    breaks across all users for one reds_count, ordered by best_break desc
    with frame_time_seconds asc as a tiebreak (a faster verified time ranks
    higher among equal breaks; missing timing data sorts last). Public —
    no auth required, same as other read-only ranking data in this app.
    """
    reds_count = request.query_params.get('reds_count')
    if reds_count is None:
        return Response({'error': 'reds_count is required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        reds_count = int(reds_count)
    except (TypeError, ValueError):
        return Response({'error': 'reds_count must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

    entries = (
        PlayerBestBreak.objects
        .filter(reds_count=reds_count)
        .select_related('user')
        .order_by('-best_break', F('frame_time_seconds').asc(nulls_last=True))
        [:50]
    )
    serializer = LeaderboardEntrySerializer(entries, many=True)
    return Response(serializer.data)
```

- [ ] **Step 5: Wire the URL**

In `maxBreak/oneFourSeven/urls.py`, add `leaderboard_view` to the `from .views import (...)` list (near `best_break_view` at line ~74):

```python
    best_break_view,
    leaderboard_view,
```

Add the route after `scoreboard/best-break/` (line ~200):

```python
    path('scoreboard/best-break/', best_break_view, name='scoreboard-best-break'),
    path('scoreboard/leaderboard/', leaderboard_view, name='scoreboard-leaderboard'),
```

- [ ] **Step 6: Run to verify it passes**

Run: `python manage.py test oneFourSeven.tests_leaderboard -v 2`
Expected: `OK` (10 tests)

- [ ] **Step 7: Run the full backend suite to check for regressions**

Run: `python manage.py test oneFourSeven`
Expected: same pass count as before this plan, plus the new tests (note the two known pre-existing failures from `docs/OPEN_MISSIONS.md` #1/#19 — `PlayerMatchHistoryOrderingTest.test_null_date_appears_last` — are expected and unrelated).

- [ ] **Step 8: Commit**

```bash
git add maxBreak/oneFourSeven/serializers.py maxBreak/oneFourSeven/views.py maxBreak/oneFourSeven/urls.py maxBreak/oneFourSeven/tests_leaderboard.py
git commit -m "feat: add global best-break leaderboard endpoint"
```

---

## Task 5: `useSessionTimer` hook

**Files:**
- Create: `FrontMaxBreak/hooks/useSessionTimer.ts`
- Test: `FrontMaxBreak/session_timer_test.mjs`

**Interfaces:**
- Produces: `useSessionTimer(): { elapsedSeconds: number }` — a hook that starts counting from mount. Also exports a pure helper `formatElapsed(seconds: number): string` (e.g. `"3:20"`, `"1:02:05"`) used by Task 10/11's display code.

- [ ] **Step 1: Write the failing test**

Since hooks can't run outside React, the test file exercises the pure, extractable pieces: `formatElapsed`. (The hook itself is a thin `setInterval` wrapper verified manually on-device per Task 10 — no React test harness exists in this repo per Open Mission #13, and this plan does not attempt to introduce one.)

```javascript
// FrontMaxBreak/session_timer_test.mjs
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node FrontMaxBreak/session_timer_test.mjs`
Expected: FAIL — `Cannot find module './hooks/useSessionTimer.ts'`

- [ ] **Step 3: Write the implementation**

```typescript
// FrontMaxBreak/hooks/useSessionTimer.ts
//
// Tracks elapsed time since the game screen was opened, regardless of mode
// (Match / Unlimited / Train). Pure observer — no dependency on
// useSnookerGame's GameState, so it can never affect or be affected by the
// game reducer.
import { useEffect, useRef, useState } from 'react';

export function useSessionTimer(): { elapsedSeconds: number } {
  const startedAtRef = useRef(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return { elapsedSeconds };
}

/** Formats a whole-second duration as "M:SS" or "H:MM:SS". Negative input clamps to 0. */
export function formatElapsed(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${minutes}:${pad(secs)}`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node FrontMaxBreak/session_timer_test.mjs`
Expected: `✅ All 9 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/hooks/useSessionTimer.ts FrontMaxBreak/session_timer_test.mjs
git commit -m "feat: add useSessionTimer hook"
```

---

## Task 6: `useFrameTimer` hook

**Files:**
- Create: `FrontMaxBreak/hooks/useFrameTimer.ts`
- Test: `FrontMaxBreak/frame_timer_test.mjs`

**Interfaces:**
- Consumes: a subset of `GameState` from `useSnookerGame.ts` — `frameNumber: number`, `isFrameOver: boolean`, and a `hasAnyPotThisFrame: boolean` flag the caller derives (see Task 10 wiring — computed as `breakBalls.length > 0 || currentBreak > 0` from the existing `GameState` fields already read in `game.tsx`).
- Produces: `useFrameTimer(input: { frameNumber: number; isFrameOver: boolean; hasAnyPotThisFrame: boolean }): { elapsedSeconds: number }` — the running elapsed time for the current frame, frozen once `isFrameOver` is true, reset to 0 on the next `frameNumber`. Also re-exports `formatElapsed` is NOT duplicated here — callers import it from `useSessionTimer.ts`.

- [ ] **Step 1: Write the failing test**

Frame-timer *logic* (when to start/stop/reset) is expressed as a pure reducer function `computeFrameTimerState` so it's fully unit-testable without mounting React — the hook itself is a thin wrapper that calls this function on each input change plus a 1s interval tick.

```javascript
// FrontMaxBreak/frame_timer_test.mjs
import assert from 'node:assert';
import { computeFrameTimerState } from './hooks/useFrameTimer.ts';

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node FrontMaxBreak/frame_timer_test.mjs`
Expected: FAIL — `Cannot find module './hooks/useFrameTimer.ts'`

- [ ] **Step 3: Write the implementation**

```typescript
// FrontMaxBreak/hooks/useFrameTimer.ts
//
// Tracks elapsed time for the current frame: starts on the first ball
// potted (any colour), freezes at frame end, resets on the next frame.
// Pure observer of GameState fields passed in by the caller (game.tsx) —
// never touches useSnookerGame's reducer.
import { useEffect, useRef, useState } from 'react';

export interface FrameTimerInput {
  frameNumber: number;
  isFrameOver: boolean;
  hasAnyPotThisFrame: boolean;
}

export interface FrameTimerState {
  frameNumber: number;
  startedAt: number | null;
  frozenElapsedMs: number | null;
}

const INITIAL_STATE: FrameTimerState = { frameNumber: 1, startedAt: null, frozenElapsedMs: null };

/** Pure state transition, fully unit-testable without mounting React. */
export function computeFrameTimerState(
  input: FrameTimerInput,
  prev: FrameTimerState,
  now: number,
): FrameTimerState {
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

export function useFrameTimer(input: FrameTimerInput): { elapsedSeconds: number } {
  const stateRef = useRef<FrameTimerState>(INITIAL_STATE);
  const [, forceTick] = useState(0);

  useEffect(() => {
    stateRef.current = computeFrameTimerState(input, stateRef.current, Date.now());
  }, [input.frameNumber, input.isFrameOver, input.hasAnyPotThisFrame]);

  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const s = stateRef.current;
  const elapsedMs = s.frozenElapsedMs !== null
    ? s.frozenElapsedMs
    : s.startedAt !== null
      ? Date.now() - s.startedAt
      : 0;
  return { elapsedSeconds: Math.floor(elapsedMs / 1000) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node FrontMaxBreak/frame_timer_test.mjs`
Expected: `✅ All 7 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/hooks/useFrameTimer.ts FrontMaxBreak/frame_timer_test.mjs
git commit -m "feat: add useFrameTimer hook"
```

---

## Task 7: `gameStorage.ts` — `durationSeconds` + `sumDurationForToday`

**Files:**
- Modify: `FrontMaxBreak/services/gameStorage.ts:12-24` (`StoredMatch` interface)
- Test: `FrontMaxBreak/stats_test.mjs` (append — this file already covers `gameStorage.ts`-adjacent stats logic per its header)

**Interfaces:**
- Produces: `StoredMatch.durationSeconds?: number` and `sumDurationForToday(matches: StoredMatch[], now?: Date): number` — used by Task 10 (writes the field on save) and by a future "time played today" display.

- [ ] **Step 1: Write the failing test**

Append to `FrontMaxBreak/stats_test.mjs` (append near the end, before the final summary `console.log`):

```javascript
console.log('sumDurationForToday');
{
  const { sumDurationForToday } = await import('./services/gameStorage.ts');
  const today = new Date('2026-09-16T12:00:00Z');
  const todayMorning = '2026-09-16T05:00:00.000Z';
  const yesterday = '2026-09-15T20:00:00.000Z';

  test('sums only today\'s matches', () => {
    const matches = [
      { id: 'a', startedAt: todayMorning, durationSeconds: 300 },
      { id: 'b', startedAt: yesterday, durationSeconds: 999 },
      { id: 'c', startedAt: todayMorning, durationSeconds: 120 },
    ];
    assert.strictEqual(sumDurationForToday(matches, today), 420);
  });

  test('empty list returns 0', () => {
    assert.strictEqual(sumDurationForToday([], today), 0);
  });

  test('missing durationSeconds counts as 0, does not throw', () => {
    const matches = [{ id: 'a', startedAt: todayMorning }];
    assert.strictEqual(sumDurationForToday(matches, today), 0);
  });

  test('exactly midnight boundary excludes yesterday', () => {
    const matches = [{ id: 'a', startedAt: '2026-09-15T23:59:59.000Z', durationSeconds: 100 }];
    assert.strictEqual(sumDurationForToday(matches, today), 0);
  });
}
```

(Match the exact `test`/`assert` helper names already used at the top of `stats_test.mjs` — read that file's existing header before inserting if names differ from `test`/`assert`.)

- [ ] **Step 2: Run to verify it fails**

Run: `node FrontMaxBreak/stats_test.mjs`
Expected: FAIL — `sumDurationForToday is not a function` or import error.

- [ ] **Step 3: Write the implementation**

In `FrontMaxBreak/services/gameStorage.ts`, update the interface:

```typescript
export interface StoredMatch {
  id: string;
  player1Name: string;
  player2Name: string;
  numberOfReds: number;
  bestOf: number | null;
  startedAt: string;
  completedAt?: string;
  isComplete: boolean;
  frameResults: FrameResult[];
  framesWon: [number, number];
  mode?: 'match' | 'train' | 'unlimited';
  durationSeconds?: number;
}
```

Add a new exported function near the other pure stat helpers (e.g. next to `groupByRivalry`):

```typescript
/** Sums durationSeconds across matches whose startedAt falls on the same calendar day as `now`. */
export function sumDurationForToday(matches: StoredMatch[], now: Date = new Date()): number {
  const todayKey = now.toDateString();
  return matches.reduce((total, m) => {
    const startedOnSameDay = new Date(m.startedAt).toDateString() === todayKey;
    return startedOnSameDay ? total + (m.durationSeconds ?? 0) : total;
  }, 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node FrontMaxBreak/stats_test.mjs`
Expected: `✅ All N assertions passed` (original 48 + 4 new = 52)

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/services/gameStorage.ts FrontMaxBreak/stats_test.mjs
git commit -m "feat: add durationSeconds field and sumDurationForToday helper"
```

---

## Task 8: `bestBreakService.ts` — extend `submitBreak` with `frame_time_seconds`

**Files:**
- Modify: `FrontMaxBreak/services/bestBreakService.ts`
- Test: `FrontMaxBreak/best_break_test.mjs`

**Interfaces:**
- Consumes: backend contract from Task 3 (`POST /scoreboard/best-break/` accepts optional `frame_time_seconds`, returns it plus `is_verified`).
- Produces: `submitBreak(redsCount: number, breakValue: number, frameTimeSeconds?: number): Promise<SubmitBreakResult | null>` — used by Task 10's `game.tsx` call site. `SubmitBreakResult` gains `frame_time_seconds: number | null` and `is_verified: boolean`.

- [ ] **Step 1: Write the failing test**

Read `FrontMaxBreak/best_break_test.mjs` first to match its existing mocking pattern for `axios`/`isLoggedIn`/`getAuthHeader` (it already tests `submitBreak`). Append a new block using that same pattern:

```javascript
console.log('submitBreak with frame_time_seconds');
{
  // Reuse this file's existing axios/authService mock setup exactly as the
  // prior submitBreak tests do — do not duplicate a second mock scheme.
  test('sends frame_time_seconds when provided', async () => {
    let sentBody = null;
    mockAxiosPost = async (url, body) => { sentBody = body; return { data: { reds_count: 15, best_break: 40, achieved_at: 'x', frame_time_seconds: 200, is_verified: true, is_new_record: true } }; };
    await submitBreak(15, 40, 200);
    assert.strictEqual(sentBody.frame_time_seconds, 200);
  });

  test('omits frame_time_seconds when not provided (backwards compatible)', async () => {
    let sentBody = null;
    mockAxiosPost = async (url, body) => { sentBody = body; return { data: { reds_count: 15, best_break: 40, achieved_at: 'x', frame_time_seconds: null, is_verified: true, is_new_record: true } }; };
    await submitBreak(15, 40);
    assert.strictEqual(sentBody.frame_time_seconds, undefined);
  });

  test('result includes is_verified from the response', async () => {
    mockAxiosPost = async () => ({ data: { reds_count: 15, best_break: 147, achieved_at: 'x', frame_time_seconds: 10, is_verified: false, is_new_record: true } });
    const result = await submitBreak(15, 147, 10);
    assert.strictEqual(result.is_verified, false);
  });
}
```

(Wire `mockAxiosPost` into this file's existing axios-mocking mechanism — match whatever pattern the file already uses for mocking `axios.post`, since the exact mock shape isn't reproduced here to avoid guessing at internals not yet read.)

- [ ] **Step 2: Run to verify it fails**

Run: `node FrontMaxBreak/best_break_test.mjs`
Expected: FAIL — `sentBody.frame_time_seconds` is `undefined` when `200` was expected (submitBreak doesn't send it yet).

- [ ] **Step 3: Write the implementation**

In `FrontMaxBreak/services/bestBreakService.ts`, update:

```typescript
export interface BestBreakRecord {
  reds_count: number;
  best_break: number;
  achieved_at: string;
  frame_time_seconds: number | null;
  is_verified: boolean;
}

export interface SubmitBreakResult extends BestBreakRecord {
  is_new_record: boolean;
}

// ...

export async function submitBreak(redsCount: number, breakValue: number, frameTimeSeconds?: number): Promise<SubmitBreakResult | null> {
  if (breakValue <= 0) return null; // nothing to record
  const logged = await isLoggedIn();
  if (!logged) return null;

  try {
    const header = await getAuthHeader();
    if (!header) return null;
    const body: Record<string, number> = { reds_count: redsCount, break: breakValue };
    if (frameTimeSeconds !== undefined) body.frame_time_seconds = frameTimeSeconds;
    const res = await axios.post(
      `${API_BASE}scoreboard/best-break/`,
      body,
      { headers: { Authorization: header } }
    );
    return res.data as SubmitBreakResult;
  } catch (error: any) {
    logger.warn('[BestBreak] submitBreak failed:', error?.message);
    return null;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node FrontMaxBreak/best_break_test.mjs`
Expected: `✅ All N assertions passed` (original count + 3)

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/services/bestBreakService.ts FrontMaxBreak/best_break_test.mjs
git commit -m "feat: send frame_time_seconds from submitBreak"
```

---

## Task 9: `leaderboardService.ts`

**Files:**
- Create: `FrontMaxBreak/services/leaderboardService.ts`
- Test: `FrontMaxBreak/leaderboard_service_test.mjs`

**Interfaces:**
- Consumes: `GET /scoreboard/leaderboard/?reds_count=<n>` from Task 4.
- Produces: `fetchLeaderboard(redsCount: number): Promise<LeaderboardEntry[]>` — used by Task 12's Leaderboard tab.

- [ ] **Step 1: Write the failing test**

Match the existing mocking pattern used in `best_break_test.mjs` for `axios.get` (read that file's mock setup for `fetchBestBreaks` specifically, since `fetchLeaderboard` is structurally identical — a GET with a query param, error-swallowing).

```javascript
// FrontMaxBreak/leaderboard_service_test.mjs
import assert from 'node:assert';

let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ok - ${name}`); }

console.log('fetchLeaderboard');
{
  const { fetchLeaderboard } = await import('./services/leaderboardService.ts');
  // (Mock axios.get the same way best_break_test.mjs mocks it for fetchBestBreaks.)

  test('returns entries from the response', async () => {
    mockAxiosGet = async () => ({ data: [{ username: 'David', reds_count: 15, best_break: 30, frame_time_seconds: 200, is_verified: true, achieved_at: 'x' }] });
    const result = await fetchLeaderboard(15);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].username, 'David');
  });

  test('passes reds_count as a query param', async () => {
    let sentUrl = null;
    mockAxiosGet = async (url) => { sentUrl = url; return { data: [] }; };
    await fetchLeaderboard(6);
    assert.ok(sentUrl.includes('reds_count=6'));
  });

  test('returns empty array on error, never throws', async () => {
    mockAxiosGet = async () => { throw new Error('network'); };
    const result = await fetchLeaderboard(15);
    assert.deepStrictEqual(result, []);
  });
}

console.log(`✅ All ${passed} assertions passed`);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node FrontMaxBreak/leaderboard_service_test.mjs`
Expected: FAIL — `Cannot find module './services/leaderboardService.ts'`

- [ ] **Step 3: Write the implementation**

```typescript
// FrontMaxBreak/services/leaderboardService.ts
//
// Global best-break leaderboard — public read, no auth required (mirrors
// the backend's leaderboard_view, which uses AllowAny).
import axios from 'axios';
import { logger } from '../utils/logger';

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'https://snookerapp.up.railway.app/oneFourSeven/';

export interface LeaderboardEntry {
  username: string;
  reds_count: number;
  best_break: number;
  frame_time_seconds: number | null;
  is_verified: boolean;
  achieved_at: string;
}

/** Top entries for one reds_count. Empty array on any error — never throws. */
export async function fetchLeaderboard(redsCount: number): Promise<LeaderboardEntry[]> {
  try {
    const res = await axios.get(`${API_BASE}scoreboard/leaderboard/?reds_count=${redsCount}`);
    return res.data as LeaderboardEntry[];
  } catch (error: any) {
    logger.warn('[Leaderboard] fetchLeaderboard failed:', error?.message);
    return [];
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node FrontMaxBreak/leaderboard_service_test.mjs`
Expected: `✅ All 3 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/services/leaderboardService.ts FrontMaxBreak/leaderboard_service_test.mjs
git commit -m "feat: add leaderboardService.fetchLeaderboard"
```

---

## Task 10: Wire both timers into `game.tsx`

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx`

**Interfaces:**
- Consumes: `useSessionTimer` (Task 5), `useFrameTimer` (Task 6), `submitBreak(redsCount, breakValue, frameTimeSeconds?)` (Task 8), `saveMatch`/`StoredMatch.durationSeconds` (Task 7).
- Produces: nothing new for later tasks — this is a leaf wiring task. Task 11 reads the frame timer's formatted value via a prop passed from here.

This task has no isolated unit test of its own (it's UI wiring of already-tested pieces) — verification is the full existing frontend suite (no regressions) plus a manual on-device check per this repo's UI-testing convention (CLAUDE.md: "For UI or frontend changes... test on device").

- [ ] **Step 1: Import the new hooks and helper**

Near the top of `FrontMaxBreak/app/scoreboard/game.tsx`, alongside the existing `bestBreakService` import (line 31):

```typescript
import { submitBreak, fetchBestBreakForRedsCount, isPotentialNewRecord } from '../../services/bestBreakService';
import { useSessionTimer, formatElapsed } from '../../hooks/useSessionTimer';
import { useFrameTimer } from '../../hooks/useFrameTimer';
```

- [ ] **Step 2: Call `useSessionTimer` once, unconditionally**

Inside `GameScreen`, near the other hook calls (after `useSnookerGame` on line 56):

```typescript
const { elapsedSeconds: sessionElapsedSeconds } = useSessionTimer();
```

- [ ] **Step 3: Call `useFrameTimer`, deriving `hasAnyPotThisFrame` from existing state**

Add after the `useSessionTimer` call. `snap` (the current frame snapshot) already exposes `breakBalls` and `currentBreak` (seen throughout this file, e.g. line 479-482) — a pot has happened this frame once either is non-empty/non-zero, OR the frame has already ended (so the flag must stay true through frame-end, not reset the instant the break itself resets to 0):

```typescript
const hasAnyPotThisFrame = snap.breakBalls.length > 0 || snap.currentBreak > 0 || snap.isFrameOver;
const { elapsedSeconds: frameElapsedSeconds } = useFrameTimer({
  frameNumber,
  isFrameOver: snap.isFrameOver,
  hasAnyPotThisFrame,
});
```

Place this after `snap`/`frameNumber` are defined (both already exist earlier in the function — confirm their exact definition lines by reading the file before inserting, since this plan doesn't reproduce the full file).

- [ ] **Step 4: Pass `frame_time_seconds` into the existing `submitBreak` call**

Change (around line 166, inside the Train-mode frame-over branch):

```typescript
      if (isTrainMode) {
        setIsNewRecordThisBreak(false);
        submitBreak(config.numberOfReds, snap.scores[0]).then(result => {
          if (!result) return;
          setKnownBestBreak(prev => Math.max(prev ?? 0, result.best_break));
          setIsNewRecordThisBreak(result.is_new_record);
        });
```

to:

```typescript
      if (isTrainMode) {
        setIsNewRecordThisBreak(false);
        submitBreak(config.numberOfReds, snap.scores[0], frameElapsedSeconds).then(result => {
          if (!result) return;
          setKnownBestBreak(prev => Math.max(prev ?? 0, result.best_break));
          setIsNewRecordThisBreak(result.is_new_record);
        });
```

- [ ] **Step 5: Write `durationSeconds` on match save**

Find the `stored` object construction (around line 194-204):

```typescript
      id: config.id,
      player1Name: config.player1Name,
      player2Name: config.player2Name,
      numberOfReds: config.numberOfReds,
      bestOf: isTrainMode ? null : config.bestOf,
      startedAt: new Date().toISOString(),
      isComplete: complete,
      frameResults: results,
      framesWon: fw,
      mode: isTrainMode ? 'train' : isUnlimitedMode ? 'unlimited' : 'match',
    };
```

add `durationSeconds: sessionElapsedSeconds,` to that object:

```typescript
      id: config.id,
      player1Name: config.player1Name,
      player2Name: config.player2Name,
      numberOfReds: config.numberOfReds,
      bestOf: isTrainMode ? null : config.bestOf,
      startedAt: new Date().toISOString(),
      isComplete: complete,
      frameResults: results,
      framesWon: fw,
      mode: isTrainMode ? 'train' : isUnlimitedMode ? 'unlimited' : 'match',
      durationSeconds: sessionElapsedSeconds,
    };
```

- [ ] **Step 6: Display the session timer in the header**

In the header area (around line 422-439, where `isTrainMode` renders "Training Session" / frame score), add a small elapsed-time line. Locate the existing header `<View style={{ alignItems: 'center' }}>` block and add beneath the existing label text, inside both the train and non-train branches, a shared small subtext:

```typescript
<Text style={[styles.frameLabel, { color: c.textMuted, fontSize: 11, marginTop: 2 }]}>
  {formatElapsed(sessionElapsedSeconds)}
</Text>
```

(Exact placement depends on the surrounding JSX read live — insert it as a sibling text line under whichever branch is active, not duplicating the whole block.)

- [ ] **Step 7: Run the full frontend suite for regressions**

Run (from `FrontMaxBreak/`):
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs && node best_break_test.mjs && node session_timer_test.mjs && node frame_timer_test.mjs && node leaderboard_service_test.mjs
```
Expected: `✅ All N assertions passed` for every file, no regressions.

- [ ] **Step 8: Manual device verification**

Per CLAUDE.md's UI-testing rule: run `npx expo start` (preview build/dev client), start a Train-mode session, confirm: (a) the session time ticks up in the header, (b) a frame's time appears to track correctly, (c) `submitBreak` still fires and a new personal best still celebrates as before (no regression to the existing Phase 1/2 behavior).

- [ ] **Step 9: Commit**

```bash
git add FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "feat: wire session and frame timers into the game screen"
```

---

## Task 11: `FrameSummary.tsx` — display frame time

**Files:**
- Modify: `FrontMaxBreak/app/components/scoreboard/FrameSummary.tsx`
- Modify: `FrontMaxBreak/app/scoreboard/game.tsx` (pass the new prop)

**Interfaces:**
- Consumes: `frameElapsedSeconds` from Task 10's `useFrameTimer` call, `formatElapsed` from Task 5.
- Produces: `FrameSummary`'s `Props` gains an optional `frameDurationSeconds?: number`, purely additive — every other existing caller/prop is unaffected.

- [ ] **Step 1: Add the prop and render it**

In `FrontMaxBreak/app/components/scoreboard/FrameSummary.tsx`, find the `Props` interface (near line 19, alongside `sessionBest?: number`) and add:

```typescript
  frameDurationSeconds?: number;
```

Add `formatElapsed` import at the top, alongside the existing `scoreboardColors` import from `'../../../constants/scoreboardTheme'` (line 3):

```typescript
import { formatElapsed } from '../../../hooks/useSessionTimer';
```

In the function signature (line 30-34), add `frameDurationSeconds` to the destructured props:

```typescript
export default function FrameSummary({
  visible, frameNumber, scores, highestBreak, playerNames, framesWon, winner,
  isMatchOver, matchWinner, bestOf, onNextFrame, onEndMatch, trainMode, sessionBest,
  onShare, onSignIn, frameDurationSeconds,
}: Props) {
```

Near the existing `sessionBest` display block (line 58-62), add a sibling line:

```typescript
            {frameDurationSeconds !== undefined && (
              <Text style={[styles.subtext, { color: c.textMuted }]}>
                Frame time: {formatElapsed(frameDurationSeconds)}
              </Text>
            )}
```

- [ ] **Step 2: Pass the prop from `game.tsx`**

In the `<FrameSummary ... />` JSX (around line 629-656 in `game.tsx`), add:

```typescript
            frameDurationSeconds={frameElapsedSeconds}
```

- [ ] **Step 3: Run the full frontend suite**

Run:
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```
Expected: `✅ All N assertions passed` for every file — this is a display-only additive prop, so no existing assertion should change.

- [ ] **Step 4: Manual device verification**

End a frame in Train mode, confirm the "Frame time: X:XX" line appears on the Frame Summary modal with a plausible value.

- [ ] **Step 5: Commit**

```bash
git add "FrontMaxBreak/app/components/scoreboard/FrameSummary.tsx" FrontMaxBreak/app/scoreboard/game.tsx
git commit -m "feat: show frame duration on the Frame Summary modal"
```

---

## Task 12: "Leaderboard" tab in `history.tsx`

**Files:**
- Modify: `FrontMaxBreak/app/scoreboard/history.tsx`
- Create: `FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx`

**Interfaces:**
- Consumes: `fetchLeaderboard(redsCount)` from Task 9.
- Produces: nothing consumed by later tasks — this is the final UI leaf.

- [ ] **Step 1: Build the new tab component**

```typescript
// FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx
//
// Global best-break leaderboard, split by reds_count (6-red / 15-red boards
// are never comparable — see PlayerBestBreak's backend docstring).
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { fetchLeaderboard, LeaderboardEntry } from '../../../services/leaderboardService';
import { formatElapsed } from '../../../hooks/useSessionTimer';
import { scoreboardColors as c } from '../../../constants/scoreboardTheme';

const REDS_OPTIONS = [15, 6] as const;

export default function LeaderboardTab() {
  const [redsCount, setRedsCount] = useState<number>(15);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard(redsCount).then(result => {
      if (!cancelled) {
        setEntries(result);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [redsCount]);

  return (
    <View style={styles.container}>
      <View style={styles.pillRow}>
        {REDS_OPTIONS.map(n => (
          <TouchableOpacity
            key={n}
            onPress={() => setRedsCount(n)}
            style={[styles.pill, redsCount === n && styles.pillActive]}
          >
            <Text style={[styles.pillText, redsCount === n && styles.pillTextActive]}>
              {n} reds
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={c.primary} style={{ marginTop: 24 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.empty}>No records yet for this format.</Text>
      ) : (
        entries.map((entry, i) => (
          <View key={`${entry.username}-${i}`} style={styles.row}>
            <Text style={styles.rank}>{i + 1}.</Text>
            <Text style={styles.name}>{entry.username}</Text>
            <Text style={styles.stat}>Break {entry.best_break}</Text>
            <Text style={styles.stat}>
              {entry.frame_time_seconds !== null ? formatElapsed(entry.frame_time_seconds) : '—'}
            </Text>
            {!entry.is_verified && <Text style={styles.flag}>⚠</Text>}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.cardBorder },
  pillActive: { backgroundColor: c.primary, borderColor: c.primary },
  pillText: { color: c.textMuted, fontSize: 13 },
  pillTextActive: { color: c.background, fontWeight: '600' },
  empty: { color: c.textMuted, textAlign: 'center', marginTop: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.cardBorder },
  rank: { color: c.textMuted, width: 24 },
  name: { color: c.textPrimary, flex: 1, fontWeight: '600' },
  stat: { color: c.textSecondary, fontSize: 13, marginLeft: 8 },
  flag: { marginLeft: 6 },
});
```

Import path confirmed against `FrameSummary.tsx:3`, which imports `scoreboardColors` from `'../../../constants/scoreboardTheme'` the same three levels down from `app/`; color keys (`cardBorder`, `background`, `textMuted`, `primary`, `textPrimary`, `textSecondary`) confirmed against `constants/scoreboardTheme.ts:29-45`.

- [ ] **Step 2: Wire it into the tab switcher**

In `FrontMaxBreak/app/scoreboard/history.tsx`, change the tab type (line 18):

```typescript
const [activeTab, setActiveTab] = useState<'matches' | 'training' | 'leaderboard'>('matches');
```

Add `'leaderboard'` to the tab-rendering array (line 241):

```typescript
        {(['matches', 'training', 'leaderboard'] as const).map(tab => (
```

Add a label case alongside the existing `tab === 'matches'` ternary (line 248) — extend it to a small lookup instead of nesting another ternary:

```typescript
              {tab === 'matches' ? 'Matches' : tab === 'training' ? 'Training' : 'Leaderboard'}
```

(Match whatever the existing label text actually says — read lines 241-256 directly before editing, since this plan infers the shape from a partial grep, not the full block.)

Add the render branch near the existing `activeTab === 'matches' ? (...) : (...)` block (line 258) — insert leaderboard as a third branch:

```typescript
      {activeTab === 'matches' ? (
        /* existing matches JSX, unchanged */
        ...
      ) : activeTab === 'training' ? (
        /* existing training JSX, unchanged */
        ...
      ) : (
        <LeaderboardTab />
      )}
```

Add the import at the top of the file:

```typescript
import LeaderboardTab from '../components/scoreboard/LeaderboardTab';
```

- [ ] **Step 3: Run the full frontend suite**

Run:
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs && node best_break_test.mjs && node session_timer_test.mjs && node frame_timer_test.mjs && node leaderboard_service_test.mjs
```
Expected: `✅ All N assertions passed` for every file.

- [ ] **Step 4: Manual device verification**

Open the Scoreboard History screen, switch to the new "Leaderboard" tab, confirm the 15-red/6-red pill toggle works and entries render (or the empty state, if no data yet) with no crash.

- [ ] **Step 5: Commit**

```bash
git add FrontMaxBreak/app/components/scoreboard/LeaderboardTab.tsx FrontMaxBreak/app/scoreboard/history.tsx
git commit -m "feat: add Leaderboard tab to scoreboard history screen"
```

---

## Task 13: Session documentation (per project rule)

**Files:**
- Create: `docs/SESSION_2026-09-16_session_frame_timers_and_leaderboard.md`
- Modify: (memory, outside this repo) `MEMORY.md` + a new linked memory file

- [ ] **Step 1: Write the session doc**

Cover, per CLAUDE.md's rule 13: the feature built (not a bug fix, but the same documentation bar applies to a completed feature per rule 8's "MD file summarising what was done"), every file touched and why, full test output from Tasks 1-12, what's device-verified vs not yet, and any gotcha for a future agent (e.g. "`useFrameTimer`/`useSessionTimer` intentionally never touch `useSnookerGame.ts` — don't merge that logic in later without re-reading this doc's reasoning").

- [ ] **Step 2: Commit**

```bash
git add "docs/SESSION_2026-09-16_session_frame_timers_and_leaderboard.md"
git commit -m "docs: add session doc for session/frame timers + leaderboard feature"
```

- [ ] **Step 3: Update memory**

Add a one-line pointer in `MEMORY.md`'s "Recent fixes" or "Active / paused work" section plus a linked memory file, per this repo's existing memory-hygiene convention (see `MEMORY.md`'s own instructions) — done as a normal memory-write, not part of this plan's git history.

---

## After this plan

Deployment is explicitly **out of scope for this plan** — per CLAUDE.md rule 6 ("Preview before production always") and the "Deployment requires explicit user approval" rule, `eas update --channel preview` (frontend) and confirming the Railway backend deploy (`git push master`, auto-deploys) both require a separate, explicit go-ahead from the user after all 13 tasks are complete and device-verified. Do not run either as part of executing this plan.
