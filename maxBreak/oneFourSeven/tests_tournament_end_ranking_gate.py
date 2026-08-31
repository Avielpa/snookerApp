"""
Tests for the tournament-end ranking-refresh gate in auto_live_monitor.py.

Bug fixed: _check_tournament_end_updates() (which triggers update_rankings
after a tournament finishes) was only called inside the `else` branch of
`if has_active_matches / else` in Command.handle()'s main loop. Since
Qualifiers events run almost continuously through the season,
_has_active_matches() is essentially always True, so the idle-only branch --
and the ranking refresh it gated -- almost never ran in production. Real
case: Zhao Xintong became world #1 after the 2026 Wuhan Open ended
2026-08-29, but our rankings stayed stale for 2+ days because British Open
Qualifiers (and friends) kept has_active_matches True the whole time.

Fix: _check_tournament_end_updates() now runs unconditionally every loop
tick, before the has_active_matches branch, so a recently-ended tournament
is always detected regardless of what else is active.

These tests cover two layers:
1. The loop-wiring regression itself (Command.handle() must call
   _check_tournament_end_updates() every tick, active or idle).
2. _check_tournament_end_updates()'s own detection/dedup logic in isolation
   (unaffected by the wiring fix, but exercised here since it's the function
   the fix now depends on running reliably).
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.test import TestCase
from django.utils import timezone

from .models import Event, MatchesOfAnEvent
from .management.commands.auto_live_monitor import Command


def _make_event(event_id, start_days_ago, end_days_ago, tour='main'):
    now = timezone.now()
    return Event.objects.create(
        ID=event_id,
        Name=f'Test Event {event_id}',
        StartDate=(now - timedelta(days=start_days_ago)).date(),
        EndDate=(now - timedelta(days=end_days_ago)).date(),
        Season=now.year,
        Tour=tour,
    )


def _make_finished_match(event, number=1, status=3):
    return MatchesOfAnEvent.objects.create(
        Event=event,
        Round=1,
        Number=number,
        Player1ID=1,
        Player2ID=2,
        WinnerID=1,
        Status=status,
    )


class TournamentEndCheckRunsEveryTickTestCase(TestCase):
    """Regression test for the actual bug: the call-site wiring in handle()."""

    def _silent_command(self):
        """Build a Command with every other side-effecting method stubbed out,
        so handle() can run one loop iteration without hitting the network or
        looping forever."""
        cmd = Command()
        cmd.stdout = MagicMock()
        cmd._startup_sync = MagicMock()
        cmd._has_active_matches = MagicMock(return_value=False)  # boot-time check
        cmd._run_live_updates = MagicMock()
        cmd._update_upcoming_matches_fallback = MagicMock()
        cmd._check_player_history_update = MagicMock(return_value=False)
        cmd._check_nightly_active_updates = MagicMock(return_value=False)
        cmd._check_pretournament_update = MagicMock(return_value=False)
        cmd._check_daily_updates = MagicMock(return_value=False)
        cmd._check_monthly_updates = MagicMock(return_value=False)
        cmd._check_upcoming_tournament_updates = MagicMock(return_value=False)
        cmd._check_news_fetch = MagicMock()
        return cmd

    def _run_one_tick(self, cmd, has_active_matches):
        cmd._has_active_matches = MagicMock(return_value=has_active_matches)
        cmd._check_tournament_end_updates = MagicMock(return_value=False)

        # Stop the infinite loop after the first iteration's time.sleep call.
        def _stop_after_sleep(_seconds):
            cmd.should_stop = True

        with patch(
            'oneFourSeven.management.commands.auto_live_monitor.time.sleep',
            side_effect=_stop_after_sleep,
        ):
            cmd.handle(active_interval=35, sleep_interval=900)

    def test_tournament_end_check_runs_while_tournaments_are_active(self):
        """The exact regression: qualifiers keep has_active_matches True, but
        the ranking-refresh check must still run on that tick."""
        cmd = self._silent_command()
        self._run_one_tick(cmd, has_active_matches=True)
        cmd._check_tournament_end_updates.assert_called_once()

    def test_tournament_end_check_still_runs_while_idle(self):
        """No-regression check: the idle path must keep working too."""
        cmd = self._silent_command()
        self._run_one_tick(cmd, has_active_matches=False)
        cmd._check_tournament_end_updates.assert_called_once()

    def test_ordering_tournament_end_before_live_updates(self):
        """Ordering matters for real-world timing: a ranking refresh
        shouldn't wait behind the (network-heavy) live-update branch."""
        cmd = self._silent_command()
        call_order = []
        # False for the boot-time pre-loop check (line ~90 in handle()), True
        # for the main loop's own check -- isolates the loop-body ordering
        # from the separate boot-time live-update fast path.
        cmd._has_active_matches = MagicMock(side_effect=[False, True])
        cmd._check_tournament_end_updates = MagicMock(
            side_effect=lambda: call_order.append('tournament_end') or False
        )
        cmd._run_live_updates = MagicMock(
            side_effect=lambda: call_order.append('live_updates')
        )

        def _stop_after_sleep(_seconds):
            cmd.should_stop = True

        with patch(
            'oneFourSeven.management.commands.auto_live_monitor.time.sleep',
            side_effect=_stop_after_sleep,
        ):
            cmd.handle(active_interval=35, sleep_interval=900)

        self.assertEqual(call_order, ['tournament_end', 'live_updates'])


