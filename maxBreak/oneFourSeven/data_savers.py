# oneFourSeven/data_savers.py
"""
Database operations for saving and updating model instances.
Handles all database interactions with proper error handling and logging.
"""

import logging
from typing import Dict, List, Optional, Any, Tuple, Type, Set
from django.db import IntegrityError, transaction
from django.db.models import Model
from django.core.exceptions import ObjectDoesNotExist

from .models import Event, Player, Ranking, MatchesOfAnEvent, RoundDetails
from .data_mappers import prepare_data_for_model

logger = logging.getLogger(__name__)


class DatabaseSaver:
    """Handles saving and updating model instances with proper error handling."""
    
    def update_or_create_item(self, model_class: Type[Model], lookup_params: Dict[str, Any], 
                             defaults_data: Dict[str, Any]) -> Tuple[Optional[Model], bool]:
        """
        Atomically update or create a model instance.
        
        Args:
            model_class: The Django model class
            lookup_params: Parameters to find existing record
            defaults_data: Data to apply when creating/updating
            
        Returns:
            Tuple of (instance, created)
        """
        # Filter out invalid field names
        valid_defaults = {k: v for k, v in defaults_data.items() if hasattr(model_class, k)}
        instance_description = f"{model_class.__name__} with lookup {lookup_params}"
        
        try:
            # Pre-fetch for change logging
            existing_obj = None
            old_values = {}
            try:
                existing_obj = model_class.objects.filter(**lookup_params).first()
                if existing_obj:
                    for key in valid_defaults.keys():
                        if hasattr(existing_obj, key):
                            old_values[key] = getattr(existing_obj, key)
            except Exception as e:
                logger.warning(f"Error pre-fetching {instance_description}: {e}")
            
            # Perform update_or_create
            obj, created = model_class.objects.update_or_create(
                **lookup_params,
                defaults=valid_defaults
            )
            
            # Log the operation
            self._log_database_operation(model_class, lookup_params, valid_defaults, 
                                       created, existing_obj, old_values)
            
            return obj, created
            
        except IntegrityError as e:
            logger.error(f"IntegrityError saving {instance_description}: {e}")
            return None, False
        except Exception as e:
            logger.error(f"Error saving {instance_description}: {e}", exc_info=True)
            return None, False
    
    def _log_database_operation(self, model_class: Type[Model], lookup_params: Dict[str, Any],
                               defaults: Dict[str, Any], created: bool, existing_obj: Optional[Model],
                               old_values: Dict[str, Any]):
        """Log database operations with change details."""
        operation = "Created" if created else "Updated"
        log_msg = f"{operation} {model_class.__name__} (lookup: {lookup_params})"
        
        if created:
            logger.debug(f"{log_msg} with data: {defaults}")
        elif existing_obj:
            changes = []
            for key, new_value in defaults.items():
                old_value = old_values.get(key)
                if str(old_value) != str(new_value):
                    old_str = str(old_value)[:50] + ('...' if len(str(old_value)) > 50 else '')
                    new_str = str(new_value)[:50] + ('...' if len(str(new_value)) > 50 else '')
                    changes.append(f"{key}: '{old_str}' -> '{new_str}'")
            
            if changes:
                log_level = logging.INFO if model_class == MatchesOfAnEvent and 'status_code' in defaults else logging.DEBUG
                logger.log(log_level, f"{log_msg}. Changes: {', '.join(changes)}")

    def save_players(self, players_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """Save player data to database."""
        if not players_data:
            logger.info("No player data to save")
            return {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        logger.info(f"Saving {len(players_data)} player records...")
        stats = {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        for player_data in players_data:
            if not isinstance(player_data, dict):
                logger.warning(f"Skipping invalid player data: {player_data}")
                stats["skipped"] += 1
                continue
            
            api_id = player_data.get('ID')
            if not api_id:
                logger.warning(f"Skipping player with missing ID: {player_data}")
                stats["skipped"] += 1
                continue
            
            try:
                cleaned_id = int(api_id)
            except (ValueError, TypeError):
                logger.warning(f"Skipping player with invalid ID '{api_id}': {player_data}")
                stats["skipped"] += 1
                continue
            
            # Prepare data
            defaults, _ = prepare_data_for_model(Player, player_data)
            lookup = {'ID': cleaned_id}
            
            instance, created = self.update_or_create_item(Player, lookup, defaults)
            if instance:
                stats["created" if created else "updated"] += 1
            else:
                stats["failed"] += 1
        
        logger.info(f"Player save summary: {stats}")
        return stats

    def save_events(self, events_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """Save event data to database."""
        if not events_data:
            logger.info("No event data to save")
            return {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        logger.info(f"Saving {len(events_data)} event records...")
        stats = {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        for event_data in events_data:
            if not isinstance(event_data, dict):
                logger.warning(f"Skipping invalid event data: {event_data}")
                stats["skipped"] += 1
                continue
            
            api_id = event_data.get('ID')
            if not api_id:
                logger.warning(f"Skipping event with missing ID: {event_data}")
                stats["skipped"] += 1
                continue
            
            try:
                cleaned_id = int(api_id)
            except (ValueError, TypeError):
                logger.warning(f"Skipping event with invalid ID '{api_id}': {event_data}")
                stats["skipped"] += 1
                continue
            
            # Prepare data
            defaults, _ = prepare_data_for_model(Event, event_data)
            
            # Handle tour categorization only if tour_category is explicitly provided
            tour_category = event_data.get('tour_category')
            if tour_category:
                defaults['Tour'] = tour_category
            
            lookup = {'ID': cleaned_id}
            
            instance, created = self.update_or_create_item(Event, lookup, defaults)
            if instance:
                stats["created" if created else "updated"] += 1
            else:
                stats["failed"] += 1
        
        logger.info(f"Event save summary: {stats}")
        return stats

    def save_rankings(self, rankings_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Save ranking data with proper deduplication based on logical key.
        Uses (Player, Season, Type) as the logical key to prevent duplicates.
        """
        if not rankings_data:
            logger.info("No ranking data to save")
            return {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        logger.info(f"Saving {len(rankings_data)} ranking records...")
        stats = {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        # Pre-fetch all relevant players
        player_ids = set()
        valid_rankings = []
        
        for ranking_data in rankings_data:
            if not isinstance(ranking_data, dict):
                stats["skipped"] += 1
                continue
            
            player_id = ranking_data.get('PlayerID')
            if player_id:
                try:
                    player_ids.add(int(player_id))
                    valid_rankings.append(ranking_data)
                except (ValueError, TypeError):
                    stats["skipped"] += 1
            else:
                stats["skipped"] += 1
        
        # Fetch players in bulk
        players_map = {p.ID: p for p in Player.objects.filter(ID__in=player_ids)}
        logger.debug(f"Found {len(players_map)} players for {len(valid_rankings)} rankings")
        
        # Process each ranking
        for ranking_data in valid_rankings:
            defaults, fk_ids = prepare_data_for_model(Ranking, ranking_data)
            player_id = fk_ids.get('_PlayerID_from_api')
            
            if not player_id or player_id not in players_map:
                logger.warning(f"Player {player_id} not found for ranking {ranking_data.get('ID')}")
                stats["skipped"] += 1
                continue
            
            player = players_map[player_id]
            
            # Use logical key for lookup
            lookup = {
                'Player': player,
                'Season': defaults.get('Season'),
                'Type': defaults.get('Type')
            }

            # The `update_or_create_item` method handles filtering valid fields,
            # so we can pass the `defaults` dictionary directly.
            
            # Use the class's own robust update_or_create_item method
            instance, created = self.update_or_create_item(Ranking, lookup, defaults)

            if instance:
                stats["created" if created else "updated"] += 1
            else:
                stats["failed"] += 1
        
        logger.info(f"Ranking save summary: {stats}")
        return stats

    def save_matches(self, event_id: int, matches_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """Save matches for a specific event using transaction."""
        if not matches_data:
            logger.info(f"No match data for event {event_id}")
            return {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        logger.info(f"Saving {len(matches_data)} matches for event {event_id}...")
        stats = {"created": 0, "updated": 0, "failed": 0, "skipped": 0}
        
        try:
            event = Event.objects.get(ID=event_id)
        except Event.DoesNotExist:
            logger.error(f"Event {event_id} not found")
            return {"created": 0, "updated": 0, "failed": len(matches_data), "skipped": 0}
        
        # Use transaction for atomicity
        try:
            with transaction.atomic():
                for match_data in matches_data:
                    if not isinstance(match_data, dict):
                        stats["skipped"] += 1
                        continue
                    
                    # Extract logical key components
                    round_val = match_data.get('Round')
                    number_val = match_data.get('Number')
                    
                    if round_val is None or number_val is None:
                        logger.warning(f"Skipping match with missing Round/Number: {match_data}")
                        stats["skipped"] += 1
                        continue
                    
                    try:
                        round_int = int(round_val)
                        number_int = int(number_val)
                    except (ValueError, TypeError):
                        logger.warning(f"Invalid Round/Number values: Round={round_val}, Number={number_val}")
                        stats["skipped"] += 1
                        continue
                    
                    # Prepare match data
                    defaults, _ = prepare_data_for_model(MatchesOfAnEvent, match_data)
                    
                    # Store API match ID
                    api_match_id = match_data.get('ID')
                    if api_match_id:
                        try:
                            defaults['api_match_id'] = int(api_match_id)
                        except (ValueError, TypeError):
                            defaults['api_match_id'] = None
                    
                    # CRITICAL FIX: Validate score consistency to prevent display bugs
                    self._validate_match_score_consistency(defaults, match_data, api_match_id)

                    # Use logical key for lookup
                    lookup = {
                        'Event': event,
                        'Round': round_int,
                        'Number': number_int
                    }

                    # CRITICAL FIX: Check if we should skip this update to prevent data downgrade
                    # Don't overwrite real player data with TBD, or finished matches with upcoming
                    existing_match = MatchesOfAnEvent.objects.filter(**lookup).first()
                    if existing_match and self._should_skip_match_update(existing_match, defaults, api_match_id):
                        stats["skipped"] += 1
                        continue

                    instance, created = self.update_or_create_item(MatchesOfAnEvent, lookup, defaults)
                    if instance:
                        stats["created" if created else "updated"] += 1
                    else:
                        stats["failed"] += 1
        
        except Exception as e:
            logger.error(f"Transaction failed for event {event_id} matches: {e}", exc_info=True)
            stats["failed"] = len(matches_data) - stats["skipped"]
            stats["created"] = 0
            stats["updated"] = 0
        
        logger.info(f"Match save summary for event {event_id}: {stats}")
        return stats
    
    def _validate_match_score_consistency(self, defaults: Dict[str, Any], raw_api_data: Dict[str, Any], api_match_id: Any):
        """
        CRITICAL FIX: Validate that score data is consistent with winner to prevent frontend display bugs.
        
        This addresses the issue where Barry Hawkins appears highlighted as winner but shows losing score.
        """
        try:
            score1 = defaults.get('Score1')
            score2 = defaults.get('Score2') 
            winner_id = defaults.get('WinnerID')
            player1_id = defaults.get('Player1ID')
            player2_id = defaults.get('Player2ID')
            status = defaults.get('Status')
            
            # Only validate finished matches with scores
            if status == 3 and score1 is not None and score2 is not None and winner_id is not None:
                # Determine winner by scores
                score_winner_is_player1 = score1 > score2
                score_winner_is_player2 = score2 > score1
                
                # Determine winner by winner_id field  
                winner_id_is_player1 = winner_id == player1_id
                winner_id_is_player2 = winner_id == player2_id
                
                # Check for inconsistency
                if (score_winner_is_player1 and not winner_id_is_player1) or \
                   (score_winner_is_player2 and not winner_id_is_player2):
                    
                    logger.error(f"🚨 SCORE INCONSISTENCY DETECTED for API Match {api_match_id}:")
                    logger.error(f"   Raw API data: {raw_api_data}")
                    logger.error(f"   Processed defaults: {defaults}")
                    logger.error(f"   Score suggests: P1({player1_id}):{score1} vs P2({player2_id}):{score2}")
                    logger.error(f"   Winner ID suggests: {winner_id}")
                    logger.error(f"   THIS WILL CAUSE FRONTEND DISPLAY BUG!")
                    
                    # POTENTIAL FIX: You could correct the data here, but for now just log
                    # Uncomment the next lines if you want to auto-fix:
                    # if score_winner_is_player1:
                    #     defaults['WinnerID'] = player1_id
                    #     logger.warning(f"   AUTO-CORRECTED: Set winner to Player1 ({player1_id})")
                    # elif score_winner_is_player2:
                    #     defaults['WinnerID'] = player2_id  
                    #     logger.warning(f"   AUTO-CORRECTED: Set winner to Player2 ({player2_id})")
                        
        except Exception as e:
            logger.error(f"Error validating match consistency for API ID {api_match_id}: {e}")

    def _should_skip_match_update(self, existing_match, new_defaults: Dict[str, Any], api_match_id: Any) -> bool:
        """
        CRITICAL FIX: Determine if we should skip updating a match to prevent data downgrade.

        ROOT CAUSE: The Snooker API sometimes returns duplicate matches:
        - Tournament draw with TBD players (Status=0, Player IDs=376)
        - Actual finished matches with real players (Status=3, real Player IDs)

        This causes the frontend to show old TBD matches in the Upcoming section.

        SAFE RULE: Don't overwrite if it would LOSE data:
        1. Existing has REAL players, new has TBD → SKIP
        2. Existing is FINISHED, new is UPCOMING → SKIP
        3. Otherwise → ALLOW UPDATE (normal progression)

        Returns:
            True if update should be skipped, False if update should proceed
        """
        try:
            # Get existing match data
            existing_player1_id = existing_match.Player1ID
            existing_player2_id = existing_match.Player2ID
            existing_status = existing_match.Status

            # Get new match data
            new_player1_id = new_defaults.get('Player1ID')
            new_player2_id = new_defaults.get('Player2ID')
            new_status = new_defaults.get('Status')

            # RULE 1: Don't replace REAL players with TBD (player ID 376)
            # If existing has real players and new has TBD, skip
            existing_has_real_players = (
                existing_player1_id is not None and existing_player1_id != 376 and
                existing_player2_id is not None and existing_player2_id != 376
            )
            new_has_tbd = (new_player1_id == 376 or new_player2_id == 376)

            if existing_has_real_players and new_has_tbd:
                logger.warning(
                    f"⚠️  SKIPPING match update for API ID {api_match_id}: "
                    f"Would replace real players ({existing_player1_id} vs {existing_player2_id}) "
                    f"with TBD players ({new_player1_id} vs {new_player2_id})"
                )
                return True  # SKIP

            # RULE 2: Don't replace FINISHED matches with UPCOMING status
            # Status codes: 0=upcoming, 1=live, 2=on break, 3=finished
            if existing_status == 3 and new_status == 0:
                logger.warning(
                    f"⚠️  SKIPPING match update for API ID {api_match_id}: "
                    f"Would replace finished match (status=3) with upcoming (status=0)"
                )
                return True  # SKIP

            # RULE 3: Don't replace match with scores with 0-0 or None scores
            existing_has_scores = (
                existing_match.Score1 is not None and existing_match.Score2 is not None and
                (existing_match.Score1 > 0 or existing_match.Score2 > 0)
            )
            new_score1 = new_defaults.get('Score1')
            new_score2 = new_defaults.get('Score2')
            new_has_no_scores = (
                new_score1 is None or new_score2 is None or
                (new_score1 == 0 and new_score2 == 0)
            )

            if existing_has_scores and new_has_no_scores:
                logger.warning(
                    f"⚠️  SKIPPING match update for API ID {api_match_id}: "
                    f"Would replace real scores ({existing_match.Score1}-{existing_match.Score2}) "
                    f"with empty scores ({new_score1}-{new_score2})"
                )
                return True  # SKIP

            # All checks passed - ALLOW UPDATE (normal progression)
            return False

        except Exception as e:
            logger.error(f"Error checking if should skip match update for API ID {api_match_id}: {e}")
            # On error, allow update to proceed (fail-safe)
            return False

    def save_round_details(self, event_id: int, round_details_data: List[Dict[str, Any]]) -> Dict[str, int]:
        """
        Save or update round details for a specific event.
        
        Args:
            event_id: The event ID to save round details for
            round_details_data: List of round details dictionaries from API
            
        Returns:
            Dictionary with statistics about the save operation
        """
        stats = {"created": 0, "updated": 0, "skipped": 0, "failed": 0}
        
        if not round_details_data or not isinstance(round_details_data, list):
            logger.warning(f"Invalid round details data for event {event_id}")
            return stats
            
        # Get the event instance
        try:
            event_instance = Event.objects.get(ID=event_id)
        except Event.DoesNotExist:
            logger.error(f"Event {event_id} not found for round details")
            stats["failed"] = len(round_details_data)
            return stats
            
        logger.info(f"Saving {len(round_details_data)} round details for event {event_id}")
        
        try:
            with transaction.atomic():
                for round_data in round_details_data:
                    try:
                        # Prepare data for the model
                        prepared_data, _ = prepare_data_for_model(RoundDetails, round_data)
                        round_number = prepared_data.get('Round')
                        
                        if not round_number:
                            logger.warning(f"No Round number in data: {round_data}")
                            stats["skipped"] += 1
                            continue
                            
                        # Use event instance and round number as lookup
                        lookup_params = {
                            'Event': event_instance,
                            'Round': round_number
                        }
                        
                        # Remove lookup fields from defaults
                        defaults_data = {k: v for k, v in prepared_data.items() 
                                       if k not in ['Event', 'Round']}
                        defaults_data['Event'] = event_instance  # Ensure event is set
                        
                        instance, created = self.update_or_create_item(
                            RoundDetails, lookup_params, defaults_data
                        )
                        
                        if instance:
                            if created:
                                stats["created"] += 1
                                logger.debug(f"Created round details: Event {event_id} Round {round_number}")
                            else:
                                stats["updated"] += 1
                                logger.debug(f"Updated round details: Event {event_id} Round {round_number}")
                        else:
                            stats["failed"] += 1
                            
                    except Exception as e:
                        logger.error(f"Error saving round details for event {event_id}, round {round_data.get('Round')}: {e}")
                        stats["failed"] += 1
        
        except Exception as e:
            logger.error(f"Transaction failed for event {event_id} round details: {e}", exc_info=True)
            stats["failed"] = len(round_details_data) - stats["skipped"]
            stats["created"] = 0
            stats["updated"] = 0
        
        logger.info(f"Round details save summary for event {event_id}: {stats}")
        return stats


# Create shared instance
db_saver = DatabaseSaver()

# Export convenience functions for backward compatibility
save_players = db_saver.save_players
save_events = db_saver.save_events
save_rankings = db_saver.save_rankings
save_matches_of_an_event = db_saver.save_matches
save_round_details = db_saver.save_round_details