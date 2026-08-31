# oneFourSeven/today_matches.py
"""
"Today's Matches" feature: every match scheduled for today, across every
event and every tour (main draw, Qualifiers, women's/seniors/Q-Tour) —
not just whichever single tournament the rest of the app treats as "active".

Why this exists: a main event's Qualifiers is its own Event row with its
own (often already-past) date range, so a qualifier match rescheduled onto
today can be invisible everywhere else in the app. See
docs/PLAN_2026-08-31_TODAY_MATCHES_SECTION.md for the full plan.

Each function below does exactly one thing, so each is testable on its own.
"""

from datetime import date

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import MatchesOfAnEvent
from .tournament_path import event_is_qualifier
from .views import _build_match_dict, get_player_names


def get_today_date() -> date:
    """Today's date, server-local — same convention already used by
    calendar_tabs_view and active_main_event_view elsewhere in this app."""
    return date.today()


def get_matches_scheduled_today():
    """Every match scheduled for today, in any event, any tour, any status."""
    return (
        MatchesOfAnEvent.objects
        .filter(ScheduledDate__date=get_today_date())
        .select_related('Event')
    )


def collect_player_ids(matches) -> set:
    """All player IDs appearing across a list of matches, for one batched
    name lookup instead of one query per match."""
    player_ids = set()
    for match in matches:
        player_ids.add(match.Player1ID)
        player_ids.add(match.Player2ID)
    return player_ids


def build_today_match_row(match, player_names_map: dict) -> dict:
    """One match -> one response dict, with its parent event's info attached."""
    row = _build_match_dict(match, player_names_map)
    row['event_id'] = match.Event.ID
    row['event_name'] = match.Event.Name
    row['event_tour'] = match.Event.Tour
    row['is_qualifier'] = event_is_qualifier(match.Event)
    return row


def group_matches_by_event(rows: list) -> list:
    """Groups a flat list of match rows into one entry per event, ordered by
    event name. Pure function — no DB access."""
    groups_by_event_id = {}
    for row in rows:
        event_id = row['event_id']
        if event_id not in groups_by_event_id:
            groups_by_event_id[event_id] = {
                'event_id': event_id,
                'event_name': row['event_name'],
                'event_tour': row['event_tour'],
                'is_qualifier': row['is_qualifier'],
                'matches': [],
            }
        groups_by_event_id[event_id]['matches'].append(row)

    groups = list(groups_by_event_id.values())
    groups.sort(key=lambda group: group['event_name'] or '')
    return groups


@api_view(['GET'])
@permission_classes([AllowAny])
def today_matches_view(request):
    """
    Every match scheduled for today, across every event and every tour,
    grouped by tournament.
    """
    matches = list(get_matches_scheduled_today())

    player_names_map = get_player_names(collect_player_ids(matches))
    rows = [build_today_match_row(match, player_names_map) for match in matches]
    groups = group_matches_by_event(rows)

    return Response({
        'date': get_today_date().isoformat(),
        'groups': groups,
    })
