"""
Tests for personal break-duration tracking: POST /oneFourSeven/scoreboard/break-timing/.

Every completed break is its own row (no upsert) — covers input validation, auth gating,
and that multiple submissions for the same user all persist independently.
"""
from django.test import TestCase
from rest_framework.test import APIClient

from .models import BreakTimingRecord
from .tests import _make_user

URL = '/oneFourSeven/scoreboard/break-timing/'


class BreakTimingPostTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = _make_user('bt_user')
        self.client.force_authenticate(user=self.user)

    def test_valid_submission_creates_record(self):
        response = self.client.post(URL, {'break_value': 42, 'duration_seconds': 65, 'mode': 'match'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['break_value'], 42)
        self.assertEqual(response.data['duration_seconds'], 65)
        self.assertEqual(response.data['mode'], 'match')
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 1)

    def test_multiple_submissions_all_persist_independently(self):
        self.client.post(URL, {'break_value': 30, 'duration_seconds': 40, 'mode': 'match'})
        self.client.post(URL, {'break_value': 50, 'duration_seconds': 70, 'mode': 'unlimited'})
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 2)

    def test_zero_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': 0, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 0)

    def test_negative_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': -5, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_negative_duration_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': -1, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_invalid_mode_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': 10, 'mode': 'train'})
        self.assertEqual(response.status_code, 400)

    def test_missing_break_value_rejected(self):
        response = self.client.post(URL, {'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_missing_duration_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_missing_mode_rejected(self):
        response = self.client.post(URL, {'break_value': 10, 'duration_seconds': 10})
        self.assertEqual(response.status_code, 400)

    def test_non_integer_break_value_rejected(self):
        response = self.client.post(URL, {'break_value': 'not-a-number', 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 400)

    def test_records_scoped_to_correct_user(self):
        other_user = _make_user('bt_other_user')
        self.client.post(URL, {'break_value': 20, 'duration_seconds': 30, 'mode': 'match'})
        self.assertEqual(BreakTimingRecord.objects.filter(user=self.user).count(), 1)
        self.assertEqual(BreakTimingRecord.objects.filter(user=other_user).count(), 0)


class BreakTimingAuthTest(TestCase):
    def test_unauthenticated_request_rejected(self):
        client = APIClient()
        response = client.post(URL, {'break_value': 10, 'duration_seconds': 10, 'mode': 'match'})
        self.assertEqual(response.status_code, 401)
