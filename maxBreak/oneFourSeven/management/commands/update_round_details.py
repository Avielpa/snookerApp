# management/commands/update_round_details.py
"""
Django management command to fetch and save round details for tournaments.
This command fetches Distance and other round format information from the snooker.org API.
Usage: python manage.py update_round_details [--event-id EVENT_ID] [--season SEASON] [--dry-run]
"""

import logging
import time
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from oneFourSeven.scraper import (
    fetch_round_details_data,
    save_round_details,
    fetch_current_season
)
from oneFourSeven.models import Event

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fetch and save round details (Distance info) for tournaments'

    def add_arguments(self, parser):
        parser.add_argument(
            '--event-id',
            type=int,
            help='Update round details for specific event ID only',
        )
        parser.add_argument(
            '--season',
            type=int,
            help='Update round details for specific season only',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=10,
            help='Maximum number of events to process (default: 10)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting round details update...')
        )

        event_id = options.get('event_id')
        season = options.get('season')
        limit = options.get('limit', 10)
        dry_run = options.get('dry_run', False)

        try:
            if event_id:
                # Update specific event
                events_to_process = Event.objects.filter(ID=event_id)
                if not events_to_process.exists():
                    raise CommandError(f'Event with ID {event_id} not found')
            else:
                # Get current season if not specified
                if not season:
                    season = fetch_current_season()
                    if not season:
                        raise CommandError('Could not determine current season')
                
                self.stdout.write(f'Processing events for season {season}')
                
                # Get events for the season, prioritize recent ones
                events_to_process = Event.objects.filter(
                    Season=season
                ).order_by('-StartDate')[:limit]

            event_count = events_to_process.count()
            
            if event_count == 0:
                self.stdout.write(
                    self.style.WARNING('No events found to process')
                )
                return

            self.stdout.write(f'Found {event_count} event(s) to process')

            if dry_run:
                for event in events_to_process:
                    self.stdout.write(f'  Would update round details for: {event.Name} (ID: {event.ID})')
                self.stdout.write(
                    self.style.WARNING('DRY RUN: No changes made')
                )
                return

            # Process events with rate limiting
            updated_count = 0
            failed_count = 0
            
            for i, event in enumerate(events_to_process):
                self.stdout.write(f'Processing round details for: {event.Name}')
                
                try:
                    # Rate limiting: 6 seconds between requests (10 per minute)
                    if i > 0:
                        time.sleep(6)
                    
                    # Fetch round details
                    round_details_data = fetch_round_details_data(event.ID, event.Season or season)
                    
                    if round_details_data and isinstance(round_details_data, list):
                        with transaction.atomic():
                            stats = save_round_details(event.ID, round_details_data)
                        
                        updated_count += 1
                        self.stdout.write(
                            f'  + Saved {len(round_details_data)} round details '
                            f'(Created: {stats["created"]}, Updated: {stats["updated"]})'
                        )
                    else:
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f'  - Failed to fetch round details')
                        )
                
                except Exception as e:
                    failed_count += 1
                    self.stdout.write(
                        self.style.ERROR(f'  - Error processing {event.Name}: {e}')
                    )

            # Summary
            self.stdout.write(
                self.style.SUCCESS(
                    f'Round details update completed: {updated_count} updated, {failed_count} failed'
                )
            )

        except Exception as e:
            logger.error(f"Error in update_round_details command: {e}", exc_info=True)
            raise CommandError(f'Failed to update round details: {e}')