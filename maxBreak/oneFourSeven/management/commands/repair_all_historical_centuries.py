# management/commands/repair_all_historical_centuries.py
"""
One-time repair for CenturyRecord across every season in the app's Stats
dropdown (2018-19 through last season). Re-scrapes CueTracker's dedicated
per-season historical page for each, same technique as
repair_2025_26_centuries but generalized to the full range.

Fast: CueTracker's historical pages aren't behind the snooker.org rate
limit, so this only needs a short courtesy delay between requests.

Usage: python manage.py repair_all_historical_centuries
       python manage.py repair_all_historical_centuries --from-year 2018 --to-year 2024
"""

import time
from django.core.management.base import BaseCommand
from django.core.management import call_command

from oneFourSeven.constants import current_season_int

COURTESY_DELAY = 3  # seconds between CueTracker requests


class Command(BaseCommand):
    help = 'One-time repair of historical CenturyRecord data for every season in the Stats dropdown'

    def add_arguments(self, parser):
        parser.add_argument('--from-year', type=int, default=2018,
                             help='First season start-year to repair (default: 2018)')
        parser.add_argument('--to-year', type=int, default=None,
                             help='Last season start-year to repair (default: last completed season)')

    def handle(self, *args, **options):
        from_year = options['from_year']
        to_year = options['to_year'] or (current_season_int() - 1)

        years = list(range(from_year, to_year + 1))
        self.stdout.write(f'Repairing {len(years)} season(s): {years[0]}-{years[-1]}')

        for i, year in enumerate(years):
            season_label = f'{year}-{str(year + 1)[2:]}'
            url = f'https://cuetracker.net/statistics/centuries/most-made/season/{year}-{year + 1}'
            self.stdout.write(f'-> Season {season_label}...')
            try:
                call_command('fetch_ct_centuries', url=url, season=season_label)
            except Exception as e:
                self.stdout.write(f'   FAILED ({season_label}): {e}')

            if i < len(years) - 1:
                time.sleep(COURTESY_DELAY)

        self.stdout.write('Done — all historical seasons repaired.')
