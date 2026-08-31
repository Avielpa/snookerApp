# One knockout path for a main event: its own matches plus main-draw
# matches stored on a sibling Qualifiers event (e.g. Last 64 on Wuhan Open Qualifiers).

from datetime import datetime, timezone as dt_timezone

from django.utils import timezone as django_timezone

from .models import Event, MatchesOfAnEvent, RoundDetails

# Sentinel for a round with no known play date at all — sorts after every
# dated round, so undated rounds fall back to ascending Round-number order
# among themselves (matches this module's pre-existing behaviour).
_NO_DATE_SENTINEL = datetime.max.replace(tzinfo=dt_timezone.utc)

QUALIFIER_TYPE = 'Qualifying'
MAIN_DRAW_PLAYERS_LEFT_MAX = 64
# snooker.org numbers qualifying 1–4 and last-64+ from 7 when RoundDetails is missing.
SNOOKER_ORG_MAIN_DRAW_ROUND_MIN = 7


def event_is_qualifier(event: Event) -> bool:
    if (event.Type or '').strip().lower() == QUALIFIER_TYPE.lower():
        return True
    return (event.Name or '').lower().endswith('qualifiers')


def qualifier_siblings(main_event: Event):
    if not main_event.ID:
        return Event.objects.none()
    return Event.objects.filter(Main=main_event.ID).exclude(ID=main_event.ID)


def main_draw_round_numbers(event: Event) -> set:
    return set(
        RoundDetails.objects.filter(
            Event=event, NumLeft__lte=MAIN_DRAW_PLAYERS_LEFT_MAX
        ).values_list('Round', flat=True)
    )


def main_draw_matches_of(event: Event) -> list:
    qs = MatchesOfAnEvent.objects.filter(Event=event)
    rounds = main_draw_round_numbers(event)
    if rounds:
        return list(qs.filter(Round__in=rounds))
    return list(qs.filter(Round__gte=SNOOKER_ORG_MAIN_DRAW_ROUND_MIN))


def extra_path_matches(main_event: Event) -> list:
    if event_is_qualifier(main_event):
        return []
    extra = []
    for sibling in qualifier_siblings(main_event):
        extra.extend(main_draw_matches_of(sibling))
    return extra


def path_matches_for_event(event: Event) -> list:
    own = list(MatchesOfAnEvent.objects.filter(Event=event))
    return own + extra_path_matches(event)


def _earliest_play_date(round_matches: list) -> datetime:
    """
    Earliest known ScheduledDate among a round's matches, aware-UTC.
    Falls back to _NO_DATE_SENTINEL when none of the matches have one.
    """
    dates = []
    for m in round_matches:
        d = m.ScheduledDate
        if not d:
            continue
        if not django_timezone.is_aware(d):
            d = d.replace(tzinfo=dt_timezone.utc)
        dates.append(d)
    return min(dates) if dates else _NO_DATE_SENTINEL


def sequential_round_map(matches) -> dict:
    """
    Map each Round number to its 1-based position in actual play order.

    Ordered by when a round was really played (its earliest match date),
    not by the raw Round number — snooker.org sometimes numbers a round
    (e.g. a Wild Card Round) outside the normal sequence even though it's
    played before rounds with a lower number. Rounds with no known date
    fall back to ascending Round-number order among themselves, which
    matches this function's previous (pre-chronology) behaviour exactly.
    """
    by_round: dict[int, list] = {}
    for m in matches:
        if m.Round is None:
            continue
        by_round.setdefault(m.Round, []).append(m)

    ordered_rounds = sorted(
        by_round.keys(),
        key=lambda round_no: (_earliest_play_date(by_round[round_no]), round_no),
    )
    return {round_no: index + 1 for index, round_no in enumerate(ordered_rounds)}


def path_owner_event(match) -> Event:
    """
    The Event whose sequential path this match's round belongs to: the main
    event, for a qualifier match merged into that main event's path (e.g.
    Last 64); otherwise the match's own event.

    This is the single source of truth for "which path is this match on" —
    both path_round_for_match and path_event_id_for_match key off it, so a
    merged path is never accidentally split back into two by a caller
    grouping matches by their own (pre-merge) event_id.
    """
    event = match.Event
    if event_is_qualifier(event) and event.Main:
        main = Event.objects.filter(pk=event.Main).first()
        if main and any(row.pk == match.pk for row in path_matches_for_event(main)):
            return main
    return event


def path_round_for_match(match) -> int | None:
    owner = path_owner_event(match)
    return sequential_round_map(path_matches_for_event(owner)).get(match.Round)


def path_event_id_for_match(match) -> int:
    """
    ID of the event whose path this match belongs to (see path_owner_event).
    Frontend round-grouping keys off this instead of the match's own raw
    event_id, so a merged qualifier match's original (pre-merge) event
    doesn't split its path back into two.
    """
    return path_owner_event(match).ID
