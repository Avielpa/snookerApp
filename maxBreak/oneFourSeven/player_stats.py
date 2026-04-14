# oneFourSeven/player_stats.py
"""
Standalone player statistics helpers.
Imported by views.py — keep this file focused and independently testable.
Every function is fully wrapped in try/except so a failure never breaks the caller.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def get_recent_form(player_id: int, n: int = 10) -> list:
    """
    Returns last N finished match results as a list of 'W' or 'L'.
    Ordered most-recent first.
    Returns [] on any error.
    """
    try:
        from oneFourSeven.models import PlayerMatchHistory
        matches = (
            PlayerMatchHistory.objects
            .filter(player_id=player_id, status=3)
            .order_by('-end_date', '-start_date', '-api_match_id')
            [:n]
        )
        return ['W' if m.winner_id == player_id else 'L' for m in matches]
    except Exception as e:
        logger.error(f'[player_stats] get_recent_form failed for {player_id}: {e}')
        return []


def get_win_streak(player_id: int) -> int:
    """
    Returns the current streak length as an int.
      positive = win streak  (e.g. 4 means W W W W)
      negative = loss streak (e.g. -2 means L L)
      0        = no history or any error
    """
    try:
        from oneFourSeven.models import PlayerMatchHistory
        matches = (
            PlayerMatchHistory.objects
            .filter(player_id=player_id, status=3, winner_id__isnull=False)
            .order_by('-scheduled_date', '-api_match_id')
            [:50]
        )
        streak = 0
        for m in matches:
            result = 'W' if m.winner_id == player_id else 'L'
            if streak == 0:
                streak = 1 if result == 'W' else -1
            elif streak > 0 and result == 'W':
                streak += 1
            elif streak < 0 and result == 'L':
                streak -= 1
            else:
                break
        return streak
    except Exception as e:
        logger.error(f'[player_stats] get_win_streak failed for {player_id}: {e}')
        return 0


def get_season_stats(player_id: int) -> dict:
    """
    Returns finished match count and win count for the player's most recent active season.
    Falls back to previous season if no data found for current year.
    Returns {'matches': int, 'wins': int, 'season': int|None}
    """
    try:
        from oneFourSeven.models import PlayerMatchHistory
        current_season = datetime.now().year

        for season in [current_season, current_season - 1]:
            qs = PlayerMatchHistory.objects.filter(
                player_id=player_id,
                status=3,
                season=season
            )
            count = qs.count()
            if count > 0:
                wins = qs.filter(winner_id=player_id).count()
                return {'matches': count, 'wins': wins, 'season': season}

        return {'matches': 0, 'wins': 0, 'season': current_season}
    except Exception as e:
        logger.error(f'[player_stats] get_season_stats failed for {player_id}: {e}')
        return {'matches': 0, 'wins': 0, 'season': None}


def get_frame_stats(player_id: int) -> dict:
    """
    Computes career frame statistics from PlayerMatchHistory.
    Returns frames_won, frames_lost, frames_played, frame_pct.
    """
    try:
        from django.db.models import Sum, Case, When, IntegerField, F
        from oneFourSeven.models import PlayerMatchHistory

        qs = PlayerMatchHistory.objects.filter(player_id=player_id, status=3)
        result = qs.aggregate(
            frames_won=Sum(Case(
                When(player1_id=player_id, then=F('score1')),
                When(player2_id=player_id, then=F('score2')),
                default=0,
                output_field=IntegerField(),
            )),
            frames_lost=Sum(Case(
                When(player1_id=player_id, then=F('score2')),
                When(player2_id=player_id, then=F('score1')),
                default=0,
                output_field=IntegerField(),
            )),
        )
        won = result['frames_won'] or 0
        lost = result['frames_lost'] or 0
        total = won + lost
        return {
            'frames_won': won,
            'frames_lost': lost,
            'frames_played': total,
            'frame_pct': round(won / total * 100, 1) if total else 0,
        }
    except Exception as e:
        logger.error(f'[player_stats] get_frame_stats failed for {player_id}: {e}')
        return {'frames_won': 0, 'frames_lost': 0, 'frames_played': 0, 'frame_pct': 0}


def get_finals_record(player_id: int) -> dict:
    """
    Returns how many finals the player has reached and won (career).
    """
    try:
        from oneFourSeven.models import PlayerMatchHistory
        finals = PlayerMatchHistory.objects.filter(
            player_id=player_id,
            status=3,
            round_name__iexact='Final',
        )
        reached = finals.count()
        won = finals.filter(winner_id=player_id).count()
        return {
            'finals_reached': reached,
            'finals_won': won,
            'finals_pct': round(won / reached * 100, 1) if reached else 0,
        }
    except Exception as e:
        logger.error(f'[player_stats] get_finals_record failed for {player_id}: {e}')
        return {'finals_reached': 0, 'finals_won': 0, 'finals_pct': 0}


def get_deciding_frames(player_id: int) -> dict:
    """
    Win rate in matches decided by exactly 1 frame (e.g. 6-5, 4-3).
    Measures clutch performance under pressure.
    """
    try:
        from django.db.models import Q, F
        from oneFourSeven.models import PlayerMatchHistory
        deciding = PlayerMatchHistory.objects.filter(
            player_id=player_id,
            status=3,
        ).filter(
            Q(score1=F('score2') + 1) | Q(score2=F('score1') + 1)
        )
        played = deciding.count()
        won = deciding.filter(winner_id=player_id).count()
        return {
            'deciding_played': played,
            'deciding_won': won,
            'deciding_pct': round(won / played * 100, 1) if played else 0,
        }
    except Exception as e:
        logger.error(f'[player_stats] get_deciding_frames failed for {player_id}: {e}')
        return {'deciding_played': 0, 'deciding_won': 0, 'deciding_pct': 0}


def get_semi_final_record(player_id: int) -> dict:
    """Semi-final appearances and wins (career)."""
    try:
        from oneFourSeven.models import PlayerMatchHistory
        qs = PlayerMatchHistory.objects.filter(
            player_id=player_id, status=3, round_name__icontains='Semi',
        )
        reached = qs.count()
        won = qs.filter(winner_id=player_id).count()
        return {'reached': reached, 'won': won, 'pct': round(won / reached * 100, 1) if reached else 0}
    except Exception as e:
        logger.error(f'[player_stats] get_semi_final_record failed for {player_id}: {e}')
        return {'reached': 0, 'won': 0, 'pct': 0}


def get_career_best_ranking(player_id: int) -> int | None:
    """Lowest (best) world ranking ever achieved."""
    try:
        from django.db.models import Min
        from oneFourSeven.models import Ranking
        result = Ranking.objects.filter(
            Player_id=player_id,
            Type__in=['MoneyRankings', 'MoneySeedings'],
        ).aggregate(best=Min('Position'))
        return result['best']
    except Exception as e:
        logger.error(f'[player_stats] get_career_best_ranking failed for {player_id}: {e}')
        return None


def get_seasons_in_top16(player_id: int) -> int:
    """Number of seasons the player finished inside the top 16."""
    try:
        from oneFourSeven.models import Ranking
        return (
            Ranking.objects
            .filter(Player_id=player_id, Type__in=['MoneyRankings', 'MoneySeedings'], Position__lte=16)
            .values('Season')
            .distinct()
            .count()
        )
    except Exception as e:
        logger.error(f'[player_stats] get_seasons_in_top16 failed for {player_id}: {e}')
        return 0


def get_recent_win_pct(player_id: int, seasons: int = 3) -> float | None:
    """Win % over the last N seasons (finished matches only)."""
    try:
        from oneFourSeven.models import PlayerMatchHistory
        from datetime import datetime
        current = datetime.now().year - 1
        recent_seasons = list(range(current - seasons + 1, current + 1))
        matches = PlayerMatchHistory.objects.filter(
            player_id=player_id, season__in=recent_seasons, status=3
        )
        total = matches.count()
        if total == 0:
            return None
        wins = matches.filter(winner_id=player_id).count()
        return round(wins / total * 100, 1)
    except Exception as e:
        logger.error(f'[player_stats] get_recent_win_pct failed for {player_id}: {e}')
        return None


def get_best_win_streak(player_id: int) -> int:
    """Career best consecutive match win streak."""
    try:
        from oneFourSeven.models import PlayerMatchHistory
        winner_ids = list(
            PlayerMatchHistory.objects
            .filter(player_id=player_id, status=3)
            .order_by('end_date', 'start_date', 'api_match_id')
            .values_list('winner_id', flat=True)
        )
        best = current = 0
        for wid in winner_ids:
            if wid == player_id:
                current += 1
                if current > best:
                    best = current
            else:
                current = 0
        return best
    except Exception as e:
        logger.error(f'[player_stats] get_best_win_streak failed for {player_id}: {e}')
        return 0


def get_ranking_trend(player_id: int) -> dict:
    """
    Returns ranking position for current and previous season.
    delta is positive when the player improved (moved up the rankings).

    Example: {'current': 5, 'previous': 8, 'delta': 3}
    Returns nulls on any error.
    """
    try:
        from oneFourSeven.models import Ranking
        current_year = datetime.now().year
        seasons = [current_year, current_year - 1, current_year - 2]
        ranking_types = ['MoneyRankings', 'MoneySeedings']

        positions = []
        for season in seasons:
            for rtype in ranking_types:
                r = Ranking.objects.filter(
                    Player_id=player_id,
                    Season=season,
                    Type=rtype
                ).first()
                if r:
                    positions.append({'season': season, 'position': r.Position})
                    break
            if len(positions) >= 2:
                break

        if not positions:
            return {'current': None, 'previous': None, 'delta': None}

        current = positions[0]['position']
        previous = positions[1]['position'] if len(positions) > 1 else None
        delta = (previous - current) if (previous is not None and current is not None) else None

        return {'current': current, 'previous': previous, 'delta': delta}
    except Exception as e:
        logger.error(f'[player_stats] get_ranking_trend failed for {player_id}: {e}')
        return {'current': None, 'previous': None, 'delta': None}
