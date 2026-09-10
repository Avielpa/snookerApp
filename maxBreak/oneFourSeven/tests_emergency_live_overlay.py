# Tests for emergency_live_overlay.py — the permanent request-time fallback
# built during the 2026-09-10 api.snooker.org access-revocation incident.
# See docs/SESSION_2026-09-10_api_outage_and_live_fallback.md.
#
# This module never touches the DB by design, so these tests use plain
# TestCase (no fixtures needed) and a lightweight stand-in object for
# Event instead of the real model, except where noted.

from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase
import requests

from .emergency_live_overlay import (
    _parse_live_overlay,
    _fetch_overlay,
    event_is_in_progress,
    apply_emergency_live_overlay,
    _cache,
)


class FakeEvent:
    """Minimal stand-in — apply_emergency_live_overlay only reads .ID/.StartDate/.EndDate."""
    def __init__(self, event_id=2546, start=None, end=None):
        self.ID = event_id
        self.StartDate = start
        self.EndDate = end


def _row(round_no, number, p1_id, p2_id, score1, score2, live, extra_classes=""):
    """Builds one real-shaped <tr> match row, mirroring www.snooker.org/res/index.asp markup."""
    live_class = "unfinished" if live else ""
    score1_html = f'<td class="score  first-score" colspan="1">{score1}</td>' if score1 is not None else '<td class="score  first-score" colspan="1"></td>'
    score2_html = f'<td class="last-score">{score2}</td>' if score2 is not None else '<td class="last-score"></td>'
    return f'''
<tr class="gradeA even {live_class} oneonone round{round_no} {extra_classes}" valign="top">
<td class="number" title="Match No. {number} in this round">{number}</td>
<td class="player "><a href="/res/index.asp?player={p1_id}" class="eng" title="Player {p1_id}">Player {p1_id}</a></td>
{score1_html}<td class="score-delim">-</td>{score2_html}
<td class="player "><a href="/res/index.asp?player={p2_id}" class="cn" title="Player {p2_id}">Player {p2_id}</a></td>
</tr>
'''


def _tbd_row(round_no, number):
    return f'''
<tr class="gradeA even oneonone round{round_no}" valign="top">
<td class="number" title="Match No. {number} in this round">{number}</td>
<td class="player "><a href="/res/index.asp?player1=1&amp;player2=2">TBD</a></td>
<td class="score  first-score" colspan="1"></td><td class="score-delim">v</td><td class="last-score"></td>
<td class="player ">TBD</td>
</tr>
'''


def _info_row(round_no, text="Watch on TV"):
    """A non-match row that sits between real match rows on the real page (broadcaster notes)."""
    return f'<tr valign="top" class="even info unfinished round{round_no}"><td class="number"></td><td colspan="7" class="info"><p class="note">{text}</p></td></tr>'


def _page(*rows):
    return "<html><body><table>" + "".join(rows) + "</table></body></html>"


