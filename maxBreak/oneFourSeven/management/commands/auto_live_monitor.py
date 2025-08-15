# management/commands/auto_live_monitor.py
"""
AUTOMATIC LIVE MATCH MONITOR
This is the ULTIMATE solution for automatic live match updates.

WHAT IT SOLVES:
- Matches not updating automatically during tournaments
- Users having to manually run update commands
- Live scores not being available in real-time

HOW IT WORKS:
1. Runs continuously in background
2. Monitors ALL active tournaments (not just main tour)
3. Updates every 2 minutes during active matches
4. Smart scheduling - sleeps when no active tournaments
5. Auto-restart on errors with exponential backoff

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
                    self.stdout.write('[SLEEP] No active matches - Sleeping')
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