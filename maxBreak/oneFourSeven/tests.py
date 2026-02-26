from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from unittest.mock import patch, MagicMock
from datetime import date, timedelta
from io import StringIO

from .models import Player, PlayerMatchHistory


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_monitor():
    """Instantiate the Command without Django management machinery."""
    from oneFourSeven.management.commands.auto_live_monitor import Command
    cmd = Command()
    cmd.stdout = StringIO()
    return cmd


def _make_player(player_id=9999):
    return Player.objects.get_or_create(
        ID=player_id,
        defaults={'FirstName': 'Test', 'LastName': 'Player'}
    )[0]


def _make_match(player_id, api_match_id, scheduled_date, status=3, season=2025):
    return PlayerMatchHistory.objects.create(
        api_match_id=api_match_id,
        player_id=player_id,
        status=status,
        scheduled_date=scheduled_date,
        season=season,
    )


# ---------------------------------------------------------------------------
# Tests: _check_daily_updates uses instance variable (not Event.created_at)
# ---------------------------------------------------------------------------

class CheckDailyUpdatesTest(TestCase):
    """Verify that _check_daily_updates tracks runs via self.last_daily_run."""

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_runs_when_not_run_today(self, mock_run):
        """Should run and set last_daily_run when not run today."""
        cmd = _make_monitor()
        # Simulate 3am UTC
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()
        self.assertEqual(cmd.last_daily_run, fake_now.date())

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_skips_when_already_run_today(self, mock_run):
        """Should NOT run again if last_daily_run is already today."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        cmd.last_daily_run = fake_now.date()  # already ran today

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_skips_outside_window(self, mock_run):
        """Should NOT run at 10am — only runs between 2-4am UTC."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=10, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_daily_updates'
    )
    def test_runs_again_next_day(self, mock_run):
        """Should run again the next day even if it ran yesterday."""
        cmd = _make_monitor()
        fake_now = timezone.now().replace(hour=3, minute=0, second=0, microsecond=0)
        cmd.last_daily_run = fake_now.date() - timedelta(days=1)  # yesterday

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_daily_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()


# ---------------------------------------------------------------------------
# Tests: _check_monthly_updates uses instance variable (not Player.created_at)
# ---------------------------------------------------------------------------

class CheckMonthlyUpdatesTest(TestCase):
    """Verify that _check_monthly_updates tracks runs via self.last_monthly_run."""

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_runs_on_first_of_month(self, mock_run):
        """Should run and set last_monthly_run on 1st of month at 3am."""
        cmd = _make_monitor()
        # Create a datetime that is the 1st of the month at 3am
        now = timezone.now()
        fake_now = now.replace(day=1, hour=3, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertTrue(result)
        mock_run.assert_called_once()
        self.assertEqual(cmd.last_monthly_run, fake_now.strftime('%Y-%m'))

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_skips_when_already_run_this_month(self, mock_run):
        """Should NOT run again if last_monthly_run is already this month."""
        cmd = _make_monitor()
        now = timezone.now()
        fake_now = now.replace(day=1, hour=3, minute=0, second=0, microsecond=0)
        cmd.last_monthly_run = fake_now.strftime('%Y-%m')

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()

    @patch(
        'oneFourSeven.management.commands.auto_live_monitor.Command._run_monthly_updates'
    )
    def test_skips_on_non_first_day(self, mock_run):
        """Should NOT run on day 15 — only runs on 1st of month."""
        cmd = _make_monitor()
        now = timezone.now()
        fake_now = now.replace(day=15, hour=3, minute=0, second=0, microsecond=0)

        with patch('oneFourSeven.management.commands.auto_live_monitor.timezone') as mock_tz:
            mock_tz.now.return_value = fake_now
            result = cmd._check_monthly_updates()

        self.assertFalse(result)
        mock_run.assert_not_called()


# ---------------------------------------------------------------------------
# Tests: player_match_history view — NULL scheduled_date sorts to bottom
# ---------------------------------------------------------------------------

class PlayerMatchHistoryOrderingTest(TestCase):
    """Verify that matches with NULL scheduled_date appear LAST, not first."""

    def setUp(self):
        self.client = APIClient()
        self.player = _make_player(player_id=9001)

        now = timezone.now()

        # Match with NULL scheduled_date (old/incomplete data — should appear LAST)
        self.null_date_match = _make_match(
            player_id=9001,
            api_match_id=1001,
            scheduled_date=None,
            status=3,
        )

        # Match from 5 days ago (should appear 2nd)
        self.old_match = _make_match(
            player_id=9001,
            api_match_id=1002,
            scheduled_date=now - timedelta(days=5),
            status=3,
        )

        # Most recent match (should appear 1st)
        self.recent_match = _make_match(
            player_id=9001,
            api_match_id=1003,
            scheduled_date=now - timedelta(days=1),
            status=3,
        )

    def test_null_date_appears_last(self):
        """NULL scheduled_date must appear after matches that have a real date."""
        url = f'/oneFourSeven/players/9001/matches/'
        response = self.client.get(url, {'limit': 10})

        self.assertEqual(response.status_code, 200)
        matches = response.data['matches']

        # Should return 3 matches
        self.assertEqual(len(matches), 3)

        # Extract api_match_ids in returned order
        returned_ids = [m['api_match_id'] for m in matches]

        # Most recent (1003) first, then old (1002), NULL last (1001)
        self.assertEqual(returned_ids[0], 1003, "Most recent match should be first")
        self.assertEqual(returned_ids[1], 1002, "5-day-old match should be second")
        self.assertEqual(returned_ids[2], 1001, "NULL date match should be last")

    def test_null_date_not_first(self):
        """Regression test: NULL date must NOT appear as the most-recent match."""
        url = f'/oneFourSeven/players/9001/matches/'
        response = self.client.get(url, {'limit': 10})

        self.assertEqual(response.status_code, 200)
        matches = response.data['matches']

        first_match_id = matches[0]['api_match_id']
        self.assertNotEqual(
            first_match_id, 1001,
            "NULL-date match should never be returned as the most recent match"
        )
