# management/commands/finish_priority_backfill.py
"""
One-time focused backfill — narrower than fetch_all_data so it can finish
inside this service's execution window (the full fetch_all_data pipeline
was observed to be silently killed partway through, likely a platform
time/resource limit on the one-off container).

Runs only what's still outstanding after the Championship League /
season-boundary bugfixes:
  1. update_matches --empty-only  (backfills the ~40 newly-unblocked
     Championship League sub-events, plus any other empty events)
  2. fetch_ct_centuries            (current-season centuries, now saved
     under the correct season label)

Usage: python manage.py finish_priority_backfill
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'One-time focused backfill: empty-match events + current-season centuries'

    def handle(self, *args, **options):
        self.stdout.write('-> Backfilling events with zero match data...')
        try:
            call_command('update_matches', empty_only=True)
        except Exception as e:
            self.stdout.write(f'   FAILED (empty-only backfill): {e}')

        self.stdout.write('-> Fetching current-season centuries...')
        try:
            call_command('fetch_ct_centuries')
        except Exception as e:
            self.stdout.write(f'   FAILED (fetch_ct_centuries): {e}')

        self.stdout.write('Done — priority backfill complete.')
