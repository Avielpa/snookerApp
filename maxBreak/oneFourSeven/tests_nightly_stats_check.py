"""
Tests for the nightly player-stats accuracy check.
See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.
"""

from django.test import SimpleTestCase

from oneFourSeven.nightly_stats_checks import (
    Flag,
    PlayerSnapshot,
    compute_db_flags,
    compute_api_flags,
    is_auto_fixable,
)


def make_snapshot(**overrides):
    defaults = dict(
        player_id=1, name='Test Player', years_as_pro=5, total_matches=100,
        wins=60, losses=40, finals_reached=2, rn_pct=95.0,
        orphaned_seasons=[], is_top32=False,
    )
    defaults.update(overrides)
    return PlayerSnapshot(**defaults)


class ComputeDbFlagsTests(SimpleTestCase):
    def test_healthy_player_has_no_flags(self):
        self.assertEqual(compute_db_flags(make_snapshot()), [])

    def test_no_matches_flag_for_veteran_with_zero_matches(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=3, total_matches=0))
        self.assertEqual([f.code for f in flags], ['NO_MATCHES', 'LOW_MATCHES'])

    def test_no_matches_flag_skipped_for_rookie(self):
        snap = make_snapshot(years_as_pro=1, total_matches=0)
        self.assertEqual(compute_db_flags(snap), [])

    def test_low_matches_flag_detail_shows_actual_vs_expected(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=5, total_matches=10))
        codes = [f.code for f in flags]
        self.assertIn('LOW_MATCHES', codes)
        detail = next(f.detail for f in flags if f.code == 'LOW_MATCHES')
        self.assertEqual(detail, 'LOW_MATCHES(10<50)')

    def test_low_matches_flag_not_raised_when_matches_sufficient(self):
        flags = compute_db_flags(make_snapshot(years_as_pro=5, total_matches=50))
        self.assertNotIn('LOW_MATCHES', [f.code for f in flags])

    def test_no_finals_flag_only_for_top32_veteran(self):
        snap = make_snapshot(is_top32=True, years_as_pro=6, finals_reached=0)
        self.assertIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_no_finals_flag_skipped_outside_top32(self):
        snap = make_snapshot(is_top32=False, years_as_pro=6, finals_reached=0)
        self.assertNotIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_no_finals_flag_skipped_for_recent_top32_player(self):
        snap = make_snapshot(is_top32=True, years_as_pro=3, finals_reached=0)
        self.assertNotIn('NO_FINALS', [f.code for f in compute_db_flags(snap)])

    def test_low_round_name_coverage_flag(self):
        flags = compute_db_flags(make_snapshot(total_matches=50, rn_pct=40.0))
        self.assertIn('LOW_ROUND_NAME_COVERAGE', [f.code for f in flags])

    def test_round_name_coverage_flag_skipped_below_match_threshold(self):
        flags = compute_db_flags(make_snapshot(total_matches=10, rn_pct=0.0))
        self.assertNotIn('LOW_ROUND_NAME_COVERAGE', [f.code for f in flags])

    def test_orphan_flag(self):
        flags = compute_db_flags(make_snapshot(orphaned_seasons=[2019, 2020]))
        self.assertEqual([f.code for f in flags], ['ORPHAN'])
        self.assertEqual(flags[0].detail, 'ORPHAN(2seasons)')

    def test_no_orphan_flag_when_no_gaps(self):
        flags = compute_db_flags(make_snapshot(orphaned_seasons=[]))
        self.assertNotIn('ORPHAN', [f.code for f in flags])

    def test_multiple_flags_can_combine(self):
        snap = make_snapshot(years_as_pro=5, total_matches=0, orphaned_seasons=[2021])
        codes = {f.code for f in compute_db_flags(snap)}
        self.assertEqual(codes, {'NO_MATCHES', 'LOW_MATCHES', 'ORPHAN'})


class ComputeApiFlagsTests(SimpleTestCase):
    def test_healthy_player_has_no_flags(self):
        snap = make_snapshot(wins=60, losses=40, finals_reached=2)
        self.assertEqual(compute_api_flags(snap, api_titles=1), [])

    def test_bad_win_rate_too_high(self):
        snap = make_snapshot(wins=95, losses=5)
        flags = compute_api_flags(snap, api_titles=0)
        self.assertEqual([f.code for f in flags], ['BAD_WIN_RATE'])
        self.assertEqual(flags[0].detail, 'BAD_WIN_RATE(95%)')

    def test_bad_win_rate_too_low(self):
        snap = make_snapshot(wins=5, losses=95)
        flags = compute_api_flags(snap, api_titles=0)
        self.assertEqual([f.code for f in flags], ['BAD_WIN_RATE'])

    def test_bad_win_rate_skipped_for_small_sample(self):
        snap = make_snapshot(wins=19, losses=1)
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_bad_win_rate_skipped_within_bounds(self):
        snap = make_snapshot(wins=55, losses=45)
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_finals_lt_titles_flag(self):
        snap = make_snapshot(finals_reached=1)
        flags = compute_api_flags(snap, api_titles=3)
        self.assertEqual([f.code for f in flags], ['FINALS_LT_TITLES'])
        self.assertEqual(flags[0].detail, 'FINALS_LT_TITLES(1<3)')

    def test_finals_lt_titles_skipped_when_no_api_titles(self):
        snap = make_snapshot(finals_reached=0)
        self.assertEqual(compute_api_flags(snap, api_titles=None), [])
        self.assertEqual(compute_api_flags(snap, api_titles=0), [])

    def test_finals_lt_titles_skipped_when_finals_cover_titles(self):
        snap = make_snapshot(finals_reached=5)
        self.assertEqual(compute_api_flags(snap, api_titles=3), [])

    def test_both_api_flags_can_combine(self):
        snap = make_snapshot(wins=95, losses=5, finals_reached=0)
        codes = {f.code for f in compute_api_flags(snap, api_titles=2)}
        self.assertEqual(codes, {'BAD_WIN_RATE', 'FINALS_LT_TITLES'})


class IsAutoFixableTests(SimpleTestCase):
    def test_empty_flags_not_auto_fixable(self):
        self.assertFalse(is_auto_fixable([]))

    def test_known_safe_flags_are_auto_fixable(self):
        flags = [Flag('NO_MATCHES', 'NO_MATCHES'), Flag('ORPHAN', 'ORPHAN(1seasons)')]
        self.assertTrue(is_auto_fixable(flags))

    def test_single_low_matches_flag_is_auto_fixable(self):
        self.assertTrue(is_auto_fixable([Flag('LOW_MATCHES', 'LOW_MATCHES(1<10)')]))

    def test_mixed_flags_not_auto_fixable(self):
        flags = [Flag('NO_MATCHES', 'NO_MATCHES'), Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]
        self.assertFalse(is_auto_fixable(flags))

    def test_unknown_flag_alone_not_auto_fixable(self):
        self.assertFalse(is_auto_fixable([Flag('BAD_WIN_RATE', 'BAD_WIN_RATE(95%)')]))

    def test_unknown_flag_alone_not_auto_fixable_no_finals(self):
        self.assertFalse(is_auto_fixable([Flag('NO_FINALS', 'NO_FINALS')]))
