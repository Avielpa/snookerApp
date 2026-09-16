"""Tests for GET /oneFourSeven/scoreboard/leaderboard/."""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PlayerBestBreak
from .tests import _make_user

URL = '/oneFourSeven/scoreboard/leaderboard/'


class LeaderboardViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_requires_reds_count(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 400)

    def test_rejects_non_integer_reds_count(self):
        response = self.client.get(URL, {'reds_count': 'fifteen'})
        self.assertEqual(response.status_code, 400)

    def test_no_auth_required(self):
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(response.status_code, 200)

    def test_empty_when_no_records(self):
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(response.data, [])

    def test_orders_by_best_break_descending(self):
        u1, u2, u3 = _make_user('lb_a'), _make_user('lb_b'), _make_user('lb_c')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=30, frame_time_seconds=200)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=90, frame_time_seconds=300)
        PlayerBestBreak.objects.create(user=u3, reds_count=15, best_break=60, frame_time_seconds=250)
        response = self.client.get(URL, {'reds_count': 15})
        breaks = [row['best_break'] for row in response.data]
        self.assertEqual(breaks, [90, 60, 30])

    def test_faster_time_breaks_a_tie(self):
        u1, u2 = _make_user('lb_tie_a'), _make_user('lb_tie_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=50, frame_time_seconds=400)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=50, frame_time_seconds=200)
        response = self.client.get(URL, {'reds_count': 15})
        usernames = [row['username'] for row in response.data]
        self.assertEqual(usernames, ['lb_tie_b', 'lb_tie_a'])

    def test_null_frame_time_sorts_last_among_ties(self):
        u1, u2 = _make_user('lb_null_a'), _make_user('lb_null_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=50, frame_time_seconds=None)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=50, frame_time_seconds=300)
        response = self.client.get(URL, {'reds_count': 15})
        usernames = [row['username'] for row in response.data]
        self.assertEqual(usernames, ['lb_null_b', 'lb_null_a'])

    def test_filters_by_reds_count(self):
        u1, u2 = _make_user('lb_reds_a'), _make_user('lb_reds_b')
        PlayerBestBreak.objects.create(user=u1, reds_count=6, best_break=51)
        PlayerBestBreak.objects.create(user=u2, reds_count=15, best_break=100)
        response = self.client.get(URL, {'reds_count': 6})
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['best_break'], 51)

    def test_includes_verification_flag(self):
        u1 = _make_user('lb_flag')
        PlayerBestBreak.objects.create(user=u1, reds_count=15, best_break=147, frame_time_seconds=10, is_verified=False)
        response = self.client.get(URL, {'reds_count': 15})
        self.assertFalse(response.data[0]['is_verified'])

    def test_limited_to_top_50(self):
        for i in range(60):
            u = _make_user(f'lb_bulk_{i}')
            PlayerBestBreak.objects.create(user=u, reds_count=15, best_break=i)
        response = self.client.get(URL, {'reds_count': 15})
        self.assertEqual(len(response.data), 50)
