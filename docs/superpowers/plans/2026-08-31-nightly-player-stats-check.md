# Nightly Player-Stats Accuracy Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent, nightly GitHub Actions job that checks every player's stats for internal consistency, cross-checks a rolling slice of players against snooker.org's real career numbers, auto-repairs known-safe missing-data flags, and pages the developer only when something is still wrong.

**Architecture:** A pure, DB-free flag-computation module (`nightly_stats_checks.py`) holds all the "is this player's data suspicious" rules so they're unit-testable without touching Postgres or the network. A new management command (`nightly_stats_check.py`) wires that module to real `Player`/`PlayerMatchHistory`/`Ranking` queries, an optional snooker.org t=4 API cross-check, the existing `backfill_career_history --force` command as its only write path, and an Expo push notification. A GitHub Actions workflow runs the command nightly against the production database via `DATABASE_URL`, with the rolling API-check cursor persisted in Actions cache (never git).

**Tech Stack:** Django management command, Python `dataclasses`, `requests` (already a dependency), Django's test runner (`SimpleTestCase`/`TestCase`), `unittest.mock`, GitHub Actions (`schedule` cron + `actions/cache`).

**Spec:** `docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md`

## Global Constraints

- The job must never call `.save()`/`.update()` on any model directly — its only write path is invoking the existing `backfill_career_history --force` command for the known-safe flag set (`NO_MATCHES`, `LOW_MATCHES`, `ORPHAN`).
- The job must never commit or push to any git branch. Cursor state lives only in GitHub Actions cache (`nightly_stats_cursor.json`, not committed to the repo).
- Every per-player check, every auto-fix attempt, and the outbound push call must be individually isolated (try/except) so one failure cannot abort the whole run.
- Clean or fully self-healed runs must send zero notifications.
- API cross-check throttles at 30 seconds between snooker.org calls (existing repo convention, `API_CALL_DELAY` in `verify_player_stats.py`).
- Follow CLAUDE.md rule 8: this feature needs 100+ tests before it's considered done, spread across the tasks below.
- `X-Requested-By: FahimaApp128` header is required on every snooker.org API call — do not change it.

---

## File Structure

- **Create** `maxBreak/oneFourSeven/nightly_stats_checks.py` — all pure flag logic, snapshot building, cursor I/O, API fetch, auto-fix, and notification-building helpers. One file because these are all small, single-purpose functions the command composes; splitting further would just add import overhead for no isolation benefit.
- **Create** `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py` — thin orchestration only (argument parsing, looping, calling the helpers above, printing the report, exit code).
- **Create** `maxBreak/oneFourSeven/tests_nightly_stats_check.py` — all tests for both files above, following the existing flat `tests_<topic>.py` convention already used in this app (see `tests_player_stats_targeting.py`, `tests_tournament_path.py`).
- **Create** `.github/workflows/nightly_stats_check.yml` — the cron workflow.
- **Modify** `docs/OPEN_MISSIONS.md` — log the broader stats-audit non-goal as an open item.
- **Create** `docs/SESSION_2026-08-31_NIGHTLY_STATS_CHECK.md` — session doc per CLAUDE.md rule 13.
- **Modify** `CLAUDE.md` — add `nightly_stats_check` to the "Key management commands" list.

---

### Task 1: Pure flag-computation logic

**Files:**
- Create: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Produces: `Flag(code: str, detail: str)` dataclass; `PlayerSnapshot` dataclass with fields `player_id: int, name: str, years_as_pro: int, total_matches: int, wins: int, losses: int, finals_reached: int, rn_pct: float, orphaned_seasons: list[int], is_top32: bool`; `compute_db_flags(snapshot: PlayerSnapshot) -> list[Flag]`; `compute_api_flags(snapshot: PlayerSnapshot, api_titles: int | None) -> list[Flag]`; `is_auto_fixable(flags: list[Flag]) -> bool`; module constants `MIN_MATCHES_PER_SEASON = 10`, `WIN_RATE_MIN = 0.30`, `WIN_RATE_MAX = 0.90`, `AUTO_FIXABLE_CODES = frozenset({'NO_MATCHES', 'LOW_MATCHES', 'ORPHAN'})`.

- [ ] **Step 1: Write the failing tests**

Create `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
"""
Tests for the nightly player-stats accuracy check.
See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.
"""

from django.test import SimpleTestCase

from oneFourSeven.nightly_stats_checks import (
    Flag,
    PlayerSnapshot,
    compute_db_flags,
    compute_api_flags,
    is_auto_fixable,
)


def make_snapshot(**overrides):
    defaults = dict(
        player_id=1, name='Test Player', years_as_pro=5, total_matches=100,
        wins=60, losses=40, finals_reached=2, rn_pct=95.0,
        orphaned_seasons=[], is_top32=False,
    )
    defaults.update(overrides)
    return PlayerSnapshot(**defaults)


class ComputeDbFlagsTests(SimpleTestCase):
    def test_healthy_player_has_no_flags(self):
        self.assertEqual(compute_db_flags(make_snapshot()), [])

    def test_no_matches_flag_for_veteran_with_zero_matches(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=3, total_matches=0))
        self.assertEqual([f.code for f in flags], ['NO_MATCHES', 'LOW_MATCHES'])

    def test_no_matches_flag_skipped_for_rookie(self):
        snap = make_snapshot(years_as_pro=1, total_matches=0)
        self.assertEqual(compute_db_flags(snap), [])

    def test_low_matches_flag_detail_shows_actual_vs_expected(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=5, total_matches=10))
        codes = [f.code for f in flags]
        self.assertIn('LOW_MATCHES', codes)
        detail = next(f.detail for f in flags if f.code == 'LOW_MATCHES')
        self.assertEqual(detail, 'LOW_MATCHES(10<50)')

    def test_low_matches_flag_not_raised_when_matches_sufficient(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=5, total_matches=50))
        self.assertNotIn('LOW_MATCHES', [f.code for f in flags])

    def test_no_finals_flag_only_for_top32_veteran(self):
        snap = make_snapshot(is_top32=True, years_as_pro=6, finals_reached=0)
        self.assertIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_no_finals_flag_skipped_outside_top32(self):
        snap = make_snapshot(is_top32=False, years_as_pro=6, finals_reached=0)
        self.assertNotIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_no_finals_flag_skipped_for_recent_top32_player(self):
        snap = make_snapshot(is_top32=True, years_as_pro=3, finals_reached=0)
        self.assertNotIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_low_round_name_coverage_flag(self):
        flags = compute_db_flags(make_snapshot(total_matches=50, rn_pct=40.0))
        self.assertIn('LOW_ROUND_NAME_COVERAGE', [f.code for f in flags])

    def test_round_name_coverage_flag_skipped_below_match_threshold(self):
        flags = compute_db_flags(make_snapshot(total_matches=10, rn_pct=0.0))
        self.assertNotIn('LOW_ROUND_NAME_COVERAGE', [f.code for f in flags])

    def test_orphan_flag(self):
        flags = compute_db_flags(make_snapshot(orphaned_seasons=[2019, 2020]))
        self.assertEqual([f.code for f in flags], ['ORPHAN'])
        self.assertEqual(flags[0].detail, 'ORPHAN(2seasons)')

    def test_no_orphan_flag_when_no_gaps(self):
        flags = compute_db_flags(make_snapshot(orphaned_seasons=[]))
        self.assertNotIn('ORPHAN', [f.code for f in flags])

    def test_multiple_flags_can_combine(self):
        snap = make_snapshot(years_as_pro=5, total_matches=0, orphaned_seasons=[2021])
        codes = {f.code for f in compute_db_flags(snap)}
        self.assertEqual(codes, {'NO_MATCHES', 'LOW_MATCHES', 'ORPHAN'})


class ComputeApiFlagsTests(SimpleTestCase):
    def test_healthy_player_has_no_flags(self):
        snap = make_snapshot(wins=60, losses=40, finals_reached=2)
        self.assertEqual(compute_api_flags(snap, api_titles=1), [])

    def test_bad_win_rate_too_high(self):
        snap = make_snapshot(wins=95, losses=5)
        flags = compute_api_flags(snap, api_titles=0)
        self.assertEqual([f.code for f in flags], ['BAD_WIN_RATE'])
        self.assertEqual(flags[0].detail, 'BAD_WIN_RATE(95%)')

    def test_bad_win_rate_too_low(self):
        snap = make_snapshot(wins=5, losses=95)
        flags = compute_api_flags(snap, api_titles=0)
        self.assertEqual([f.code for f in flags], ['BAD_WIN_RATE'])

    def test_bad_win_rate_skipped_for_small_sample(self):
        snap = make_snapshot(wins=19, losses=1)
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_bad_win_rate_skipped_within_bounds(self):
        snap = make_snapshot(wins=55, losses=45)
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_finals_lt_titles_flag(self):
        snap = make_snapshot(finals_reached=1)
        flags = compute_api_flags(snap, api_titles=3)
        self.assertEqual([f.code for f in flags], ['FINALS_LT_TITLES'])
        self.assertEqual(flags[0].detail, 'FINALS_LT_TITLES(1<3)')

    def test_finals_lt_titles_skipped_when_no_api_titles(self):
        snap = make_snapshot(finals_reached=0)
        self.assertEqual(compute_api_flags(snap, api_titles=None), [])
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_finals_lt_titles_skipped_when_finals_cover_titles(self):
        snap = make_snapshot(finals_reached=5)
        self.assertEqual(compute_api_flags(snap, api_titles=3), [])

    def test_both_api_flags_can_combine(self):
        snap = make_snapshot(wins=95, losses=5, finals_reached=0)
        codes = {f.code for f in compute_api_flags(snap, api_titles=2)}
        self.assertEqual(codes, {'BAD_WIN_RATE', 'FINALS_LT_TITLES'})


class IsAutoFixableTests(SimpleTestCase):
    def test_empty_flags_not_auto_fixable(self):
        self.assertFalse(is_auto_fixable([]))

    def test_known_safe_flags_are_auto_fixable(self):
        flags = [Flag('NO_MATCHES', 'NO_MATCHES'), Flag('ORPHAN', 'ORPHAN(1seasons)')]
        self.assertTrue(is_auto_fixable(flags))

    def test_single_low_matches_flag_is_auto_fixable(self):
        self.assertTrue(is_auto_fixable([Flag('LOW_MATCHES', 'LOW_MATCHES(1<10)')]))

    def test_mixed_flags_not_auto_fixable(self):
        flags = [Flag('NO_MATCHES', 'NO_MATCHES'), Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]
        self.assertFalse(is_auto_fixable(flags))

    def test_unknown_flag_alone_not_auto_fixable(self):
        self.assertFalse(is_auto_fixable([Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]))

    def test_unknown_flag_alone_not_auto_fixable_no_finals(self):
        self.assertFalse(is_auto_fixable([Flag('NO_FINALS', 'NO_FINALS')]))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL / ERROR — `ModuleNotFoundError: No module named 'oneFourSeven.nightly_stats_checks'`

- [ ] **Step 3: Write the implementation**

Create `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
"""
Pure flag-computation logic for the nightly player-stats accuracy check.

Deliberately free of Django ORM queries and network calls so the rules
that decide "this player's data looks wrong" can be unit tested without a
database or the internet. The management command
(management/commands/nightly_stats_check.py) is the only place that wires
this module up to real Player/PlayerMatchHistory rows, the snooker.org
API, backfill_career_history, and the push notification.

See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.
"""

