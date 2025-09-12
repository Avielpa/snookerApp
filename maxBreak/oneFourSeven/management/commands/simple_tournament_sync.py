# management/commands/simple_tournament_sync.py
"""
SIMPLE TOURNAMENT SYNC - REPLACES auto_live_monitor.py

FIXES ALL ISSUES:
1. English Open Main has no matches - FIXED
2. Player names not syncing - FIXED  
3. Complex logic causing failures - SIMPLIFIED

SIMPLE LOGIC:
- Check tournaments starting in next 14 days
- If tournament has no matches, fetch them
- Update players for all tournaments
- Update matches for active tournaments
- NO COMPLEX TIME CHECKS
- NO HOURLY RESTRICTIONS
- JUST WORKS
"""

import time
import logging
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent, Player

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Simple tournament sync that just works'

    def add_arguments(self, parser):
        parser.add_argument('--force', action='store_true', help='Force update all tournaments')
        parser.add_argument('--check-only', action='store_true', help='Only check, don\'t update')

    def handle(self, *args, **options):
        force = options.get('force', False)
        check_only = options.get('check_only', False)
        
        self.stdout.write('[SIMPLE SYNC] Starting simple tournament sync...')
        
        try:
            current_time = timezone.now()
            today = current_time.date()
            
            # Check tournaments in a WIDER range - from yesterday to 14 days ahead
            start_range = today - timedelta(days=1)
            end_range = today + timedelta(days=14)
            
            self.stdout.write(f'[RANGE] Checking tournaments from {start_range} to {end_range}')
            
            # Get all tournaments in this range
            tournaments = Event.objects.filter(
                StartDate__gte=start_range,
                StartDate__lte=end_range
            ).order_by('StartDate')
            
            self.stdout.write(f'[FOUND] Found {tournaments.count()} tournaments to check')
            
            tournaments_updated = []
            players_updated = set()
            
            # Check each tournament
            for tournament in tournaments:
                self.stdout.write(f'[CHECK] {tournament.Name} (ID: {tournament.ID}) - {tournament.StartDate}')
                
                # Count existing matches
                match_count = MatchesOfAnEvent.objects.filter(Event=tournament).count()
                self.stdout.write(f'[MATCHES] {tournament.Name} has {match_count} matches')
                
                # If no matches OR force update, try to get them
                if match_count == 0 or force:
                    if not check_only:
                        success = self._update_tournament_matches(tournament)
                        if success:
                            tournaments_updated.append(tournament.Name)
                    else:
                        self.stdout.write(f'[CHECK-ONLY] Would update {tournament.Name}')
                        tournaments_updated.append(tournament.Name)
                
                # Check if tournament has started (update matches if active)
                if tournament.StartDate <= today <= tournament.EndDate:
                    self.stdout.write(f'[ACTIVE] {tournament.Name} is currently active')
                    if not check_only:
                        self._update_live_matches(tournament)
                
                # Always try to update players for tournaments starting soon
                days_until_start = (tournament.StartDate - today).days
                if days_until_start <= 7 and not check_only:
                    self._update_tournament_players(tournament, players_updated)
            
            # Summary
            self.stdout.write(f'[SUMMARY] Tournament sync completed:')
            self.stdout.write(f'  - Tournaments checked: {tournaments.count()}')
            self.stdout.write(f'  - Tournaments updated: {len(tournaments_updated)}')
            self.stdout.write(f'  - Player categories updated: {len(players_updated)}')
            
            if tournaments_updated:
                self.stdout.write('[UPDATED] Updated tournaments:')
                for name in tournaments_updated:
                    self.stdout.write(f'  - {name}')
            
        except Exception as e:
            logger.error(f'Simple tournament sync failed: {str(e)}')
            self.stdout.write(f'[ERROR] Failed: {str(e)}')
            raise

    def _update_tournament_matches(self, tournament):
        """Update matches for a specific tournament."""
        try:
            self.stdout.write(f'[UPDATE] Updating matches for {tournament.Name}...')
            
            # Try to update matches
            call_command('update_matches', '--event-id', str(tournament.ID))
            
            # Check if it worked
            new_match_count = MatchesOfAnEvent.objects.filter(Event=tournament).count()
            self.stdout.write(f'[SUCCESS] {tournament.Name} now has {new_match_count} matches')
            
            return new_match_count > 0
            
        except Exception as e:
            self.stdout.write(f'[INFO] Could not update matches for {tournament.Name}: {str(e)}')
            return False

    def _update_live_matches(self, tournament):
        """Update live matches for active tournament."""
        try:
            self.stdout.write(f'[LIVE] Updating live matches for {tournament.Name}...')
            call_command('update_live_matches', '--event-id', str(tournament.ID))
            self.stdout.write(f'[SUCCESS] Updated live matches for {tournament.Name}')
        except Exception as e:
            self.stdout.write(f'[INFO] Could not update live matches for {tournament.Name}: {str(e)}')

    def _update_tournament_players(self, tournament, players_updated):
        """Update players based on tournament type."""
        try:
            # Determine what players to update based on tournament
            if tournament.Tour == 'womens' and 'women' not in players_updated:
                self.stdout.write('[PLAYERS] Updating women players...')
                call_command('update_players', '--sex', 'women', '--status', 'pro')
                players_updated.add('women')
                
            elif tournament.Tour == 'amateur' and 'amateur' not in players_updated:
                self.stdout.write('[PLAYERS] Updating amateur players...')
                call_command('update_players', '--status', 'amateur')
                players_updated.add('amateur')
                
            elif 'men' not in players_updated:
                # Main tour - update professional men
                self.stdout.write('[PLAYERS] Updating men players...')
                call_command('update_players', '--sex', 'men', '--status', 'pro')
                players_updated.add('men')
                
        except Exception as e:
            self.stdout.write(f'[INFO] Could not update players: {str(e)}')