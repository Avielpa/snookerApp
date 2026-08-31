"""
Pure flag-computation logic for the nightly player-stats accuracy check.

Deliberately free of Django ORM queries and network calls so the rules
that decide "this player's data looks wrong" can be unit tested without a
database or the internet. The management command
(management/commands/nightly_stats_check.py) is the only place that wires
this module up to real Player/PlayerMatchHistory rows, the snooker.org
API, backfill_career_history, and the push notification.

See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.
"""

from dataclasses import dataclass

MIN_MATCHES_PER_SEASON = 10
WIN_RATE_MIN = 0.30
WIN_RATE_MAX = 0.90

# Flags in this set describe *missing* data, not a data anomaly that needs
# human judgement — they're the exact cases backfill_career_history --force
# already exists to repair. Anything not in this set always goes to the
# notify path untouched.
AUTO_FIXABLE_CODES = frozenset({'NO_MATCHES', 'LOW_MATCHES', 'ORPHAN'})


@dataclass(frozen=True)
class Flag:
    code: str
    detail: str


@dataclass
class PlayerSnapshot:
    """Precomputed per-player numbers the flag rules run against."""
    player_id: int
    name: str
    years_as_pro: int
    total_matches: int
    wins: int
    losses: int
    finals_reached: int
    rn_pct: float
    orphaned_seasons: list
    is_top32: bool


def compute_db_flags(snapshot: PlayerSnapshot) -> list:
    """Internal-consistency checks — no network, no snooker.org
    comparison. Adapted from validate_career_data.py's flag rules."""
    flags = []
    s = snapshot

    if s.years_as_pro >= 2 and s.total_matches == 0:
        flags.append(Flag('NO_MATCHES', 'NO_MATCHES'))

    min_expected = s.years_as_pro * MIN_MATCHES_PER_SEASON
    if s.years_as_pro >= 2 and s.total_matches < min_expected:
        flags.append(Flag('LOW_MATCHES', f'LOW_MATCHES({s.total_matches}<{min_expected})'))

    if s.is_top32 and s.years_as_pro >= 5 and s.finals_reached == 0:
        flags.append(Flag('NO_FINALS', 'NO_FINALS'))

    if s.total_matches >= 20 and s.rn_pct < 80:
        flags.append(Flag('LOW_ROUND_NAME_COVERAGE', f'LOW_ROUND_NAME_COVERAGE({s.rn_pct:.0f}%)'))

    if s.orphaned_seasons:
        flags.append(Flag('ORPHAN', f'ORPHAN({len(s.orphaned_seasons)}seasons)'))

    return flags


def compute_api_flags(snapshot: PlayerSnapshot, api_titles) -> list:
    """Source-of-truth cross-check against snooker.org t=4 data. Adapted
    from verify_player_stats.py's flag rules. Never mutates anything —
    the caller decides what, if anything, to do with the flags."""
    flags = []
    s = snapshot
    total_decided = s.wins + s.losses

    if total_decided > 20:
        win_rate = s.wins / total_decided
        if not (WIN_RATE_MIN <= win_rate <= WIN_RATE_MAX):
            flags.append(Flag('BAD_WIN_RATE', f'BAD_WIN_RATE({win_rate:.0%})'))

    if api_titles and api_titles > 0 and s.finals_reached < api_titles:
        flags.append(Flag('FINALS_LT_TITLES', f'FINALS_LT_TITLES({s.finals_reached}<{api_titles})'))

    return flags


def is_auto_fixable(flags: list) -> bool:
    """True only if every flag on this player is in the known-safe set."""
    return bool(flags) and all(f.code in AUTO_FIXABLE_CODES for f in flags)