from dataclasses import dataclass

MIN_MATCHES_PER_SEASON = 10
WIN_RATE_MIN = 0.30
WIN_RATE_MAX = 0.90

# Flags in this set describe *missing* data, not a data anomaly that needs
# human judgement — they're the exact cases backfill_career_history --force
# already exists to repair. Anything not in this set always goes to the
# notify path untouched.
AUTO_FIXABLE_CODES = frozenset({'NO_MATCHES', 'LOW_MATCHES', 'ORPHAN'})


@dataclass(frozen=True)
class Flag:
    code: str
    detail: str


@dataclass
class PlayerSnapshot:
    """Precomputed per-player numbers the flag rules run against."""
    player_id: int
    name: str
    years_as_pro: int
    total_matches: int
    wins: int
    losses: int
    finals_reached: int
    rn_pct: float
    orphaned_seasons: list
    is_top32: bool


def compute_db_flags(snapshot: PlayerSnapshot) -> list:
    """Internal-consistency checks — no network, no snooker.org
    comparison. Adapted from validate_career_data.py's flag rules."""
    flags = []
    s = snapshot

    if s.years_as_pro >= 2 and s.total_matches == 0:
        flags.append(Flag('NO_MATCHES', 'NO_MATCHES'))

    min_expected = s.years_as_pro * MIN_MATCHES_PER_SEASON
    if s.years_as_pro >= 2 and s.total_matches < min_expected:
        flags.append(Flag('LOW_MATCHES', f'LOW_MATCHES({s.total_matches}<{min_expected})'))

    if s.is_top32 and s.years_as_pro >= 5 and s.finals_reached == 0:
        flags.append(Flag('NO_FINALS', 'NO_FINALS'))

    if s.total_matches >= 20 and s.rn_pct < 80:
        flags.append(Flag('LOW_ROUND_NAME_COVERAGE', f'LOW_ROUND_NAME_COVERAGE({s.rn_pct:.0f}%)'))

    if s.orphaned_seasons:
        flags.append(Flag('ORPHAN', f'ORPHAN({len(s.orphaned_seasons)}seasons)'))

    return flags


def compute_api_flags(snapshot: PlayerSnapshot, api_titles) -> list:
    """Source-of-truth cross-check against snooker.org t=4 data. Adapted
    from verify_player_stats.py's flag rules. Never mutates anything —
    the caller decides what, if anything, to do with the flags."""
    flags = []
    s = snapshot
    total_decided = s.wins + s.losses

    if total_decided > 20:
        win_rate = s.wins / total_decided
        if not (WIN_RATE_MIN <= win_rate <= WIN_RATE_MAX):
            flags.append(Flag('BAD_WIN_RATE', f'BAD_WIN_RATE({win_rate:.0%})'))

    if api_titles and api_titles > 0 and s.finals_reached < api_titles:
        flags.append(Flag('FINALS_LT_TITLES', f'FINALS_LT_TITLES({s.finals_reached}<{api_titles})'))

    return flags


def is_auto_fixable(flags: list) -> bool:
    """True only if every flag on this player is in the known-safe set."""
    return bool(flags) and all(f.code in AUTO_FIXABLE_CODES for f in flags)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 24 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add pure flag-computation logic for nightly stats check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 2: Real snapshot builder (DB queries)

**Files:**
- Modify: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Consumes: `PlayerSnapshot` from Task 1.
- Produces: `build_snapshot(player, current_season: int, top32_ids: set) -> PlayerSnapshot`; `get_top32_ids(current_season: int) -> set[int]`; `iter_all_players() -> QuerySet[Player]`.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
from django.test import TestCase

from oneFourSeven.models import Player, PlayerMatchHistory, Ranking
from oneFourSeven.nightly_stats_checks import build_snapshot, get_top32_ids, iter_all_players


