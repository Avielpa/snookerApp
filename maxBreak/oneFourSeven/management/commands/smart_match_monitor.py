# management/commands/smart_match_monitor.py
"""
Smart Match Monitor - Simple and Intelligent

WHAT IT DOES:
1. Checks if there are active tournaments
2. Gets today's matches with start times
3. Monitors matches 10 minutes before they start
4. Updates every 2 minutes during live matches
5. Stops when all matches are finished

HOW TO USE:
- Run as cron job every 5-10 minutes: python manage.py smart_match_monitor
- It will only activate when needed (before/during matches)
"""

import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent

class Command(BaseCommand):
    help = 'Smart match monitor that activates before matches start'

    def handle(self, *args, **options):
        now = timezone.now()
        today = now.date()
        
        self.stdout.write(f"[SMART MONITOR] Check: {now.strftime('%H:%M:%S')}")
        
        # Step 1: Check for active tournaments
        active_events = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        )
        
        if not active_events.exists():
            self.stdout.write("[NO TOURNAMENTS] No active tournaments today")
            return
            
        self.stdout.write(f"[ACTIVE TOURNAMENTS] Found {active_events.count()} tournament(s)")
        
        # Step 2: Get today's matches
        today_matches = MatchesOfAnEvent.objects.filter(
            Event__in=active_events,
            ScheduledDate__date=today,
            ScheduledDate__isnull=False
        ).exclude(Status=2)  # Exclude finished matches
        
        if not today_matches.exists():
            self.stdout.write("[NO MATCHES] No matches scheduled for today")
            return
            
        self.stdout.write(f"[TODAY MATCHES] Found {today_matches.count()} matches today")
        
        # Step 3: Check if any matches need monitoring
        needs_monitoring = False
        live_matches = 0
        upcoming_matches = 0
        
        for match in today_matches:
            if match.Status == 1:  # Live match
                live_matches += 1
                needs_monitoring = True
            elif match.ScheduledDate:
                minutes_until = (match.ScheduledDate - now).total_seconds() / 60
                if -10 <= minutes_until <= 120:  # 10 mins before to 2 hours after
                    upcoming_matches += 1
                    needs_monitoring = True
        
        if live_matches > 0:
            self.stdout.write(f"[LIVE NOW] {live_matches} live matches - MONITORING ACTIVE")
        
        if upcoming_matches > 0:
            self.stdout.write(f"[STARTING SOON] {upcoming_matches} matches - MONITORING ACTIVE")
            
        if not needs_monitoring:
            self.stdout.write("[SLEEP] No matches need monitoring right now")
            return
        
        # Step 4: Start monitoring (update matches)
        self.stdout.write("[UPDATING] Starting live match updates...")
        try:
            call_command('update_matches', '--active-only')
            self.stdout.write("[SUCCESS] Match updates completed")
        except Exception as e:
            self.stdout.write(f"[ERROR] Update failed: {e}")
            
        self.stdout.write("---")