class ParseLiveOverlayTests(TestCase):
    """_parse_live_overlay: the HTML -> overlay-dict parser."""

    def test_live_match_parsed_correctly(self):
        html = _page(_row(9, 2, 17, 39, 2, 1, live=True))
        overlay = _parse_live_overlay(html)
        self.assertIn((9, 2), overlay)
        row = overlay[(9, 2)]
        self.assertEqual(row["player1_id"], 17)
        self.assertEqual(row["player2_id"], 39)
        self.assertEqual(row["score1"], 2)
        self.assertEqual(row["score2"], 1)
        self.assertTrue(row["live"])

    def test_finished_match_parsed_with_live_false(self):
        html = _page(_row(8, 1, 1038, 109, 4, 2, live=False))
        overlay = _parse_live_overlay(html)
        self.assertIn((8, 1), overlay)
        self.assertFalse(overlay[(8, 1)]["live"])
        self.assertEqual(overlay[(8, 1)]["score1"], 4)
        self.assertEqual(overlay[(8, 1)]["score2"], 2)

    def test_not_started_match_is_skipped(self):
        html = _page(_row(9, 5, 100, 200, None, None, live=False))
        overlay = _parse_live_overlay(html)
        self.assertNotIn((9, 5), overlay)
        self.assertEqual(len(overlay), 0)

    def test_tbd_vs_tbd_is_skipped(self):
        html = _page(_tbd_row(13, 1))
        overlay = _parse_live_overlay(html)
        self.assertEqual(len(overlay), 0)

    def test_info_note_row_is_skipped_not_mistaken_for_a_match(self):
        html = _page(_info_row(9), _row(9, 2, 17, 39, 2, 1, live=True))
        overlay = _parse_live_overlay(html)
        # only the real match row should be present, the info row must not
        # produce a spurious entry or crash the parser
        self.assertEqual(len(overlay), 1)
        self.assertIn((9, 2), overlay)

    def test_multiple_matches_all_parsed_with_correct_keys(self):
        html = _page(
            _row(9, 1, 1, 2, None, None, live=False),
            _row(9, 2, 17, 39, 2, 1, live=True),
            _row(9, 3, 5, 6, 1, 2, live=True),
            _row(8, 1, 10, 11, 4, 3, live=False),
        )
        overlay = _parse_live_overlay(html)
        self.assertEqual(len(overlay), 3)  # the not-started 9/1 row is excluded
        self.assertIn((9, 2), overlay)
        self.assertIn((9, 3), overlay)
        self.assertIn((8, 1), overlay)
        self.assertNotIn((9, 1), overlay)

    def test_row_missing_round_class_is_skipped(self):
        html = '<html><body><table><tr class="gradeA even oneonone" valign="top"><td class="number" title="Match No. 1 in this round">1</td></tr></table></body></html>'
        overlay = _parse_live_overlay(html)
        self.assertEqual(len(overlay), 0)

    def test_row_missing_oneonone_class_is_skipped(self):
        html = '<html><body><table><tr class="gradeA even round9" valign="top"><td class="number" title="Match No. 1 in this round">1</td></tr></table></body></html>'
        overlay = _parse_live_overlay(html)
        self.assertEqual(len(overlay), 0)

    def test_empty_page_returns_empty_dict(self):
        overlay = _parse_live_overlay("<html><body></body></html>")
        self.assertEqual(overlay, {})

    def test_malformed_html_does_not_raise(self):
        # BeautifulSoup is tolerant of malformed markup — confirm the parser
        # doesn't blow up on a truncated/broken page (e.g. a network hiccup
        # mid-download).
        try:
            overlay = _parse_live_overlay("<html><body><table><tr class=\"round9 oneonone")
        except Exception as e:
            self.fail(f"_parse_live_overlay raised on malformed HTML: {e}")
        self.assertEqual(overlay, {})

    def test_score_dash_not_started_is_skipped_even_with_unfinished_class(self):
        # Defensive: a row incorrectly carrying "unfinished" but with no
        # real score yet must still be excluded (score wins the decision).
        html = _page(_row(9, 4, 1, 2, None, None, live=True))
        overlay = _parse_live_overlay(html)
        self.assertNotIn((9, 4), overlay)


class EventIsInProgressTests(TestCase):

    def test_today_within_range_is_true(self):
        today = date.today()
        event = FakeEvent(start=today - timedelta(days=2), end=today + timedelta(days=2))
        self.assertTrue(event_is_in_progress(event))

    def test_today_equals_start_date_is_true(self):
        today = date.today()
        event = FakeEvent(start=today, end=today + timedelta(days=5))
        self.assertTrue(event_is_in_progress(event))

    def test_today_equals_end_date_is_true(self):
        today = date.today()
        event = FakeEvent(start=today - timedelta(days=5), end=today)
        self.assertTrue(event_is_in_progress(event))

    def test_future_event_is_false(self):
        today = date.today()
        event = FakeEvent(start=today + timedelta(days=1), end=today + timedelta(days=8))
        self.assertFalse(event_is_in_progress(event))

    def test_past_event_is_false(self):
        today = date.today()
        event = FakeEvent(start=today - timedelta(days=10), end=today - timedelta(days=1))
        self.assertFalse(event_is_in_progress(event))

    def test_missing_start_date_is_false(self):
        event = FakeEvent(start=None, end=date.today() + timedelta(days=5))
        self.assertFalse(event_is_in_progress(event))

    def test_missing_end_date_is_false(self):
        event = FakeEvent(start=date.today() - timedelta(days=5), end=None)
        self.assertFalse(event_is_in_progress(event))

    def test_both_dates_missing_is_false(self):
        event = FakeEvent(start=None, end=None)
        self.assertFalse(event_is_in_progress(event))

    def test_malformed_event_object_does_not_raise(self):
        class Weird:
            ID = 1
        try:
            result = event_is_in_progress(Weird())
        except Exception as e:
            self.fail(f"event_is_in_progress raised on malformed input: {e}")
        self.assertFalse(result)


