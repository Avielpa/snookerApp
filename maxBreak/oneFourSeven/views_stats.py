# oneFourSeven/views_stats.py
"""
Stats screen API endpoints.
  GET /stats/centuries/?season=2025-26     — century race table from CenturyRecord
  GET /stats/tour-winners/?season=2025     — who won which event this season
  GET /stats/title-leaders/?season=2025   — ranked by titles won
"""

import logging
from collections import defaultdict

from django.db.models import Max
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import CenturyRecord, Event, MatchesOfAnEvent, Player

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _player_display(player: Player | None, fallback_name: str = '') -> dict:
    """Return a compact player dict for API responses."""
    if player:
        name = f"{player.FirstName} {player.LastName}".strip()
        return {'id': player.ID, 'name': name, 'nationality': player.Nationality}
    return {'id': None, 'name': fallback_name, 'nationality': None}


def _current_season_label() -> str:
    """Return the current snooker season label, e.g. '2025-26'.
    Season rolls over in May, matching the frontend's useSeasonSelector.ts.
    """
    from datetime import date
    today = date.today()
    year = today.year
    if today.month >= 5:
        return f"{year}-{str(year + 1)[2:]}"
    return f"{year - 1}-{str(year)[2:]}"


def _current_season_int() -> int:
    """Return the snooker.org season int (year the season starts), e.g. 2025."""
    from datetime import date
    today = date.today()
    return today.year if today.month >= 5 else today.year - 1


# ---------------------------------------------------------------------------
# 1. Centuries race
# ---------------------------------------------------------------------------

@api_view(['GET'])
def stats_centuries_view(request):
    """
    GET /stats/centuries/?season=2025-26
    Returns ranked list of players by season century count.
    """
    season = request.query_params.get('season', _current_season_label())

    records = (
        CenturyRecord.objects
        .filter(season_label=season)
        .select_related('player')
        .order_by('-season_current', '-career_total')
    )

    if not records.exists():
        return Response({'season': season, 'count': 0, 'results': []})

    results = []
    for rank, rec in enumerate(records, start=1):
        player_info = _player_display(rec.player, rec.player_name)
        results.append({
            'rank':           rank,
            'player_name':    rec.player_name,
            'player_id':      player_info['id'],
            'nationality':    player_info['nationality'],
            'season_current': rec.season_current,
            'season_prev1':   rec.season_prev1,
            'season_prev2':   rec.season_prev2,
            'career_total':   rec.career_total,
            'career_147s':    rec.career_147s,
        })

    return Response({
        'season':      season,
        'count':       len(results),
        'scraped_at':  records.first().scraped_at.isoformat() if records.exists() else None,
        'results':     results,
    })


# ---------------------------------------------------------------------------
# 1b. All-time records (career totals) — deliberately NOT season-filtered.
# CenturyRecord stores one row per (player, season_label); a player's
# career_total/career_147s only appear on rows for seasons they actually
# have a century in. Filtering by the currently-selected season (as the
# centuries-race endpoint above does) silently drops any all-time great
# who hasn't scored a century in that specific season yet — e.g. Ronnie
# O'Sullivan's real career total (1324) never showed up because he had no
# row in the current season's dataset. This endpoint takes the MAX
# career_total/career_147s per player across every season row instead.
# ---------------------------------------------------------------------------

@api_view(['GET'])
def stats_records_view(request):
    """GET /stats/records/ — all-time century/147 leaders, not season-scoped."""
    rows = (
        CenturyRecord.objects
        .values('player_name', 'player_id')
        .annotate(best_total=Max('career_total'), best_147s=Max('career_147s'))
    )

    best_per_player: dict = {}
    for row in rows:
        name = row['player_name']
        total = row['best_total'] or 0
        existing = best_per_player.get(name)
        if not existing or total > existing['best_total']:
            best_per_player[name] = row

    player_ids = [r['player_id'] for r in best_per_player.values() if r['player_id']]
    players_map = {p.ID: p for p in Player.objects.filter(ID__in=player_ids)}

    results = []
    for row in best_per_player.values():
        player = players_map.get(row['player_id'])
        results.append({
            'player_name':  row['player_name'],
            'player_id':    row['player_id'],
            'nationality':  player.Nationality if player else None,
            'career_total': row['best_total'] or 0,
            'career_147s':  row['best_147s'] or 0,
        })

    results.sort(key=lambda r: -r['career_total'])

    return Response({'count': len(results), 'results': results})


# ---------------------------------------------------------------------------
# 2. Tour winners
# ---------------------------------------------------------------------------

