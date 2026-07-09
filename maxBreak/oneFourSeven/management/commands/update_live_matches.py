# management/commands/update_live_matches.py
"""
Django management command to update live matches for active tournaments.
This script is designed to run frequently (e.g., every 5-15 minutes) to update match statuses.
Usage: python manage.py update_live_matches
"""

import logging
import time
from datetime import date, timedelta
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone as dj_timezone

from oneFourSeven.scraper import (
    fetch_event_matches_data,
    save_matches_of_an_event
)
from oneFourSeven.models import Event, MatchesOfAnEvent
from oneFourSeven.data_savers import DatabaseSaver
from oneFourSeven.constants import MIN_REQUEST_INTERVAL

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Update live matches for active tournaments (respects 10 requests/minute limit)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--max-events',
            type=int,
            default=8,
            help='Maximum number of active events to update (default: 8, stays under 10 req/min)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        self.stdout.write(
            self.style.SUCCESS('Starting live matches update...')
        )

        max_events = options.get('max_events', 8)
        dry_run = options.get('dry_run', False)

        try:
            # Find active tournaments (running now or very recently)
            today = date.today()
            yesterday = today - timedelta(days=1)
            tomorrow = today + timedelta(days=1)

            # First, fix any finished tournaments with stuck running matches
            # Grace period of 3 days so qualifiers running past their EndDate aren't wrongly closed
            self._fix_finished_tournaments(dry_run)

            # Championship League runs ~40 sub-events that all share the exact
            # same StartDate/EndDate (the whole Stage span), so ordering by
            # StartDate alone can't break the tie -- the same first N events
            # would get checked every cycle forever, starving the rest. Instead
            # prioritize events that actually have a match due right now
            # (unfinished status, scheduled time already passed) ahead of ones
            # with nothing urgent.
            now = dj_timezone.now()
            active_events = Event.objects.filter(
                StartDate__lte=tomorrow,  # Started by tomorrow
                EndDate__gte=yesterday,   # Ended after yesterday
            ).annotate(
                due_now=Count(
                    'matches',
                    filter=Q(matches__Status__in=[0, 1, 2], matches__ScheduledDate__lte=now),
                )
            ).order_by('-due_now', 'StartDate')

            active_event_ids = set(active_events.values_list('ID', flat=True))

            # Also include past events (up to 60 days) that still have unfinished matches
            # e.g. qualifiers whose EndDate passed but matches are still running
            past_with_unfinished = Event.objects.filter(
                EndDate__lt=yesterday,
                EndDate__gte=today - timedelta(days=60),
                matches__Status__in=[0, 1, 2],
            ).distinct().exclude(ID__in=active_event_ids)

            all_events = list(active_events) + list(past_with_unfinished)
            all_events = all_events[:max_events]

            event_count = len(all_events)

            if event_count == 0:
                self.stdout.write(
                    self.style.WARNING('No active tournaments found for live update')
                )
                return

            self.stdout.write(f'Found {event_count} active tournament(s) to update')

            if dry_run:
                for event in all_events:
                    self.stdout.write(f'  Would update: {event.Name} (ID: {event.ID})')
                self.stdout.write(
                    self.style.WARNING('DRY RUN: No changes made')
                )
                return

            # Update matches with rate limiting
            updated_count = 0
            failed_count = 0

            for i, event in enumerate(all_events):
                self.stdout.write(f'Updating matches for: {event.Name}')
                
                try:
                    # Rate limiting: 6 seconds between requests (10 per minute)
                    if i > 0:
                        time.sleep(MIN_REQUEST_INTERVAL)  # Respect snooker.org's 2 requests/minute limit
                    
                    self.stdout.write(f'  Fetching matches data...', ending='')
                    
                    # Fetch latest matches with better error reporting
                    matches_data = fetch_event_matches_data(event.ID)
                    
                    if matches_data and isinstance(matches_data, list):
                        with transaction.atomic():
                            save_matches_of_an_event(event.ID, matches_data)
                        
                        updated_count += 1
                        self.stdout.write(
                            f' SUCCESS: Updated {len(matches_data)} matches'
                        )
                        
                        # Show some live match info if available
                        live_matches = [m for m in matches_data if m.get('Status') == 1]
                        if live_matches:
                            self.stdout.write(f'    Found {len(live_matches)} live matches')
                            
                    elif matches_data is None:
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f' FAILED: API returned no data (timeout or empty response)')
                        )
                    else:
                        failed_count += 1
                        self.stdout.write(
                            self.style.WARNING(f' FAILED: Invalid data format: {type(matches_data)}')
                        )
                
                except Exception as e:
                    failed_count += 1
                    error_msg = str(e)
                    if 'timeout' in error_msg.lower():
                        self.stdout.write(
                            self.style.ERROR(f' TIMEOUT: API may be slow: {error_msg}')
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(f' ERROR: {error_msg}')
                        )

            # After updating matches, save any player IDs not yet in our DB
            self._save_missing_players(all_events)

            # Summary
            self.stdout.write(
                self.style.SUCCESS(
                    f'Live update completed: {updated_count} updated, {failed_count} failed'
                )
            )

        except Exception as e:
            logger.error(f"Error in update_live_matches command: {e}", exc_info=True)
            raise CommandError(f'Failed to update live matches: {e}')

    def _save_missing_players(self, events):
        """Fetch and save any player IDs from these events that aren't in our DB yet."""
        from oneFourSeven.models import Player
        import requests

        # Collect all player IDs referenced in these events' matches
        match_player_ids = set(
            MatchesOfAnEvent.objects.filter(Event__in=events)
            .values_list('Player1ID', 'Player2ID')
            .distinct()
        )
        flat_ids = {pid for pair in match_player_ids for pid in pair if pid}

        # Find which ones are missing
        existing_ids = set(Player.objects.filter(ID__in=flat_ids).values_list('ID', flat=True))
        missing_ids = flat_ids - existing_ids

        if not missing_ids:
            return

        self.stdout.write(f'[PLAYERS] Saving {len(missing_ids)} missing player(s): {missing_ids}')

        for pid in missing_ids:
            try:
                time.sleep(30)  # Respect 2 req/min limit
                resp = requests.get(
                    f'https://api.snooker.org/?t=4&p={pid}',
                    headers={'X-Requested-By': 'FahimaApp128'},
                    timeout=10
                )
                if resp.status_code != 200:
                    self.stdout.write(f'  [SKIP] Player {pid}: HTTP {resp.status_code}')
                    continue
                data = resp.json()
                pdata = data[0] if isinstance(data, list) and data else data
                if not pdata or pdata.get('ID') != pid:
                    self.stdout.write(f'  [SKIP] Player {pid}: unexpected response')
                    continue
                Player.objects.get_or_create(
                    ID=pid,
                    defaults={
                        'FirstName': pdata.get('FirstName') or '',
                        'MiddleName': pdata.get('MiddleName') or '',
                        'LastName': pdata.get('LastName') or '',
                        'ShortName': pdata.get('ShortName') or '',
                        'Nationality': pdata.get('Nationality') or '',
                        'Sex': pdata.get('Sex') or '',
                        'Type': pdata.get('Type'),
                    }
                )
                name = ' '.join(filter(None, [pdata.get('FirstName'), pdata.get('LastName')]))
                self.stdout.write(f'  [OK] Saved player {pid}: {name}')
            except Exception as e:
                self.stdout.write(f'  [WARN] Could not save player {pid}: {e}')

    def _fix_finished_tournaments(self, dry_run=False):
        """Fix matches in tournaments that have ended but still show as running."""
        today = date.today()
        
        # Find finished tournaments with running matches
        # Use a 3-day grace period so qualifiers running past their EndDate aren't wrongly closed
        grace_cutoff = today - timedelta(days=3)
        problem_events = Event.objects.filter(
            EndDate__lt=grace_cutoff,  # Tournament ended more than 3 days ago
            matches__Status=1  # Has running matches (STATUS_RUNNING)
        ).distinct()
        
        if not problem_events.exists():
            return
            
        self.stdout.write(f'Found {problem_events.count()} finished tournaments with stuck matches')
        
        total_fixed = 0
        
        for event in problem_events:
            days_ago = (today - event.EndDate).days
            stuck_matches = MatchesOfAnEvent.objects.filter(
                Event=event, 
                Status=1  # STATUS_RUNNING only
            )
            
            self.stdout.write(f'  Fixing {stuck_matches.count()} stuck matches in {event.Name} (ended {days_ago} days ago)')
            
            if not dry_run:
                for match in stuck_matches:
                    # Determine winner based on score
                    if match.Score1 is not None and match.Score2 is not None:
                        if match.Score1 > match.Score2:
                            match.WinnerID = match.Player1ID
                        elif match.Score2 > match.Score1:
                            match.WinnerID = match.Player2ID
                    
                    # Set status to finished
                    match.Status = 2  # STATUS_FINISHED
                    match.Unfinished = False
                    match.OnBreak = False
                    match.save()
                    
                    total_fixed += 1
        
        if total_fixed > 0:
            self.stdout.write(
                self.style.SUCCESS(f'Fixed {total_fixed} stuck matches in finished tournaments')
            )