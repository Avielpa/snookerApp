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
            .filter(player_id=player_id, status=3)
            .order_by('-end_date', '-start_date', '-api_match_id')
            [:30]
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
