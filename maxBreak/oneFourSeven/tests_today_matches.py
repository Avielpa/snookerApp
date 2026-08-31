# Tests for today_matches.py — "Today's Matches" feature.
# See docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md for the full plan this
# covers, including the British Open Qualifiers scenario that triggered it.

from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Event, MatchesOfAnEvent, Player
from .today_matches import (
    get_matches_scheduled_today,
    collect_player_ids,
    build_today_match_row,
    group_matches_by_event,
)

TODAY = datetime.combine(date.today(), datetime.min.time(), tzinfo=dt_timezone.utc)
YESTERDAY = TODAY - timedelta(days=1)
TOMORROW = TODAY + timedelta(days=1)


def _event(event_id, name, event_type='Ranking', main=None, tour='main'):
    return Event.objects.create(
        ID=event_id, Name=name, Type=event_type, Season=2026,
        Main=main if main is not None else event_id, Tour=tour,
    )


def _match(event, round_no, number, api_match_id, scheduled_date, status=0):
    return MatchesOfAnEvent.objects.create(
        Event=event, Round=round_no, Number=number, api_match_id=api_match_id,
        Status=status, ScheduledDate=scheduled_date,
    )


def _player(player_id, first_name, last_name):
    return Player.objects.create(ID=player_id, FirstName=first_name, LastName=last_name)


class GetMatchesScheduledTodayTest(TestCase):

    def setUp(self):
        self.event = _event(1, 'British Open')

    def test_includes_match_scheduled_today(self):
        m = _match(self.event, 1, 1, 100, TODAY)
        self.assertIn(m, list(get_matches_scheduled_today()))

    def test_excludes_match_scheduled_yesterday(self):
        _match(self.event, 1, 1, 100, YESTERDAY)
        self.assertEqual(list(get_matches_scheduled_today()), [])

    def test_excludes_match_scheduled_tomorrow(self):
        _match(self.event, 1, 1, 100, TOMORROW)
        self.assertEqual(list(get_matches_scheduled_today()), [])

    def test_excludes_match_with_no_scheduled_date(self):
        _match(self.event, 1, 1, 100, None)
        self.assertEqual(list(get_matches_scheduled_today()), [])

    def test_includes_match_from_a_qualifying_event(self):
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        m = _match(qual, 2, 1, 200, TODAY)
        self.assertIn(m, list(get_matches_scheduled_today()))

    def test_includes_match_from_a_non_main_tour_event(self):
        womens = _event(3, "World Women's Championship", tour='womens')
        m = _match(womens, 1, 1, 300, TODAY)
        self.assertIn(m, list(get_matches_scheduled_today()))

    def test_includes_matches_from_multiple_events_same_day(self):
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        m1 = _match(self.event, 1, 1, 100, TODAY)
        m2 = _match(qual, 2, 1, 200, TODAY)
        ids = {m.api_match_id for m in get_matches_scheduled_today()}
        self.assertEqual(ids, {100, 200})

    def test_any_status_is_included(self):
        _match(self.event, 1, 1, 100, TODAY, status=0)
        _match(self.event, 1, 2, 101, TODAY, status=1)
        _match(self.event, 1, 3, 102, TODAY, status=2)
        _match(self.event, 1, 4, 103, TODAY, status=3)
        self.assertEqual(get_matches_scheduled_today().count(), 4)

    def test_empty_when_nothing_scheduled_today(self):
        self.assertEqual(list(get_matches_scheduled_today()), [])


class CollectPlayerIdsTest(TestCase):

    def test_collects_both_players_from_each_match(self):
        event = _event(1, 'British Open')
        m1 = MatchesOfAnEvent(Player1ID=10, Player2ID=20)
        m2 = MatchesOfAnEvent(Player1ID=30, Player2ID=None)
        self.assertEqual(collect_player_ids([m1, m2]), {10, 20, 30, None})