class BuildSnapshotTests(TestCase):
    def setUp(self):
        self.player = Player.objects.create(
            ID=1001, FirstName='Ronnie', LastName='OSullivan', FirstSeasonAsPro=2005,
        )

    def _add_match(self, **overrides):
        defaults = dict(
            api_match_id=1, player_id=self.player.ID, event_id=1,
            round_number=1, round_name='Final',
            player1_id=self.player.ID, player1_name='Ronnie OSullivan',
            player2_id=2002, player2_name='Opponent',
            winner_id=self.player.ID, season=2024,
        )
        defaults.update(overrides)
        defaults['api_match_id'] = PlayerMatchHistory.objects.count() + 1
        return PlayerMatchHistory.objects.create(**defaults)

    def test_snapshot_with_no_matches(self):
        snap = build_snapshot(self.player, current_season=2026, top32_ids=set())
        self.assertEqual(snap.total_matches, 0)
        self.assertEqual(snap.wins, 0)
        self.assertEqual(snap.losses, 0)
        self.assertEqual(snap.finals_reached, 0)
        self.assertEqual(snap.rn_pct, 0.0)
        self.assertFalse(snap.is_top32)
        # every season from 2005..2026 is orphaned with zero rows
        self.assertEqual(len(snap.orphaned_seasons), 22)

    def test_snapshot_counts_wins_losses_and_finals(self):
        self._add_match(round_name='Final', winner_id=self.player.ID, season=2024)
        self._add_match(round_name='Semi-Final', winner_id=2002, season=2024, round_number=2)
        snap = build_snapshot(self.player, current_season=2026, top32_ids=set())
        self.assertEqual(snap.total_matches, 2)
        self.assertEqual(snap.wins, 1)
        self.assertEqual(snap.losses, 1)
        self.assertEqual(snap.finals_reached, 1)
        self.assertEqual(snap.rn_pct, 100.0)

    def test_snapshot_is_top32_reflects_membership(self):
        snap_in = build_snapshot(self.player, current_season=2026, top32_ids={1001, 5})
        snap_out = build_snapshot(self.player, current_season=2026, top32_ids={5})
        self.assertTrue(snap_in.is_top32)
        self.assertFalse(snap_out.is_top32)

    def test_snapshot_years_as_pro_defaults_when_first_season_missing(self):
        rookie = Player.objects.create(ID=1002, FirstName='New', LastName='Pro', FirstSeasonAsPro=None)
        snap = build_snapshot(rookie, current_season=2026, top32_ids=set())
        self.assertEqual(snap.years_as_pro, 2026 - 2005 + 1)

    def test_snapshot_name_joins_first_and_last(self):
        snap = build_snapshot(self.player, current_season=2026, top32_ids=set())
        self.assertEqual(snap.name, 'Ronnie OSullivan')

    def test_snapshot_orphaned_season_present_when_a_gap_exists(self):
        self._add_match(season=2024)
        snap = build_snapshot(self.player, current_season=2025, top32_ids=set())
        self.assertIn(2023, snap.orphaned_seasons)
        self.assertNotIn(2024, snap.orphaned_seasons)

    def test_snapshot_round_name_coverage_partial(self):
        self._add_match(round_name='Final', season=2024)
        self._add_match(round_name=None, season=2024, round_number=2)
        snap = build_snapshot(self.player, current_season=2026, top32_ids=set())
        self.assertEqual(snap.rn_pct, 50.0)


class GetTop32IdsTests(TestCase):
    def test_returns_top32_by_position_across_two_seasons(self):
        p1 = Player.objects.create(ID=1, FirstName='A', LastName='A')
        p2 = Player.objects.create(ID=2, FirstName='B', LastName='B')
        Ranking.objects.create(ID=1, Player=p1, Season=2026, Position=1, Type='MoneyRankings')
        Ranking.objects.create(ID=2, Player=p2, Season=2025, Position=2, Type='MoneyRankings')
        ids = get_top32_ids(current_season=2026)
        self.assertEqual(ids, {1, 2})

    def test_ignores_non_money_ranking_types(self):
        p1 = Player.objects.create(ID=1, FirstName='A', LastName='A')
        Ranking.objects.create(ID=1, Player=p1, Season=2026, Position=1, Type='OneYear')
        self.assertEqual(get_top32_ids(current_season=2026), set())

    def test_ignores_seasons_outside_current_or_previous(self):
        p1 = Player.objects.create(ID=1, FirstName='A', LastName='A')
        Ranking.objects.create(ID=1, Player=p1, Season=2020, Position=1, Type='MoneyRankings')
        self.assertEqual(get_top32_ids(current_season=2026), set())


class IterAllPlayersTests(TestCase):
    def test_returns_every_player_ordered_by_id(self):
        Player.objects.create(ID=5, FirstName='E', LastName='E')
        Player.objects.create(ID=1, FirstName='A', LastName='A')
        ids = [p.ID for p in iter_all_players()]
        self.assertEqual(ids, [1, 5])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `ImportError: cannot import name 'build_snapshot'`

- [ ] **Step 3: Write the implementation**

Append to `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
def get_top32_ids(current_season: int) -> set:
    """Player IDs in the top 32 of MoneyRankings across the current and
    previous season — same lookup used by verify_player_stats.py and
    validate_career_data.py."""
    from oneFourSeven.models import Ranking

    ids = Ranking.objects.filter(
        Type='MoneyRankings',
        Season__in=[current_season, current_season - 1],
    ).order_by('Position').values_list('Player_id', flat=True)[:32]
    return set(ids)


def iter_all_players():
    """Every Player row, ordered by ID for stable, resumable iteration."""
    from oneFourSeven.models import Player

    return Player.objects.order_by('ID')


def build_snapshot(player, current_season: int, top32_ids: set) -> PlayerSnapshot:
    """Query PlayerMatchHistory for one player and turn the results into
    a PlayerSnapshot the flag rules can run against.

    Note: unlike backfill_career_history.py's progress-file bookkeeping
    (backfill_progress.json, meant for a one-time manual backfill run),
    this treats every season with zero rows as orphaned — the nightly
    check is meant to be strict, and auto-fix (Task 5) already knows how
    to repair a real ORPHAN flag safely.
    """
    from oneFourSeven.models import PlayerMatchHistory

    first = player.FirstSeasonAsPro or 2005
    years_as_pro = current_season - first + 1

    total = PlayerMatchHistory.objects.filter(player_id=player.ID).count()
    wins = PlayerMatchHistory.objects.filter(player_id=player.ID, winner_id=player.ID).count()
    losses = PlayerMatchHistory.objects.filter(
        player_id=player.ID
    ).exclude(winner_id=player.ID).exclude(winner_id__isnull=True).count()
    finals_reached = PlayerMatchHistory.objects.filter(
        player_id=player.ID, round_name__iexact='Final'
    ).count()
    named_rounds = PlayerMatchHistory.objects.filter(
        player_id=player.ID, round_name__isnull=False,
    ).count()
    rn_pct = (named_rounds / total * 100) if total else 0.0

    orphaned = [
        season for season in range(first, current_season + 1)
        if not PlayerMatchHistory.objects.filter(player_id=player.ID, season=season).exists()
    ]

    name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()

    return PlayerSnapshot(
        player_id=player.ID, name=name, years_as_pro=years_as_pro,
        total_matches=total, wins=wins, losses=losses,
        finals_reached=finals_reached, rn_pct=rn_pct,
        orphaned_seasons=orphaned, is_top32=player.ID in top32_ids,
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 35 tests total, 0 failures (24 from Task 1 + 11 new).

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add DB-backed snapshot builder for nightly stats check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 3: Cursor persistence for the rolling API sweep

**Files:**
- Modify: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Produces: `load_cursor(path) -> int` (returns 0 if the file is missing or unreadable); `save_cursor(path, next_player_id: int) -> None`; `select_batch(player_ids: list, cursor: int, batch_size: int) -> tuple[list, int]` — returns `(batch, next_cursor)`, wrapping to the start when the cursor runs past the end of the list.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
import json

from django.test import SimpleTestCase

from oneFourSeven.nightly_stats_checks import load_cursor, save_cursor, select_batch


class CursorPersistenceTests(SimpleTestCase):
    def test_load_cursor_returns_zero_when_file_missing(self, tmp_path=None):
        import tempfile, pathlib
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'cursor.json'
            self.assertEqual(load_cursor(path), 0)

    def test_load_cursor_returns_zero_on_corrupt_json(self):
        import tempfile, pathlib
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'cursor.json'
            path.write_text('not json')
            self.assertEqual(load_cursor(path), 0)

    def test_save_then_load_roundtrips(self):
        import tempfile, pathlib
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'cursor.json'
            save_cursor(path, 42)
            self.assertEqual(load_cursor(path), 42)

    def test_save_cursor_writes_valid_json(self):
        import tempfile, pathlib
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'cursor.json'
            save_cursor(path, 7)
            data = json.loads(path.read_text())
            self.assertEqual(data, {'next_player_id': 7})


class SelectBatchTests(SimpleTestCase):
    def test_selects_batch_size_from_cursor(self):
        ids = list(range(1, 11))  # 1..10
        batch, next_cursor = select_batch(ids, cursor=0, batch_size=3)
        self.assertEqual(batch, [1, 2, 3])
        self.assertEqual(next_cursor, 3)

    def test_continues_from_previous_cursor(self):
        ids = list(range(1, 11))
        batch, next_cursor = select_batch(ids, cursor=3, batch_size=3)
        self.assertEqual(batch, [4, 5, 6])
        self.assertEqual(next_cursor, 6)

    def test_wraps_around_when_cursor_past_end(self):
        ids = list(range(1, 11))
        batch, next_cursor = select_batch(ids, cursor=9, batch_size=4)
        self.assertEqual(batch, [10, 1, 2, 3])
        self.assertEqual(next_cursor, 3)

    def test_cursor_beyond_list_length_resets_to_start(self):
        ids = list(range(1, 6))
        batch, next_cursor = select_batch(ids, cursor=99, batch_size=2)
        self.assertEqual(batch, [1, 2])
        self.assertEqual(next_cursor, 2)

    def test_batch_size_larger_than_list_returns_whole_list_once(self):
        ids = [1, 2, 3]
        batch, next_cursor = select_batch(ids, cursor=0, batch_size=10)
        self.assertEqual(batch, [1, 2, 3])
        self.assertEqual(next_cursor, 0)

    def test_empty_player_list_returns_empty_batch(self):
        batch, next_cursor = select_batch([], cursor=0, batch_size=5)
        self.assertEqual(batch, [])
        self.assertEqual(next_cursor, 0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `ImportError: cannot import name 'load_cursor'`

- [ ] **Step 3: Write the implementation**

Append to `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
import json as _json


