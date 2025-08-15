# oneFourSeven/data_mappers.py
"""
Data mapping and cleaning utilities for transforming API data to model data.
Handles type conversion, field mapping, and data validation.
"""

import logging
from datetime import datetime, date, timezone as dt_timezone
from typing import Dict, List, Optional, Any, Tuple, Type
from django.db.models import Model
from django.utils import timezone as django_timezone
from django.core.exceptions import FieldDoesNotExist

from .constants import API_FIELD_MAPPINGS
from .models import Player, Event, Ranking, MatchesOfAnEvent

logger = logging.getLogger(__name__)


class DataCleaner:
    """Utility class for cleaning and converting API data to appropriate Python types."""
    
    @staticmethod
    def clean_int(value: Any, field_name: str, record_id: Any) -> Optional[int]:
        """Safely convert a value to integer."""
        if value is None or value == '':
            return None
        if isinstance(value, int):
            return value
        try:
            float_value = float(value)
            return int(float_value)
        except ValueError:
            logger.warning(f"Could not convert '{field_name}' value '{value}' to int for record {record_id}")
            return None
        except TypeError:
            logger.warning(f"Could not convert '{field_name}' value '{value}' to int for record {record_id}")
            return None

    @staticmethod
    def clean_float(value: Any, field_name: str, record_id: Any) -> Optional[float]:
        """Safely convert a value to float."""
        if value is None or value == '':
            return None
        if isinstance(value, (int, float)):
            return float(value)
        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning(f"Could not convert '{field_name}' value '{value}' to float for record {record_id}")
            return None

    @staticmethod
    def clean_date(date_str: Optional[str], field_name: str, record_id: Any) -> Optional[date]:
        """Safely convert YYYY-MM-DD string to date object."""
        if not date_str or not isinstance(date_str, str) or date_str == "0000-00-00":
            return None
        try:
            return datetime.strptime(date_str, '%Y-%m-%d').date()
        except (ValueError, TypeError):
            logger.warning(f"Invalid '{field_name}' date format '{date_str}' for record {record_id}")
            return None

    @staticmethod
    def clean_datetime(datetime_str: Optional[str], field_name: str, record_id: Any) -> Optional[datetime]:
        """Safely convert ISO datetime string to timezone-aware datetime object."""
        if not datetime_str or not isinstance(datetime_str, str):
            return None
        try:
            dt_obj = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            if django_timezone.is_naive(dt_obj):
                dt_obj = dt_obj.replace(tzinfo=dt_timezone.utc)
            return dt_obj
        except (ValueError, TypeError):
            logger.warning(f"Invalid '{field_name}' datetime format '{datetime_str}' for record {record_id}")
            return None

    @staticmethod
    def clean_boolean(value: Any) -> Optional[bool]:
        """Safely convert various values to boolean."""
        if isinstance(value, str):
            return value.lower() in ['true', '1', 't', 'y', 'yes']
        elif value is None:
            return None
        else:
            return bool(value)


