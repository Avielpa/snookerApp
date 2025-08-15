# management/commands/update_matches.py
"""
Django management command to update match data for specific tournaments.
This command is faster than the full populate_db script as it only updates match data.
Usage: python manage.py update_matches --event-id 2336
"""

import logging
import time
from django.core.management.base import BaseCommand, CommandError

from oneFourSeven.scraper import (
    fetch_event_matches_data,
    save_matches_of_an_event
)
from oneFourSeven.models import Event

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update match data for specific tournaments (faster than full database population)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--event-id',
            type=int,
            help='Specific event ID to update matches for',
        )
        parser.add_argument(
            '--active-only',
            action='store_true',
            help='Update matches for all currently active tournaments',
        )
        parser.add_argument(
            '--all-current',
            action='store_true',
            help='Update matches for all tournaments in current season',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--max-events',
            type=int,
            default=10,
            help='Maximum number of events to update when using --all-current (default: 10)',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting matches update...')
        )

        dry_run = options.get('dry_run', False)
        event_id = options.get('event_id')
        active_only = options.get('active_only', False)
        all_current = options.get('all_current', False)
        max_events = options.get('max_events', 10)

        try:
            start_time = time.time()
            events_to_update = []

            if event_id:
                # Update specific event
                try:
                    event = Event.objects.get(ID=event_id)
                    events_to_update = [event]
                    self.stdout.write(f'Updating matches for event: {event.Name} (ID: {event_id})')
                except Event.DoesNotExist:
                    raise CommandError(f'Event with ID {event_id} not found in database')

            elif active_only:
                # Update all active events
                from datetime import date
                today = date.today()
                
                events_to_update = list(
                    Event.objects.filter(
                        StartDate__lte=today,
                        EndDate__gte=today
                    ).order_by('StartDate')[:max_events]
                )
                
                self.stdout.write(f'Found {len(events_to_update)} active tournament(s) to update')

            elif all_current:
                # Update all events in current season
                from datetime import date
                current_year = date.today().year
                
                events_to_update = list(
                    Event.objects.filter(
                        Season=current_year,
                        Type__in=['Ranking', 'Qualifying', 'Invitational']
                    ).exclude(
                        Name__icontains='Championship League Stage'
                    ).order_by('StartDate')[:max_events]
                )
                
                self.stdout.write(f'Found {len(events_to_update)} tournament(s) in current season to update')

            else:
                raise CommandError(
                    'Must specify one of: --event-id, --active-only, or --all-current'
                )

            if not events_to_update:
                self.stdout.write(
                    self.style.WARNING('No tournaments found to update')
                )
                return

            if dry_run:
                for event in events_to_update:
                    self.stdout.write(f'  Would update: {event.Name} (ID: {event.ID})')
                self.stdout.write(
                    self.style.WARNING('DRY RUN: No changes made')
                )
                return

            # Update matches for each event
            updated_count = 0
            failed_count = 0

            for i, event in enumerate(events_to_update):
                self.stdout.write(f'Updating matches for: {event.Name} (ID: {event.ID})')
                
                # Add rate limiting between requests (except for first request)
                if i > 0:
                    time.sleep(6)  # Respect 10 requests/minute limit
                
                try:
                    matches_data = fetch_event_matches_data(event.ID)
                    
                    if matches_data is None:
                        self.stdout.write(
                            self.style.WARNING(f'Failed to fetch matches for event {event.ID}')
                        )
                        failed_count += 1
                        continue
                    
                    if not matches_data:
                        self.stdout.write(f'No matches found for event {event.ID}')
                        continue
                    
                    # Save matches
                    save_matches_of_an_event(event.ID, matches_data)
                    self.stdout.write(f'Updated {len(matches_data)} matches for event {event.ID}')
                    updated_count += 1
                    
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error updating event {event.ID}: {e}')
                    )
                    failed_count += 1

            end_time = time.time()
            duration = end_time - start_time

            self.stdout.write(
                self.style.SUCCESS(
                    f'Match update completed in {duration:.2f} seconds. '
                    f'Updated: {updated_count}, Failed: {failed_count}'
                )
            )

        except Exception as e:
            logger.error(f"Error updating matches: {e}", exc_info=True)
            raise CommandError(f'Matches update failed: {e}')