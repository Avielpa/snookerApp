# One knockout path for a main event: its own matches plus main-draw
# matches stored on a sibling Qualifiers event (e.g. Last 64 on Wuhan Open Qualifiers).

from .models import Event, MatchesOfAnEvent, RoundDetails

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


def sequential_round_map(matches) -> dict:
    rounds = sorted({m.Round for m in matches if m.Round is not None})
    return {round_no: index + 1 for index, round_no in enumerate(rounds)}


def path_round_for_match(match) -> int | None:
    event = match.Event
    if event_is_qualifier(event) and event.Main:
        main = Event.objects.filter(pk=event.Main).first()
        if main:
            path = path_matches_for_event(main)
            if any(row.pk == match.pk for row in path):
                return sequential_round_map(path).get(match.Round)
    return sequential_round_map(path_matches_for_event(event)).get(match.Round)
