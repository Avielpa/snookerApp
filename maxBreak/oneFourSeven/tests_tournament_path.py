# Tests for tournament_path: main event match list includes qualifier Last-64.

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Event, MatchesOfAnEvent, RoundDetails
from .tournament_path import (
    path_matches_for_event,
    path_round_for_match,
    sequential_round_map,
)


def _event(**kwargs):
    defaults = {
        'ID': kwargs.pop('ID'),
        'Name': 'Wuhan Open',
        'Type': 'Ranking',
        'Season': 2026,
        'Main': kwargs.get('Main', kwargs.get('ID')),
    }
    defaults.update(kwargs)
    return Event.objects.create(**defaults)


def _match(event, round_no, number, api_match_id):
    return MatchesOfAnEvent.objects.create(
        Event=event,
        Round=round_no,
        Number=number,
        api_match_id=api_match_id,
        Status=0,
    )


class TournamentPathMatchesTest(TestCase):

    def setUp(self):
        self.main = _event(ID=2757, Name='Wuhan Open', Type='Ranking', Main=2757)
        self.qual = _event(
            ID=2758, Name='Wuhan Open Qualifiers', Type='Qualifying', Main=2757
        )
        _match(self.qual, 2, 1, 1001)  # qualifying — must stay off the main path
        self.l64 = _match(self.qual, 7, 1, 1002)
        self.l32 = _match(self.main, 8, 1, 2001)

    def test_main_path_includes_qualifier_round_7_not_round_2(self):
        ids = {m.api_match_id for m in path_matches_for_event(self.main)}
        self.assertIn(1002, ids)
        self.assertIn(2001, ids)
        self.assertNotIn(1001, ids)

    def test_qualifier_event_list_is_not_merged(self):
        ids = {m.api_match_id for m in path_matches_for_event(self.qual)}
        self.assertEqual(ids, {1001, 1002})

    def test_num_left_filter_when_round_details_exist(self):
        RoundDetails.objects.create(
            Event=self.qual, Round=7, NumLeft=64, Distance=5, RoundName='Round 1'
        )
        RoundDetails.objects.create(
            Event=self.qual, Round=2, NumLeft=128, Distance=5, RoundName='Qual Round 2'
        )
        ids = {m.api_match_id for m in path_matches_for_event(self.main)}
        self.assertEqual(ids, {1002, 2001})

    def test_sequential_map_labels_last_64_as_round_1(self):
        mapping = sequential_round_map(path_matches_for_event(self.main))
        self.assertEqual(mapping[7], 1)
        self.assertEqual(mapping[8], 2)
        self.assertNotIn(2, mapping)

    def test_path_round_for_qualifier_last_64_follows_main_path(self):
        self.assertEqual(path_round_for_match(self.l64), 1)
        self.assertEqual(path_round_for_match(self.l32), 2)


class TournamentPathApiTest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.main = _event(ID=2757, Name='Wuhan Open', Type='Ranking', Main=2757)
        self.qual = _event(
            ID=2758, Name='Wuhan Open Qualifiers', Type='Qualifying', Main=2757
        )
        _match(self.qual, 2, 1, 1001)
        _match(self.qual, 7, 1, 1002)
        _match(self.main, 8, 1, 2001)

    def test_main_event_matches_endpoint_includes_last_64(self):
        response = self.client.get('/oneFourSeven/events/2757/matches/')
        self.assertEqual(response.status_code, 200)
        ids = {row['api_match_id'] for row in response.data}
        self.assertIn(1002, ids)
        self.assertIn(2001, ids)
        self.assertNotIn(1001, ids)

    def test_main_event_matches_have_sequential_path_round(self):
        response = self.client.get('/oneFourSeven/events/2757/matches/')
        self.assertEqual(response.status_code, 200)
        by_id = {row['api_match_id']: row['path_round'] for row in response.data}
        self.assertEqual(by_id[1002], 1)
        self.assertEqual(by_id[2001], 2)

    def test_match_detail_path_round_for_last_64(self):
        response = self.client.get('/oneFourSeven/matches/1002/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['path_round'], 1)