class BuildTodayMatchRowTest(TestCase):

    def setUp(self):
        _player(10, 'Judd', 'Trump')
        _player(20, 'Zhao', 'Xintong')
        self.player_names_map = {10: 'Judd Trump', 20: 'Zhao Xintong'}

    def test_row_has_event_fields_attached(self):
        event = _event(1, 'British Open')
        m = _match(event, 1, 1, 100, TODAY)
        m.Player1ID, m.Player2ID = 10, 20
        row = build_today_match_row(m, self.player_names_map)
        self.assertEqual(row['event_id'], 1)
        self.assertEqual(row['event_name'], 'British Open')
        self.assertEqual(row['event_tour'], 'main')
        self.assertFalse(row['is_qualifier'])

    def test_row_marks_qualifier_event(self):
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        m = _match(qual, 2, 1, 200, TODAY)
        row = build_today_match_row(m, self.player_names_map)
        self.assertTrue(row['is_qualifier'])

    def test_row_includes_standard_match_dict_fields(self):
        event = _event(1, 'British Open')
        m = _match(event, 1, 1, 100, TODAY)
        row = build_today_match_row(m, self.player_names_map)
        self.assertIn('score1', row)
        self.assertIn('status_code', row)
        self.assertIn('api_match_id', row)


class GroupMatchesByEventTest(TestCase):

    def test_groups_two_matches_from_the_same_event(self):
        rows = [
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False},
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False},
        ]
        groups = group_matches_by_event(rows)
        self.assertEqual(len(groups), 1)
        self.assertEqual(len(groups[0]['matches']), 2)

    def test_produces_two_groups_for_two_different_events(self):
        rows = [
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False},
            {'event_id': 2, 'event_name': 'British Open Qualifiers', 'event_tour': 'main', 'is_qualifier': True},
        ]
        groups = group_matches_by_event(rows)
        self.assertEqual(len(groups), 2)

    def test_groups_ordered_by_earliest_match_time_not_event_name(self):
        # "Wuhan Open" is a group's earliest match at 09:00; "British Open" at
        # 11:00 — Wuhan's group must come first despite the alphabetical name.
        rows = [
            {'event_id': 2, 'event_name': 'Wuhan Open', 'event_tour': 'main', 'is_qualifier': False, 'scheduled_date': '2026-08-31T09:00:00Z'},
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False, 'scheduled_date': '2026-08-31T11:00:00Z'},
        ]
        groups = group_matches_by_event(rows)
        self.assertEqual([g['event_name'] for g in groups], ['Wuhan Open', 'British Open'])

    def test_matches_within_a_group_stay_in_the_order_given(self):
        # group_matches_by_event trusts its caller to pass already
        # time-ordered rows (get_matches_scheduled_today does this) —
        # it must not silently re-sort within a group.
        rows = [
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False, 'scheduled_date': '2026-08-31T09:00:00Z', 'api_match_id': 100},
            {'event_id': 1, 'event_name': 'British Open', 'event_tour': 'main', 'is_qualifier': False, 'scheduled_date': '2026-08-31T11:00:00Z', 'api_match_id': 101},
        ]
        groups = group_matches_by_event(rows)
        self.assertEqual([m['api_match_id'] for m in groups[0]['matches']], [100, 101])

    def test_empty_input_gives_empty_output(self):
        self.assertEqual(group_matches_by_event([]), [])


class TodayMatchesViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        _player(10, 'Judd', 'Trump')
        _player(20, 'Zhao', 'Xintong')

    def test_response_has_date_and_groups(self):
        response = self.client.get('/oneFourSeven/matches/today/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['date'], date.today().isoformat())
        self.assertEqual(response.data['groups'], [])

    def test_main_and_qualifiers_appear_as_two_separate_groups(self):
        # The exact British Open scenario that triggered this feature:
        # main draw started today, a few leftover Qualifiers matches also
        # scheduled today.
        main = _event(1, 'British Open')
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        _match(main, 1, 1, 100, TODAY)
        _match(qual, 6, 1, 200, TODAY, status=0)

        response = self.client.get('/oneFourSeven/matches/today/')
        event_ids = {g['event_id'] for g in response.data['groups']}
        self.assertEqual(event_ids, {1, 2})
        qual_group = next(g for g in response.data['groups'] if g['event_id'] == 2)
        self.assertTrue(qual_group['is_qualifier'])
        self.assertEqual(len(qual_group['matches']), 1)

    def test_includes_a_womens_tour_match_scheduled_today(self):
        womens = _event(3, "World Women's Championship", tour='womens')
        _match(womens, 1, 1, 300, TODAY)

        response = self.client.get('/oneFourSeven/matches/today/')
        event_ids = {g['event_id'] for g in response.data['groups']}
        self.assertIn(3, event_ids)

    def test_finished_match_today_is_still_included_with_its_score(self):
        main = _event(1, 'British Open')
        m = _match(main, 1, 1, 100, TODAY, status=3)
        m.Score1, m.Score2, m.WinnerID, m.Player1ID, m.Player2ID = 4, 1, 10, 10, 20
        m.save()

        response = self.client.get('/oneFourSeven/matches/today/')
        match_row = response.data['groups'][0]['matches'][0]
        self.assertEqual(match_row['status_code'], 3)
        self.assertEqual(match_row['score1'], 4)
        self.assertEqual(match_row['score2'], 1)

    def test_live_match_today_is_included_with_live_status(self):
        main = _event(1, 'British Open')
        _match(main, 1, 1, 100, TODAY, status=1)

        response = self.client.get('/oneFourSeven/matches/today/')
        match_row = response.data['groups'][0]['matches'][0]
        self.assertEqual(match_row['status_code'], 1)

    def test_two_concurrent_main_events_both_produce_a_group(self):
        first = _event(1, 'British Open')
        second = _event(4, 'Wuhan Open')
        _match(first, 1, 1, 100, TODAY)
        _match(second, 1, 1, 400, TODAY)

        response = self.client.get('/oneFourSeven/matches/today/')
        event_ids = {g['event_id'] for g in response.data['groups']}
        self.assertEqual(event_ids, {1, 4})

    def test_qualifier_with_future_main_draw_still_shows_todays_matches(self):
        future_main = Event.objects.create(
            ID=5, Name='Future Open', Type='Ranking', Season=2026, Main=5,
            StartDate=date.today() + timedelta(days=10),
        )
        qual = _event(6, 'Future Open Qualifiers', event_type='Qualifying', main=5)
        _match(qual, 2, 1, 500, TODAY)

        response = self.client.get('/oneFourSeven/matches/today/')
        event_ids = {g['event_id'] for g in response.data['groups']}
        self.assertIn(6, event_ids)

    def test_response_orders_groups_and_matches_by_time_not_alphabetically(self):
        # Qualifiers plays earlier in the day than the main draw today —
        # despite "British Open" alphabetically preceding "British Open
        # Qualifiers", the earlier-kicking-off group must come first.
        main = _event(1, 'British Open')
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        _match(qual, 6, 1, 200, TODAY + timedelta(hours=9))
        _match(main, 1, 1, 100, TODAY + timedelta(hours=12))

        response = self.client.get('/oneFourSeven/matches/today/')
        event_ids_in_order = [g['event_id'] for g in response.data['groups']]
        self.assertEqual(event_ids_in_order, [2, 1])

    def test_matches_within_the_response_are_time_ordered(self):
        main = _event(1, 'British Open')
        _match(main, 1, 2, 102, TODAY + timedelta(hours=14), status=0)
        _match(main, 1, 1, 101, TODAY + timedelta(hours=10), status=0)

        response = self.client.get('/oneFourSeven/matches/today/')
        match_ids_in_order = [m['api_match_id'] for m in response.data['groups'][0]['matches']]
        self.assertEqual(match_ids_in_order, [101, 102])

    def test_missing_player_name_does_not_crash(self):
        main = _event(1, 'British Open')
        m = _match(main, 1, 1, 100, TODAY)
        m.Player1ID = 999  # no matching Player row
        m.save()

        response = self.client.get('/oneFourSeven/matches/today/')
        self.assertEqual(response.status_code, 200)
