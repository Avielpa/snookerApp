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
