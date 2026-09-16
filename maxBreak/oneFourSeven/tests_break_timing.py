from django.test import SimpleTestCase

from .break_timing import is_realistic_frame_time, REALISTIC_SECONDS_PER_POINT


class IsRealisticFrameTimeTest(SimpleTestCase):
    def test_zero_break_is_always_realistic(self):
        self.assertTrue(is_realistic_frame_time(0, 0))
        self.assertTrue(is_realistic_frame_time(1, 0))

    def test_missing_frame_time_is_treated_as_realistic(self):
        self.assertTrue(is_realistic_frame_time(None, 100))

    def test_time_above_floor_is_realistic(self):
        # 147 in 400s is well above Ronnie's 320s floor.
        self.assertTrue(is_realistic_frame_time(400, 147))

    def test_time_exactly_at_floor_is_realistic(self):
        floor = round(REALISTIC_SECONDS_PER_POINT * 147)
        self.assertTrue(is_realistic_frame_time(floor, 147))

    def test_time_below_floor_is_unrealistic(self):
        self.assertFalse(is_realistic_frame_time(60, 147))

    def test_floor_scales_linearly_with_break_value(self):
        # A 30-break floor should be far lower than a 147-break floor.
        self.assertTrue(is_realistic_frame_time(50, 30))
        self.assertFalse(is_realistic_frame_time(5, 30))
