# Tests for tournament_path: main event match list includes qualifier Last-64.

from datetime import datetime, timezone as dt_timezone

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Event, MatchesOfAnEvent, RoundDetails
from .tournament_path import (
    path_matches_for_event,
    path_round_for_match,
    path_event_id_for_match,
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


def _match(event, round_no, number, api_match_id, scheduled_date=None):
    return MatchesOfAnEvent.objects.create(
        Event=event,
        Round=round_no,
        Number=number,
        api_match_id=api_match_id,
        Status=0,
        ScheduledDate=scheduled_date,
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

    def test_path_event_id_for_merged_qualifier_match_is_the_main_event(self):
        # The merged Last-64 match physically lives on the Qualifiers event
        # (self.qual, ID 2758), but its PATH is the main event's (2757) —
        # frontend round-grouping must key off this, not match.Event_id,
        # or a merged path gets split back into two by event.
        self.assertEqual(path_event_id_for_match(self.l64), self.main.ID)
        self.assertEqual(path_event_id_for_match(self.l32), self.main.ID)

    def test_path_event_id_for_qualifying_only_match_is_its_own_event(self):
        # A qualifying-only match (never merged into the main path — round 2
        # from setUp) reports its own event as the path owner, unchanged.
        qualifying_only = MatchesOfAnEvent.objects.get(api_match_id=1001)
        self.assertEqual(path_event_id_for_match(qualifying_only), self.qual.ID)


class SequentialRoundMapOutOfOrderTest(TestCase):
    """
    Regression test for the bug the 2026-08-17 bracketChain.ts fix already
    solved on the frontend: a round can be numbered outside the normal
    knockout sequence (e.g. a Wild Card Round) while still being played
    BEFORE rounds with a lower number. path_round must order by when a
    round was actually played, not by its raw Round number.
    """

    def setUp(self):
        self.event = _event(ID=3001, Name='Some Open', Type='Ranking', Main=3001)

    def test_out_of_sequence_round_ordered_by_play_date_not_round_number(self):
        # Wild Card Round: numbered 20 (higher than the Final's 15) but
        # actually played first.
        wild_card = _match(
            self.event, 20, 1, 4001,
            scheduled_date=datetime(2026, 3, 1, tzinfo=dt_timezone.utc),
        )
        quarter_final = _match(
            self.event, 13, 1, 4002,
            scheduled_date=datetime(2026, 3, 5, tzinfo=dt_timezone.utc),
        )
        semi_final = _match(
            self.event, 14, 1, 4003,
            scheduled_date=datetime(2026, 3, 8, tzinfo=dt_timezone.utc),
        )
        final = _match(
            self.event, 15, 1, 4004,
            scheduled_date=datetime(2026, 3, 10, tzinfo=dt_timezone.utc),
        )

        mapping = sequential_round_map([wild_card, quarter_final, semi_final, final])

        self.assertEqual(mapping[20], 1)  # played first, despite the highest Round number
        self.assertEqual(mapping[13], 2)
        self.assertEqual(mapping[14], 3)
        self.assertEqual(mapping[15], 4)  # real Final is still last

    def test_rounds_with_no_date_fall_back_to_ascending_round_number(self):
        # Unchanged behaviour when no ScheduledDate is known at all (matches
        # the pre-existing tests above, which never set ScheduledDate).
        round_a = _match(self.event, 7, 1, 5001)
        round_b = _match(self.event, 8, 1, 5002)

        mapping = sequential_round_map([round_a, round_b])

        self.assertEqual(mapping[7], 1)
        self.assertEqual(mapping[8], 2)

    def test_dated_round_sorts_before_undated_rounds(self):
        # A round with a known play date is assumed to have already
        # happened; undated rounds fall back after it in round-number order
        # rather than being treated as "earliest" by default.
        dated_early = _match(
            self.event, 9, 1, 6001,
            scheduled_date=datetime(2026, 4, 1, tzinfo=dt_timezone.utc),
        )
        undated = _match(self.event, 8, 1, 6002)

        mapping = sequential_round_map([dated_early, undated])

        self.assertEqual(mapping[9], 1)
        self.assertEqual(mapping[8], 2)


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

    def test_main_event_matches_share_one_path_event_id_across_the_merge(self):
        # The Last-64 (1002, physically on the Qualifiers event 2758) and the
        # Last-32 (2001, on the main event 2757) are one merged path — the
        # frontend must be able to group them together, so both must report
        # the SAME path_event_id despite having different raw event_ids.
        response = self.client.get('/oneFourSeven/events/2757/matches/')
        self.assertEqual(response.status_code, 200)
        by_id = {row['api_match_id']: row for row in response.data}
        self.assertEqual(by_id[1002]['event_id'], 2758)  # raw event unchanged
        self.assertEqual(by_id[1002]['path_event_id'], 2757)  # path owner is main
        self.assertEqual(by_id[2001]['path_event_id'], 2757)
        self.assertEqual(by_id[1002]['path_event_id'], by_id[2001]['path_event_id'])

    def test_match_detail_path_event_id_for_last_64(self):
        response = self.client.get('/oneFourSeven/matches/1002/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['path_event_id'], 2757)
