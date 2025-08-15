# management/commands/update_players.py
"""
Django management command to update only player data.
This command is faster than the full populate_db script as it only updates player information.
Usage: python manage.py update_players
"""

import logging
import time
from django.core.management.base import BaseCommand, CommandError

from oneFourSeven.scraper import (
    fetch_current_season,
    fetch_players_data,
    save_players,
    ST_PLAYER_PRO,
    ST_PLAYER_AMATEUR,
    SE_PLAYER_MEN,
    SE_PLAYER_WOMEN
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update player data only (faster than full database population)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--season',
            type=int,
            help='Season year to update players for (defaults to current season)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--status',
            type=str,
            choices=['pro', 'amateur', 'all'],
            default='all',
            help='Player status to update (default: all)',
        )
        parser.add_argument(
            '--sex',
            type=str,
            choices=['men', 'women', 'all'],
            default='all',
            help='Player gender to update (default: all)',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting players update...')
        )

        dry_run = options.get('dry_run', False)
        status_filter = options.get('status', 'all')
        sex_filter = options.get('sex', 'all')
        season = options.get('season')

        try:
            start_time = time.time()

            # Get current season if not specified
            if not season:
                self.stdout.write('Fetching current season...')
                season = fetch_current_season()
                if not season:
                    raise CommandError('Failed to fetch current season')

            self.stdout.write(f'Updating players for season {season}...')

            if dry_run:
                self.stdout.write(
                    self.style.WARNING('DRY RUN: Would fetch and update player data')
                )
                return

            # Define player categories to fetch
            categories = []
            
            if status_filter in ['pro', 'all']:
                if sex_filter in ['men', 'all']:
                    categories.append(('Professional Men', ST_PLAYER_PRO, SE_PLAYER_MEN))
                if sex_filter in ['women', 'all']:
                    categories.append(('Professional Women', ST_PLAYER_PRO, SE_PLAYER_WOMEN))
            
            if status_filter in ['amateur', 'all']:
                if sex_filter in ['men', 'all']:
                    categories.append(('Amateur Men', ST_PLAYER_AMATEUR, SE_PLAYER_MEN))
                if sex_filter in ['women', 'all']:
                    categories.append(('Amateur Women', ST_PLAYER_AMATEUR, SE_PLAYER_WOMEN))

            all_players = []
            total_fetched = 0

            # Fetch players for each category
            for category_name, status, sex in categories:
                self.stdout.write(f'Fetching {category_name}...')
                
                # Add rate limiting between requests
                if total_fetched > 0:
                    time.sleep(6)  # Respect 10 requests/minute limit
                
                players_data = fetch_players_data(season, status, sex)
                
                if players_data is None:
                    self.stdout.write(
                        self.style.WARNING(f'Failed to fetch {category_name}')
                    )
                    continue
                
                if players_data:
                    all_players.extend(players_data)
                    self.stdout.write(f'Fetched {len(players_data)} {category_name}')
                    total_fetched += 1
                else:
                    self.stdout.write(f'No {category_name} found')

            if not all_players:
                self.stdout.write(
                    self.style.WARNING('No player data found to update')
                )
                return

            self.stdout.write(f'Total players fetched: {len(all_players)}')

            # Save players data
            self.stdout.write('Saving players to database...')
            save_players(all_players)

            end_time = time.time()
            duration = end_time - start_time

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated {len(all_players)} player records '
                    f'for season {season} in {duration:.2f} seconds'
                )
            )

        except Exception as e:
            logger.error(f"Error updating players: {e}", exc_info=True)
            raise CommandError(f'Players update failed: {e}')