class ApplyEmergencyLiveOverlayTests(TestCase):
    """apply_emergency_live_overlay: the response-mutating overlay logic. _fetch_overlay is mocked
    so these tests never touch the network."""

    def _in_progress_event(self):
        today = date.today()
        return FakeEvent(event_id=2546, start=today - timedelta(days=1), end=today + timedelta(days=1))

    def test_event_not_in_progress_returns_data_unchanged_and_never_fetches(self):
        event = FakeEvent(start=date.today() + timedelta(days=5), end=date.today() + timedelta(days=10))
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0}]
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay") as mock_fetch:
            result = apply_emergency_live_overlay(event, response_data)
        mock_fetch.assert_not_called()
        self.assertEqual(result[0]["score1"], 0)
        self.assertEqual(result[0]["status_code"], 0)

    def test_no_overlay_data_returns_unchanged(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 17, "player2_id": 39}]
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=None):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 0)
        self.assertEqual(result[0]["status_code"], 0)

    def test_live_match_overlaid_with_matching_player_order(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 17, "player2_id": 39, "status_display": "Scheduled"}]
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 2)
        self.assertEqual(result[0]["score2"], 1)
        self.assertEqual(result[0]["status_code"], 1)
        self.assertEqual(result[0]["status_display"], "Running / Live")

    def test_live_match_overlaid_with_swapped_player_order(self):
        # Our DB has player1/player2 in the opposite order from the page —
        # scores must be mapped onto the correct slot, not just copied 1:1.
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 39, "player2_id": 17, "status_display": "Scheduled"}]
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        # DB player1 is 39, who is "player2" on the page with score2=1
        self.assertEqual(result[0]["score1"], 1)
        self.assertEqual(result[0]["score2"], 2)
        self.assertEqual(result[0]["status_code"], 1)

    def test_finished_match_sets_status_3_and_winner(self):
        event = self._in_progress_event()
        response_data = [{"round": 8, "number": 1, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 1038, "player2_id": 109, "winner_id": None,
                           "status_display": "Scheduled"}]
        overlay = {(8, 1): {"player1_id": 1038, "player2_id": 109, "score1": 4, "score2": 2, "live": False}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["status_code"], 3)
        self.assertEqual(result[0]["status_display"], "4-2")
        self.assertEqual(result[0]["winner_id"], 1038)
        self.assertEqual(result[0]["score1"], 4)
        self.assertEqual(result[0]["score2"], 2)

    def test_finished_match_winner_set_correctly_when_player2_wins(self):
        event = self._in_progress_event()
        response_data = [{"round": 8, "number": 1, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 1038, "player2_id": 109, "winner_id": None}]
        overlay = {(8, 1): {"player1_id": 1038, "player2_id": 109, "score1": 2, "score2": 4, "live": False}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["status_code"], 3)
        self.assertEqual(result[0]["winner_id"], 109)

    def test_already_finished_in_db_is_never_touched(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 3, "score1": 4, "score2": 2,
                           "player1_id": 17, "player2_id": 39, "winner_id": 17}]
        # overlay disagrees wildly — must be ignored because DB already says Finished
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 0, "score2": 0, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 4)
        self.assertEqual(result[0]["score2"], 2)
        self.assertEqual(result[0]["status_code"], 3)
        self.assertEqual(result[0]["winner_id"], 17)

    def test_player_id_mismatch_is_skipped_not_overwritten(self):
        # Same (round, number) key but different players than we expect —
        # must never blindly overwrite a genuinely different match.
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 999, "player2_id": 888}]
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 0)
        self.assertEqual(result[0]["score2"], 0)
        self.assertEqual(result[0]["status_code"], 0)

    def test_null_db_player_ids_still_allow_overlay(self):
        # A brand-new match row where our DB hasn't backfilled player IDs
        # yet shouldn't be blocked by the mismatch guard.
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": None, "player2_id": None}]
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 2)
        self.assertEqual(result[0]["score2"], 1)

    def test_match_not_present_on_page_is_left_untouched(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 9, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 1, "player2_id": 2}]
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["score1"], 0)
        self.assertEqual(result[0]["status_code"], 0)

    def test_multiple_matches_in_one_response_all_handled_independently(self):
        event = self._in_progress_event()
        response_data = [
            {"round": 9, "number": 1, "status_code": 0, "score1": 0, "score2": 0, "player1_id": 1, "player2_id": 2},
            {"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0, "player1_id": 17, "player2_id": 39},
            {"round": 8, "number": 1, "status_code": 0, "score1": 0, "score2": 0, "player1_id": 1038, "player2_id": 109, "winner_id": None},
        ]
        overlay = {
            (9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True},
            (8, 1): {"player1_id": 1038, "player2_id": 109, "score1": 4, "score2": 2, "live": False},
        }
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        # round9#1 untouched (not on the page)
        self.assertEqual(result[0]["status_code"], 0)
        # round9#2 live
        self.assertEqual(result[1]["status_code"], 1)
        self.assertEqual(result[1]["score1"], 2)
        # round8#1 finished with winner
        self.assertEqual(result[2]["status_code"], 3)
        self.assertEqual(result[2]["winner_id"], 1038)

    def test_fetch_overlay_exception_is_swallowed_and_data_returned_unchanged(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 17, "player2_id": 39}]
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", side_effect=RuntimeError("boom")):
            try:
                result = apply_emergency_live_overlay(event, response_data)
            except Exception as e:
                self.fail(f"apply_emergency_live_overlay raised instead of swallowing: {e}")
        self.assertEqual(result[0]["score1"], 0)
        self.assertEqual(result[0]["status_code"], 0)

    def test_malformed_match_dict_missing_keys_does_not_raise(self):
        event = self._in_progress_event()
        response_data = [{"round": 9, "number": 2}]  # missing score1/score2/player ids entirely
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            try:
                result = apply_emergency_live_overlay(event, response_data)
            except Exception as e:
                self.fail(f"apply_emergency_live_overlay raised on a sparse match dict: {e}")
        self.assertIsInstance(result, list)

    def test_empty_response_data_returns_empty_list(self):
        event = self._in_progress_event()
        overlay = {(9, 2): {"player1_id": 17, "player2_id": 39, "score1": 2, "score2": 1, "live": True}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, [])
        self.assertEqual(result, [])

    def test_draw_score_does_not_crash_or_set_bogus_winner(self):
        # Not a realistic snooker outcome, but the code path should be safe
        # regardless — s1 != s2 guards the winner assignment.
        event = self._in_progress_event()
        response_data = [{"round": 8, "number": 1, "status_code": 0, "score1": 0, "score2": 0,
                           "player1_id": 1038, "player2_id": 109, "winner_id": None}]
        overlay = {(8, 1): {"player1_id": 1038, "player2_id": 109, "score1": 3, "score2": 3, "live": False}}
        with patch("oneFourSeven.emergency_live_overlay._fetch_overlay", return_value=overlay):
            result = apply_emergency_live_overlay(event, response_data)
        self.assertEqual(result[0]["status_code"], 3)
        self.assertIsNone(result[0]["winner_id"])  # left as whatever it was — never guessed


