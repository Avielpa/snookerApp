# management/commands/update_rankings.py
"""
Django management command to update only player rankings data.
This command is faster than the full populate_db script as it only updates rankings.
Usage: python manage.py update_rankings
"""

import logging
import time
from django.core.management.base import BaseCommand, CommandError

from oneFourSeven.scraper import (
    fetch_current_season,
    fetch_ranking_data,
    save_rankings,
    RT_MONEY_RANKINGS
)
from oneFourSeven.constants import ALL_RANKING_TYPES

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update player rankings data only (faster than full database population)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--season',
            type=int,
            help='Season year to update rankings for (defaults to current season)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )
        parser.add_argument(
            '--ranking-type',
            type=str,
            default='MoneyRankings',
            choices=ALL_RANKING_TYPES + ['all'],
            help='Type of rankings to update (default: MoneyRankings, use "all" for all types)',
        )
        parser.add_argument(
            '--current-season-only',
            action='store_true',
            help='Only update rankings for current season (faster)',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting rankings update...')
        )

        dry_run = options.get('dry_run', False)
        ranking_type = options.get('ranking_type', 'MoneyRankings')
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

            # Determine which ranking types to update
            if ranking_type == 'all':
                ranking_types = ALL_RANKING_TYPES
                self.stdout.write(f'Updating all {len(ranking_types)} ranking types for season {season}...')
            else:
                ranking_types = [ranking_type]
                self.stdout.write(f'Updating {ranking_type} for season {season}...')

            if dry_run:
                self.stdout.write(
                    self.style.WARNING(f'DRY RUN: Would fetch and update {len(ranking_types)} ranking type(s)')
                )
                for rt in ranking_types:
                    self.stdout.write(f'  - {rt}')
                return

            total_records = 0
            successful_types = []
            failed_types = []

            # Process each ranking type
            for i, rt in enumerate(ranking_types):
                self.stdout.write(f'\n[{i+1}/{len(ranking_types)}] Processing {rt}...')
                
                # Add rate limiting between requests (except for first one)
                if i > 0:
                    self.stdout.write('Rate limiting... (6 second delay)')
                    time.sleep(6)
                
                try:
                    # Fetch rankings data
                    self.stdout.write(f'Fetching {rt} data from API...')
                    rankings_data = fetch_ranking_data(season, rt)

                    if rankings_data is None:
                        self.stdout.write(
                            self.style.WARNING(f'Failed to fetch {rt} data')
                        )
                        failed_types.append(rt)
                        continue

                    if not rankings_data:
                        self.stdout.write(
                            self.style.WARNING(f'No {rt} data found for season {season}')
                        )
                        failed_types.append(rt)
                        continue

                    self.stdout.write(f'Fetched {len(rankings_data)} {rt} records')

                    # Save rankings data
                    self.stdout.write(f'Saving {rt} to database...')
                    save_rankings(rankings_data)
                    
                    total_records += len(rankings_data)
                    successful_types.append(f'{rt} ({len(rankings_data)} records)')
                    
                    self.stdout.write(
                        self.style.SUCCESS(f'Successfully updated {rt}')
                    )

                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Failed to update {rt}: {e}')
                    )
                    logger.error(f"Error updating {rt}: {e}", exc_info=True)
                    failed_types.append(rt)

            # Summary
            end_time = time.time()
            duration = end_time - start_time

            self.stdout.write(f'\n=== UPDATE SUMMARY ===')
            self.stdout.write(f'Total records updated: {total_records}')
            self.stdout.write(f'Duration: {duration:.2f} seconds')
            
            if successful_types:
                self.stdout.write(
                    self.style.SUCCESS(f'Successfully updated {len(successful_types)} ranking type(s):')
                )
                for rt in successful_types:
                    self.stdout.write(f'  - {rt}')
            
            if failed_types:
                self.stdout.write(
                    self.style.WARNING(f'Failed to update {len(failed_types)} ranking type(s):')
                )
                for rt in failed_types:
                    self.stdout.write(f'  - {rt}')

            if not successful_types:
                raise CommandError('No ranking types were updated successfully')

        except Exception as e:
            logger.error(f"Error updating rankings: {e}", exc_info=True)
            raise CommandError(f'Rankings update failed: {e}')