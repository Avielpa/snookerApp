# oneFourSeven/views.py

import logging
from datetime import datetime, date, timezone as dt_timezone # Python's timezone
from typing import List, Dict, Optional, Set, Any, Union

# Django Imports
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models.query import QuerySet
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone as django_timezone # Django's timezone utils

# DRF Imports
from rest_framework import viewsets, status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.response import Response # Use DRF Response

# Simple JWT Imports
from rest_framework_simplejwt.tokens import RefreshToken

# Local Imports
from .models import MatchesOfAnEvent, Player, Ranking, Event, RoundDetails, UpcomingMatch
from .serializers import (
    EventSerializer, MatchesOfAnEventSerializer, PlayerSerializer,
    RankingSerializer, UserSerializer
)
# Import specific fetch functions from the refactored scraper
from .scraper import (
    fetch_event_details_data, # Renamed from get_tour_details
    fetch_h2h_data,
    fetch_round_details_data
)

logger = logging.getLogger(__name__)

# Inside get_player_names in views.py (Proposed NEW version)
def get_player_names(player_ids: Set[Optional[int]]) -> Dict[int, str]:
    """ Fetches player names efficiently for a given set of IDs. """
    # Filter out None values and ensure IDs are integers
    valid_player_ids: Set[int] = {pid for pid in player_ids if isinstance(pid, int)}

    players_map: Dict[int, str] = {}
    if not valid_player_ids:
        logger.debug("No valid player IDs provided to get_player_names.")
        return players_map

    players = Player.objects.filter(ID__in=valid_player_ids)
    for p in players:
        # --- MODIFIED NAME ASSEMBLY ---
        # Build name parts, including MiddleName if it exists
        name_parts = []
        if p.FirstName:
            name_parts.append(p.FirstName)
        if p.MiddleName:
            name_parts.append(p.MiddleName)
        if p.LastName:
            name_parts.append(p.LastName)
        
        # Join with spaces to create full name
        full_name = " ".join(name_parts)
        # --- END MODIFIED NAME ASSEMBLY ---

        # Provide a fallback using ID if name parts are all missing
        if full_name:
            players_map[p.ID] = full_name
        else:
            players_map[p.ID] = f"Player {p.ID}"

    found_ids = set(players_map.keys())
    missing_ids = valid_player_ids - found_ids
    if missing_ids:
         logger.warning(f"Could not find Player records for IDs: {missing_ids}")

    logger.debug(f"Fetched names for {len(players_map)} out of {len(valid_player_ids)} requested player IDs.")
    return players_map


# --- Helper Function: _get_sortable_datetime ---
def _get_sortable_datetime(match: MatchesOfAnEvent) -> datetime:
    """
    Helper to determine a consistent, timezone-aware datetime for sorting matches.
    It prioritizes ScheduledDate, then tries to parse the first session time,
    and falls back to a very distant future date if neither is available.
    Ensures the returned datetime is timezone-aware (using UTC if input is naive).

    Args:
        match: The MatchesOfAnEvent instance.

    Returns:
        A timezone-aware datetime object suitable for sorting.
    """
    # Priority 1: Use ScheduledDate if available
    scheduled_date = match.ScheduledDate
    if scheduled_date:
        if django_timezone.is_aware(scheduled_date):
            return scheduled_date
        else:
            # Make naive datetime aware using UTC (safer than using Django's current TZ)
            logger.warning(f"Match PK {match.pk} (API ID {match.api_match_id}): Making naive ScheduledDate {scheduled_date} UTC-aware for sorting.")
            return scheduled_date.replace(tzinfo=dt_timezone.utc)

    # Priority 2: Try parsing the first session time from sessions_str
    sessions_info = match.sessions_str
    if sessions_info:
        try:
            # Assumes format like 'DD.MM.YYYY HH:MM; DD.MM.YYYY HH:MM'
            first_session_str = sessions_info.split(';')[0].strip()
            # Specify the exact format including date and time parts
            dt_naive = datetime.strptime(first_session_str, '%d.%m.%Y %H:%M')
            # Make naive datetime aware using UTC
            logger.debug(f"Match PK {match.pk} (API ID {match.api_match_id}): Using parsed session time {dt_naive} (made UTC-aware) for sorting.")
            return dt_naive.replace(tzinfo=dt_timezone.utc)
        except (ValueError, IndexError, TypeError) as e:
            logger.warning(f"Match PK {match.pk} (API ID {match.api_match_id}): Could not parse session string '{sessions_info}' for sorting. Error: {e}. Falling back.")
            # Fall through to the final fallback

    # Priority 3: Fallback to a very distant future date
    # Use max datetime, make it timezone-aware (UTC)
    # This ensures matches without valid dates are sorted last.
    max_dt_naive = datetime.max.replace(microsecond=0)
    max_dt_aware = max_dt_naive.replace(tzinfo=dt_timezone.utc)
    logger.warning(f"Match PK {match.pk} (API ID {match.api_match_id}): No valid ScheduledDate or parseable session found. Using max date ({max_dt_aware}) for sorting.")
    return max_dt_aware


# --- Helper Function: _format_datetime_for_json ---
def _format_datetime_for_json(dt: Optional[datetime]) -> Optional[str]:
    """
    Formats a timezone-aware or naive datetime object into an ISO 8601 string
    ending with 'Z' to indicate UTC. Naive datetimes are assumed to be UTC.

    Args:
        dt: The datetime object (can be None).

    Returns:
        An ISO 8601 formatted string with 'Z' suffix (e.g., "2023-10-27T10:00:00Z"),
        or None if the input dt is None or an error occurs.
    """
    if dt is None:
        return None
        
    try:
        # Make datetime timezone-aware if needed
        if django_timezone.is_naive(dt):
            # If naive, assume UTC
            dt_aware = dt.replace(tzinfo=dt_timezone.utc)
        else:
            # If already aware, convert to UTC for consistent 'Z' representation
            dt_aware = dt.astimezone(dt_timezone.utc)

        # Format to ISO string
        iso_string = dt_aware.isoformat()

        # Ensure it ends with 'Z' instead of '+00:00' offset
        if iso_string.endswith('+00:00'):
            formatted_string = iso_string[:-6] + 'Z'
            return formatted_string
        elif iso_string.endswith('Z'):
            return iso_string # Already correct
        else:
            # This case should be rare if UTC conversion worked
            logger.warning(f"Could not format datetime {dt} to end with 'Z'. Output: {iso_string}")
            return iso_string # Return the potentially non-Z format

    except Exception as e:
        logger.error(f"Error formatting datetime '{dt}' for JSON: {e}", exc_info=True)
        return None # Return None on formatting error


