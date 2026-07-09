# management/commands/fetch_all_data.py
"""
On-demand full data refresh — fetches everything the app pulls from
snooker.org and CueTracker, in one command. Safe to re-run anytime;
every step is an idempotent read-and-upsert sync, not destructive.

Usage: python manage.py fetch_all_data
"""

import time
from django.core.management.base import BaseCommand
from django.core.management import call_command

from oneFourSeven.scraper import fetch_current_season
from oneFourSeven.constants import MIN_REQUEST_INTERVAL


class Command(BaseCommand):
    help = 'On-demand full data refresh from snooker.org and CueTracker'

    def handle(self, *args, **options):
        self.stdout.write('Fetching all data...')

        steps = []

        current_season = fetch_current_season()
        if current_season:
            self.stdout.write(f'Current season: {current_season}')
            steps.append(('Tournaments (current season)', 'update_tournaments', {'season': current_season}))
            steps.append(('Tournaments (next season)', 'update_tournaments', {'season': current_season + 1}))
        else:
            self.stdout.write('Could not determine current season — falling back to auto-detect')
            steps.append(('Tournaments (auto-detected)', 'update_tournaments', {}))

        steps += [
            ('Players (pro men)', 'update_players', {'status': 'pro', 'sex': 'men'}),
            ('Players (pro women)', 'update_players', {'status': 'pro', 'sex': 'women'}),
            ('Rankings (current season)', 'update_rankings', {'current_season_only': True}),
            ('Recent matches', 'daily_matches_update', {}),
            ('Backfill events with zero match data', 'update_matches', {'empty_only': True}),
            ('Round details', 'daily_rounds_update', {}),
            ('Other tours (Women/Seniors/Q-Tour)', 'sync_other_tours', {}),
            ('CueTracker career history', 'sync_career_history', {}),
            ('CueTracker centuries', 'fetch_ct_centuries', {}),
            ('Century leaderboard', 'scrape_century_stats', {}),
            ('Per-frame scores', 'fetch_frame_scores', {}),
        ]

        for label, command_name, kwargs in steps:
            self.stdout.write(f'-> {label}...')
            try:
                call_command(command_name, verbosity=0, **kwargs)
            except Exception as e:
                self.stdout.write(f'   FAILED ({label}): {e}')
            time.sleep(MIN_REQUEST_INTERVAL)  # Respect snooker.org's 2 requests/minute limit between steps

        self.stdout.write('Done — all data fetched.')
