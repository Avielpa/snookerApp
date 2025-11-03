# management/commands/cleanup_duplicate_matches.py
"""
One-time cleanup command to fix existing duplicate match data in database.

PROBLEM: Before the fix, TBD matches overwrote real match data.
This command finds and fixes those bad records.

Usage: python manage.py cleanup_duplicate_matches --dry-run
       python manage.py cleanup_duplicate_matches  # Actually fix them
"""

import logging
from django.core.management.base import BaseCommand
from django.db.models import Q
from oneFourSeven.models import MatchesOfAnEvent
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean up duplicate/bad match data (TBD matches with past dates in upcoming status)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be fixed without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        self.stdout.write('[CLEANUP] Starting duplicate match cleanup...')

        if dry_run:
            self.stdout.write('[DRY RUN] No changes will be made')

        # Find problematic matches:
        # 1. Status = 0 (upcoming) but date is in the past
        # 2. Has TBD players (ID 376)

        cutoff_date = datetime.now() - timedelta(hours=6)  # 6 hour buffer for timezone

        bad_matches = MatchesOfAnEvent.objects.filter(
            Q(Status=0) &  # Upcoming status
            Q(ScheduledDate__lt=cutoff_date) &  # But date is past
            (Q(Player1ID=376) | Q(Player2ID=376))  # And has TBD players
        )

        count = bad_matches.count()
        self.stdout.write(f'[FOUND] {count} problematic matches (TBD with past dates in upcoming status)')

        if count == 0:
            self.stdout.write('[SUCCESS] No problematic matches found - database is clean!')
            return

        # Show details
        for match in bad_matches[:10]:  # Show first 10
            self.stdout.write(
                f'  Match ID {match.id}: Event={match.Event.Name}, '
                f'Round={match.Round}, Number={match.Number}, '
                f'Date={match.ScheduledDate}, '
                f'P1={match.Player1ID}, P2={match.Player2ID}, '
                f'Status={match.Status}'
            )

        if count > 10:
            self.stdout.write(f'  ... and {count - 10} more')

        if not dry_run:
            # FIX: Change status to 3 (finished) so they go to Results section
            # This is safer than deleting them
            updated = bad_matches.update(Status=3)
            self.stdout.write(f'[FIXED] Updated {updated} matches from Status=0 to Status=3')
            self.stdout.write('[SUCCESS] These matches will now appear in Results section instead of Upcoming')
        else:
            self.stdout.write(f'[DRY RUN] Would update {count} matches from Status=0 to Status=3')

        # Also check for matches with real players that somehow have status=0 and past dates
        old_unfinished = MatchesOfAnEvent.objects.filter(
            Q(Status=0) &  # Upcoming status
            Q(ScheduledDate__lt=cutoff_date) &  # Past date
            ~Q(Player1ID=376) & ~Q(Player2ID=376)  # Real players (not TBD)
        )

        real_count = old_unfinished.count()
        if real_count > 0:
            self.stdout.write(f'[FOUND] {real_count} additional old matches with real players but status=0')

            if not dry_run:
                updated_real = old_unfinished.update(Status=3)
                self.stdout.write(f'[FIXED] Updated {updated_real} real player matches to Status=3')
            else:
                self.stdout.write(f'[DRY RUN] Would update {real_count} real player matches to Status=3')

        self.stdout.write('[COMPLETE] Cleanup finished!')