# --- Helper Function: _build_match_dict ---
def _build_match_dict(match: MatchesOfAnEvent, player_names_map: Dict[int, str]) -> Dict[str, Any]:
    """
    Builds the dictionary representation of a single match, suitable for JSON response.
    Includes player names fetched separately and formats dates.

    Args:
        match: The MatchesOfAnEvent model instance.
        player_names_map: A dictionary mapping Player IDs to their names.

    Returns:
        A dictionary containing formatted match data.
    """
    p1_id = match.Player1ID
    p2_id = match.Player2ID

    # Get names from the pre-fetched map, with fallbacks
    p1_name = "TBD"
    if p1_id:
        p1_name = player_names_map.get(p1_id, f"Player ID {p1_id} (Not Found)")

    p2_name = "TBD"
    if p2_id:
        p2_name = player_names_map.get(p2_id, f"Player ID {p2_id} (Not Found)")

    # Construct the dictionary using correct model field names
    match_data = {
        "id": match.pk,                   # Django's primary key
        "api_match_id": match.api_match_id, # The ID from the snooker.org API
        "event_id": match.Event_id,       # ID of the parent Event
        "round": match.Round,
        "number": match.Number,
        "player1_id": p1_id,
        "player1_name": p1_name,          # Added player name
        "score1": match.Score1,
        "player2_id": p2_id,
        "player2_name": p2_name,          # Added player name
        "score2": match.Score2,
        "winner_id": match.WinnerID,
        "status_code": match.Status,             # Raw status code from model
        "status_display": match.get_Status_display(), # Human-readable status
        "scheduled_date": _format_datetime_for_json(match.ScheduledDate),
        "start_date": _format_datetime_for_json(match.StartDate),
        "end_date": _format_datetime_for_json(match.EndDate),
        "frame_scores": match.FrameScores, # Keep as string, frontend can parse if needed
        "sessions_str": match.sessions_str, # Keep as string
        "on_break": match.OnBreak,
        "unfinished": match.Unfinished,
        "live_url": match.LiveUrl,
        "details_url": match.DetailsUrl,
        "note": match.Note,
    }
    return match_data


# --- DRF Generic Views (for simple list endpoints) ---

@permission_classes([AllowAny])
class EventList(generics.ListAPIView):
    """
    API endpoint that lists all events, ordered by descending start date.
    """
    # Optimized queryset: select only needed fields if performance is critical
    # queryset = Event.objects.all().values('ID', 'Name', 'StartDate', ...)
    queryset = Event.objects.all().order_by('-Season', '-StartDate') # Order by season then date
    serializer_class = EventSerializer


@permission_classes([AllowAny])
class PlayerList(generics.ListAPIView):
    """
    API endpoint that lists players, optionally filtered by sex ('M' or 'F').
    Requires the 'sex' parameter in the URL.
    Example: /api/players/M/
    """
    serializer_class = PlayerSerializer

    def get_queryset(self):
        """ Filters the queryset based on the 'sex' URL parameter. """
        sex_param = self.kwargs.get('sex', None)
        if sex_param and isinstance(sex_param, str):
            sex_upper = sex_param.upper()
            if sex_upper in [Player.SEX_MALE, Player.SEX_FEMALE]:
                logger.debug(f"Filtering players by sex: {sex_upper}")
                return Player.objects.filter(Sex=sex_upper).order_by('LastName', 'FirstName')
            else:
                logger.warning(f"Invalid 'sex' parameter value provided: {sex_param}. Allowed: M, F.")
                # Return empty queryset for invalid sex parameter
                return Player.objects.none()
        else:
            logger.error("Missing or invalid 'sex' parameter in URL for PlayerList.")
            # Return empty queryset if parameter is missing
            return Player.objects.none()

@permission_classes([AllowAny])
class RankingList(generics.ListAPIView):
    """
    API endpoint that lists player rankings.
    Uses `select_related('Player')` for optimized fetching of player names.
    """
    serializer_class = RankingSerializer
    # Optimize query by pre-fetching related Player object to avoid N+1 queries
    # when the serializer accesses obj.Player or calls get_player_name.
    queryset = Ranking.objects.select_related('Player').all().order_by('Season', 'Type', 'Position')


