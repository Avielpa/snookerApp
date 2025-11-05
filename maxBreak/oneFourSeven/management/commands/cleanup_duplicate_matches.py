# management/commands/cleanup_duplicate_matches.py
"""
One-time cleanup command to fix existing duplicate match data in database.

PROBLEM: Before the fix, TBD matches overwrote real match data OR created duplicates.
This command finds and fixes those bad records.

Usage: python manage.py cleanup_duplicate_matches --dry-run
       python manage.py cleanup_duplicate_matches  # Actually fix them
"""

import logging
from django.core.management.base import BaseCommand
from django.db.models import Q, Count
from oneFourSeven.models import MatchesOfAnEvent
from datetime import datetime, timedelta
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean up duplicate/bad match data (TBD matches in Results, duplicates with same Event/Round/Number)'

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

        total_deleted = 0
        total_updated = 0

        # ============================================================
        # STEP 1: Find and DELETE duplicate finished matches (same Event/Round/Number)
        # Keep the one with REAL players, delete the TBD one
        # ============================================================

        self.stdout.write('\n[STEP 1] Finding duplicate finished matches in Results tab...')

        # Find all matches grouped by (Event, Round, Number) with count > 1
        duplicates = MatchesOfAnEvent.objects.values('Event', 'Round', 'Number').annotate(
            count=Count('id')
        ).filter(count__gt=1)

        duplicate_count = duplicates.count()
        self.stdout.write(f'[FOUND] {duplicate_count} sets of duplicate matches (same Event/Round/Number)')

        for dup_group in duplicates:
            event_id = dup_group['Event']
            round_num = dup_group['Round']
            number = dup_group['Number']

            # Get all matches in this duplicate group
            matches = MatchesOfAnEvent.objects.filter(
                Event_id=event_id,
                Round=round_num,
                Number=number
            ).order_by('id')

            # Separate into real and TBD matches
            real_matches = []
            tbd_matches = []

            for match in matches:
                if match.Player1ID == 376 or match.Player2ID == 376:
                    tbd_matches.append(match)
                else:
                    real_matches.append(match)

            # Decision logic
            if len(real_matches) > 0 and len(tbd_matches) > 0:
                # We have both real and TBD - DELETE the TBD ones
                self.stdout.write(
                    f'  Event {event_id}, Round {round_num}, Number {number}: '
                    f'{len(real_matches)} real + {len(tbd_matches)} TBD → Deleting TBD'
                )

                if not dry_run:
                    for tbd_match in tbd_matches:
                        tbd_match.delete()
                        total_deleted += 1
                else:
                    total_deleted += len(tbd_matches)

            elif len(real_matches) > 1:
                # Multiple real matches - keep the latest updated, delete others
                self.stdout.write(
                    f'  Event {event_id}, Round {round_num}, Number {number}: '
                    f'{len(real_matches)} real matches → Keeping 1, deleting {len(real_matches)-1}'
                )

                if not dry_run:
                    # Keep the first, delete the rest
                    for match in real_matches[1:]:
                        match.delete()
                        total_deleted += 1
                else:
                    total_deleted += len(real_matches) - 1

            elif len(tbd_matches) > 1:
                # Multiple TBD matches - keep one, delete others
                self.stdout.write(
                    f'  Event {event_id}, Round {round_num}, Number {number}: '
                    f'{len(tbd_matches)} TBD matches → Keeping 1, deleting {len(tbd_matches)-1}'
                )

                if not dry_run:
                    for match in tbd_matches[1:]:
                        match.delete()
                        total_deleted += 1
                else:
                    total_deleted += len(tbd_matches) - 1

        # ============================================================
        # STEP 2: Find TBD matches in FINISHED status (shouldn't exist in Results)
        # DELETE them (they're garbage data)
        # ============================================================

        self.stdout.write('\n[STEP 2] Finding TBD matches with finished status (garbage in Results)...')

        tbd_finished = MatchesOfAnEvent.objects.filter(
            Q(Status=3) &  # Finished status
            (Q(Player1ID=376) | Q(Player2ID=376))  # Has TBD players
        )

        tbd_finished_count = tbd_finished.count()
        self.stdout.write(f'[FOUND] {tbd_finished_count} TBD matches with finished status (garbage)')

        if tbd_finished_count > 0:
            # Show details
            for match in tbd_finished[:10]:
                self.stdout.write(
                    f'  Match ID {match.id}: Event={match.Event.Name}, '
                    f'Round={match.Round}, Number={match.Number}, '
                    f'P1={match.Player1ID}, P2={match.Player2ID}'
                )

            if tbd_finished_count > 10:
                self.stdout.write(f'  ... and {tbd_finished_count - 10} more')

            if not dry_run:
                deleted = tbd_finished.delete()[0]
                self.stdout.write(f'[DELETED] {deleted} TBD matches from Results')
                total_deleted += deleted
            else:
                total_deleted += tbd_finished_count

        # ============================================================
        # STEP 3: Old TBD matches in Upcoming (from previous cleanup)
        # Move to finished status
        # ============================================================

        self.stdout.write('\n[STEP 3] Finding old TBD matches in Upcoming...')

        cutoff_date = datetime.now() - timedelta(hours=6)

        bad_matches = MatchesOfAnEvent.objects.filter(
            Q(Status=0) &  # Upcoming status
            Q(ScheduledDate__lt=cutoff_date) &  # But date is past
            (Q(Player1ID=376) | Q(Player2ID=376))  # And has TBD players
        )

        count = bad_matches.count()
        self.stdout.write(f'[FOUND] {count} old TBD matches in Upcoming')

        if count > 0:
            if not dry_run:
                updated = bad_matches.update(Status=3)
                self.stdout.write(f'[UPDATED] {updated} matches to finished status')
                total_updated += updated
            else:
                total_updated += count

        # ============================================================
        # SUMMARY
        # ============================================================

        self.stdout.write('\n[SUMMARY]')
        self.stdout.write(f'  Deleted: {total_deleted} matches')
        self.stdout.write(f'  Updated: {total_updated} matches')

        if dry_run:
            self.stdout.write('[DRY RUN] No changes were made - run without --dry-run to apply fixes')
        else:
            self.stdout.write('[SUCCESS] Cleanup complete!')

        self.stdout.write('[COMPLETE] Duplicate cleanup finished!')
