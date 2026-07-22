"""
Tests for _get_todays_player_ids() in update_player_api_stats.py and
update_player_ct_stats.py.

Bug fixed: the old filter excluded status=3 (Finished) matches, so a
player's NumMaximums/career stats could never be refreshed by the one
event that actually changes them (their match finishing). It also only
looked at "today" even though the job runs at 2 AM UTC, right after most
matches from the previous evening finish.
"""

from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from .models import Player, UpcomingMatch
from .management.commands.update_player_api_stats import (
    _get_todays_player_ids as api_stats_ids,
)
from .management.commands.update_player_ct_stats import (
    _get_todays_player_ids as ct_stats_ids,
)


def _make_player(player_id):
    return Player.objects.get_or_create(
        ID=player_id,
        defaults={'FirstName': 'Test', 'LastName': f'Player{player_id}'},
    )[0]


def _make_upcoming_match(p1, p2, days_ago, status, tour_type='main'):
    _make_player(p1)
    _make_player(p2)
    scheduled = timezone.now() - timedelta(days=days_ago)
    return UpcomingMatch.objects.create(
        api_match_id=1000000 + p1 * 10 + p2,
        player1_id=p1,
        player2_id=p2,
        scheduled_date=scheduled,
        status=status,
        tour_type=tour_type,
    )


class TargetingFunctionsTestCase(TestCase):
    """Shared test matrix run against both duplicated implementations."""

    def _run_both(self):
        return api_stats_ids(), ct_stats_ids()

    def test_finished_match_today_is_included(self):
        """Regression test: this was the actual bug — a Finished match
        today used to be silently excluded."""
        _make_upcoming_match(1981, 999, days_ago=0, status=3)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)
        self.assertIn(1981, ct_ids)
        self.assertIn(999, api_ids)

    def test_finished_match_yesterday_is_included(self):
        """This is the Bingyu Chang case: match finished the evening
        before the 2 AM UTC job runs."""
        _make_upcoming_match(1981, 999, days_ago=1, status=3)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)
        self.assertIn(1981, ct_ids)

    def test_scheduled_not_yet_played_today_still_included(self):
        """Original intent (pre-match bio refresh) must still work."""
        _make_upcoming_match(1981, 999, days_ago=0, status=0)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)
        self.assertIn(1981, ct_ids)

    def test_live_match_today_included(self):
        _make_upcoming_match(1981, 999, days_ago=0, status=1)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)

    def test_on_break_match_today_included(self):
        _make_upcoming_match(1981, 999, days_ago=0, status=2)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)

    def test_match_two_days_ago_excluded(self):
        """Window is today+yesterday only, not an unbounded lookback."""
        _make_upcoming_match(1981, 999, days_ago=2, status=3)
        api_ids, ct_ids = self._run_both()
        self.assertNotIn(1981, api_ids)
        self.assertNotIn(1981, ct_ids)

    def test_match_in_future_excluded(self):
        _make_upcoming_match(1981, 999, days_ago=-3, status=0)
        api_ids, ct_ids = self._run_both()
        self.assertNotIn(1981, api_ids)
        self.assertNotIn(1981, ct_ids)

    def test_non_main_tour_excluded(self):
        _make_upcoming_match(1981, 999, days_ago=0, status=3, tour_type='womens')
        api_ids, ct_ids = self._run_both()
        self.assertNotIn(1981, api_ids)
        self.assertNotIn(1981, ct_ids)

    def test_no_matches_returns_empty_set(self):
        api_ids, ct_ids = self._run_both()
        self.assertEqual(api_ids, set())
        self.assertEqual(ct_ids, set())

    def test_none_player_ids_excluded(self):
        """A match with an unresolved/TBD opponent (null id) must not
        pollute the set with None."""
        UpcomingMatch.objects.create(
            api_match_id=5555555,
            player1_id=1981,
            player2_id=None,
            scheduled_date=timezone.now(),
            status=3,
            tour_type='main',
        )
        api_ids, ct_ids = self._run_both()
        self.assertNotIn(None, api_ids)
        self.assertNotIn(None, ct_ids)
        self.assertIn(1981, api_ids)

    def test_both_players_in_same_match_included(self):
        _make_upcoming_match(1981, 500, days_ago=0, status=3)
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)
        self.assertIn(500, api_ids)

    def test_multiple_matches_multiple_days_union_correctly(self):
        _make_upcoming_match(1981, 500, days_ago=0, status=3)
        _make_upcoming_match(2000, 2001, days_ago=1, status=3)
        _make_upcoming_match(3000, 3001, days_ago=3, status=3)  # outside window
        api_ids, ct_ids = self._run_both()
        self.assertEqual(api_ids, {1981, 500, 2000, 2001})
        self.assertEqual(ct_ids, {1981, 500, 2000, 2001})

    def test_boundary_exactly_today_midnight(self):
        """scheduled_date at today's midnight must count as 'today'."""
        _make_player(1981)
        _make_player(999)
        today_midnight = timezone.make_aware(
            timezone.datetime.combine(date.today(), timezone.datetime.min.time())
        )
        UpcomingMatch.objects.create(
            api_match_id=7777777,
            player1_id=1981,
            player2_id=999,
            scheduled_date=today_midnight,
            status=3,
            tour_type='main',
        )
        api_ids, ct_ids = self._run_both()
        self.assertIn(1981, api_ids)
