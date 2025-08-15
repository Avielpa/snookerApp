# management/commands/update_tournaments.py
"""
Django management command to update only tournament/event data.
This command is faster than the full populate_db script as it only updates tournament information.
Usage: python manage.py update_tournaments
"""

import logging
import time
from django.core.management.base import BaseCommand, CommandError

from oneFourSeven.scraper import (
    fetch_current_season,
    fetch_season_events_data,
    save_events,
    TR_MAIN_TOUR
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update tournament/event data only (faster than full database population)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--season',
            type=int,
            help='Season year to update tournaments for (defaults to current season)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--tour',
            type=str,
            default='all',
            help='Tour type to fetch events for (default: all tours). Options: main, seniors, womens, other, amateur, all',
        )
        parser.add_argument(
            '--current-season-only',
            action='store_true',
            help='Update only the current season (faster)',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting tournaments update...')
        )

        dry_run = options.get('dry_run', False)
        tour = options.get('tour', 'all')
        season = options.get('season')
        current_season_only = options.get('current_season_only', False)

        try:
            start_time = time.time()

            # Get current season if not specified
            if not season:
                self.stdout.write('Fetching current season...')
                season = fetch_current_season()
                if not season:
                    raise CommandError('Failed to fetch current season')

            self.stdout.write(f'Updating tournaments for season {season}, tour: {tour}...')

            if dry_run:
                self.stdout.write(
                    self.style.WARNING('DRY RUN: Would fetch and update tournament data')
                )
                return

            # Fetch events data for all tour types if 'all' is specified
            all_events_data = []
            if tour == 'all':
                tour_types = ['main', 'seniors', 'womens', 'other', 'amateur']
                for tour_type in tour_types:
                    self.stdout.write(f'Fetching {tour_type} tour data from API...')
                    events_data = fetch_season_events_data(season, tour_type)
                    if events_data:
                        all_events_data.extend(events_data)
                        self.stdout.write(f'  Found {len(events_data)} {tour_type} events')
                    else:
                        self.stdout.write(f'  No {tour_type} events found')
                    
                    # Add rate limiting between requests
                    if tour_type != tour_types[-1]:  # Don't sleep after last request
                        time.sleep(6)
                
                events_data = all_events_data
            else:
                # Fetch single tour type
                self.stdout.write(f'Fetching {tour} tour data from API...')
                events_data = fetch_season_events_data(season, tour)

            if not events_data:
                self.stdout.write(
                    self.style.WARNING(f'No tournament data found for season {season}')
                )
                return

            self.stdout.write(f'Total fetched: {len(events_data)} tournament records')

            # Apply filters (same as in populate_db.py)
            # Filter to keep only relevant tournament types
            filtered_events = []
            for event in events_data:
                event_type = event.get('Type', '')
                event_name = event.get('Name', '')
                
                # Keep ranking events, qualifying events, and invitational events
                if event_type in ['Ranking', 'Qualifying', 'Invitational','Other', 'Q', 'Seniors', 'Amateur']:
                    # Exclude Championship League Stage events
                    if 'Championship League Stage' not in event_name:
                        filtered_events.append(event)

            self.stdout.write(f'Filtered to {len(filtered_events)} relevant tournaments')

            if not filtered_events:
                self.stdout.write(
                    self.style.WARNING('No relevant tournaments found after filtering')
                )
                return

            # Save events data
            self.stdout.write('Saving tournaments to database...')
            save_events(filtered_events)

            end_time = time.time()
            duration = end_time - start_time

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated {len(filtered_events)} tournament records '
                    f'for season {season} in {duration:.2f} seconds'
                )
            )

        except Exception as e:
            logger.error(f"Error updating tournaments: {e}", exc_info=True)
            raise CommandError(f'Tournaments update failed: {e}')