def load_cursor(path) -> int:
    """Read the next-player-id cursor. Returns 0 (start of roster) if the
    file is missing or unreadable — a reset is harmless, it just means
    the sweep starts over from the first player by ID."""
    from pathlib import Path

    path = Path(path)
    if not path.exists():
        return 0
    try:
        data = _json.loads(path.read_text())
        return int(data.get('next_player_id', 0))
    except Exception:
        return 0


def save_cursor(path, next_player_id: int) -> None:
    from pathlib import Path

    Path(path).write_text(_json.dumps({'next_player_id': next_player_id}))


def select_batch(player_ids: list, cursor: int, batch_size: int):
    """Return (batch, next_cursor) — batch_size player IDs starting at
    cursor's *position* in the sorted id list, wrapping to the start once
    the end of the roster is reached. cursor is a position index, not a
    player ID, so a shrinking/growing roster degrades gracefully instead
    of raising."""
    n = len(player_ids)
    if n == 0:
        return [], 0

    start = cursor % n
    batch = [player_ids[(start + i) % n] for i in range(min(batch_size, n))]
    next_cursor = (start + len(batch)) % n
    return batch, next_cursor
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 45 tests total, 0 failures (35 from Tasks 1-2 + 10 new).

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add cursor persistence for rolling API sweep

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 4: snooker.org API fetch helper

**Files:**
- Modify: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Produces: `fetch_api_titles(player_id: int) -> int | None` — returns `NumRankingTitles` from snooker.org's t=4 endpoint, or `None` on any failure (bad status, timeout, malformed body, empty list).

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
from unittest.mock import patch, Mock

from oneFourSeven.nightly_stats_checks import fetch_api_titles


class FetchApiTitlesTests(SimpleTestCase):
    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_returns_titles_on_success(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: [{'NumRankingTitles': 5}])
        self.assertEqual(fetch_api_titles(1), 5)

    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_returns_zero_when_field_missing(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: [{}])
        self.assertEqual(fetch_api_titles(1), 0)

    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_returns_none_on_non_200_status(self, mock_get):
        mock_get.return_value = Mock(status_code=500, json=lambda: [])
        self.assertIsNone(fetch_api_titles(1))

    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_returns_none_on_empty_body(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: [])
        self.assertIsNone(fetch_api_titles(1))

    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_returns_none_on_request_exception(self, mock_get):
        mock_get.side_effect = Exception('network down')
        self.assertIsNone(fetch_api_titles(1))

    @patch('oneFourSeven.nightly_stats_checks.requests.get')
    def test_sends_required_header(self, mock_get):
        mock_get.return_value = Mock(status_code=200, json=lambda: [{'NumRankingTitles': 1}])
        fetch_api_titles(1)
        _, kwargs = mock_get.call_args
        self.assertEqual(kwargs['headers'], {'X-Requested-By': 'FahimaApp128'})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `ImportError: cannot import name 'fetch_api_titles'`

- [ ] **Step 3: Write the implementation**

Append to `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
import requests


def fetch_api_titles(player_id: int):
    """Fetch NumRankingTitles from snooker.org's t=4 career-aggregate
    endpoint for one player. Returns None on any failure — the caller
    treats a None the same as "couldn't verify this one," never as
    "titles is zero.\""""
    from oneFourSeven.constants import API_BASE_URL, HEADERS

    try:
        resp = requests.get(
            f'{API_BASE_URL}?t=4&p={player_id}', headers=HEADERS, timeout=15
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data:
            return None
        return data[0].get('NumRankingTitles') or 0
    except Exception:
        return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 51 tests total, 0 failures (45 from Tasks 1-3 + 6 new).

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add snooker.org t=4 fetch helper for nightly stats check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 5: Auto-fix helper

**Files:**
- Modify: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Produces: `attempt_autofix(player_id: int) -> bool` — calls `backfill_career_history --player-id <id> --force` via `call_command`, returns `True` on success, `False` if it raised.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
from oneFourSeven.nightly_stats_checks import attempt_autofix


class AttemptAutofixTests(SimpleTestCase):
    @patch('oneFourSeven.nightly_stats_checks.call_command')
    def test_calls_backfill_with_force_and_player_id(self, mock_call):
        attempt_autofix(1001)
        mock_call.assert_called_once_with('backfill_career_history', player_id=1001, force=True)

    @patch('oneFourSeven.nightly_stats_checks.call_command')
    def test_returns_true_on_success(self, mock_call):
        mock_call.return_value = None
        self.assertTrue(attempt_autofix(1001))

    @patch('oneFourSeven.nightly_stats_checks.call_command')
    def test_returns_false_when_backfill_raises(self, mock_call):
        mock_call.side_effect = Exception('API down')
        self.assertFalse(attempt_autofix(1001))
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `ImportError: cannot import name 'attempt_autofix'`

- [ ] **Step 3: Write the implementation**

Append to `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
from django.core.management import call_command


