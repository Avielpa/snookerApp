"""
Tests for the `sync_career_history` rolling-sweep cursor helpers.
Mirrors the style of CursorPersistenceTests/SelectBatchTests in
tests_nightly_stats_check.py, but exercises the separate
career_sync_batching module/cursor file so the two sweeps are proven
independent.
"""

import json
import tempfile
import pathlib

from django.test import SimpleTestCase

from oneFourSeven.career_sync_batching import load_cursor, save_cursor, select_batch


class LoadCursorTests(SimpleTestCase):
    def test_returns_zero_when_file_missing(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            self.assertEqual(load_cursor(path), 0)

    def test_returns_zero_on_corrupt_json(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            path.write_text('not json')
            self.assertEqual(load_cursor(path), 0)

    def test_returns_zero_on_empty_file(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            path.write_text('')
            self.assertEqual(load_cursor(path), 0)

    def test_returns_zero_when_key_missing(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            path.write_text(json.dumps({'unrelated': 5}))
            self.assertEqual(load_cursor(path), 0)

    def test_accepts_string_path(self):
        with tempfile.TemporaryDirectory() as d:
            path = str(pathlib.Path(d) / 'career_sync_cursor.json')
            save_cursor(path, 3)
            self.assertEqual(load_cursor(path), 3)


class SaveCursorTests(SimpleTestCase):
    def test_save_then_load_roundtrips(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            save_cursor(path, 17)
            self.assertEqual(load_cursor(path), 17)

    def test_writes_valid_json_with_expected_key(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            save_cursor(path, 9)
            data = json.loads(path.read_text())
            self.assertEqual(data, {'next_index': 9})

    def test_overwrites_previous_value(self):
        with tempfile.TemporaryDirectory() as d:
            path = pathlib.Path(d) / 'career_sync_cursor.json'
            save_cursor(path, 1)
            save_cursor(path, 2)
            self.assertEqual(load_cursor(path), 2)

    def test_uses_a_distinct_file_from_nightly_stats_cursor(self):
        # Regression guard: the two rolling sweeps must never be pointed
        # at the same physical file, or one command's progress would
        # silently corrupt the other's.
        from oneFourSeven.management.commands.nightly_stats_check import DEFAULT_CURSOR_FILE
        from oneFourSeven.management.commands.sync_career_history import DEFAULT_CURSOR_FILE as CAREER_DEFAULT_CURSOR_FILE
        self.assertNotEqual(str(DEFAULT_CURSOR_FILE), str(CAREER_DEFAULT_CURSOR_FILE))


class SelectBatchTests(SimpleTestCase):
    def test_selects_batch_size_from_cursor(self):
        ids = list(range(1, 11))
        batch, next_cursor = select_batch(ids, cursor=0, batch_size=3)
        self.assertEqual(batch, [1, 2, 3])
        self.assertEqual(next_cursor, 3)

    def test_continues_from_previous_cursor(self):
        ids = list(range(1, 11))
        batch, next_cursor = select_batch(ids, cursor=3, batch_size=3)
        self.assertEqual(batch, [4, 5, 6])
        self.assertEqual(next_cursor, 6)

    def test_wraps_around_when_cursor_near_end(self):
        ids = list(range(1, 11))
        batch, next_cursor = select_batch(ids, cursor=9, batch_size=4)
        self.assertEqual(batch, [10, 1, 2, 3])
        self.assertEqual(next_cursor, 3)

    def test_cursor_beyond_list_length_resets_to_start(self):
        ids = list(range(1, 6))
        batch, next_cursor = select_batch(ids, cursor=99, batch_size=2)
        self.assertEqual(batch, [1, 2])
        self.assertEqual(next_cursor, 2)

    def test_negative_cursor_resets_to_start(self):
        ids = list(range(1, 6))
        batch, next_cursor = select_batch(ids, cursor=-1, batch_size=2)
        self.assertEqual(batch, [1, 2])
        self.assertEqual(next_cursor, 2)

    def test_batch_size_larger_than_list_returns_whole_list_once(self):
        ids = [1, 2, 3]
        batch, next_cursor = select_batch(ids, cursor=0, batch_size=10)
        self.assertEqual(batch, [1, 2, 3])
        self.assertEqual(next_cursor, 0)

    def test_empty_player_list_returns_empty_batch(self):
        batch, next_cursor = select_batch([], cursor=0, batch_size=5)
        self.assertEqual(batch, [])
        self.assertEqual(next_cursor, 0)

    def test_batch_size_zero_returns_empty_batch_and_keeps_cursor(self):
        ids = list(range(1, 6))
        batch, next_cursor = select_batch(ids, cursor=2, batch_size=0)
        self.assertEqual(batch, [])
        self.assertEqual(next_cursor, 2)

    def test_full_sweep_across_multiple_calls_visits_every_id_once(self):
        ids = list(range(1, 23))  # 22 players, e.g. a top-N roster
        cursor = 0
        seen = []
        for _ in range(5):  # 5 batches of 5 = 25 >= 22, guarantees a full wrap
            batch, cursor = select_batch(ids, cursor, batch_size=5)
            seen.extend(batch)
        # every id appears at least once across the sweep
        self.assertEqual(set(seen), set(ids))
