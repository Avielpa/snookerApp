# oneFourSeven/scraper.py
"""
Simplified scraper module that orchestrates API fetching, data processing, and database operations.
This module now acts as a facade that delegates to specialized modules.
"""

import logging
from datetime import date
from typing import Optional

# Import from our new modular structure
from .api_client import (
    fetch_current_season,
    fetch_season_events_data,
    fetch_players_data,
    fetch_ranking_data,
    fetch_event_matches_data,
    fetch_event_details_data,
    fetch_h2h_data,
    fetch_round_details_data
)

from .data_savers import (
    save_players,
    save_events, 
    save_rankings,
    save_matches_of_an_event,
    save_round_details
)

from .data_mappers import (
    filter_events,
    deduplicate_players,
    _clean_int,
    _clean_float,
    _clean_date,
    _clean_datetime
)

from .constants import (
    ST_PLAYER_PRO, ST_PLAYER_AMATEUR,
    SE_PLAYER_MEN, SE_PLAYER_WOMEN,
    RT_MONEY_RANKINGS, TR_MAIN_TOUR
)

from .models import Event

logger = logging.getLogger(__name__)


def get_current_active_event_id() -> Optional[int]:
    """
    Find the ID of the most recently started event that is currently active.
    Returns None if no active event is found.
    """
    today = date.today()
    logger.debug(f"Finding current active event for date: {today}")
    
    try:
        active_event = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        ).order_by('-StartDate', '-ID').first()
        
        if active_event:
            logger.info(f"Current active event: ID={active_event.ID} ('{active_event.Name}')")
            return active_event.ID
        else:
            logger.info("No active event found for today")
            return None
            
    except Exception as e:
        logger.error(f"Error finding current active event: {e}", exc_info=True)
        return None


# Re-export key functions for backward compatibility
__all__ = [
    # API functions
    'fetch_current_season',
    'fetch_season_events_data',
    'fetch_players_data', 
    'fetch_ranking_data',
    'fetch_event_matches_data',
    'fetch_event_details_data',
    'fetch_h2h_data',
    'fetch_round_details_data',
    
    # Data processing functions
    'save_players',
    'save_events',
    'save_rankings', 
    'save_matches_of_an_event',
    'save_round_details',
    'filter_events',
    'deduplicate_players',
    
    # Helper functions
    'get_current_active_event_id',
    '_clean_int',
    '_clean_float', 
    '_clean_date',
    '_clean_datetime',
    
    # Constants
    'ST_PLAYER_PRO', 'ST_PLAYER_AMATEUR',
    'SE_PLAYER_MEN', 'SE_PLAYER_WOMEN', 
    'RT_MONEY_RANKINGS', 'TR_MAIN_TOUR'
]