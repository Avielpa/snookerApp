# oneFourSeven/api_client.py
"""
API client for communicating with the snooker.org API.
Handles all HTTP requests, rate limiting, and error handling.
"""

import requests
import logging
from typing import Dict, List, Optional, Any, Union
from .constants import (
    API_BASE_URL, HEADERS, DEFAULT_TIMEOUT,
    T_EVENT_MATCHES, T_ROUND_DETAILS, T_SEASON_EVENTS, T_PLAYER_INFO, T_PLAYERS,
    T_RANKING, T_HEAD_TO_HEAD, T_CURRENT_SEASON, T_EVENT_DETAILS
)

logger = logging.getLogger(__name__)


class SnookerAPIClient:
    """
    Client for interacting with the snooker.org API.
    Handles requests, caching, and error handling.
    """
    
    def __init__(self):
        self.base_url = API_BASE_URL
        self.headers = HEADERS.copy()
        self.timeout = DEFAULT_TIMEOUT
        
    def _make_request(self, endpoint_params: Dict[str, Union[str, int]]) -> Optional[Union[List, Dict]]:
        """
        Makes a request to the snooker.org API with the given parameters.
        
        Args:
            endpoint_params: Dictionary of query parameters
            
        Returns:
            JSON response as list or dict if successful, None if failed
        """
        # Construct URL with parameters
        param_string = "&".join([f"{k}={v}" for k, v in endpoint_params.items()])
        url = f"{self.base_url}?{param_string}"
        logger.debug(f"Making API request to: {url}")

        request_headers = self.headers.copy()
        # Add cache-control headers to avoid stale data
        request_headers.update({
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        })

        try:
            response = requests.get(url, headers=request_headers, timeout=self.timeout)
            response.raise_for_status()
            
            if not response.content:
                logger.warning(f"Empty response from {url}")
                return []
                
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP Error {e.response.status_code} from {url}: {e.response.text[:200]}...")
            return None
        except requests.exceptions.Timeout:
            logger.error(f"Timeout ({self.timeout}s) for {url}")
            return None
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error for {url}: {e}")
            return None
        except requests.exceptions.JSONDecodeError:
            logger.warning(f"Invalid JSON response from {url}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error for {url}: {e}", exc_info=True)
            return None

    def fetch_current_season(self) -> Optional[int]:
        """Fetch the current snooker season year."""
        logger.info("Fetching current season...")
        params = {'t': T_CURRENT_SEASON}
        data = self._make_request(params)
        
        if data and isinstance(data, list) and len(data) > 0:
            season_value = data[0].get('CurrentSeason')
            if season_value is not None:
                try:
                    season = int(season_value)
                    logger.info(f"Current season: {season}")
                    return season
                except (ValueError, TypeError):
                    logger.error(f"Invalid season value: {season_value}")
        
        logger.warning("Could not determine current season")
        return None

    def fetch_season_events(self, season: int, tour: str = 'main') -> Optional[List[Dict]]:
        """Fetch events for a specific season and tour."""
        logger.info(f"Fetching events for season {season}, tour '{tour}'")
        params = {'t': T_SEASON_EVENTS, 's': season, 'tr': tour}
        data = self._make_request(params)
        
        if isinstance(data, list):
            logger.info(f"Fetched {len(data)} events")
            return data
        return None

    def fetch_players(self, season: int, player_status: str, sex: str) -> Optional[List[Dict]]:
        """Fetch players by season, status, and sex."""
        logger.info(f"Fetching players: season={season}, status={player_status}, sex={sex}")
        params = {'t': T_PLAYERS, 's': season, 'st': player_status, 'se': sex}
        data = self._make_request(params)
        
        if isinstance(data, list):
            logger.info(f"Fetched {len(data)} players")
            return data
        return None

    def fetch_rankings(self, season: int, ranking_type: str = 'MoneyRankings') -> Optional[List[Dict]]:
        """Fetch rankings for a specific season and type."""
        logger.info(f"Fetching rankings: season={season}, type={ranking_type}")
        params = {'t': T_RANKING, 's': season, 'rt': ranking_type}
        data = self._make_request(params)
        
        if isinstance(data, list):
            logger.info(f"Fetched {len(data)} rankings")
            return data
        return None

    def fetch_event_matches(self, event_id: int) -> Optional[List[Dict]]:
        """Fetch all matches for a specific event."""
        logger.info(f"Fetching matches for event {event_id}")
        params = {'t': T_EVENT_MATCHES, 'e': event_id}
        data = self._make_request(params)
        
        if isinstance(data, list):
            logger.info(f"Fetched {len(data)} matches")
            return data
        return None

    def fetch_event_details(self, event_id: int) -> Optional[Union[List, Dict]]:
        """Fetch detailed event information."""
        logger.info(f"Fetching event details for {event_id}")
        params = {'t': T_EVENT_DETAILS, 'e': event_id}
        return self._make_request(params)


    def fetch_head_to_head(self, player1_id: int, player2_id: int, season: int = -1, tour: str = 'main') -> Optional[Union[List, Dict]]:
        """Fetch head-to-head statistics between two players."""
        logger.info(f"Fetching H2H: Player {player1_id} vs Player {player2_id} (season: {season})")
        params = {'p1': player1_id, 'p2': player2_id, 's': season, 'tr': tour}
        return self._make_request(params)
    
    def fetch_round_details(self, event_id: int, season: int) -> Optional[List[Dict]]:
        """
        Fetch round details including Distance information for a tournament.
        """
        logger.info(f"Fetching round details for event {event_id}, season {season}")
        params = {'t': T_ROUND_DETAILS, 'e': event_id, 's': season}
        data = self._make_request(params)
        
        if isinstance(data, list):
            logger.info(f"Fetched {len(data)} round details")
            return data
        return None


# Create a shared instance
api_client = SnookerAPIClient()

# Export convenience functions for backward compatibility
fetch_current_season = api_client.fetch_current_season
fetch_season_events_data = api_client.fetch_season_events
fetch_players_data = api_client.fetch_players
fetch_ranking_data = api_client.fetch_rankings
fetch_event_matches_data = api_client.fetch_event_matches
fetch_event_details_data = api_client.fetch_event_details
fetch_h2h_data = api_client.fetch_head_to_head
fetch_round_details_data = api_client.fetch_round_details