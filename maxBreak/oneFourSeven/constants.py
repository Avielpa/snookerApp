# oneFourSeven/constants.py
"""
Constants and configuration for the snooker application.
Contains API endpoints, parameters, and other configuration values.
"""

# --- API Configuration ---
API_BASE_URL = "https://api.snooker.org/"
HEADERS = {"X-Requested-By": "FahimaApp128"}
DEFAULT_TIMEOUT = 30  # seconds - increased for live matches

# --- API Endpoint Parameter 't' values ---
T_EVENT_MATCHES = '6'
T_SEASON_EVENTS = '5'
T_PLAYER_INFO = '9'
T_PLAYERS = '10'
T_RANKING = '11'
T_HEAD_TO_HEAD = '16'
T_CURRENT_SEASON = '20'
T_EVENT_DETAILS = '3'
T_ROUND_DETAILS = '12'

# --- Player Status 'st' values ---
ST_PLAYER_PRO = 'p'
ST_PLAYER_AMATEUR = 'a'

# --- Player Sex 'se' values ---
SE_PLAYER_MEN = 'm'
SE_PLAYER_WOMEN = 'f'

# --- Ranking Type 'rt' values ---
RT_MONEY_RANKINGS = 'MoneyRankings'
RT_MONEY_SEEDINGS = 'MoneySeedings'
RT_ONE_YEAR_MONEY_RANKINGS = 'OneYearMoneyRankings'
RT_QT_RANKINGS = 'QTRankings'
RT_WOMENS_RANKINGS = 'WomensRankings'
RT_ONE_YEAR = 'OneYearProvisional'  # Keep for backwards compatibility

# All available ranking types
ALL_RANKING_TYPES = [
    RT_MONEY_RANKINGS,
    RT_MONEY_SEEDINGS, 
    RT_ONE_YEAR_MONEY_RANKINGS,
    RT_QT_RANKINGS,
    RT_WOMENS_RANKINGS
]

# --- Tour 'tr' values ---
TR_MAIN_TOUR = 'main'
TR_SENIORS = 'seniors'
TR_WOMENS = 'womens'
TR_OTHER = 'other'

# All tour types for comprehensive updates
ALL_TOUR_TYPES = [TR_MAIN_TOUR, TR_SENIORS, TR_WOMENS, TR_OTHER]

# --- Match Status Codes ---
MATCH_STATUS_SCHEDULED = 0
MATCH_STATUS_RUNNING = 1
MATCH_STATUS_FINISHED = 2
MATCH_STATUS_UNKNOWN = 3

# --- Database Field Mappings ---
# Maps API field names to model field names for different models
API_FIELD_MAPPINGS = {
    'MatchesOfAnEvent': {
        'ID': 'api_match_id',
        'Sessions': 'sessions_str',
        'FrameScores': 'FrameScores',
        'OnBreak': 'OnBreak',
        'Unfinished': 'Unfinished',
        'LiveUrl': 'LiveUrl',
        'DetailsUrl': 'DetailsUrl',
        'Note': 'Note',
    },
    'Ranking': {
        'Position': 'Position',
        'Season': 'Season',
        'Sum': 'Sum',
        'Type': 'Type'
    },
    'Player': {},  # Most Player fields match directly
    'Event': {
        'Url': 'Url'
    }
}

# --- Event Filtering Configuration ---
ALLOWED_EVENT_TYPES = ['Ranking', 'Qualifying', 'Invitational']
EXCLUDED_EVENT_NAME_PATTERNS = ['Championship League Stage']

# --- Rate Limiting Configuration ---
REQUESTS_PER_MINUTE = 10
SECONDS_PER_MINUTE = 60