class ModelDataMapper:
    """Maps API data to Django model data with proper field mappings and type conversion."""
    
    def __init__(self):
        self.cleaner = DataCleaner()
    
    def prepare_model_data(self, model_class: Type[Model], api_data: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Prepare API data for model creation/update.
        
        Args:
            model_class: The Django model class
            api_data: Raw data from API
            
        Returns:
            Tuple of (prepared_defaults, foreign_key_ids)
        """
        prepared_defaults = {}
        foreign_key_ids = {}
        record_id = api_data.get('ID', 'Unknown')
        
        logger.debug(f"Preparing data for {model_class.__name__}, record {record_id}")
        
        # Handle foreign key extractions first
        foreign_key_ids.update(self._extract_foreign_keys(model_class, api_data, record_id))
        
        # Get field mappings for this model
        field_mappings = API_FIELD_MAPPINGS.get(model_class.__name__, {})
        model_field_names = {f.name for f in model_class._meta.get_fields()}
        
        # Process each API field
        for api_key, api_value in api_data.items():
            model_field_name = self._get_model_field_name(api_key, field_mappings, model_field_names)
            
            if not model_field_name:
                continue
                
            # Clean the value based on model field type
            cleaned_value = self._clean_field_value(model_class, model_field_name, api_value, record_id)
            
            if cleaned_value is not None or api_value is None:
                prepared_defaults[model_field_name] = cleaned_value
        
        return prepared_defaults, foreign_key_ids
    
    def _extract_foreign_keys(self, model_class: Type[Model], api_data: Dict[str, Any], record_id: Any) -> Dict[str, Any]:
        """Extract foreign key IDs from API data."""
        foreign_keys = {}
        
        if model_class == Ranking:
            player_id = self.cleaner.clean_int(api_data.get('PlayerID'), 'PlayerID', record_id)
            if player_id is not None:
                foreign_keys['_PlayerID_from_api'] = player_id
                
        elif model_class == MatchesOfAnEvent:
            event_id = self.cleaner.clean_int(api_data.get('EventID'), 'EventID', record_id)
            if event_id is not None:
                foreign_keys['_EventID_from_api'] = event_id
        
        return foreign_keys
    
    def _get_model_field_name(self, api_key: str, field_mappings: Dict[str, str], model_field_names: set) -> Optional[str]:
        """Determine the model field name for an API key."""
        # Check explicit mapping first
        if api_key in field_mappings:
            mapped_name = field_mappings[api_key]
            if mapped_name in model_field_names:
                return mapped_name
            else:
                logger.warning(f"Mapped field '{mapped_name}' not found in model")
                return None
        
        # Check direct match
        if api_key in model_field_names:
            return api_key
            
        return None
    
    def _clean_field_value(self, model_class: Type[Model], field_name: str, value: Any, record_id: Any) -> Any:
        """Clean a field value based on the model field type."""
        try:
            field = model_class._meta.get_field(field_name)
            
            # Skip foreign keys and primary keys - handled separately
            if field.primary_key or field.is_relation:
                return None
                
            field_type = field.get_internal_type()
            
            # Apply appropriate cleaning based on field type
            if field_type == 'DateField':
                return self.cleaner.clean_date(value, field_name, record_id)
            elif field_type == 'DateTimeField':
                return self.cleaner.clean_datetime(value, field_name, record_id)
            elif field_type in ['IntegerField', 'BigAutoField', 'PositiveIntegerField', 'PositiveSmallIntegerField', 'SmallIntegerField']:
                return self.cleaner.clean_int(value, field_name, record_id)
            elif field_type == 'FloatField':
                return self.cleaner.clean_float(value, field_name, record_id)
            elif field_type == 'BooleanField':
                return self.cleaner.clean_boolean(value)
            elif field_type in ['CharField', 'TextField', 'URLField']:
                return str(value) if value is not None else None
            else:
                logger.warning(f"Unhandled field type '{field_type}' for field '{field_name}'")
                return value
                
        except FieldDoesNotExist:
            logger.warning(f"Field '{field_name}' not found in {model_class.__name__}")
            return None
        except Exception as e:
            logger.error(f"Error cleaning field '{field_name}': {e}", exc_info=True)
            return None


class DataFilter:
    """Filters API data based on business rules."""
    
    @staticmethod
    def filter_events(events_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter events based on type and name patterns."""
        from .constants import ALLOWED_EVENT_TYPES, EXCLUDED_EVENT_NAME_PATTERNS
        
        filtered_events = []
        for event in events_data:
            if not isinstance(event, dict):
                continue
                
            # Check event type
            event_type = event.get('Type')
            if event_type not in ALLOWED_EVENT_TYPES:
                continue
                
            # Check excluded name patterns
            event_name = event.get('Name', '')
            if any(pattern in event_name for pattern in EXCLUDED_EVENT_NAME_PATTERNS):
                continue
                
            filtered_events.append(event)
        
        return filtered_events
    
    @staticmethod
    def deduplicate_players(players_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate players based on ID."""
        unique_players = {}
        cleaner = DataCleaner()
        
        for i, player in enumerate(players_data):
            if not isinstance(player, dict):
                continue
                
            player_id = cleaner.clean_int(player.get('ID'), 'ID', f'player_{i}')
            if player_id is not None:
                unique_players[player_id] = player
        
        return list(unique_players.values())


# Create shared instances
data_mapper = ModelDataMapper()
data_filter = DataFilter()

# Export convenience functions
prepare_data_for_model = data_mapper.prepare_model_data
filter_events = data_filter.filter_events
deduplicate_players = data_filter.deduplicate_players

# Export cleaner functions for backward compatibility
_clean_int = DataCleaner.clean_int
_clean_float = DataCleaner.clean_float
_clean_date = DataCleaner.clean_date
_clean_datetime = DataCleaner.clean_datetime