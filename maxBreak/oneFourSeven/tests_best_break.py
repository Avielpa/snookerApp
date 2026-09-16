"""
Tests for the personal-best-break feature: GET/POST /oneFourSeven/scoreboard/best-break/.

Covers the upsert-if-higher logic (PlayerBestBreak.best_break must only ever rise),
per-reds_count isolation (a 6-red best and a 15-red best never compare against
each other), input validation, and auth gating.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import PlayerBestBreak
from .tests import _make_user

URL = '/oneFourSeven/scoreboard/best-break/'


class BestBreakPostTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bb_user')
        self.client.force_authenticate(user=self.user)

    def test_first_submission_creates_record(self):
        """First break for a reds_count creates a new record, marked is_new_record."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 36})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 36)
        self.assertEqual(response.data['reds_count'], 15)
        self.assertTrue(response.data['is_new_record'])
        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 36)

    def test_higher_break_replaces_record(self):
        """A higher break for the same reds_count overwrites the stored best."""
        self.client.post(URL, {'reds_count': 15, 'break': 36})
        response = self.client.post(URL, {'reds_count': 15, 'break': 74})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 74)
        self.assertTrue(response.data['is_new_record'])
        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 74)

    def test_lower_break_does_not_replace_record(self):
        """A lower break never overwrites — the stored best only ever rises."""
        self.client.post(URL, {'reds_count': 15, 'break': 74})
        response = self.client.post(URL, {'reds_count': 15, 'break': 20})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 74, 'lower break must not overwrite the existing record')
        self.assertFalse(response.data['is_new_record'])
        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 74)

    def test_equal_break_does_not_count_as_new_record(self):
        """Submitting the exact same value again is not a new record (must be strictly higher)."""
        self.client.post(URL, {'reds_count': 15, 'break': 50})
        response = self.client.post(URL, {'reds_count': 15, 'break': 50})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 50)
        self.assertFalse(response.data['is_new_record'])

    def test_different_reds_counts_are_independent(self):
        """A 6-reds best and a 15-reds best never compare against or overwrite each other."""
        self.client.post(URL, {'reds_count': 6, 'break': 51})
        self.client.post(URL, {'reds_count': 15, 'break': 100})
        # A big break at 6 reds must not affect (or be affected by) the 15-reds record.
        response = self.client.post(URL, {'reds_count': 6, 'break': 60})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 60)
        self.assertEqual(
            PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 100,
            '15-reds record must be untouched by a 6-reds submission',
        )

    def test_zero_break_is_valid(self):
        """A break of 0 (e.g. a foul-only visit) is a legitimate value, not an error."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 0})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 0)

    def test_maximum_break_147_accepted(self):
        """The maximum possible snooker break (147) is accepted normally."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 147})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 147)

    def test_negative_break_rejected(self):
        response = self.client.post(URL, {'reds_count': 15, 'break': -5})
        self.assertEqual(response.status_code, 400)

    def test_missing_reds_count_rejected(self):
        response = self.client.post(URL, {'break': 40})
        self.assertEqual(response.status_code, 400)

    def test_missing_break_rejected(self):
        response = self.client.post(URL, {'reds_count': 15})
        self.assertEqual(response.status_code, 400)

    def test_non_integer_values_rejected(self):
        response = self.client.post(URL, {'reds_count': 'fifteen', 'break': 40})
        self.assertEqual(response.status_code, 400)

    def test_two_users_do_not_share_records(self):
        """Each user's best break is fully isolated from every other user's."""
        other = _make_user('bb_other')
        self.client.post(URL, {'reds_count': 15, 'break': 90})

        other_client = APIClient()
        other_client.force_authenticate(user=other)
        other_client.post(URL, {'reds_count': 15, 'break': 30})

        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 90)
        self.assertEqual(PlayerBestBreak.objects.get(user=other, reds_count=15).best_break, 30)


class BestBreakGetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bb_get_user')
        self.client.force_authenticate(user=self.user)

    def test_returns_empty_list_when_no_records(self):
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_returns_all_reds_counts_for_user(self):
        self.client.post(URL, {'reds_count': 6, 'break': 40})
        self.client.post(URL, {'reds_count': 15, 'break': 80})
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        by_reds = {row['reds_count']: row['best_break'] for row in response.data}
        self.assertEqual(by_reds[6], 40)
        self.assertEqual(by_reds[15], 80)

    def test_does_not_return_other_users_records(self):
        other = _make_user('bb_get_other')
        other_client = APIClient()
        other_client.force_authenticate(user=other)
        other_client.post(URL, {'reds_count': 15, 'break': 147})

        self.client.post(URL, {'reds_count': 15, 'break': 10})
        response = self.client.get(URL)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['best_break'], 10)


class BestBreakAuthTest(TestCase):
    """Both GET and POST must require authentication — no device-id/anonymous path exists."""

    def test_get_requires_auth(self):
        response = APIClient().get(URL)
        self.assertEqual(response.status_code, 401)

    def test_post_requires_auth(self):
        response = APIClient().post(URL, {'reds_count': 15, 'break': 40})
        self.assertEqual(response.status_code, 401)


class BestBreakFrameTimeTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bb_time_user')
        self.client.force_authenticate(user=self.user)

    def test_submission_without_frame_time_is_verified(self):
        """Old-style callers that don't send frame_time_seconds still get is_verified=True."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 40})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_verified'])
        self.assertIsNone(response.data['frame_time_seconds'])

    def test_realistic_frame_time_is_verified(self):
        response = self.client.post(URL, {'reds_count': 15, 'break': 40, 'frame_time_seconds': 300})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['is_verified'])
        self.assertEqual(response.data['frame_time_seconds'], 300)

    def test_unrealistically_fast_frame_time_is_flagged_not_rejected(self):
        """A suspiciously fast break is still saved and still updates the record — just flagged."""
        response = self.client.post(URL, {'reds_count': 15, 'break': 147, 'frame_time_seconds': 10})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 147)
        self.assertFalse(response.data['is_verified'])
        self.assertEqual(PlayerBestBreak.objects.get(user=self.user, reds_count=15).best_break, 147)

    def test_flag_updates_alongside_a_new_higher_break(self):
        self.client.post(URL, {'reds_count': 15, 'break': 40, 'frame_time_seconds': 200})
        response = self.client.post(URL, {'reds_count': 15, 'break': 147, 'frame_time_seconds': 5})
        self.assertFalse(response.data['is_verified'])
        self.assertEqual(response.data['frame_time_seconds'], 5)

    def test_lower_break_does_not_overwrite_stored_timing(self):
        self.client.post(URL, {'reds_count': 15, 'break': 100, 'frame_time_seconds': 250})
        response = self.client.post(URL, {'reds_count': 15, 'break': 20, 'frame_time_seconds': 1})
        self.assertTrue(response.data['is_verified'], 'a lower break must not touch the stored record at all')
        self.assertEqual(response.data['frame_time_seconds'], 250)

    def test_tied_break_with_faster_time_updates_timing_but_not_new_record(self):
        """A repeat of the same PB value at a faster time should still improve
        the stored timing (so it can win the leaderboard's tiebreak), but must
        not count as is_new_record — that stays strictly-higher-break only."""
        self.client.post(URL, {'reds_count': 15, 'break': 50, 'frame_time_seconds': 200})
        response = self.client.post(URL, {'reds_count': 15, 'break': 50, 'frame_time_seconds': 120})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['best_break'], 50)
        self.assertEqual(response.data['frame_time_seconds'], 120)
        self.assertFalse(response.data['is_new_record'])
        self.assertEqual(
            PlayerBestBreak.objects.get(user=self.user, reds_count=15).frame_time_seconds, 120,
        )

    def test_tied_break_with_slower_time_does_not_update_timing(self):
        """A repeat of the same PB value at a slower (or equal) time must not
        overwrite the faster time already on record."""
        self.client.post(URL, {'reds_count': 15, 'break': 50, 'frame_time_seconds': 120})
        response = self.client.post(URL, {'reds_count': 15, 'break': 50, 'frame_time_seconds': 200})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['frame_time_seconds'], 120)
        self.assertFalse(response.data['is_new_record'])
        self.assertEqual(
            PlayerBestBreak.objects.get(user=self.user, reds_count=15).frame_time_seconds, 120,
        )
