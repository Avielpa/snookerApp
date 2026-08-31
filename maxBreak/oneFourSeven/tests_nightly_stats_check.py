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