# Event name patterns that indicate round-robin stages (no single champion)
_ROUND_ROBIN_PATTERNS = [
    'Championship League - Group',
    "Championship League - Winners'",
]


def _is_round_robin(event_name: str) -> bool:
    return any(p in event_name for p in _ROUND_ROBIN_PATTERNS)


def _get_tour_winners(season_int: int) -> list[dict]:
    """
    Return list of {event, winner} dicts for all main-tour events in a season
    that have a single definitive final match (Status=3, WinnerID>0, at max Round).
    """
    events = (
        Event.objects
        .filter(Season=season_int, Tour='main')
        .exclude(Type__in=['Qualifying', 'Q', 'Other'])
        .order_by('-EndDate')
    )

    # Filter out round-robin events by name
    events = [e for e in events if not _is_round_robin(e.Name)]
    event_ids = [e.ID for e in events]
    event_map = {e.ID: e for e in events}

    # Find max completed round per event
    max_round_qs = (
        MatchesOfAnEvent.objects
        .filter(Event_id__in=event_ids, WinnerID__gt=0, Status=3)
        .values('Event')
        .annotate(max_round=Max('Round'))
    )

    # Build a map: event_id → max_round
    max_round_map = {row['Event']: row['max_round'] for row in max_round_qs}

    # For each event find the single final match (exactly 1 match at max round)
    winners = []
    for event_id, max_round in max_round_map.items():
        finals = MatchesOfAnEvent.objects.filter(
            Event_id=event_id, Round=max_round, WinnerID__gt=0, Status=3
        )
        if finals.count() != 1:
            continue  # Skip round-robin-style events

        final = finals.first()
        ev = event_map[event_id]
        winner = Player.objects.filter(ID=final.WinnerID).first()
        runner_up_id = final.Player1ID if final.WinnerID == final.Player2ID else final.Player2ID
        runner_up = Player.objects.filter(ID=runner_up_id).first()

        winners.append({
            'event_id':       ev.ID,
            'event_name':     ev.Name,
            'event_type':     ev.Type,
            'start_date':     ev.StartDate.isoformat() if ev.StartDate else None,
            'end_date':       ev.EndDate.isoformat() if ev.EndDate else None,
            'venue':          ev.Venue,
            'city':           ev.City,
            'country':        ev.Country,
            'winner_id':      winner.ID if winner else None,
            'winner_name':    f"{winner.FirstName} {winner.LastName}".strip() if winner else '',
            'winner_nationality': winner.Nationality if winner else None,
            'runner_up_id':   runner_up.ID if runner_up else None,
            'runner_up_name': f"{runner_up.FirstName} {runner_up.LastName}".strip() if runner_up else '',
            'score':          f"{final.Score1}-{final.Score2}",
        })

    # Sort by end_date descending (most recent first)
    winners.sort(key=lambda x: x['end_date'] or '', reverse=True)
    return winners


@api_view(['GET'])
def stats_tour_winners_view(request):
    """
    GET /stats/tour-winners/?season=2025
    Returns list of events with their champions for the given season.
    """
    season = int(request.query_params.get('season', _current_season_int()))
    winners = _get_tour_winners(season)

    return Response({
        'season': season,
        'count':  len(winners),
        'results': winners,
    })


# ---------------------------------------------------------------------------
# 3. Title leaders
# ---------------------------------------------------------------------------

@api_view(['GET'])
def stats_title_leaders_view(request):
    """
    GET /stats/title-leaders/?season=2025
    Returns players ranked by number of titles won in the season.
    """
    season = int(request.query_params.get('season', _current_season_int()))
    winners = _get_tour_winners(season)

    # Group by winner
    player_titles: dict[int | None, dict] = {}
    for w in winners:
        key = w['winner_id']
        if key not in player_titles:
            player_titles[key] = {
                'player_id':   w['winner_id'],
                'player_name': w['winner_name'],
                'nationality': w['winner_nationality'],
                'titles':      0,
                'events':      [],
            }
        player_titles[key]['titles'] += 1
        player_titles[key]['events'].append({
            'event_id':   w['event_id'],
            'event_name': w['event_name'],
            'event_type': w['event_type'],
            'end_date':   w['end_date'],
        })

    leaders = sorted(player_titles.values(), key=lambda x: x['titles'], reverse=True)
    for rank, leader in enumerate(leaders, start=1):
        leader['rank'] = rank

    return Response({
        'season': season,
        'count':  len(leaders),
        'results': leaders,
    })
