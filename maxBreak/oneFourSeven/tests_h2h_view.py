"""
Tests for h2h_view (GET /h2h/<player1_id>/<player2_id>/).

Regression coverage for the duplicate-row bug: PlayerMatchHistory stores one
row per player per match, so a match between p1 and p2 has two rows (one
owned by p1, one owned by p2). Without constraining on player_id, the view's
Q(...) filter matched both rows for every match, doubling TotalMeetings and
the win counts.
"""

from django.test import TestCase
from rest_framework.test import APIClient

from .models import Player, PlayerMatchHistory


def _make_player(player_id, first='Test', last='Player'):
    return Player.objects.get_or_create(
        ID=player_id,
        defaults={'FirstName': first, 'LastName': last},
    )[0]


def _make_match(player_id, player1_id, player2_id, winner_id, api_match_id,
                 round_name='Final', status=3, season=2025, event_id=1, round_number=1):
    return PlayerMatchHistory.objects.create(
        api_match_id=api_match_id,
        player_id=player_id,
        player1_id=player1_id,
        player2_id=player2_id,
        winner_id=winner_id,
        round_name=round_name,
        round_number=round_number,
        event_id=event_id,
        status=status,
        season=season,
        score1=3 if winner_id == player1_id else 1,
        score2=3 if winner_id == player2_id else 1,
    )


class H2HViewDedupeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.p1 = _make_player(101, 'Alice', 'One')
        self.p2 = _make_player(102, 'Bob', 'Two')

    def test_single_match_stored_as_two_perspective_rows_counts_once(self):
        # p1's own history row for this match
        _make_match(player_id=101, player1_id=101, player2_id=102, winner_id=101, api_match_id=5001)
        # p2's own history row for the SAME real match
        _make_match(player_id=102, player1_id=101, player2_id=102, winner_id=101, api_match_id=5001)

        resp = self.client.get('/oneFourSeven/h2h/101/102/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data['TotalMeetings'], 1)
        self.assertEqual(len(data['Matches']), 1)
        self.assertEqual(data['Player1Wins'], 1)
        self.assertEqual(data['Player2Wins'], 0)

    def test_multiple_matches_all_deduped(self):
        for i, winner in enumerate([101, 102, 101], start=1):
            _make_match(player_id=101, player1_id=101, player2_id=102, winner_id=winner,
                        api_match_id=6000 + i, event_id=1000 + i)
            _make_match(player_id=102, player1_id=101, player2_id=102, winner_id=winner,
                        api_match_id=6000 + i, event_id=1000 + i)

        resp = self.client.get('/oneFourSeven/h2h/101/102/')
        data = resp.json()

        self.assertEqual(data['TotalMeetings'], 3)
        self.assertEqual(data['Player1Wins'], 2)
        self.assertEqual(data['Player2Wins'], 1)

    def test_dedupe_keeps_p1_owned_row_when_metadata_diverges(self):
        # The two mirror rows can carry different round_name metadata for
        # the same api_match_id. p1's own row must be the one returned.
        _make_match(player_id=101, player1_id=101, player2_id=102, winner_id=101,
                    api_match_id=7001, round_name='Qualifying Round')
        _make_match(player_id=102, player1_id=101, player2_id=102, winner_id=101,
                    api_match_id=7001, round_name='Round 7')

        resp = self.client.get('/oneFourSeven/h2h/101/102/')
        data = resp.json()

        self.assertEqual(len(data['Matches']), 1)
        self.assertEqual(data['Matches'][0]['RoundName'], 'Qualifying Round')

    def test_reversed_player_order_still_deduped(self):
        # Querying as p2 vs p1 should behave symmetrically.
        _make_match(player_id=101, player1_id=101, player2_id=102, winner_id=102, api_match_id=8001)
        _make_match(player_id=102, player1_id=101, player2_id=102, winner_id=102, api_match_id=8001)

        resp = self.client.get('/oneFourSeven/h2h/102/101/')
        data = resp.json()

        self.assertEqual(data['TotalMeetings'], 1)
        self.assertEqual(data['Player1Wins'], 1)  # p2 (now Player1 in the response) won
        self.assertEqual(data['Player2Wins'], 0)

    def test_single_row_without_a_mirror_still_counts(self):
        # Edge case: only p1's row exists (e.g. p2's row hasn't backfilled yet).
        _make_match(player_id=101, player1_id=101, player2_id=102, winner_id=101, api_match_id=9001)

        resp = self.client.get('/oneFourSeven/h2h/101/102/')
        data = resp.json()

        self.assertEqual(data['TotalMeetings'], 1)
        self.assertEqual(data['Player1Wins'], 1)

    def test_no_matches_returns_zero(self):
        resp = self.client.get('/oneFourSeven/h2h/101/102/')
        data = resp.json()

        self.assertEqual(data['TotalMeetings'], 0)
        self.assertEqual(data['Matches'], [])
