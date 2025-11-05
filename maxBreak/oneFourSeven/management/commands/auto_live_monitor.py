# management/commands/auto_live_monitor.py
"""
AUTOMATIC LIVE MATCH MONITOR
This is the ULTIMATE solution for automatic live match updates and tournament management.

WHAT IT SOLVES:
- Matches not updating automatically during tournaments
- Users having to manually run update commands
- Live scores not being available in real-time
- Rankings not updating after tournaments end
- Players not being updated after tournaments

HOW IT WORKS:
1. Runs continuously in background
2. Monitors ALL active tournaments (not just main tour)
3. Updates every 2 minutes during active matches
4. Smart scheduling - sleeps when no active tournaments
5. Auto-restart on errors with exponential backoff
6. TOURNAMENT END DETECTION: Automatically updates all ranking types and players when tournaments finish
7. Prevents duplicate updates with smart tracking

NEW FEATURES:
- Automatic ranking updates when tournaments end (all types: MoneyRankings, WorldRankings, etc.)
- Automatic player updates when tournaments end
- Tour-specific updates (women's rankings for women's tours, amateur for amateur tours)
- Smart duplicate prevention with cleanup

DEPLOYMENT:
Add to Procfile: live_monitor: cd maxBreak && python manage.py auto_live_monitor
"""

