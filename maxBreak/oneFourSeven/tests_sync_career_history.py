"""
Tests for `sync_career_history`'s opt-in --batch-size rolling-sweep mode.

Only the batching/cursor wiring is under test here — the real per-player
work (_fetch_and_save, which hits snooker.org) and backfill_career_history
(called for genuinely new players) are mocked out, same approach as
tests_nightly_stats_check.py mocks attempt_autofix/fetch_api_titles
rather than making real network calls. No real CueTracker/snooker.org
request is made anywhere in this file.
"""

import json
import pathlib
import tempfile
from unittest.mock import patch

from django.core.management import call_command as django_call_command
from django.test import TestCase

from oneFourSeven.constants import current_season_int
from oneFourSeven.management.commands.sync_career_history import Command
from oneFourSeven.models import Player, PlayerMatchHistory, Ranking


class SyncCareerHistoryBatchingTests(TestCase):
    def setUp(self):
        self.current_season = current_season_int()
        self.existing_players = []
        # 6 "existing" players — each has a prior-season match, so all
        # land in the existing_players (current-season-update) bucket.
        for i in range(6):
            pid = 9000 + i
            p = Player.objects.create(ID=pid, FirstName=f'P{i}', LastName='Existing')
            Ranking.objects.create(
                ID=pid, Player=p, Season=self.current_season, Position=i + 1,
                Type='MoneyRankings',
            )
            PlayerMatchHistory.objects.create(
                api_match_id=pid, player_id=pid, event_id=1, round_number=1,
                round_name='Final', player1_id=pid, player2_id=8888,
                winner_id=pid, season=self.current_season - 1,
            )
            self.existing_players.append(p)

    def _run(self, cursor_file, **kwargs):
        kwargs.setdefault('top', 128)
        # The command's existing-player loop calls close_old_connections()
        # before each _fetch_and_save() — real behavior, needed in
        # production so a long real-network loop doesn't hold a stale
        # connection. Inside a TestCase's wrapping atomic transaction that
        # forcibly closes the one connection the test itself depends on,
        # breaking every later query in the same test. Not exercising real
        # network I/O here anyway (that's what _fetch_and_save covers, and
        # it's mocked below), so it's patched to a no-op for these
        # batching-only tests.
        with patch('oneFourSeven.management.commands.sync_career_history.close_old_connections'):
            with patch.object(Command, '_fetch_and_save', return_value=1) as mock_fetch:
                django_call_command('sync_career_history', cursor_file=str(cursor_file), **kwargs)
        return mock_fetch

    def test_without_batch_size_updates_every_existing_player(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            mock_fetch = self._run(cursor_file)
            self.assertEqual(mock_fetch.call_count, 6)
            # Full-run mode must never write a cursor file — batching is opt-in.
            self.assertFalse(cursor_file.exists())

    def test_batch_size_limits_players_processed_this_run(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            mock_fetch = self._run(cursor_file, batch_size=2)
            self.assertEqual(mock_fetch.call_count, 2)

    def test_batch_size_writes_a_cursor_file(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            self._run(cursor_file, batch_size=2)
            self.assertTrue(cursor_file.exists())
            data = json.loads(cursor_file.read_text())
            self.assertEqual(data, {'next_index': 2})

    def test_second_run_continues_from_where_first_left_off(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'

            # Capture which players were actually processed each run by
            # patching _fetch_and_save to record the player id passed in.
            processed_runs = []

            def record(self_, player, season):
                processed_runs[-1].append(player.ID)
                return 1

            with patch('oneFourSeven.management.commands.sync_career_history.close_old_connections'), \
                 patch.object(Command, '_fetch_and_save', autospec=True, side_effect=record):
                processed_runs.append([])
                django_call_command('sync_career_history', top=128, batch_size=2, cursor_file=str(cursor_file))
                processed_runs.append([])
                django_call_command('sync_career_history', top=128, batch_size=2, cursor_file=str(cursor_file))

            all_ids = sorted(p.ID for p in self.existing_players)
            self.assertEqual(sorted(processed_runs[0]), all_ids[0:2])
            self.assertEqual(sorted(processed_runs[1]), all_ids[2:4])

    def test_full_sweep_across_enough_runs_covers_every_existing_player(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            seen = set()

            def record(self_, player, season):
                seen.add(player.ID)
                return 1

            with patch('oneFourSeven.management.commands.sync_career_history.close_old_connections'), \
                 patch.object(Command, '_fetch_and_save', autospec=True, side_effect=record):
                for _ in range(4):  # 4 runs * batch_size=2 = 8 >= 6 players, guarantees full coverage
                    django_call_command('sync_career_history', top=128, batch_size=2, cursor_file=str(cursor_file))

            self.assertEqual(seen, {p.ID for p in self.existing_players})

    def test_new_players_only_never_writes_cursor_even_with_batch_size(self):
        # --new-players-only returns before the batching block entirely —
        # confirm that early-return still holds with --batch-size present.
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            with patch('oneFourSeven.management.commands.sync_career_history.call_command'):
                django_call_command(
                    'sync_career_history', top=128, batch_size=2,
                    cursor_file=str(cursor_file), new_players_only=True,
                )
            self.assertFalse(cursor_file.exists())

    def test_new_player_backfill_is_never_batched(self):
        # A brand-new player (no prior-season history) must always get a
        # full backfill call regardless of --batch-size — batching only
        # ever applies to the existing-player current-season-update loop.
        new_player = Player.objects.create(ID=9500, FirstName='Brand', LastName='New')
        Ranking.objects.create(
            ID=9500, Player=new_player, Season=self.current_season, Position=99,
            Type='MoneyRankings',
        )
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            with patch('oneFourSeven.management.commands.sync_career_history.call_command') as mock_backfill, \
                 patch('oneFourSeven.management.commands.sync_career_history.close_old_connections'), \
                 patch.object(Command, '_fetch_and_save', return_value=1):
                django_call_command('sync_career_history', top=128, batch_size=1, cursor_file=str(cursor_file))
            backfilled_ids = {c.kwargs.get('player_id') for c in mock_backfill.call_args_list}
            self.assertIn(9500, backfilled_ids)

    def test_command_is_registered_and_discoverable(self):
        from django.core.management import get_commands
        self.assertIn('sync_career_history', get_commands())

    def test_command_help_text_documents_batch_size_flag(self):
        from io import StringIO
        import contextlib
        out = StringIO()
        with self.assertRaises(SystemExit):
            with contextlib.redirect_stdout(out):
                django_call_command('sync_career_history', '--help')
        self.assertIn('--batch-size', out.getvalue())

    def test_batch_size_zero_processes_no_existing_players_but_still_saves_cursor(self):
        with tempfile.TemporaryDirectory() as d:
            cursor_file = pathlib.Path(d) / 'career_sync_cursor.json'
            mock_fetch = self._run(cursor_file, batch_size=0)
            self.assertEqual(mock_fetch.call_count, 0)
            self.assertTrue(cursor_file.exists())
