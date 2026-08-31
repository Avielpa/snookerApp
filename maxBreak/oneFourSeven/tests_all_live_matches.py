# Tests for all_live_matches_view — other-live is "not this event", any tour.
from datetime import date, datetime, timezone as dt_timezone

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Event, MatchesOfAnEvent, Player

TODAY = datetime.combine(date.today(), datetime.min.time(), tzinfo=dt_timezone.utc)


def _event(event_id, name, event_type='Ranking', main=None, tour='main'):
    return Event.objects.create(
        ID=event_id, Name=name, Type=event_type, Season=2026,
        Main=main if main is not None else event_id, Tour=tour,
    )


def _match(event, api_match_id, status=1):
    return MatchesOfAnEvent.objects.create(
        Event=event, Round=1, Number=api_match_id, api_match_id=api_match_id,
        Status=status, ScheduledDate=TODAY,
    )


class AllLiveMatchesViewTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        Player.objects.create(ID=10, FirstName='Judd', LastName='Trump')
        Player.objects.create(ID=20, FirstName='Zhao', LastName='Xintong')

    def _ids(self, response):
        return {row['api_match_id'] for row in response.data}

    def test_empty_when_nothing_is_live(self):
        response = self.client.get('/oneFourSeven/all-live-matches/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_includes_a_main_tour_qualifier_live_match(self):
        _event(1, 'British Open')
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        _match(qual, 200, status=1)

        response = self.client.get('/oneFourSeven/all-live-matches/?exclude_event_id=1')
        self.assertEqual(self._ids(response), {200})

    def test_excludes_the_focused_event_even_when_it_is_live(self):
        main = _event(1, 'British Open')
        _match(main, 100, status=1)

        response = self.client.get('/oneFourSeven/all-live-matches/?exclude_event_id=1')
        self.assertEqual(response.data, [])

    def test_includes_q_tour_and_womens_live_alongside_a_main_qualifier(self):
        _event(1, 'British Open')
        qual = _event(2, 'British Open Qualifiers', event_type='Qualifying', main=1)
        qtour = _event(80, 'Q Tour Event 7', tour='other')
        womens = _event(90, "World Women's Championship", tour='womens')
        _match(qual, 200, status=1)
        _match(qtour, 800, status=1)
        _match(womens, 900, status=1)

        response = self.client.get('/oneFourSeven/all-live-matches/?exclude_event_id=1')
        self.assertEqual(self._ids(response), {200, 800, 900})

    def test_includes_on_break_matches(self):
        seniors = _event(70, 'Senior Masters', tour='seniors')
        _match(seniors, 700, status=2)

        response = self.client.get('/oneFourSeven/all-live-matches/')
        self.assertEqual(self._ids(response), {700})

    def test_does_not_include_scheduled_or_finished_matches(self):
        event = _event(1, 'British Open')
        _match(event, 100, status=0)
        _match(event, 101, status=3)

        response = self.client.get('/oneFourSeven/all-live-matches/')
        self.assertEqual(response.data, [])

    def test_without_exclude_param_includes_every_live_event(self):
        main = _event(1, 'British Open')
        _match(main, 100, status=1)

        response = self.client.get('/oneFourSeven/all-live-matches/')
        self.assertEqual(self._ids(response), {100})