import time
import logging
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Automatic live match monitor that runs continuously'

    def __init__(self):
        super().__init__()
        self.should_stop = False
        self.error_count = 0
        self.max_errors = 10
        self.processed_tournament_ends = set()  # Track processed tournament end updates

    def add_arguments(self, parser):
        parser.add_argument(
            '--active-interval',
            type=int,
            default=120,  # 2 minutes
            help='Update interval in seconds during active tournaments'
        )
        parser.add_argument(
            '--sleep-interval', 
            type=int,
            default=900,  # 15 minutes
            help='Check interval in seconds when no active tournaments'
        )

    def handle(self, *args, **options):
        active_interval = options.get('active_interval', 120)
        sleep_interval = options.get('sleep_interval', 900)
        
        self.stdout.write('[START] AUTO LIVE MONITOR STARTING...')
        self.stdout.write(f'[ACTIVE] Active interval: {active_interval}s')
        self.stdout.write(f'[SLEEP] Sleep interval: {sleep_interval}s')
        
        while not self.should_stop:
            try:
                current_time = timezone.now()
                self.stdout.write(f'[CHECK] Checking at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
                
                # Check if we have active tournaments with matches
                has_active_matches = self._has_active_matches(current_time)
                
                if has_active_matches:
                    self.stdout.write('[ACTIVE] ACTIVE TOURNAMENTS FOUND - Starting live updates')
                    self._run_live_updates()
                    
                    # Use short interval during active periods
                    next_check = active_interval
                    self.stdout.write(f'[TIMER] Next check in {next_check//60} minutes')
                else:
                    self.stdout.write('[SLEEP] No active matches - Checking fallback upcoming matches')
                    
                    # Update upcoming matches as fallback when no active tournaments
                    self._update_upcoming_matches_fallback()
                    
                    # Check for scheduled daily updates (3am UTC)
                    if self._check_daily_updates():
                        self.stdout.write('[AUTOMATION] Daily updates completed')
                    
                    # Check for scheduled monthly updates (1st of month, 3am UTC)
                    if self._check_monthly_updates():
                        self.stdout.write('[AUTOMATION] Monthly updates completed')
                    
                    # Check for upcoming tournaments needing match data (every 4 hours)
                    if self._check_upcoming_tournament_updates():
                        self.stdout.write('[AUTOMATION] Upcoming tournament updates completed')
                    
                    # Check for recently finished tournaments needing final updates
                    if self._check_tournament_end_updates():
                        self.stdout.write('[AUTOMATION] Tournament end updates completed')
                    
                    next_check = sleep_interval
                    self.stdout.write(f'[TIMER] Next check in {next_check//60} minutes')
                
                # Reset error count on successful run
                self.error_count = 0
                
                # Sleep until next check
                time.sleep(next_check)
                
            except KeyboardInterrupt:
                self.stdout.write('[STOP] Stopping auto live monitor...')
                break
            except Exception as e:
                self.error_count += 1
                logger.error(f'Auto live monitor error ({self.error_count}/{self.max_errors}): {str(e)}')
                self.stdout.write(f'[ERROR] Error: {str(e)}')
                
                if self.error_count >= self.max_errors:
                    self.stdout.write('[STOP] Too many errors - Stopping monitor')
                    break
                
                # Exponential backoff on errors
                error_sleep = min(300, 30 * (2 ** self.error_count))  # Max 5 minutes
                self.stdout.write(f'[WAIT] Sleeping {error_sleep}s due to error')
                time.sleep(error_sleep)

    def _has_active_matches(self, current_time):
        """Check if there are any tournaments with matches that should be active."""
        today = current_time.date()
        
        # Find tournaments active today or recently
        recent_date = today - timedelta(days=1)
        tomorrow = today + timedelta(days=1)
        
        active_tournaments = Event.objects.filter(
            StartDate__lte=tomorrow,
            EndDate__gte=recent_date
        )
        
        if not active_tournaments.exists():
            return False
        
        # Check if any tournaments have matches that should be live or starting soon
        for event in active_tournaments:
            # Look for matches scheduled for today that might be active
            today_matches = MatchesOfAnEvent.objects.filter(
                Event=event,
                ScheduledDate__date=today,
                Status__in=[0, 1, 2]  # Scheduled, Running, On Break
            )
            
            for match in today_matches:
                if not match.ScheduledDate:
                    continue
                
                # Calculate time difference
                match_time = match.ScheduledDate
                if match_time.tzinfo is None:
                    match_time = timezone.make_aware(match_time)
                
                time_diff = current_time - match_time
                
                # Match should be monitored if:
                # 1. Started in last 4 hours (might still be running)
                # 2. Starting in next 30 minutes
                if timedelta(minutes=-30) <= time_diff <= timedelta(hours=4):
                    self.stdout.write(f'[MATCH] Active match found: {event.Name} - {match.api_match_id}')
                    return True
        
        return False

    def _run_live_updates(self):
        """Run the live match update command."""
        try:
            # Run live match updates for all tournaments
            call_command('update_live_matches', '--max-events', '10')
            self.stdout.write('[SUCCESS] Live updates completed')
        except Exception as e:
            logger.error(f'Failed to run live updates: {str(e)}')
            self.stdout.write(f'[FAILED] Live update failed: {str(e)}')
            raise
    
    def _update_upcoming_matches_fallback(self):
        """Update upcoming matches as fallback when no active tournaments."""
        try:
            from django.utils import timezone
            from oneFourSeven.models import UpcomingMatch
            
            # Check if we need to update upcoming matches (every 4 hours)
            recent_update = UpcomingMatch.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=4)
            ).exists()
            
            if not recent_update:
                self.stdout.write('[FALLBACK] Updating upcoming matches - no recent data')
                call_command('update_upcoming_matches', '--tour', 'main')
                self.stdout.write('[SUCCESS] Upcoming matches fallback updated')
            else:
                self.stdout.write('[SKIP] Upcoming matches fallback recent - skipping')
                
        except Exception as e:
            logger.error(f'Failed to update upcoming matches fallback: {str(e)}')
            self.stdout.write(f'[FAILED] Upcoming matches fallback failed: {str(e)}')

    def _check_daily_updates(self):
        """Check if daily updates should run (3am UTC)."""
        current_time = timezone.now()
        
        # Check if it's around 3am UTC (within 1 hour window)
        if 2 <= current_time.hour <= 4:
            # Check if we already ran today
            today = current_time.date()
            from oneFourSeven.models import Event
            
            # Use a simple flag - check if any event was updated today
            recent_update = Event.objects.filter(
                created_at__date=today
            ).exists()
            
            if not recent_update:
                self.stdout.write('[DAILY] Running daily updates at 3am...')
                self._run_daily_updates()
                return True
        
        return False
    
    def _run_daily_updates(self):
        """Run daily maintenance updates."""
        try:
            self.stdout.write('[DAILY] Starting daily matches and round updates...')
            
            # Update active tournaments
            call_command('update_matches', '--active-only')
            self.stdout.write('[SUCCESS] Daily matches updated')
            
            # Update upcoming tournaments round details (next 30 days)
            call_command('update_round_details', '--upcoming-only', '--days', '30')
            self.stdout.write('[SUCCESS] Daily round details updated')
            
        except Exception as e:
            logger.error(f'Daily updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Daily updates failed: {str(e)}')
    
    def _check_monthly_updates(self):
        """Check if monthly updates should run (1st of month)."""
        current_time = timezone.now()
        
        # Check if it's the 1st day of the month and early morning
        if current_time.day == 1 and 2 <= current_time.hour <= 4:
            # Check if we already ran this month
            from oneFourSeven.models import Player
            
            # Check if any player was updated this month
            this_month = current_time.replace(day=1).date()
            recent_update = Player.objects.filter(
                created_at__date__gte=this_month
            ).exists()
            
            if not recent_update:
                self.stdout.write('[MONTHLY] Running monthly full updates...')
                self._run_monthly_updates()
                return True
        
        return False
    
    def _run_monthly_updates(self):
        """Run monthly comprehensive updates."""
        try:
            self.stdout.write('[MONTHLY] Starting monthly comprehensive updates...')
            
            # Update tournaments for current season
            call_command('update_tournaments', '--season', '2025', '--tour', 'main')
            self.stdout.write('[SUCCESS] Monthly tournaments updated')
            
            # Update players
            call_command('update_players', '--status', 'pro', '--sex', 'men')
            call_command('update_players', '--status', 'pro', '--sex', 'women')
            self.stdout.write('[SUCCESS] Monthly players updated')
            
            # Update rankings
            call_command('update_rankings', '--current-season-only')
            self.stdout.write('[SUCCESS] Monthly rankings updated')
            
        except Exception as e:
            logger.error(f'Monthly updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Monthly updates failed: {str(e)}')
    
    def _check_upcoming_tournament_updates(self):
        """Check if upcoming tournaments need match/round data updates (every 4 hours)."""
        current_time = timezone.now()
        
        # Only run every 2 hours (check if current hour is divisible by 2) - more frequent updates
        if current_time.hour % 2 != 0:
            return False
        
        # Check if we already ran this hour
        from oneFourSeven.models import Event, MatchesOfAnEvent, RoundDetails
        
        # Find upcoming tournaments in next 1-7 days without match data
        upcoming_start = current_time.date() + timedelta(days=1)
        upcoming_end = current_time.date() + timedelta(days=7)
        
        upcoming_tournaments = Event.objects.filter(
            StartDate__gte=upcoming_start,
            StartDate__lte=upcoming_end
        )
        
        tournaments_needing_update = []
        for tournament in upcoming_tournaments:
            match_count = MatchesOfAnEvent.objects.filter(Event=tournament).count()
            round_count = RoundDetails.objects.filter(Event=tournament).count()
            
            # Tournament needs update if it has no matches (regardless of rounds)
            if match_count == 0:
                tournaments_needing_update.append(tournament)
        
        if tournaments_needing_update:
            self.stdout.write(f'[UPCOMING] Found {len(tournaments_needing_update)} tournaments needing data updates')
            self._run_upcoming_tournament_updates(tournaments_needing_update)
            return True
        
        return False
    
    def _run_upcoming_tournament_updates(self, tournaments):
        """Update match and round data for upcoming tournaments."""
        try:
            for tournament in tournaments:
                self.stdout.write(f'[UPCOMING] Updating {tournament.Name} (ID: {tournament.ID})')
                
                # Try to update matches first
                try:
                    call_command('update_matches', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated matches for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No matches yet for {tournament.Name}: {str(e)}')
                
                # Try to update round details
                try:
                    call_command('update_round_details', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated round details for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No round details yet for {tournament.Name}: {str(e)}')
                
                # Try to update prize money
                try:
                    call_command('update_prize_money', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated prize money for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No prize money yet for {tournament.Name}: {str(e)}')
                
                # Small delay between tournaments to respect API limits
                import time
                time.sleep(2)
                
        except Exception as e:
            logger.error(f'Upcoming tournament updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Upcoming tournament updates failed: {str(e)}')
    
    def _check_tournament_end_updates(self):
        """Check for recently finished tournaments that need ranking and player updates."""
        current_time = timezone.now()
        
        # Find tournaments that ended in the last 48 hours
        end_cutoff = current_time - timedelta(hours=48)
        recently_ended = Event.objects.filter(
            EndDate__gte=end_cutoff,
            EndDate__lt=current_time
        )
        
        # Clean up old processed tournament IDs (older than 7 days)
        old_cutoff = current_time - timedelta(days=7)
        old_tournaments = Event.objects.filter(
            EndDate__lt=old_cutoff,
            ID__in=list(self.processed_tournament_ends)
        ).values_list('ID', flat=True)
        
        for old_id in old_tournaments:
            self.processed_tournament_ends.discard(old_id)
        
        # Check if we have tournaments that ended and might need final updates
        tournaments_needing_final_updates = []
        for tournament in recently_ended:
            # Skip if already processed
            if tournament.ID in self.processed_tournament_ends:
                continue
                
            # Check if this tournament has finished matches (status 3)
            finished_matches = MatchesOfAnEvent.objects.filter(
                Event=tournament,
                Status=3  # Finished
            ).count()
            
            # If tournament has finished matches, it probably ended
            if finished_matches > 0:
                tournaments_needing_final_updates.append(tournament)
        
        if tournaments_needing_final_updates:
            self.stdout.write(f'[TOUR_END] Found {len(tournaments_needing_final_updates)} recently ended tournaments')
            self._run_tournament_end_updates(tournaments_needing_final_updates)
            return True
        
        return False
    
    def _run_tournament_end_updates(self, tournaments):
        """Run comprehensive updates after tournament ends - rankings and players."""
        try:
            for tournament in tournaments:
                self.stdout.write(f'[TOUR_END] Processing end updates for {tournament.Name} (ID: {tournament.ID})')
                
                # Update all ranking types after tournament ends
                ranking_types = [
                    'MoneyRankings',
                    'WorldRankings', 
                    'OneYearRanking',
                    'OneYearMoneyRankings',
                    'MoneySeedings',
                    'QTRankings'
                ]
                
                # Add women's rankings if applicable
                if tournament.Tour in ['womens', 'main']:
                    ranking_types.append('WomensRankings')
                
                # Add amateur rankings if applicable  
                if tournament.Tour in ['amateur', 'other']:
                    ranking_types.append('AmateurRankings')
                
                # Update each ranking type
                for ranking_type in ranking_types:
                    try:
                        self.stdout.write(f'[RANKINGS] Updating {ranking_type} after {tournament.Name}')
                        call_command('update_rankings', '--ranking-type', ranking_type, '--current-season-only')
                        self.stdout.write(f'[SUCCESS] Updated {ranking_type}')
                        
                        # Small delay between ranking updates
                        import time
                        time.sleep(3)
                        
                    except Exception as e:
                        self.stdout.write(f'[WARNING] Failed to update {ranking_type}: {str(e)}')
                        # Continue with other ranking types
                
                # Update players (might have new data after tournament)
                try:
                    self.stdout.write(f'[PLAYERS] Updating players after {tournament.Name}')

                    # Update different player categories based on tournament type
                    if tournament.Tour == 'womens':
                        call_command('update_players', '--status', 'pro', '--sex', 'women')
                    elif tournament.Tour == 'amateur':
                        call_command('update_players', '--status', 'amateur')
                    else:
                        # Main tour - update professional men
                        call_command('update_players', '--status', 'pro', '--sex', 'men')

                    self.stdout.write(f'[SUCCESS] Updated players after {tournament.Name}')

                except Exception as e:
                    self.stdout.write(f'[WARNING] Failed to update players: {str(e)}')

                # Update player details (photos and match history) for top players
                try:
                    self.stdout.write(f'[PLAYER_DETAILS] Updating top 50 player photos and match history')
                    call_command('update_player_details', '--top', '50', '--seasons', '2')
                    self.stdout.write(f'[SUCCESS] Updated player details')
                except Exception as e:
                    self.stdout.write(f'[WARNING] Failed to update player details: {str(e)}')

                # Mark tournament as processed to avoid duplicate updates
                self.processed_tournament_ends.add(tournament.ID)
                
                # Delay between tournaments to respect API limits
                import time
                time.sleep(5)
                
        except Exception as e:
            logger.error(f'Tournament end updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Tournament end updates failed: {str(e)}')