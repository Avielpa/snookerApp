# management/commands/update_live_matches.py
"""
Django management command to update live matches for active tournaments.
This script is designed to run frequently (e.g., every 5-15 minutes) to update match statuses.
Usage: python manage.py update_live_matches
"""

import logging
import time
from datetime import date, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from oneFourSeven.scraper import (
    fetch_event_matches_data,
    save_matches_of_an_event
)
from oneFourSeven.models import Event, MatchesOfAnEvent
from oneFourSeven.data_savers import DatabaseSaver

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update live matches for active tournaments (respects 10 requests/minute limit)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-events',
            type=int,
            default=8,
            help='Maximum number of active events to update (default: 8, stays under 10 req/min)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting live matches update...')
        )

        max_events = options.get('max_events', 8)
        dry_run = options.get('dry_run', False)

        try:
            # Find active tournaments (running now or very recently)
            today = date.today()
            yesterday = today - timedelta(days=1)
            tomorrow = today + timedelta(days=1)

            # First, fix any finished tournaments with stuck running matches
            self._fix_finished_tournaments(dry_run)

            active_events = Event.objects.filter(
                StartDate__lte=tomorrow,  # Started by tomorrow
                EndDate__gte=yesterday,   # Ended after yesterday
                # Include all tours for live updates - users want all live matches
            ).order_by('StartDate')[:max_events]

            event_count = active_events.count()
            
            if event_count == 0:
                self.stdout.write(
                    self.style.WARNING('No active tournaments found for live update')
                )
                return

            self.stdout.write(f'Found {event_count} active tournament(s) to update')

            if dry_run:
                for event in active_events:
                    self.stdout.write(f'  Would update: {event.Name} (ID: {event.ID})')
                self.stdout.write(
                    self.style.WARNING('DRY RUN: No changes made')
                )
                return

            # Update matches with rate limiting
            updated_count = 0
            failed_count = 0
            
            for i, event in enumerate(active_events):
                self.stdout.write(f'Updating matches for: {event.Name}')
                
                try:
                    # Rate limiting: 6 seconds between requests (10 per minute)
                    if i > 0:
                        time.sleep(6)
                    
                    self.stdout.write(f'  Fetching matches data...', ending='')
                    
                    # Fetch latest matches with better error reporting
                    matches_data = fetch_event_matches_data(event.ID)
                    
                    if matches_data and isinstance(matches_data, list):
                        with transaction.atomic():
                            save_matches_of_an_event(event.ID, matches_data)
                        
                        updated_count += 1
                        self.stdout.write(
                            f' SUCCESS: Updated {len(matches_data)} matches'
                        )
                        
                        # Show some live match info if available
                        live_matches = [m for m in matches_data if m.get('Status') == 1]
                        if live_matches:
                            self.stdout.write(f'    Found {len(live_matches)} live matches')
                            
                    elif matches_data is None:
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f' FAILED: API returned no data (timeout or empty response)')
                        )
                    else:
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f' FAILED: Invalid data format: {type(matches_data)}')
                        )
                
                except Exception as e:
                    failed_count += 1
                    error_msg = str(e)
                    if 'timeout' in error_msg.lower():
                        self.stdout.write(
                            self.style.ERROR(f' TIMEOUT: API may be slow: {error_msg}')
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(f' ERROR: {error_msg}')
                        )

            # Summary
            self.stdout.write(
                self.style.SUCCESS(
                    f'Live update completed: {updated_count} updated, {failed_count} failed'
                )
            )

        except Exception as e:
            logger.error(f"Error in update_live_matches command: {e}", exc_info=True)
            raise CommandError(f'Failed to update live matches: {e}')

    def _fix_finished_tournaments(self, dry_run=False):
        """Fix matches in tournaments that have ended but still show as running."""
        today = date.today()
        
        # Find finished tournaments with running matches
        problem_events = Event.objects.filter(
            EndDate__lt=today,  # Tournament ended
            matches__Status=1  # Has running matches (STATUS_RUNNING)
        ).distinct()
        
        if not problem_events.exists():
            return
            
        self.stdout.write(f'Found {problem_events.count()} finished tournaments with stuck matches')
        
        total_fixed = 0
        
        for event in problem_events:
            days_ago = (today - event.EndDate).days
            stuck_matches = MatchesOfAnEvent.objects.filter(
                Event=event, 
                Status=1  # STATUS_RUNNING only
            )
            
            self.stdout.write(f'  Fixing {stuck_matches.count()} stuck matches in {event.Name} (ended {days_ago} days ago)')
            
            if not dry_run:
                for match in stuck_matches:
                    # Determine winner based on score
                    if match.Score1 is not None and match.Score2 is not None:
                        if match.Score1 > match.Score2:
                            match.WinnerID = match.Player1ID
                        elif match.Score2 > match.Score1:
                            match.WinnerID = match.Player2ID
                    
                    # Set status to finished
                    match.Status = 2  # STATUS_FINISHED
                    match.Unfinished = False
                    match.OnBreak = False
                    match.save()
                    
                    total_fixed += 1
        
        if total_fixed > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Fixed {total_fixed} stuck matches in finished tournaments')
            )