def attempt_autofix(player_id: int) -> bool:
    """Repair a player flagged with one of AUTO_FIXABLE_CODES by re-running
    the existing, already-manually-used backfill command for that one
    player. This is the ONLY write path in the whole nightly check."""
    try:
        call_command('backfill_career_history', player_id=player_id, force=True)
        return True
    except Exception:
        return False
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 54 tests total, 0 failures (51 from Tasks 1-4 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add auto-fix helper wrapping backfill_career_history

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 6: Notification builder and sender

**Files:**
- Modify: `maxBreak/oneFourSeven/nightly_stats_checks.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Consumes: `Flag`, `PlayerSnapshot` from Task 1.
- Produces: `build_notification(still_flagged: list[tuple[PlayerSnapshot, list[Flag]]], autofixed: list[PlayerSnapshot], errors: list[str]) -> tuple[str, str] | None` — returns `None` when there's nothing to say; `send_admin_notification(token: str, title: str, body: str) -> None`.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
from oneFourSeven.nightly_stats_checks import build_notification, send_admin_notification


class BuildNotificationTests(SimpleTestCase):
    def test_returns_none_when_everything_clean(self):
        self.assertIsNone(build_notification(still_flagged=[], autofixed=[], errors=[]))

    def test_returns_none_when_only_autofixed_and_no_errors(self):
        snap = make_snapshot(player_id=1, name='Fixed Player')
        self.assertIsNone(build_notification(still_flagged=[], autofixed=[snap], errors=[]))

    def test_mentions_still_flagged_player_names_and_flags(self):
        snap = make_snapshot(player_id=1, name='Judd Trump')
        flags = [Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]
        title, body = build_notification(still_flagged=[(snap, flags)], autofixed=[], errors=[])
        self.assertIn('1', title)
        self.assertIn('Judd Trump', body)
        self.assertIn('BAD_WIN_RATE(95%)', body)

    def test_mentions_error_count(self):
        title, body = build_notification(still_flagged=[], autofixed=[], errors=['boom'])
        self.assertIn('error', body.lower())

    def test_combines_still_flagged_and_errors_in_one_message(self):
        snap = make_snapshot(player_id=1, name='Judd Trump')
        flags = [Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]
        title, body = build_notification(
            still_flagged=[(snap, flags)], autofixed=[], errors=['t=4 timeout for player 42'],
        )
        self.assertIn('Judd Trump', body)
        self.assertIn('t=4 timeout for player 42', body)

    def test_truncates_long_flagged_list_in_body(self):
        snaps = [
            (make_snapshot(player_id=i, name=f'Player {i}'), [Flag('BAD_WIN_RATE', 'x')])
            for i in range(30)
        ]
        title, body = build_notification(still_flagged=snaps, autofixed=[], errors=[])
        self.assertIn('30', title)
        self.assertLess(len(body), 2000)  # stays a reasonable push-notification size


class SendAdminNotificationTests(SimpleTestCase):
    @patch('oneFourSeven.nightly_stats_checks.send_expo_push')
    def test_sends_to_single_token(self, mock_send):
        send_admin_notification('ExponentPushToken[abc]', 'Title', 'Body')
        mock_send.assert_called_once_with(['ExponentPushToken[abc]'], 'Title', 'Body')

    @patch('oneFourSeven.nightly_stats_checks.send_expo_push')
    def test_swallows_send_errors(self, mock_send):
        mock_send.side_effect = Exception('expo down')
        # Should not raise — a failed notification must not crash the run.
        send_admin_notification('token', 'Title', 'Body')
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `ImportError: cannot import name 'build_notification'`

- [ ] **Step 3: Write the implementation**

Append to `maxBreak/oneFourSeven/nightly_stats_checks.py`:

```python
def build_notification(still_flagged: list, autofixed: list, errors: list):
    """Build (title, body) for the admin push, or None if there's nothing
    worth waking up for. A clean night, or a night where every flag was
    auto-fixed with no errors, sends nothing."""
    if not still_flagged and not errors:
        return None

    title = f'⚠️ Nightly stats check: {len(still_flagged)} player(s) flagged'

    lines = []
    for snapshot, flags in still_flagged[:10]:
        flag_str = ', '.join(f.detail for f in flags)
        lines.append(f'{snapshot.name} (ID={snapshot.player_id}): {flag_str}')
    if len(still_flagged) > 10:
        lines.append(f'...and {len(still_flagged) - 10} more')

    if errors:
        lines.append(f'{len(errors)} error(s) during the run:')
        lines.extend(errors[:5])

    body = '\n'.join(lines)
    return title, body


def send_admin_notification(token: str, title: str, body: str) -> None:
    """Send one push to the developer's device. Failure here must never
    crash the run — the report already printed to stdout is the durable
    record regardless."""
    from oneFourSeven.push_notifications import send_expo_push

    try:
        send_expo_push([token], title, body)
    except Exception:
        pass
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 62 tests total, 0 failures (54 from Tasks 1-5 + 8 new).

- [ ] **Step 5: Commit**

```bash
git add maxBreak/oneFourSeven/nightly_stats_checks.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add notification builder and sender for nightly stats check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 7: The management command

**Files:**
- Create: `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py`
- Test: `maxBreak/oneFourSeven/tests_nightly_stats_check.py`

**Interfaces:**
- Consumes everything from Tasks 1–6: `iter_all_players`, `get_top32_ids`, `build_snapshot`, `compute_db_flags`, `compute_api_flags`, `is_auto_fixable`, `load_cursor`, `save_cursor`, `select_batch`, `fetch_api_titles`, `attempt_autofix`, `build_notification`, `send_admin_notification`.
- Produces: CLI `python manage.py nightly_stats_check [--dry-run] [--notify-token TOKEN] [--batch-size N] [--max-autofix N] [--cursor-file PATH] [--sleep-seconds N]`. Exit code 1 if anything is still flagged or errored after auto-fix attempts, else 0.

- [ ] **Step 1: Write the failing tests**

Append to `maxBreak/oneFourSeven/tests_nightly_stats_check.py`:

```python
from io import StringIO

from django.core.management import call_command as django_call_command


class NightlyStatsCheckCommandTests(TestCase):
    def setUp(self):
        self.healthy = Player.objects.create(
            ID=2001, FirstName='Healthy', LastName='Player', FirstSeasonAsPro=2024,
        )
        self.broken = Player.objects.create(
            ID=2002, FirstName='Broken', LastName='Player', FirstSeasonAsPro=2010,
        )
        # Healthy player: enough matches for 2 years as pro (>=20), all named rounds.
        for i in range(25):
            PlayerMatchHistory.objects.create(
                api_match_id=i, player_id=self.healthy.ID, event_id=1,
                round_number=i, round_name='Last 32',
                player1_id=self.healthy.ID, player2_id=9999,
                winner_id=self.healthy.ID if i % 2 == 0 else 9999,
                season=2024,
            )
        # Broken player: zero matches despite being pro since 2010 -> NO_MATCHES/LOW_MATCHES/ORPHAN.

    def _run(self, **kwargs):
        out = StringIO()
        kwargs.setdefault('no_api', True)
        django_call_command('nightly_stats_check', stdout=out, **kwargs)
        return out.getvalue()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix')
    def test_dry_run_does_not_call_autofix_or_notify(self, mock_autofix):
        with patch('oneFourSeven.nightly_stats_checks.send_admin_notification') as mock_notify:
            self._run(dry_run=True)
            mock_autofix.assert_not_called()
            mock_notify.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=True)
    def test_autofixable_flag_triggers_autofix_attempt(self, mock_autofix):
        self._run()
        mock_autofix.assert_any_call(self.broken.ID)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=True)
    def test_no_notification_when_autofix_succeeds_and_reverify_clean(self, mock_autofix):
        # Simulate the repair actually having worked by adding matches
        # once attempt_autofix "runs" — patch to add data as a side effect.
        def fake_fix(player_id):
            for i in range(200, 216):
                PlayerMatchHistory.objects.get_or_create(
                    api_match_id=i, player_id=player_id, event_id=1,
                    round_number=i, round_name='Last 32',
                    player1_id=player_id, player2_id=9999,
                    winner_id=player_id, season=2024,
                )
            return True

        mock_autofix.side_effect = fake_fix
        with patch('oneFourSeven.nightly_stats_checks.send_admin_notification') as mock_notify:
            self._run()
            mock_notify.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_notification_sent_when_autofix_fails(self, mock_autofix):
        with patch('oneFourSeven.nightly_stats_checks.send_admin_notification') as mock_notify:
            self._run(notify_token='tok')
            mock_notify.assert_called_once()
            token_arg = mock_notify.call_args[0][0]
            self.assertEqual(token_arg, 'tok')

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix')
    def test_max_autofix_cap_is_respected(self, mock_autofix):
        mock_autofix.return_value = False
        extra_broken = [
            Player.objects.create(ID=3000 + i, FirstName='X', LastName=str(i), FirstSeasonAsPro=2010)
            for i in range(5)
        ]
        self._run(max_autofix=2)
        self.assertLessEqual(mock_autofix.call_count, 2)

    def test_no_api_flag_skips_network_calls(self):
        with patch('oneFourSeven.nightly_stats_checks.fetch_api_titles') as mock_fetch:
            self._run(no_api=True)
            mock_fetch.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_exit_code_nonzero_when_still_flagged(self, mock_autofix):
        with self.assertRaises(SystemExit) as ctx:
            django_call_command('nightly_stats_check')
        self.assertNotEqual(ctx.exception.code, 0)

    def test_exit_code_zero_when_clean(self):
        PlayerMatchHistory.objects.filter(player_id=self.broken.ID).delete()
        self.broken.delete()  # only the healthy player remains
        # Should not raise SystemExit at all when nothing is flagged.
        self._run()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix')
    def test_per_player_exception_does_not_abort_run(self, mock_autofix):
        mock_autofix.side_effect = Exception('boom')
        # Should not raise — errors are caught and reported, not propagated.
        with self.assertRaises(SystemExit):
            self._run()

    def test_report_printed_to_stdout(self):
        output = self._run()
        self.assertIn('Broken Player', output)

    def test_summary_line_counts_are_consistent(self):
        output = self._run()
        self.assertIn('OK:', output)
        self.assertIn('AUTO-FIXED:', output)
        self.assertIn('STILL FLAGGED:', output)
        self.assertIn('ERRORS:', output)

    def test_healthy_player_reported_ok(self):
        output = self._run()
        self.assertIn('Healthy Player', output)
        self.assertIn('Healthy Player', output.split('Broken Player')[0] + output)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_notify_token_none_skips_send_call(self, mock_autofix):
        with patch('oneFourSeven.nightly_stats_checks.send_admin_notification') as mock_notify:
            with self.assertRaises(SystemExit):
                self._run(notify_token=None)
            mock_notify.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix')
    def test_second_broken_player_also_gets_autofix_attempt(self, mock_autofix):
        mock_autofix.return_value = True
        second_broken = Player.objects.create(
            ID=2003, FirstName='Also', LastName='Broken', FirstSeasonAsPro=2011,
        )
        self._run()
        called_ids = {call.args[0] for call in mock_autofix.call_args_list}
        self.assertIn(self.broken.ID, called_ids)
        self.assertIn(second_broken.ID, called_ids)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=True)
    def test_autofix_attempt_count_matches_autofixable_players_under_cap(self, mock_autofix):
        self._run(max_autofix=50)
        self.assertEqual(mock_autofix.call_count, 1)  # only self.broken is auto-fixable here

    def test_dry_run_still_prints_flags_but_leaves_data_untouched(self):
        before = PlayerMatchHistory.objects.filter(player_id=self.broken.ID).count()
        self._run(dry_run=True)
        after = PlayerMatchHistory.objects.filter(player_id=self.broken.ID).count()
        self.assertEqual(before, after)

    @patch('oneFourSeven.nightly_stats_checks.fetch_api_titles')
    @patch('time.sleep')
    def test_api_enabled_pass_calls_fetch_and_sleeps(self, mock_sleep, mock_fetch):
        mock_fetch.return_value = 0
        self._run(no_api=False, batch_size=10, sleep_seconds=0)
        self.assertTrue(mock_fetch.called)

    @patch('oneFourSeven.nightly_stats_checks.fetch_api_titles', return_value=None)
    def test_api_fetch_returning_none_does_not_raise_finals_flag(self, mock_fetch):
        # api_titles=None must never be treated as "0 titles" by compute_api_flags
        with patch('time.sleep'):
            output = self._run(no_api=False, batch_size=10, sleep_seconds=0)
        self.assertNotIn('FINALS_LT_TITLES', output)

    @patch('oneFourSeven.nightly_stats_checks.save_cursor')
    def test_cursor_saved_after_api_enabled_run(self, mock_save):
        with patch('oneFourSeven.nightly_stats_checks.fetch_api_titles', return_value=0), \
             patch('time.sleep'):
            self._run(no_api=False, batch_size=10, sleep_seconds=0)
        mock_save.assert_called_once()

    @patch('oneFourSeven.nightly_stats_checks.save_cursor')
    def test_cursor_not_saved_in_dry_run(self, mock_save):
        self._run(dry_run=True, no_api=False)
        mock_save.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.save_cursor')
    def test_cursor_not_saved_when_no_api(self, mock_save):
        self._run(no_api=True)
        mock_save.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_still_flagged_players_included_in_notification_body(self, mock_autofix):
        with patch('oneFourSeven.nightly_stats_checks.send_admin_notification') as mock_notify:
            with self.assertRaises(SystemExit):
                self._run(notify_token='tok')
            body = mock_notify.call_args[0][2]
            self.assertIn('Broken Player', body)

    def test_empty_roster_exits_cleanly(self):
        PlayerMatchHistory.objects.all().delete()
        Player.objects.all().delete()
        self._run()  # no players at all -> nothing flagged -> no SystemExit

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix')
    def test_autofix_not_attempted_for_non_autofixable_flag(self, mock_autofix):
        # Give the healthy player a BAD_WIN_RATE-shaped history (not auto-fixable)
        for i in range(25, 55):
            PlayerMatchHistory.objects.create(
                api_match_id=1000 + i, player_id=self.healthy.ID, event_id=1,
                round_number=i, round_name='Last 32',
                player1_id=self.healthy.ID, player2_id=9999,
                winner_id=self.healthy.ID, season=2024,
            )
        with patch('oneFourSeven.nightly_stats_checks.fetch_api_titles', return_value=0), \
             patch('time.sleep'):
            self._run(no_api=False, batch_size=10, sleep_seconds=0)
        called_ids = {call.args[0] for call in mock_autofix.call_args_list}
        self.assertNotIn(self.healthy.ID, called_ids)

    def test_batch_size_option_is_accepted(self):
        self._run(batch_size=5, no_api=True)

    def test_max_autofix_zero_disables_all_autofix(self):
        with patch('oneFourSeven.nightly_stats_checks.attempt_autofix') as mock_autofix:
            with self.assertRaises(SystemExit):
                self._run(max_autofix=0)
            mock_autofix.assert_not_called()

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', side_effect=[True, False])
    def test_mixed_autofix_outcomes_across_two_broken_players(self, mock_autofix):
        second_broken = Player.objects.create(
            ID=2004, FirstName='Second', LastName='Broken', FirstSeasonAsPro=2012,
        )
        with self.assertRaises(SystemExit):
            self._run()
        self.assertEqual(mock_autofix.call_count, 2)

    def test_command_accepts_custom_cursor_file_path(self):
        import tempfile, pathlib
        with tempfile.TemporaryDirectory() as d:
            cursor_path = str(pathlib.Path(d) / 'custom_cursor.json')
            self._run(cursor_file=cursor_path)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=True)
    def test_autofixed_player_not_double_counted_as_still_flagged(self, mock_autofix):
        def fake_fix(player_id):
            for i in range(300, 316):
                PlayerMatchHistory.objects.get_or_create(
                    api_match_id=i, player_id=player_id, event_id=1,
                    round_number=i, round_name='Last 32',
                    player1_id=player_id, player2_id=9999,
                    winner_id=player_id, season=2024,
                )
            return True

        mock_autofix.side_effect = fake_fix
        output = self._run()
        self.assertIn('auto-fixed', output)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_still_flagged_output_mentions_auto_fix_failed(self, mock_autofix):
        output = self._run(notify_token='tok')
        self.assertIn('auto-fix failed', output)

    def test_dry_run_reports_not_auto_fixable_marker_for_untouched_flags(self):
        output = self._run(dry_run=True)
        self.assertIn('[dry-run, no fix attempted]', output)

    @patch('oneFourSeven.nightly_stats_checks.build_snapshot')
    def test_build_snapshot_exception_for_one_player_is_logged_not_raised(self, mock_snapshot):
        from oneFourSeven.nightly_stats_checks import build_snapshot as real_build_snapshot

        def side_effect(player, current_season, top32_ids):
            if player.ID == self.healthy.ID:
                raise Exception('boom')
            return real_build_snapshot(player, current_season, top32_ids)

        mock_snapshot.side_effect = side_effect
        with self.assertRaises(SystemExit):
            self._run(notify_token='tok')  # broken player still flags -> exits 1

    def test_clean_run_reports_zero_errors_in_summary(self):
        output = self._run(dry_run=True)
        self.assertIn('ERRORS: 0', output)

    def test_command_help_text_documents_dry_run_flag(self):
        out = StringIO()
        django_call_command('nightly_stats_check', '--help', stdout=out)
        self.assertIn('--dry-run', out.getvalue())

    def test_command_help_text_documents_notify_token_flag(self):
        out = StringIO()
        django_call_command('nightly_stats_check', '--help', stdout=out)
        self.assertIn('--notify-token', out.getvalue())

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=True)
    def test_autofix_success_message_includes_original_flag_detail(self, mock_autofix):
        def fake_fix(player_id):
            for i in range(400, 416):
                PlayerMatchHistory.objects.get_or_create(
                    api_match_id=i, player_id=player_id, event_id=1,
                    round_number=i, round_name='Last 32',
                    player1_id=player_id, player2_id=9999,
                    winner_id=player_id, season=2024,
                )
            return True

        mock_autofix.side_effect = fake_fix
        output = self._run()
        self.assertIn('NO_MATCHES', output)

    def test_sleep_seconds_option_accepted_without_error(self):
        self._run(no_api=True, sleep_seconds=0)

    @patch('oneFourSeven.nightly_stats_checks.attempt_autofix', return_value=False)
    def test_multiple_runs_are_idempotent_on_a_clean_reverify(self, mock_autofix):
        with self.assertRaises(SystemExit):
            self._run(notify_token='tok')
        with self.assertRaises(SystemExit):
            self._run(notify_token='tok')
        self.assertGreaterEqual(mock_autofix.call_count, 2)

    def test_command_is_registered_and_discoverable(self):
        from django.core.management import get_commands
        self.assertIn('nightly_stats_check', get_commands())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: FAIL — `CommandError: Unknown command: 'nightly_stats_check'`

