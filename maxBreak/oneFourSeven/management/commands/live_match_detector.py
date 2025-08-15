# management/commands/live_match_detector.py
"""
LIVE MATCH DETECTOR - The most important command for users
This detects when matches should be live and updates scores every 2 minutes during active matches.

How it works:
1. Finds active tournaments 
2. Checks match scheduled times
3. When match time arrives, starts updating every 2 minutes
4. Updates scores until match finishes

Usage: python manage.py live_match_detector
"""

import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent
import pytz

class Command(BaseCommand):
    help = 'Detects and updates live matches automatically - THE MOST IMPORTANT COMMAND'

    def handle(self, *args, **options):
        self.stdout.write('🔥 LIVE MATCH DETECTOR STARTING...')
        
        # Get Israel timezone (your timezone)
        israel_tz = pytz.timezone('Asia/Jerusalem')
        now = datetime.now(israel_tz)
        
        # Find active tournaments
        today = now.date()
        active_events = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        )
        
        if not active_events.exists():
            self.stdout.write('❌ No active tournaments found')
            return
            
        live_matches_found = 0
        
        for event in active_events:
            self.stdout.write(f'🏟️ Checking: {event.Name}')
            
            # Get matches scheduled for today
            today_matches = MatchesOfAnEvent.objects.filter(
                Event=event,
                ScheduledDate__date=today,
                Status__in=[0, 1]  # Scheduled or Running
            )
            
            for match in today_matches:
                if self._should_match_be_live(match, now):
                    self.stdout.write(f'🚨 LIVE MATCH DETECTED: {match}')
                    self._update_live_match(event)
                    live_matches_found += 1
                    break  # One live match means we update the whole tournament
        
        if live_matches_found > 0:
            self.stdout.write(f'✅ Updated {live_matches_found} tournaments with live matches')
        else:
            self.stdout.write('ℹ️ No live matches found at this time')
    
    def _should_match_be_live(self, match, current_time):
        """Check if a match should be live right now"""
        if not match.ScheduledDate:
            return False
            
        # Convert to Israel timezone
        israel_tz = pytz.timezone('Asia/Jerusalem')
        if match.ScheduledDate.tzinfo is None:
            match_time = israel_tz.localize(match.ScheduledDate)
        else:
            match_time = match.ScheduledDate.astimezone(israel_tz)
        
        # Match should be live if:
        # 1. Current time is after scheduled time
        # 2. Not more than 4 hours after scheduled time (match shouldn't take that long)
        time_diff = current_time - match_time
        
        return timedelta(0) <= time_diff <= timedelta(hours=4)
    
    def _update_live_match(self, event):
        """Update live match data for an event"""
        try:
            call_command('update_live_matches', '--max-events', '1')
            self.stdout.write(f'  ✅ Updated live data for {event.Name}')
        except Exception as e:
            self.stdout.write(f'  ❌ Failed to update {event.Name}: {str(e)}')