@api_view(['GET'])
@permission_classes([AllowAny])
def ranking_types_view(request, ranking_type='MoneyRankings'):
    """
    API endpoint for all ranking types that returns rankings for a specific type.
    
    Available ranking types:
    - MoneyRankings: Prize money rankings (all players)
    - MoneySeedings: Seedings based on prize money
    - OneYearMoneyRankings: One-year prize money rankings  
    - QTRankings: Q Tour rankings
    - WomensRankings: Women's world rankings
    """
    try:
        from oneFourSeven.constants import ALL_RANKING_TYPES
        
        # Validate ranking type
        if ranking_type not in ALL_RANKING_TYPES:
            return Response(
                {"error": f"Invalid ranking type. Available types: {ALL_RANKING_TYPES}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get query parameters
        season_param = request.GET.get('season')
        target_season = int(season_param) if season_param else 2025
        
        # Base query for target season
        rankings_query = Ranking.objects.select_related('Player').filter(
            Season=target_season,
            Type=ranking_type
        ).order_by('Position')
        
        # If no data for target season, try previous season(s)
        if not rankings_query.exists():
            # Try previous seasons (2024, 2023, etc.)
            for prev_season in range(target_season - 1, target_season - 4, -1):
                prev_query = Ranking.objects.select_related('Player').filter(
                    Season=prev_season,
                    Type=ranking_type
                ).order_by('Position')
                
                if prev_query.exists():
                    rankings_query = prev_query
                    target_season = prev_season  # Update season for response
                    break
        
        # Serialize rankings
        rankings = rankings_query
        serialized_data = RankingSerializer(rankings, many=True).data
        
        # Get ranking type display info
        ranking_info = {
            'MoneyRankings': {
                'name': 'Prize Money Rankings',
                'description': 'Official world rankings based on prize money earned',
                'icon': 'trophy-outline',
                'color': '#FFD700'
            },
            'MoneySeedings': {
                'name': 'Money Seedings',
                'description': 'Tournament seedings based on prize money',
                'icon': 'trending-up-outline', 
                'color': '#FF6B35'
            },
            'OneYearMoneyRankings': {
                'name': 'One Year Money Rankings',
                'description': 'Prize money rankings for the past year',
                'icon': 'calendar-outline',
                'color': '#4ECDC4'
            },
            'QTRankings': {
                'name': 'Q Tour Rankings',
                'description': 'Qualifying tour official rankings',
                'icon': 'school-outline',
                'color': '#45B7D1'
            },
            'WomensRankings': {
                'name': "Women's World Rankings", 
                'description': 'Official women\'s world rankings',
                'icon': 'ribbon-outline',
                'color': '#96CEB4'
            }
        }
        
        info = ranking_info.get(ranking_type, {
            'name': ranking_type,
            'description': f'{ranking_type} rankings',
            'icon': 'list-outline',
            'color': '#666666'
        })
        
        # Add summary statistics
        total_count = rankings_query.count()
        men_count = rankings_query.filter(Player__Sex='M').count()
        women_count = rankings_query.filter(Player__Sex='F').count()
        
        return Response({
            'ranking_type': ranking_type,
            'ranking_name': info['name'],
            'description': info['description'],
            'icon': info['icon'],
            'color': info['color'],
            'season': target_season,
            'summary': {
                'total_count': total_count,
                'men_count': men_count,
                'women_count': women_count,
                'data_source': 'snooker.org Official API'
            },
            'rankings': serialized_data,
            'last_updated': date.today().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in ranking_types_view: {e}", exc_info=True)
        return Response(
            {"error": "Internal server error while loading rankings"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])  
@permission_classes([AllowAny])
def ranking_tabs_view(request, tab_type='mens'):
    """
    API endpoint for ranking tabs that returns rankings filtered by category.
    
    IMPORTANT: The snooker.org API only provides MoneyRankings (prize money earned).
    This means:
    - mens: Shows all professional men in MoneyRankings (125+ players)
    - womens: Shows women who earned prize money (4-10 players typically)
    - amateur: Currently empty as amateurs don't earn official prize money
    
    The website's separate women's/Q tour rankings use different data sources not available via API.
    """
    try:
        # Get query parameters
        season_param = request.GET.get('season')
        target_season = int(season_param) if season_param else 2025
        ranking_type = request.GET.get('type', 'MoneyRankings')
        
        # Base query with optimizations
        base_query = Ranking.objects.select_related('Player').filter(
            Season=target_season,
            Type=ranking_type
        )
        
        # Filter based on tab type with realistic expectations
        if tab_type == 'mens':
            rankings_query = base_query.filter(Player__Sex='M')
            tab_name = "Men's Prize Money Rankings"
            description = "Professional men ranked by prize money earned"
        elif tab_type == 'womens':
            rankings_query = base_query.filter(Player__Sex='F')
            tab_name = "Women's Prize Money Rankings"
            description = "Women who earned prize money in mixed tournaments"
        elif tab_type == 'amateur':
            # Show empty results but explain why
            rankings_query = base_query.filter(Player__FirstSeasonAsPro__isnull=True)
            tab_name = "Amateur Rankings"
            description = "Amateur players (prize money rankings not applicable)"
        else:  # 'all'
            rankings_query = base_query
            tab_name = "All Prize Money Rankings"
            description = "All players ranked by prize money earned"
        
        # Order by position
        rankings = rankings_query.order_by('Position')
        
        # Serialize rankings
        serialized_data = RankingSerializer(rankings, many=True).data
        
        # For womens tab, preserve actual positions to show how they rank among all players
        # For amateur tab, explain why it's empty
        if tab_type == 'amateur' and not serialized_data:
            # Provide explanation for empty amateur rankings
            explanation = {
                'reason': 'Amateur players do not appear in prize money rankings',
                'note': 'The snooker.org API only provides MoneyRankings data',
                'alternative': 'Q School and amateur rankings use different data sources not available via API'
            }
        else:
            explanation = None
        
        # Add summary statistics
        total_count = rankings_query.count()
        
        return Response({
            'tab_type': tab_type,
            'tab_name': tab_name,
            'description': description,
            'season': target_season,
            'ranking_type': ranking_type,
            'summary': {
                'total_count': total_count,
                'displayed_count': len(serialized_data),
                'ranking_system': 'Prize Money Rankings',
                'data_source': 'snooker.org Official API'
            },
            'rankings': serialized_data,
            'explanation': explanation,
            'last_updated': date.today().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in ranking_tabs_view: {e}", exc_info=True)
        return Response(
            {"error": "Internal server error while loading rankings"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


# --- Function-Based Views (for more complex logic or specific endpoints) ---

@api_view(['GET'])
@permission_classes([AllowAny])
def event_detail_view(request, event_id):
    """
    API endpoint that returns details for a single event, looked up by its ID.
    """
    logger.debug(f"Request received for event details ID: {event_id}")
    # Use get_object_or_404 for standard object lookup and 404 handling
    event_instance = get_object_or_404(Event, ID=event_id)
    serializer = EventSerializer(event_instance)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([AllowAny])
def matches_of_an_event_view(request, event_id):
    """
    API endpoint that lists all matches for a given event ID.
    Matches are sorted chronologically based on ScheduledDate or session times.
    Includes player names in the response.
    """
    logger.debug(f"Request received for matches of event ID: {event_id}")

    # Ensure the event exists first
    event_instance = get_object_or_404(Event, pk=event_id) # Use Django PK for Event lookup
    logger.debug(f"Event found: {event_instance.Name}")

    # Fetch all matches for this event from the database
    # Use prefetch_related if accessing related models frequently (not needed here for players)
    matches_qs = MatchesOfAnEvent.objects.filter(Event=event_instance)
    matches_list = list(matches_qs) # Evaluate queryset to get list in memory
    match_count = len(matches_list)
    logger.debug(f"Fetched {match_count} matches from DB for event {event_id}.")

    if not matches_list:
        # Return empty list with 200 OK if no matches found
        return Response([], status=status.HTTP_200_OK)

    # Sort matches in memory using the custom helper function
    try:
        # The helper _get_sortable_datetime handles date logic complexity
        sorted_matches = sorted(matches_list, key=_get_sortable_datetime)
        logger.debug(f"Sorted {len(sorted_matches)} matches based on date/time.")
    except Exception as e:
        logger.error(f"Error sorting matches for event {event_id}: {e}", exc_info=True)
        return Response(
            {"error": "Server error occurred while sorting matches."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # --- Prepare data for response: Fetch player names efficiently ---
    # 1. Collect all unique Player IDs involved in these matches
    player_ids_to_fetch: Set[Optional[int]] = set()
    for match in sorted_matches:
        player_ids_to_fetch.add(match.Player1ID)
        player_ids_to_fetch.add(match.Player2ID)

    # 2. Fetch names for these IDs in bulk using the helper
    player_names_map = get_player_names(player_ids_to_fetch)
    # -----------------------------------------------------------------

    # Build the final list of match data dictionaries using the helper
    response_data = []
    try:
        for match in sorted_matches:
            response_data.append(_build_match_dict(match, player_names_map))
        logger.debug(f"Prepared {len(response_data)} matches for JSON response for event {event_id}.")
    except Exception as e:
        logger.error(f"Error building match dictionary for event {event_id}: {e}", exc_info=True)
        return Response(
             {"error": "Server error occurred during data preparation."},
             status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # Return the list of match dictionaries
    return Response(response_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def match_detail_view(request, api_match_id):
    """
    API endpoint that returns details for a single match, looked up by its
    `api_match_id` (the ID from snooker.org API).
    Includes player names.
    """
    logger.debug(f"Request received for match details API ID: {api_match_id}")

    # Validate input is integer-like before querying
    try:
        id_int = int(api_match_id)
    except (ValueError, TypeError):
        logger.warning(f"Invalid Match API ID format received: {api_match_id}")
        # Use DRF's standard 404 response for bad lookup format
        raise Http404("Invalid Match API ID format.")

    # Fetch the match using the 'api_match_id' field
    # Use filter().first() to handle potential non-uniqueness if API IDs repeat,
    # although ideally they should be unique per match conceptually.
    # Or use get() if you expect api_match_id to be unique in your DB.
    match_instance = get_object_or_404(MatchesOfAnEvent, api_match_id=id_int)
    # match_instance = MatchesOfAnEvent.objects.filter(api_match_id=id_int).first()
    # if not match_instance:
    #      raise Http404(f"Match with API ID {id_int} not found.")

    # Fetch player names involved in this specific match
    player_ids_to_fetch: Set[Optional[int]] = {match_instance.Player1ID, match_instance.Player2ID}
    player_names_map = get_player_names(player_ids_to_fetch)

    # Build the response dictionary using the helper
    try:
        match_data = _build_match_dict(match_instance, player_names_map)
        return Response(match_data)
    except Exception as e:
        logger.error(f"Error building dictionary for match api_id {api_match_id}: {e}", exc_info=True)
        return Response(
             {"error": "Server error during data preparation."},
             status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def player_by_id_view(request, player_id):
    """
    API endpoint that returns details for a single player, looked up by their ID.
    """
    logger.debug(f"Request received for player ID: {player_id}")
    player_instance = get_object_or_404(Player, ID=player_id)
    serializer = PlayerSerializer(player_instance)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def round_format(request, round_id, season_int):
    """
    API endpoint that returns the match format for a given round ID and season.
    First tries to get data from database, falls back to API if needed.
    """
    logger.debug(f"Request received for round format: Round ID {round_id}, Season {season_int}")

    # Validate inputs
    try:
        round_id_int = int(round_id)
        season_int = int(season_int)
    except (ValueError, TypeError):
        logger.warning(f"Invalid round ID or season format: {round_id}, {season_int}")
        return Response({"error": "Invalid round ID or season format."}, status=status.HTTP_400_BAD_REQUEST)

    # First try to get from database
    try:
        # Find the event for this season and round
        # Priority: Active tournaments first, then most recent by start date
        from datetime import date
        today = date.today()
        
        round_details_query = RoundDetails.objects.select_related('Event').filter(
            Round=round_id_int,
            Event__Season=season_int
        )
        
        # Try to get the most relevant tournament:
        # 1. Currently active tournaments
        active_round = round_details_query.filter(
            Event__StartDate__lte=today,
            Event__EndDate__gte=today
        ).first()
        
        if active_round:
            round_detail = active_round
        else:
            # 2. Most recent tournament by start date
            round_detail = round_details_query.order_by('-Event__StartDate').first()
        
        if round_detail:
            logger.debug(f"Found round format in database: Round {round_id_int}, Distance {round_detail.Distance}")
            # Return format in the format expected by frontend
            response_data = {
                'Round': round_detail.Round,
                'RoundName': round_detail.get_correct_round_name(),
                'EventID': round_detail.Event.ID,
                'Distance': round_detail.Distance,
                'DistanceText': round_detail.get_format_text(),
                'Money': float(round_detail.Money) if round_detail.Money else None,
                'ActualMoney': float(round_detail.ActualMoney) if round_detail.ActualMoney else None,
                'Currency': round_detail.Currency or 'GBP',
                'Points': round_detail.Points
            }
            return Response([response_data])  # Frontend expects array
        
        logger.info(f"Round format not found in database for Round {round_id_int}, Season {season_int}")
        return Response({"error": "Round format not found in database. Use management command to update round details."}, 
                       status=status.HTTP_404_NOT_FOUND)
        
    except Exception as e:
        logger.error(f"Error fetching round format from database for Round {round_id_int}, Season {season_int}: {e}", exc_info=True)
        return Response({"error": "Internal server error while fetching round format."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def tour_details_view(request, event_id):
    """
    API endpoint that proxies a request to the external snooker.org API
    to fetch detailed tournament information (using t=3).
    """
    logger.info(f"Proxying request for external tour details for event ID: {event_id}")

    # Validate event_id format
    try:
        id_int = int(event_id)
    except (ValueError, TypeError):
         return Response({"error": "Invalid Event ID format."}, status=status.HTTP_400_BAD_REQUEST)

    # Use the refactored scraper function
    try:
        details_data = fetch_event_details_data(id_int) # Function from scraper.py

        if details_data is not None:
             # API might return list or dict for t=3, return it directly
             logger.debug(f"Successfully fetched external details for event {event_id}.")
             return Response(details_data)
        else:
             # fetch_event_details_data returned None, indicating fetch error
             logger.warning(f"Failed to fetch external details for event {event_id} from scraper.")
             return Response(
                 {"error": f"Could not retrieve external details for event {event_id}."},
                 status=status.HTTP_404_NOT_FOUND # Or 503 Service Unavailable if API down?
             )
    except Exception as e:
        # Catch unexpected errors during the fetch_event_details_data call
        logger.error(f"Error calling scraper's fetch_event_details_data for event {event_id}: {e}", exc_info=True)
        return Response({"error": "Internal server error while fetching external details."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def h2h_view(request, player1_id, player2_id):
    """
    API endpoint that proxies a request to the external snooker.org API
    to fetch Head-to-Head statistics between two players (using t=13).
    """
    logger.info(f"Proxying request for H2H data for P1:{player1_id} vs P2:{player2_id}")

    # Validate player IDs
    try:
        p1_int = int(player1_id)
        p2_int = int(player2_id)
    except (ValueError, TypeError):
         return Response({"error": "Invalid Player ID format."}, status=status.HTTP_400_BAD_REQUEST)

    # Use the refactored scraper function
    try:
        h2h_data = fetch_h2h_data(p1_int, p2_int) # Function from scraper.py

        if h2h_data is not None:
             # Process the raw match list into win statistics that frontend expects
             if isinstance(h2h_data, list):
                 # Count wins for each player
                 p1_wins = sum(1 for match in h2h_data if match.get('WinnerID') == p1_int)
                 p2_wins = sum(1 for match in h2h_data if match.get('WinnerID') == p2_int)
                 total_meetings = len(h2h_data)
                 
                 # Get player names from the database
                 player_names_map = get_player_names({p1_int, p2_int})
                 p1_name = player_names_map.get(p1_int, f"Player {p1_int}")
                 p2_name = player_names_map.get(p2_int, f"Player {p2_int}")
                 
                 # Find last meeting info
                 last_meeting = None
                 last_result = None
                 if h2h_data:
                     # Sort matches by most recent (assuming they're already sorted by date)
                     last_match = h2h_data[0]  # First match should be most recent
                     last_meeting = last_match.get('StartDate') or last_match.get('ScheduledDate')
                     if last_match.get('WinnerID') == p1_int:
                         last_result = f"{p1_name} won {last_match.get('Score1', 0)}-{last_match.get('Score2', 0)}"
                     elif last_match.get('WinnerID') == p2_int:
                         last_result = f"{p2_name} won {last_match.get('Score2', 0)}-{last_match.get('Score1', 0)}"
                 
                 # Create processed data in format frontend expects
                 processed_data = {
                     'Player1ID': p1_int,
                     'Player1Name': p1_name,
                     'Player2ID': p2_int,
                     'Player2Name': p2_name,
                     'Player1Wins': p1_wins,
                     'Player2Wins': p2_wins,
                     'TotalMeetings': total_meetings,
                     'LastMeeting': last_meeting,
                     'LastResult': last_result,
                     'Matches': h2h_data  # Include raw matches for detailed view
                 }
             else:
                 # Handle case where API returns non-list data
                 processed_data = {
                     'Player1ID': p1_int,
                     'Player2ID': p2_int,
                     'Player1Wins': 0,
                     'Player2Wins': 0,
                     'TotalMeetings': 0,
                     'Matches': []
                 }

             logger.debug(f"Successfully processed H2H data for {p1_int} vs {p2_int}: {processed_data['Player1Wins']}-{processed_data['Player2Wins']} ({processed_data['TotalMeetings']} meetings)")
             return Response(processed_data)
        else:
            # fetch_h2h_data returned None, indicating fetch error
            logger.warning(f"Failed to fetch H2H data for {p1_int} vs {p2_int} from scraper.")
            return Response(
                {"error": f"Could not retrieve H2H data for players {p1_int} and {p2_int}."},
                status=status.HTTP_404_NOT_FOUND
            )
    except Exception as e:
        # Catch unexpected errors during the fetch_h2h_data call
        logger.error(f"Error calling scraper's fetch_h2h_data for {p1_int} vs {p2_int}: {e}", exc_info=True)
        return Response({"error": "Internal server error while fetching H2H data."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Debug/Status Views ---

@api_view(['GET'])
@permission_classes([AllowAny])
def calendar_tabs_view(request, tab_type='main'):
    """
    API endpoint for calendar tabs that returns tournaments filtered by tab type:
    - main: Main tour tournaments only
    - others: All other tour types (seniors, womens, other, amateur)
    - all: All tournaments
    
    Returns tournaments categorized by status within the selected tab.
    """
    try:
        from datetime import timedelta
        
        # Get query parameters
        season_param = request.GET.get('season')
        target_season = int(season_param) if season_param else 2025
        
        today = date.today()
        recent_cutoff = today - timedelta(days=365)  # Show all past tournaments in current season
        
        # Filter tournaments based on tab type
        base_query = Event.objects.all()
        
        if tab_type == 'main':
            base_query = base_query.filter(Tour='main')
            tab_name = 'Main Tours'
        elif tab_type == 'others':
            base_query = base_query.exclude(Tour='main')
            tab_name = 'Other Tours'
        else:  # 'all'
            tab_name = 'All Tours'
        
        # Current season tournaments
        current_season_events = base_query.filter(Season=target_season)
        
        # Categorize tournaments
        active_tournaments = []
        upcoming_tournaments = []
        recent_tournaments = []
        
        for event in current_season_events:
            if event.StartDate and event.EndDate:
                tournament_data = {
                    'id': event.ID,
                    'name': event.Name,
                    'start_date': event.StartDate.isoformat(),
                    'end_date': event.EndDate.isoformat(),
                    'tour': event.Tour,
                    'venue': event.Venue,
                    'city': event.City,
                    'country': event.Country,
                    'prize_money': event.get_prize_money_breakdown()
                }
                
                if event.StartDate <= today <= event.EndDate:
                    # Currently active
                    active_tournaments.append(tournament_data)
                elif event.StartDate > today:
                    # Upcoming
                    tournament_data['days_until'] = (event.StartDate - today).days
                    upcoming_tournaments.append(tournament_data)
                elif event.EndDate >= recent_cutoff:
                    # Recently finished
                    tournament_data['days_ago'] = (today - event.EndDate).days
                    recent_tournaments.append(tournament_data)
        
        # Sort tournaments
        active_tournaments.sort(key=lambda x: x['start_date'])
        upcoming_tournaments.sort(key=lambda x: x['start_date'])
        recent_tournaments.sort(key=lambda x: x['end_date'], reverse=True)
        
        return Response({
            'tab_type': tab_type,
            'tab_name': tab_name,
            'season': target_season,
            'summary': {
                'active_count': len(active_tournaments),
                'upcoming_count': len(upcoming_tournaments),
                'recent_count': len(recent_tournaments)
            },
            'active': active_tournaments,
            'upcoming': upcoming_tournaments,
            'recent': recent_tournaments,
            'last_updated': today.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in calendar_tabs_view: {e}", exc_info=True)
        return Response(
            {"error": "Internal server error while loading calendar data"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def tours_by_status_view(request):
    """
    API endpoint that returns tournaments categorized by status:
    - active: Currently running tournaments
    - upcoming: Future tournaments (current season)
    - recent: Recently finished tournaments (current season)
    - previous: Previous season tournaments
    
    Query parameters:
    - season: Filter by specific season (default: current)
    - include_all_tours: Include all tour types (default: false, main only)
    """
    try:
        from datetime import datetime, timedelta
        
        # Get query parameters
        season_param = request.GET.get('season')
        include_all_tours = request.GET.get('include_all_tours', 'false').lower() == 'true'
        
        # Default to current season if not specified
        if season_param:
            try:
                target_season = int(season_param)
            except ValueError:
                return Response({"error": "Invalid season parameter"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target_season = 2025  # Current season
        
        today = date.today()
        recent_cutoff = today - timedelta(days=14)  # Last 2 weeks
        
        # Base queryset
        base_query = Event.objects.all()
        if not include_all_tours:
            base_query = base_query.filter(Tour='main')
        
        # Current season tournaments
        current_season_events = base_query.filter(Season=target_season)
        
        # Categorize current season tournaments
        active_tournaments = []
        upcoming_tournaments = []
        recent_tournaments = []
        
        for event in current_season_events:
            if event.StartDate and event.EndDate:
                if event.StartDate <= today <= event.EndDate:
                    # Currently active
                    active_tournaments.append({
                        'id': event.ID,
                        'name': event.Name,
                        'start_date': event.StartDate.isoformat(),
                        'end_date': event.EndDate.isoformat(),
                        'tour': event.Tour,
                        'venue': event.Venue,
                        'city': event.City,
                        'country': event.Country
                    })
                elif event.StartDate > today:
                    # Upcoming
                    upcoming_tournaments.append({
                        'id': event.ID,
                        'name': event.Name,
                        'start_date': event.StartDate.isoformat(),
                        'end_date': event.EndDate.isoformat(),
                        'tour': event.Tour,
                        'venue': event.Venue,
                        'city': event.City,
                        'country': event.Country,
                        'days_until': (event.StartDate - today).days
                    })
                elif event.EndDate >= recent_cutoff:
                    # Recently finished
                    recent_tournaments.append({
                        'id': event.ID,
                        'name': event.Name,
                        'start_date': event.StartDate.isoformat(),
                        'end_date': event.EndDate.isoformat(),
                        'tour': event.Tour,
                        'venue': event.Venue,
                        'city': event.City,
                        'country': event.Country,
                        'days_ago': (today - event.EndDate).days
                    })
        
        # Previous season tournaments (last 2 seasons for reference)
        previous_seasons_events = base_query.filter(
            Season__in=[target_season - 1, target_season - 2]
        ).order_by('-Season', '-EndDate')[:20]  # Limit to most recent 20
        
        previous_tournaments = []
        for event in previous_seasons_events:
            previous_tournaments.append({
                'id': event.ID,
                'name': event.Name,
                'season': event.Season,
                'start_date': event.StartDate.isoformat() if event.StartDate else None,
                'end_date': event.EndDate.isoformat() if event.EndDate else None,
                'tour': event.Tour,
                'venue': event.Venue,
                'city': event.City,
                'country': event.Country
            })
        
        # Sort tournaments
        active_tournaments.sort(key=lambda x: x['start_date'])
        upcoming_tournaments.sort(key=lambda x: x['start_date'])
        recent_tournaments.sort(key=lambda x: x['end_date'], reverse=True)
        
        return Response({
            'season': target_season,
            'include_all_tours': include_all_tours,
            'summary': {
                'active_count': len(active_tournaments),
                'upcoming_count': len(upcoming_tournaments),
                'recent_count': len(recent_tournaments),
                'previous_count': len(previous_tournaments)
            },
            'active': active_tournaments,
            'upcoming': upcoming_tournaments,
            'recent': recent_tournaments,
            'previous_seasons': previous_tournaments,
            'last_updated': today.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error in tours_by_status_view: {e}", exc_info=True)
        return Response(
            {"error": "Internal server error while categorizing tournaments"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def debug_status_view(request):
    """
    Debug endpoint to check system status and data availability.
    """
    try:
        from datetime import datetime, timezone as dt_timezone
        
        # Count data
        events_count = Event.objects.count()
        matches_count = MatchesOfAnEvent.objects.count()
        players_count = Player.objects.count()
        
        # Find recent/active tournaments
        now = datetime.now(dt_timezone.utc)
        recent_events = Event.objects.filter(
            StartDate__isnull=False,
            EndDate__isnull=False
        ).order_by('-StartDate')[:10]
        
        event_info = []
        for event in recent_events:
            start = event.StartDate
            end = event.EndDate
            
            if start and end:
                # Convert date objects to datetime objects if needed
                if isinstance(start, date) and not isinstance(start, datetime):
                    start = datetime.combine(start, datetime.min.time()).replace(tzinfo=dt_timezone.utc)
                elif isinstance(start, datetime) and start.tzinfo is None:
                    start = start.replace(tzinfo=dt_timezone.utc)
                    
                if isinstance(end, date) and not isinstance(end, datetime):
                    end = datetime.combine(end, datetime.max.time()).replace(tzinfo=dt_timezone.utc)
                elif isinstance(end, datetime) and end.tzinfo is None:
                    end = end.replace(tzinfo=dt_timezone.utc)
                
                # Check if active
                is_active = start <= now <= end
                
                # Count matches for this event
                match_count = MatchesOfAnEvent.objects.filter(Event=event).count()
                
                event_info.append({
                    'id': event.ID,
                    'name': event.Name,
                    'start_date': start.isoformat(),
                    'end_date': end.isoformat(),
                    'is_active': is_active,
                    'match_count': match_count,
                    'status': 'active' if is_active else ('future' if start > now else 'past')
                })
        
        return Response({
            'status': 'ok',
            'timestamp': now.isoformat(),
            'database': {
                'events': events_count,
                'matches': matches_count,
                'players': players_count
            },
            'recent_events': event_info,
            'active_events': [e for e in event_info if e['is_active']],
            'api_info': {
                'version': 'django-snooker-api-v1',
                'endpoints_available': [
                    '/events/',
                    '/events/{id}/',
                    '/events/{id}/matches/',
                    '/players/{sex}/',
                    '/rankings/',
                    '/debug/status/' # This endpoint
                ]
            }
        })
        
    except Exception as e:
        logger.error(f"Debug status endpoint error: {e}", exc_info=True)
        return Response({
            'status': 'error',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- Authentication Views ---

@api_view(['POST'])
@permission_classes([AllowAny]) # Anyone can attempt to log in
def login_view(request): # Renamed slightly to avoid conflict with built-in 'login'
    """ API endpoint for user login using username and password. Returns JWT tokens on success. """
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({"error": "Username and password are required."}, status=status.HTTP_400_BAD_REQUEST)

    logger.debug(f"Login attempt for username: {username}")
    # Use Django's built-in authentication
    user = authenticate(request=request, username=username, password=password)

    if user is not None:
        # User authenticated successfully
        refresh = RefreshToken.for_user(user)
        logger.info(f"Login successful for user: {username} (ID: {user.id})")
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            # Optionally include some user details (be careful not to expose sensitive info)
            'user': {
                 'id': user.id,
                 'username': user.username,
                 'email': user.email, # Optional
                 'is_staff': user.is_staff, # Optional
            }
        })
    else:
        # Authentication failed
        logger.warning(f"Login failed for username: {username}")
        return Response({"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([IsAuthenticated]) # Only authenticated users can log out
def logout_view(request): # Renamed slightly
    """ API endpoint for user logout. Currently informational, client handles token removal. """
    # Note: SimpleJWT logout is typically handled client-side by discarding tokens.
    # This endpoint can be used for logging or potentially blacklist refresh tokens if configured.
    logger.info(f"Logout request received for user: {request.user.username} (ID: {request.user.id})")
    # No server-side token action needed by default unless using token blacklisting.
    return Response({"message": "Logout successful. Please discard your tokens."})


# --- Prize Money API Endpoints ---

@api_view(['GET'])
@permission_classes([AllowAny])
def prize_money_view(request, event_id):
    """
    API endpoint to get prize money breakdown for a tournament.
    Returns winner/runner-up prize amounts with formatted display.
    """
    try:
        event = Event.objects.get(ID=event_id)
        prize_breakdown = event.get_prize_money_breakdown()
        
        if prize_breakdown:
            return Response(prize_breakdown, status=status.HTTP_200_OK)
        else:
            return Response({"message": "No prize money data available"}, status=status.HTTP_404_NOT_FOUND)
            
    except Event.DoesNotExist:
        return Response({"error": "Tournament not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error in prize_money_view for event {event_id}: {e}", exc_info=True)
        return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def round_prizes_view(request, event_id):
    """
    API endpoint to get round-specific prize amounts for a tournament.
    Returns a mapping of round numbers to formatted prize amounts.
    """
    try:
        from .models import RoundDetails
        
        round_details = RoundDetails.objects.filter(Event_id=event_id)
        round_prizes = {}
        
        for round_detail in round_details:
            if round_detail.Money and round_detail.Money > 0:
                # Format the money amount
                if round_detail.Money >= 1000000:
                    formatted = f"£{round_detail.Money/1000000:.1f}M"
                elif round_detail.Money >= 1000:
                    formatted = f"£{round_detail.Money/1000:.0f}K"
                else:
                    formatted = f"£{round_detail.Money:,.0f}"
                
                round_prizes[round_detail.Round] = formatted
        
        return Response(round_prizes, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in round_prizes_view for event {event_id}: {e}", exc_info=True)
        return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def upcoming_matches_fallback_view(request):
    """
    API endpoint to serve upcoming matches as fallback when no active tournaments exist.
    Used when main database doesn't have current active tournaments with matches.
    """
    try:
        tour_type = request.GET.get('tour', 'main')
        days_ahead = int(request.GET.get('days', 7))  # Default 7 days
        
        # Get upcoming matches from fallback data
        from django.utils import timezone
        now = timezone.now()
        end_date = now + django_timezone.timedelta(days=days_ahead)
        
        upcoming_matches = UpcomingMatch.objects.filter(
            tour_type=tour_type,
            scheduled_date__gte=now,
            scheduled_date__lte=end_date
        ).order_by('scheduled_date', 'round_number', 'match_number')
        
        # Format matches for API response
        matches_data = []
        for match in upcoming_matches:
            match_data = {
                'id': match.id,
                'api_match_id': match.api_match_id,
                'event_id': match.event_id,
                'event_name': match.event_name,
                'round': match.round_number,
                'match_number': match.match_number,
                'player1_id': match.player1_id,
                'player2_id': match.player2_id,
                'player1_name': match.player1_name,
                'player2_name': match.player2_name,
                'score1': match.score1,
                'score2': match.score2,
                'winner_id': match.winner_id,
                'status_code': match.status,
                'status_display': match.status_display,
                'scheduled_date': match.scheduled_date.isoformat() if match.scheduled_date else None,
                'is_live': match.is_live,
                'is_today': match.is_today,
                'score_display': match.score_display,
                'tour_type': match.tour_type,
                'created_at': match.created_at.isoformat(),
            }
            matches_data.append(match_data)
        
        # Group by today vs upcoming
        today_matches = [m for m in matches_data if m['is_today']]
        upcoming_other = [m for m in matches_data if not m['is_today']]
        
        response_data = {
            'success': True,
            'tour_type': tour_type,
            'days_ahead': days_ahead,
            'total_matches': len(matches_data),
            'today_matches': today_matches,
            'upcoming_matches': upcoming_other,
            'last_updated': now.isoformat(),
            'data_source': 'fallback_upcoming_matches',
            'message': 'Showing upcoming matches from fallback data'
        }
        
        logger.info(f"Served {len(matches_data)} upcoming matches for {tour_type} tour (fallback)")
        return Response(response_data, status=status.HTTP_200_OK)
        
    except ValueError as e:
        logger.warning(f"Invalid parameter in upcoming_matches_fallback_view: {e}")
        return Response({"error": "Invalid parameters"}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Error in upcoming_matches_fallback_view: {e}", exc_info=True)
        return Response({"error": "Internal server error"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- User ViewSet (for CRUD operations on Users if needed) ---

class UserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    Permissions vary based on action:
    - `create` (Register): Allowed for anyone.
    - `list`, `destroy`: Allowed only for admin users.
    - `retrieve`, `update`, `partial_update`: Allowed for authenticated users (typically only for their own record, needs adjustment).
    """
    queryset = User.objects.all().order_by('-date_joined') # Get all users
    serializer_class = UserSerializer # Use the safe UserSerializer

    # --- Define Permissions Dynamically ---
    def get_permissions(self):
        """ Assign permissions based on the action being performed. """
        if self.action == 'create':
            # Anyone can create a user (register)
            permission_classes_list = [AllowAny]
        elif self.action in ['list', 'destroy']:
            # Only admin users can list all users or delete users
            permission_classes_list = [IsAdminUser]
        # elif self.action in ['retrieve', 'update', 'partial_update']:
            # Default: Only authenticated users can access details/update.
            # Needs refinement to allow users to only access/update THEIR OWN record.
            # Example (requires custom permission class or logic in get_object):
            # permission_classes = [IsAuthenticated, IsOwnerOrAdmin] # Custom permission
            # permission_classes_list = [IsAuthenticated] # Simplest for now
        else:
            # Default for other actions (retrieve, update, etc.) - require authentication
            permission_classes_list = [IsAuthenticated]

        # Instantiate and return permission classes
        return [permission() for permission in permission_classes_list]

    # --- Override Create for Password Hashing ---
    def perform_create(self, serializer):
        """ Hash the password when creating a new user. """
        # The serializer should handle validation (e.g., password confirmation) if needed
        user = serializer.save()
        # Ensure password gets hashed properly if not handled by serializer implicitly
        if 'password' in serializer.validated_data:
             user.set_password(serializer.validated_data['password'])
             user.save()
        logger.info(f"New user created: {user.username} (ID: {user.id})")

    # --- Add Logic for Own Record Access (Example - Needs more work) ---
    # def get_object(self):
    #     """ Ensure users can only retrieve/update their own profile unless admin. """
    #     obj = super().get_object()
    #     user = self.request.user
    #     if obj == user or user.is_staff:
    #          return obj
    #     else:
    #          raise PermissionDenied("You do not have permission to access this user.")

