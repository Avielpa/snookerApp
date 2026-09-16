"""
Anti-cheat check for a submitted break's frame time, used by the best-break
upsert endpoint (views.py::best_break_view). Pure, no DB access — testable
in isolation.
"""

# Ronnie O'Sullivan's fastest official maximum break (147): 5 minutes 20
# seconds (320 seconds), 1997 World Championship. Used as the fastest
# realistic reference point, scaled linearly to any break value.
REALISTIC_SECONDS_PER_POINT = 320 / 147


def is_realistic_frame_time(frame_time_seconds, break_value):
    """
    True if frame_time_seconds is not suspiciously fast for break_value.
    A break_value of 0 is always realistic (nothing to time). A missing
    frame_time_seconds (None) is treated as realistic — no timer data means
    no basis to flag it, matching PlayerBestBreak.is_verified's default of
    True for rows written before this feature existed.
    """
    if break_value <= 0:
        return True
    if frame_time_seconds is None:
        return True
    floor_seconds = break_value / REALISTIC_SECONDS_PER_POINT
    return frame_time_seconds >= floor_seconds