- [ ] **Step 3: Write the implementation**

Create `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py`:

```python
# management/commands/nightly_stats_check.py
"""
Nightly, automated player-stats accuracy check.

Runs DB-only consistency checks over every player, plus a rolling
snooker.org t=4 cross-check over a slice of the roster each night
(cursor-based, so every player eventually gets checked, not just the
top-ranked ones). Flags in the known-safe set (NO_MATCHES, LOW_MATCHES,
ORPHAN) are auto-repaired via the existing backfill_career_history
command, then re-verified. Sends one push notification only if something
is still wrong after that — a clean or fully self-healed run is silent.

See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.

Usage:
  python manage.py nightly_stats_check
  python manage.py nightly_stats_check --dry-run
  python manage.py nightly_stats_check --no-api
  python manage.py nightly_stats_check --notify-token ExponentPushToken[xxx]
"""

import time
from pathlib import Path

from django.core.management.base import BaseCommand

from oneFourSeven.nightly_stats_checks import (
    attempt_autofix,
    build_notification,
    build_snapshot,
    compute_api_flags,
    compute_db_flags,
    fetch_api_titles,
    get_top32_ids,
    is_auto_fixable,
    iter_all_players,
    load_cursor,
    save_cursor,
    select_batch,
    send_admin_notification,
)

DEFAULT_CURSOR_FILE = Path(__file__).resolve().parent.parent.parent.parent / 'nightly_stats_cursor.json'
DEFAULT_BATCH_SIZE = 100
DEFAULT_MAX_AUTOFIX = 20
DEFAULT_SLEEP_SECONDS = 30


class Command(BaseCommand):
    help = 'Nightly automated player-stats accuracy check with auto-fix and admin notification'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Run checks and print the report, skip auto-fix and notification')
        parser.add_argument('--no-api', action='store_true',
                            help='Skip the snooker.org t=4 cross-check pass entirely (DB-only)')
        parser.add_argument('--notify-token', default=None,
                            help='Expo push token to notify when something is still flagged')
        parser.add_argument('--batch-size', type=int, default=DEFAULT_BATCH_SIZE,
                            help='How many players to API-cross-check per run')
        parser.add_argument('--max-autofix', type=int, default=DEFAULT_MAX_AUTOFIX,
                            help='Cap on auto-fix attempts per run')
        parser.add_argument('--cursor-file', default=str(DEFAULT_CURSOR_FILE),
                            help='Path to the rolling-sweep cursor file')
        parser.add_argument('--sleep-seconds', type=int, default=DEFAULT_SLEEP_SECONDS,
                            help='Delay between snooker.org API calls')

    def handle(self, *args, **options):
        from oneFourSeven.constants import current_season_int

        current_season = current_season_int()
        dry_run = options['dry_run']
        no_api = options['no_api']
        max_autofix = options['max_autofix']
        cursor_file = options['cursor_file']

        top32_ids = get_top32_ids(current_season)
        players = list(iter_all_players())
        player_ids = [p.ID for p in players]
        players_by_id = {p.ID: p for p in players}

        api_batch_ids = set()
        next_cursor = load_cursor(cursor_file)
        if not no_api and player_ids:
            batch, next_cursor = select_batch(player_ids, load_cursor(cursor_file), options['batch_size'])
            api_batch_ids = set(batch)

        still_flagged = []
        autofixed = []
        errors = []
        autofix_attempts = 0

        for player in players:
            try:
                snapshot = build_snapshot(player, current_season, top32_ids)
                flags = compute_db_flags(snapshot)

                if player.ID in api_batch_ids:
                    time.sleep(options['sleep_seconds'])
                    api_titles = fetch_api_titles(player.ID)
                    flags += compute_api_flags(snapshot, api_titles)
            except Exception as e:
                errors.append(f'Check failed for player {player.ID}: {e}')
                continue

            if not flags:
                self.stdout.write(f'{snapshot.name} (ID={snapshot.player_id}): OK')
                continue

            flag_str = ', '.join(f.detail for f in flags)

            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f'{snapshot.name} (ID={snapshot.player_id}): {flag_str} [dry-run, no fix attempted]'
                ))
                still_flagged.append((snapshot, flags))
                continue

            if is_auto_fixable(flags) and autofix_attempts < max_autofix:
                autofix_attempts += 1
                try:
                    fixed_ok = attempt_autofix(player.ID)
                except Exception as e:
                    fixed_ok = False
                    errors.append(f'Auto-fix raised for player {player.ID}: {e}')

                if fixed_ok:
                    try:
                        recheck_snapshot = build_snapshot(player, current_season, top32_ids)
                        remaining = compute_db_flags(recheck_snapshot)
                    except Exception as e:
                        remaining = flags
                        errors.append(f'Re-check failed for player {player.ID}: {e}')

                    if remaining:
                        still_flagged.append((recheck_snapshot, remaining))
                        self.stdout.write(self.style.WARNING(
                            f'{snapshot.name} (ID={snapshot.player_id}): auto-fix attempted, '
                            f'still flagged: {", ".join(f.detail for f in remaining)}'
                        ))
                    else:
                        autofixed.append(snapshot)
                        self.stdout.write(self.style.SUCCESS(
                            f'{snapshot.name} (ID={snapshot.player_id}): auto-fixed ({flag_str})'
                        ))
                else:
                    still_flagged.append((snapshot, flags))
                    self.stdout.write(self.style.WARNING(
                        f'{snapshot.name} (ID={snapshot.player_id}): auto-fix failed, flags: {flag_str}'
                    ))
            else:
                still_flagged.append((snapshot, flags))
                self.stdout.write(self.style.WARNING(
                    f'{snapshot.name} (ID={snapshot.player_id}): {flag_str} [not auto-fixable]'
                ))

        if not dry_run and not no_api:
            save_cursor(cursor_file, next_cursor)

        self.stdout.write('')
        self.stdout.write(f'OK: {len(players) - len(still_flagged) - len(autofixed)}  '
                          f'AUTO-FIXED: {len(autofixed)}  STILL FLAGGED: {len(still_flagged)}  '
                          f'ERRORS: {len(errors)}')

        if not dry_run:
            notification = build_notification(still_flagged, autofixed, errors)
            if notification and options['notify_token']:
                title, body = notification
                send_admin_notification(options['notify_token'], title, body)

        if still_flagged or errors:
            raise SystemExit(1)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd maxBreak && python manage.py test oneFourSeven.tests_nightly_stats_check -v 2`