class CheckTournamentEndUpdatesDetectionTestCase(TestCase):
    """_check_tournament_end_updates()'s own detection/dedup logic -- the
    function the wiring fix now depends on running every tick."""

    def _command(self):
        cmd = Command()
        cmd.stdout = MagicMock()
        cmd._run_tournament_end_updates = MagicMock()
        return cmd

    def test_no_recently_ended_tournaments_returns_false(self):
        cmd = self._command()
        # No events at all.
        result = cmd._check_tournament_end_updates()
        self.assertFalse(result)
        cmd._run_tournament_end_updates.assert_not_called()

    def test_recently_ended_tournament_with_finished_matches_is_detected(self):
        """The exact real-world scenario: Wuhan Open ended 2 days ago, with
        finished matches, while other events (not modeled here) are active."""
        event = _make_event(2547, start_days_ago=7, end_days_ago=2)
        _make_finished_match(event, status=3)

        cmd = self._command()
        result = cmd._check_tournament_end_updates()

        self.assertTrue(result)
        cmd._run_tournament_end_updates.assert_called_once()
        called_events = list(cmd._run_tournament_end_updates.call_args[0][0])
        self.assertEqual([e.ID for e in called_events], [2547])

    def test_tournament_ended_over_48_hours_ago_is_excluded(self):
        event = _make_event(9001, start_days_ago=10, end_days_ago=3)
        _make_finished_match(event, status=3)

        cmd = self._command()
        result = cmd._check_tournament_end_updates()

        self.assertFalse(result)
        cmd._run_tournament_end_updates.assert_not_called()

    def test_recently_ended_tournament_with_no_finished_matches_is_skipped(self):
        """An event that ended but has no Status=3 matches yet (e.g. data not
        synced) shouldn't trigger a ranking refresh prematurely."""
        event = _make_event(9002, start_days_ago=5, end_days_ago=1)
        _make_finished_match(event, status=0)  # scheduled, not finished

        cmd = self._command()
        result = cmd._check_tournament_end_updates()

        self.assertFalse(result)
        cmd._run_tournament_end_updates.assert_not_called()

    def test_already_processed_tournament_is_not_reprocessed(self):
        event = _make_event(2547, start_days_ago=7, end_days_ago=2)
        _make_finished_match(event, status=3)

        cmd = self._command()
        cmd.processed_tournament_ends.add(2547)
        result = cmd._check_tournament_end_updates()

        self.assertFalse(result)
        cmd._run_tournament_end_updates.assert_not_called()

    def test_multiple_recently_ended_tournaments_all_detected(self):
        """Real scenario: a main event and its own qualifiers can both have
        just ended around the same time."""
        event_a = _make_event(2547, start_days_ago=7, end_days_ago=2)
        _make_finished_match(event_a, status=3)
        event_b = _make_event(2548, start_days_ago=20, end_days_ago=1)
        _make_finished_match(event_b, status=3)

        cmd = self._command()
        result = cmd._check_tournament_end_updates()

        self.assertTrue(result)
        called_ids = sorted(e.ID for e in cmd._run_tournament_end_updates.call_args[0][0])
        self.assertEqual(called_ids, [2547, 2548])

    def test_stale_processed_ids_older_than_7_days_are_cleaned_up(self):
        """Old processed_tournament_ends entries for tournaments that ended
        over 7 days ago should be dropped so state doesn't grow unbounded."""
        old_event = _make_event(5000, start_days_ago=30, end_days_ago=10)
        cmd = self._command()
        cmd.processed_tournament_ends.add(5000)

        cmd._check_tournament_end_updates()

        self.assertNotIn(5000, cmd.processed_tournament_ends)