class FetchOverlayCachingAndFailureTests(TestCase):
    """_fetch_overlay: caching + network-failure behavior. Mocks requests.get directly."""

    def setUp(self):
        _cache.clear()

    def tearDown(self):
        _cache.clear()

    def test_successful_fetch_populates_cache(self):
        html = _page(_row(9, 2, 17, 39, 2, 1, live=True))
        mock_response = type("R", (), {"text": html, "raise_for_status": lambda self: None})()
        with patch("oneFourSeven.emergency_live_overlay.requests.get", return_value=mock_response) as mock_get:
            result = _fetch_overlay(2546)
        self.assertIn((9, 2), result)
        self.assertIn(2546, _cache)
        mock_get.assert_called_once()

    def test_second_call_within_cache_window_does_not_refetch(self):
        html = _page(_row(9, 2, 17, 39, 2, 1, live=True))
        mock_response = type("R", (), {"text": html, "raise_for_status": lambda self: None})()
        with patch("oneFourSeven.emergency_live_overlay.requests.get", return_value=mock_response) as mock_get:
            _fetch_overlay(2546)
            _fetch_overlay(2546)
        self.assertEqual(mock_get.call_count, 1)

    def test_network_failure_with_no_prior_cache_returns_none(self):
        with patch("oneFourSeven.emergency_live_overlay.requests.get", side_effect=requests.RequestException("timeout")):
            result = _fetch_overlay(2546)
        self.assertIsNone(result)

    def test_network_failure_with_prior_cache_serves_stale_data(self):
        html = _page(_row(9, 2, 17, 39, 2, 1, live=True))
        mock_response = type("R", (), {"text": html, "raise_for_status": lambda self: None})()
        with patch("oneFourSeven.emergency_live_overlay.requests.get", return_value=mock_response):
            _fetch_overlay(2546)
        # force cache to look expired, then simulate a failure on the next fetch
        _cache[2546] = (0, _cache[2546][1])
        with patch("oneFourSeven.emergency_live_overlay.requests.get", side_effect=requests.RequestException("down")):
            result = _fetch_overlay(2546)
        self.assertIsNotNone(result)
        self.assertIn((9, 2), result)

    def test_different_events_cached_independently(self):
        html_a = _page(_row(9, 2, 17, 39, 2, 1, live=True))
        html_b = _page(_row(7, 1, 100, 200, 4, 3, live=False))
        responses = {
            2546: type("R", (), {"text": html_a, "raise_for_status": lambda self: None})(),
            2547: type("R", (), {"text": html_b, "raise_for_status": lambda self: None})(),
        }
        with patch("oneFourSeven.emergency_live_overlay.requests.get", side_effect=lambda url, params, **kw: responses[params["event"]]):
            result_a = _fetch_overlay(2546)
            result_b = _fetch_overlay(2547)
        self.assertIn((9, 2), result_a)
        self.assertNotIn((7, 1), result_a)
        self.assertIn((7, 1), result_b)
        self.assertNotIn((9, 2), result_b)