Expected: PASS — 101 tests total, 0 failures (62 from Tasks 1-6 + 39 new), clearing the CLAUDE.md rule-8 minimum of 100.

- [ ] **Step 5: Manual dry-run smoke test against local dev DB**

Run: `cd maxBreak && python manage.py nightly_stats_check --dry-run --no-api`
Expected: prints a per-player report ending in an `OK: N AUTO-FIXED: 0 STILL FLAGGED: N ERRORS: 0` summary line, exits 0 (dry-run never raises `SystemExit(1)`).

- [ ] **Step 6: Commit**

```bash
git add maxBreak/oneFourSeven/management/commands/nightly_stats_check.py maxBreak/oneFourSeven/tests_nightly_stats_check.py
git commit -m "feat: add nightly_stats_check management command

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

### Task 8: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/nightly_stats_check.yml`

**Interfaces:**
- Consumes: `python manage.py nightly_stats_check` CLI from Task 7, repo secrets `DATABASE_URL`, `SECRET_KEY`, `ADMIN_EXPO_PUSH_TOKEN`.

- [ ] **Step 1: Write the workflow file**

Create `.github/workflows/nightly_stats_check.yml`:

```yaml
name: Nightly Player Stats Check

on:
  schedule:
    - cron: '0 3 * * *'  # 03:00 UTC nightly
  workflow_dispatch: {}

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        working-directory: maxBreak
        run: pip install -r requirements.txt

      - name: Restore rolling-sweep cursor
        uses: actions/cache@v4
        with:
          path: maxBreak/nightly_stats_cursor.json
          key: nightly-stats-cursor
          restore-keys: nightly-stats-cursor

      - name: Run nightly stats check
        working-directory: maxBreak
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          SECRET_KEY: ${{ secrets.SECRET_KEY }}
        run: |
          python manage.py nightly_stats_check --notify-token "${{ secrets.ADMIN_EXPO_PUSH_TOKEN }}"

      - name: Save rolling-sweep cursor
        if: always()
        uses: actions/cache/save@v4
        with:
          path: maxBreak/nightly_stats_cursor.json
          key: nightly-stats-cursor
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/nightly_stats_check.yml'))"`
Expected: no output, exit code 0 (valid YAML).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/nightly_stats_check.yml
git commit -m "ci: add nightly player-stats accuracy check workflow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

