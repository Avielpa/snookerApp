# management/commands/smart_live_scheduler.py
"""
SMART LIVE SCHEDULER - Comprehensive automated system for live match monitoring
This is the ULTIMATE solution for your live match problem.

WHAT THIS SOLVES:
- Matches starting at 19:30 not showing as live at 22:07
- Manual intervention needed to see live matches
- Data not updating automatically

HOW IT WORKS:
1. Runs continuously in the background
2. Intelligent detection of match start times
3. Adaptive monitoring frequency based on activity
4. Automatic status updates every 2 minutes during matches
5. Error recovery and retry logic
6. Timezone-aware scheduling

USAGE: python manage.py smart_live_scheduler
"""

import time
import threading
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent
import pytz
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Smart live match scheduler with continuous monitoring'

    def __init__(self):
        super().__init__()
        self.should_stop = False
        self.monitoring_thread = None
        self.israel_tz = pytz.timezone('Asia/Jerusalem')

    def add_arguments(self, parser):
        parser.add_argument(
            '--run-once',
            action='store_true',
            help='Run once instead of continuous monitoring'
        )
        parser.add_argument(
            '--check-interval',
            type=int,
            default=120,  # 2 minutes
            help='Check interval in seconds during quiet periods'
        )

    def handle(self, *args, **options):
        run_once = options.get('run_once', False)
        check_interval = options.get('check_interval', 120)

        if run_once:
            self._run_single_check()
        else:
            self._start_continuous_monitoring(check_interval)

    def _start_continuous_monitoring(self, check_interval):
        """Start continuous monitoring with intelligent scheduling"""
        self.stdout.write('🚀 SMART LIVE SCHEDULER STARTING...')
        self.stdout.write(f'⏱️ Base check interval: {check_interval} seconds')
        
        try:
            while not self.should_stop:
                current_time = datetime.now(self.israel_tz)
                self.stdout.write(f'🔍 Monitoring check at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
                
                # Determine if we're in an active period
                active_period = self._is_active_period(current_time)
                
                # Adjust check interval based on activity
                if active_period:
                    interval = 120  # 2 minutes during active periods
                    self.stdout.write('🔥 ACTIVE PERIOD - Checking every 2 minutes')
                else:
                    interval = min(check_interval, 900)  # Max 15 minutes during quiet periods
                    self.stdout.write(f'😴 Quiet period - Checking every {interval//60} minutes')
                
                # Run the monitoring check
                self._run_monitoring_check(current_time)
                
                # Wait for the next check
                time.sleep(interval)
                
        except KeyboardInterrupt:
            self.stdout.write('⏹️ Stopping smart scheduler...')
        except Exception as e:
            logger.error(f'Smart scheduler error: {str(e)}')
            self.stdout.write(f'❌ Error: {str(e)}')

    def _is_active_period(self, current_time):
        """Determine if we're in an active tournament period"""
        # Check if any tournaments are active
        today = current_time.date()
        tomorrow = today + timedelta(days=1)
        
        # Active tournaments (started and not finished)
        active_events = Event.objects.filter(
            StartDate__lte=tomorrow,
            EndDate__gte=today
        )
        
        if not active_events.exists():
            return False
        
        # Check if any matches are scheduled soon or currently running
        for event in active_events:
            # Look for matches in the next 2 hours or currently running
            upcoming_matches = MatchesOfAnEvent.objects.filter(
                Event=event,
                Status__in=[0, 1, 2],  # Scheduled, Running, or On Break
                ScheduledDate__gte=current_time - timedelta(hours=1),
                ScheduledDate__lte=current_time + timedelta(hours=2)
            )
            
            if upcoming_matches.exists():
                return True
        
        # Check time of day - more active during typical playing hours (12:00 - 23:00)
        current_hour = current_time.hour
        return 12 <= current_hour <= 23

    def _run_monitoring_check(self, current_time):
        """Run a single monitoring check"""
        try:
            # 1. Check for tournaments that need live match detection
            live_events = self._detect_live_tournaments(current_time)
            
            # 2. Update live matches for active tournaments
            if live_events:
                self._update_live_tournaments(live_events)
            
            # 3. Clean up finished matches that are still marked as running
            self._cleanup_finished_matches(current_time)
            
        except Exception as e:
            logger.error(f'Monitoring check failed: {str(e)}')
            self.stdout.write(f'⚠️ Check failed: {str(e)}')

    def _detect_live_tournaments(self, current_time):
        """Detect tournaments that should have live matches"""
        today = current_time.date()
        live_events = []
        
        # Get tournaments that are currently active
        active_events = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        )
        
        for event in active_events:
            # Check if this tournament has matches that should be live
            should_be_live = self._tournament_should_be_live(event, current_time)
            
            if should_be_live:
                live_events.append(event)
                self.stdout.write(f'🎯 {event.Name} should have live matches')
        
        return live_events

    def _tournament_should_be_live(self, event, current_time):
        """Check if a tournament should have live matches right now"""
        # Get today's matches for this event
        today = current_time.date()
        today_matches = MatchesOfAnEvent.objects.filter(
            Event=event,
            ScheduledDate__date=today,
            Status__in=[0, 1, 2]  # Scheduled, Running, or On Break
        )
        
        for match in today_matches:
            if self._should_match_be_live(match, current_time):
                return True
        
        return False

    def _should_match_be_live(self, match, current_time):
        """Check if a specific match should be live"""
        if not match.ScheduledDate:
            return False
        
        # Convert scheduled time to Israel timezone
        if match.ScheduledDate.tzinfo is None:
            match_time = self.israel_tz.localize(match.ScheduledDate)
        else:
            match_time = match.ScheduledDate.astimezone(self.israel_tz)
        
        # Match should be live if:
        # 1. Current time is at or after scheduled time
        # 2. Not more than 4 hours after scheduled time
        time_diff = current_time - match_time
        
        # Allow matches to start up to 15 minutes early (sometimes they start early)
        early_start = timedelta(minutes=-15)
        max_duration = timedelta(hours=4)
        
        return early_start <= time_diff <= max_duration

    def _update_live_tournaments(self, events):
        """Update live match data for the given tournaments"""
        self.stdout.write(f'🔄 Updating {len(events)} tournaments...')
        
        for event in events:
            try:
                # Update matches for this specific event
                call_command('update_matches', '--event-id', str(event.ID))
                self.stdout.write(f'  ✅ Updated {event.Name}')
                
                # Small delay between updates to be nice to the API
                time.sleep(2)
                
            except Exception as e:
                logger.error(f'Failed to update {event.Name}: {str(e)}')
                self.stdout.write(f'  ❌ Failed {event.Name}: {str(e)}')

    def _cleanup_finished_matches(self, current_time):
        """Clean up matches that should be finished but are still marked as running"""
        # Find matches that have been "running" for more than 4 hours
        cutoff_time = current_time - timedelta(hours=4)
        
        stuck_matches = MatchesOfAnEvent.objects.filter(
            Status__in=[1, 2],  # Running or On Break
            ScheduledDate__lt=cutoff_time
        )
        
        if stuck_matches.exists():
            self.stdout.write(f'🧹 Found {stuck_matches.count()} potentially stuck matches')
            
            for match in stuck_matches[:5]:  # Limit to 5 at a time
                # Try to update this specific match
                try:
                    event = match.Event
                    call_command('update_matches', '--event-id', str(event.ID))
                    self.stdout.write(f'  🔄 Refreshed stuck match in {event.Name}')
                    time.sleep(1)
                except Exception as e:
                    logger.error(f'Failed to refresh stuck match: {str(e)}')

    def _run_single_check(self):
        """Run a single monitoring check (for testing)"""
        current_time = datetime.now(self.israel_tz)
        self.stdout.write(f'🔍 Single check at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
        self._run_monitoring_check(current_time)
        self.stdout.write('✅ Single check completed')