**Note for the human operator (not an automatable step):** three GitHub repo secrets must be added before this workflow can run successfully: `DATABASE_URL` (Railway Postgres connection string), `SECRET_KEY` (same value as the Railway backend's Django secret key), `ADMIN_EXPO_PUSH_TOKEN` (your device's Expo push token). The workflow will fail loudly on its first scheduled run if these are missing — that failure is safe (nothing to override, nothing crashes), just re-add the secret and re-run.

---

### Task 9: Docs — open mission, session doc, CLAUDE.md pointer

**Files:**
- Modify: `docs/OPEN_MISSIONS.md`
- Create: `docs/SESSION_2026-08-31_NIGHTLY_STATS_CHECK.md`
- Modify: `CLAUDE.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Add the broader-audit non-goal to OPEN_MISSIONS.md**

Add this entry under `## Open` in `docs/OPEN_MISSIONS.md` (append after the last numbered item, incrementing the number):

```markdown
### 14. Nightly stats check covers only PlayerMatchHistory/career-title accuracy, not the full stats surface
- **Found**: 2026-08-31, while scoping the nightly player-stats accuracy check (`docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md`).
- **Status**: Explicitly scoped out at design time — the nightly job (`nightly_stats_check` management command) only validates `PlayerMatchHistory` completeness and cross-checks `Player.NumRankingTitles` against snooker.org's t=4 endpoint, matching what the pre-existing `validate_career_data.py`/`verify_player_stats.py` commands already covered.
- **Impact**: `PlayerCareerStats`, `CenturyRecord`, and `Ranking` rows have no automated nightly accuracy check — a data bug in the century-break leaderboard or all-time stats records would not be caught by this job.
- **Next step when picked up**: brainstorm a follow-up spec extending the same auto-fix/notify pattern to those models, likely with a different repair command per model (there is no single existing "re-sync this one row" command for `CenturyRecord`/`PlayerCareerStats` the way `backfill_career_history` exists for match history).
```

- [ ] **Step 2: Write the session doc**

Create `docs/SESSION_2026-08-31_NIGHTLY_STATS_CHECK.md`:

```markdown
# Session 2026-08-31: Nightly Player-Stats Accuracy Check

## What was built

A new, independent, nightly automated job that checks player stats
accuracy and pages the developer only when something is genuinely
wrong. Full design rationale: `docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md`.

## Why this shape

Two manual, one-off management commands already existed
(`validate_career_data.py`, `verify_player_stats.py`) with the exact
flag logic needed, but neither was scheduled or alerted anyone. The
brainstorming session surfaced two real risks in the naive version of
this idea before any code was written:

1. **Sampling by rank (top-N) misses the middle of the roster** — the
   Compare tool lets a user look up any two players, not just top-32,
   so checking only top-ranked players would leave most of the roster
   unverified. Fixed by a rolling cursor-based sweep over the *entire*
   player list instead of a fixed top-N.
2. **Persisting the rolling-sweep cursor via a git commit to `master`
   would have silently triggered a Railway redeploy every night**
   (per this repo's `git push master` → auto-deploy convention).
   Fixed by persisting the cursor in GitHub Actions cache instead —
   it never touches git or the repo at all.

## Files touched and why

- `maxBreak/oneFourSeven/nightly_stats_checks.py` (new) — all pure flag
  logic, DB snapshot building, cursor I/O, the snooker.org fetch, the
  auto-fix wrapper, and notification building. Kept separate from the
  management command specifically so the flag rules are unit-testable
  without a database or network.
- `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py`
  (new) — thin orchestration: loops over players, calls the helpers
  above, prints the report, exits non-zero when anything is still
  flagged.
- `maxBreak/oneFourSeven/tests_nightly_stats_check.py` (new) — full
  test suite, following this app's existing flat `tests_<topic>.py`
  convention (see `tests_player_stats_targeting.py`).
- `.github/workflows/nightly_stats_check.yml` (new) — cron workflow,
  runs entirely on GitHub Actions infrastructure, independent of
  Railway.
- `docs/OPEN_MISSIONS.md` — logged the broader stats-audit (
  `PlayerCareerStats`, `CenturyRecord`, `Ranking`) as an explicit
  non-goal, not forgotten.
- `CLAUDE.md` — added `nightly_stats_check` to the management-commands
  list.

## What was verified

- Full test suite passes: `cd maxBreak && python manage.py test
  oneFourSeven.tests_nightly_stats_check -v 2` (101 tests across
  pure-logic, DB-snapshot, cursor, API-fetch, auto-fix, notification,
  and full-command integration tests).
- Manual dry-run against local dev DB (`--dry-run --no-api`) confirmed
  the report prints correctly and the command exits 0 in dry-run mode
  regardless of flags found.
- YAML syntax of the new workflow file validated with `yaml.safe_load`.

## What still needs real-world confirmation

- The workflow has NOT yet run on GitHub Actions against the real
  production database — it needs three repo secrets added first
  (`DATABASE_URL`, `SECRET_KEY`, `ADMIN_EXPO_PUSH_TOKEN`), then either
  a `workflow_dispatch` manual trigger or waiting for the first
  scheduled 03:00 UTC run, to confirm it actually connects to Railway
  Postgres and the Expo push notification arrives on a real device.
- The cursor's actual sweep rate against the real player roster size
  hasn't been measured — the design assumes ~100/night is a reasonable
  batch given the roster size, but this should be sanity-checked after
  the first few real runs (check `maxBreak/oneFourSeven/nightly_stats_cursor.json`'s
  restored value in the Action logs' cache step across a few nights).

## Lessons for the next agent

- `backfill_career_history --force` is the ONLY write path in this
  whole feature — do not add any other write path to this job without
  re-reading the design doc's safety properties section first.
- Do not persist any state for this job via a git commit — that's how
  the Railway auto-deploy-on-`master`-push trap gets triggered
  accidentally. Use GitHub Actions cache (or a DB table, if ever
  needed) instead.
- `nightly_stats_checks.py`'s functions are deliberately DB/network-free
  where possible (`compute_db_flags`, `compute_api_flags`,
  `is_auto_fixable`, `build_notification`) — if you add a new flag rule,
  add it as a pure function taking a `PlayerSnapshot`, not as an inline
  query in the management command, so it stays unit-testable.
```

- [ ] **Step 3: Add the command to CLAUDE.md's management-commands list**

In `CLAUDE.md`, find the `**Key management commands:**` code block and add this line after `python manage.py rebuild_player_stats`:

```
python manage.py nightly_stats_check     # Nightly player-stats accuracy check (auto-fix + notify)
```

- [ ] **Step 4: Commit**

```bash
git add docs/OPEN_MISSIONS.md docs/SESSION_2026-08-31_NIGHTLY_STATS_CHECK.md CLAUDE.md
git commit -m "docs: session writeup, open mission, and CLAUDE.md entry for nightly stats check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SzNSYDshno4KULqgE34DGj"
```

---

## Post-plan: what the user still needs to do

This plan produces working, tested code, but three things remain outside
Claude's authority and must be done by you before the job runs for real:

1. Add the three GitHub repo secrets (`DATABASE_URL`, `SECRET_KEY`,
   `ADMIN_EXPO_PUSH_TOKEN`) in the repo's Settings → Secrets and
   variables → Actions.
2. Trigger one manual `workflow_dispatch` run to confirm it actually
   connects to production and a push notification (if anything is
   flagged) reaches your device.
3. Approve pushing these commits to `master` — per this repo's
   deployment-approval rule, nothing gets pushed without your explicit
   go-ahead, even though this feature's own commits don't touch
   anything Railway serves.
