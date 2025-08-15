# management/commands/test_live_system_simple.py
"""
TEST LIVE SYSTEM - Simple version without emojis
Quick command to test if the live match detection is working properly.
"""

from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent

class Command(BaseCommand):
    help = 'Test live match detection system'

    def handle(self, *args, **options):
        self.stdout.write('TESTING LIVE MATCH DETECTION...')
        
        now = timezone.now()
        today = now.date()
        
        self.stdout.write(f'Current time: {now.strftime("%Y-%m-%d %H:%M:%S UTC")}')
        
        # Find active tournaments
        active_events = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        )
        
        self.stdout.write(f'\nFound {active_events.count()} active tournaments:')
        
        total_live_matches = 0
        
        for event in active_events:
            self.stdout.write(f'\n{event.Name} (ID: {event.ID})')
            self.stdout.write(f'   Dates: {event.StartDate} to {event.EndDate}')
            
            # Get today's matches
            today_matches = MatchesOfAnEvent.objects.filter(
                Event=event,
                ScheduledDate__date=today
            )
            
            self.stdout.write(f'   {today_matches.count()} matches scheduled for today')
            
            live_matches = []
            upcoming_matches = []
            
            for match in today_matches:
                if not match.ScheduledDate:
                    continue
                
                # Use the scheduled time as-is for now
                match_time = match.ScheduledDate
                if match_time.tzinfo is None:
                    match_time = timezone.make_aware(match_time)
                
                time_diff = now - match_time
                
                # Check if should be live (between -15 minutes and +4 hours)
                if timedelta(minutes=-15) <= time_diff <= timedelta(hours=4):
                    live_matches.append((match, match_time, time_diff))
                elif time_diff < timedelta(minutes=-15):
                    upcoming_matches.append((match, match_time, time_diff))
            
            if live_matches:
                self.stdout.write(f'   {len(live_matches)} SHOULD BE LIVE:')
                for match, match_time, time_diff in live_matches:
                    status_name = self._get_status_name(match.Status)
                    minutes_diff = int(time_diff.total_seconds() / 60)
                    self.stdout.write(f'      {match.api_match_id}: {match_time.strftime("%H:%M")} ({minutes_diff:+d}min) - Status: {status_name}')
                    
                    if match.Status not in [1, 2]:  # Not running or on break
                        self.stdout.write(f'         WARNING: Should be live but status is {status_name}')
                
                total_live_matches += len(live_matches)
            
            if upcoming_matches:
                self.stdout.write(f'   {len(upcoming_matches)} upcoming matches:')
                for match, match_time, time_diff in upcoming_matches[:3]:  # Show first 3
                    minutes_until = int(abs(time_diff.total_seconds()) / 60)
                    self.stdout.write(f'      {match.api_match_id}: {match_time.strftime("%H:%M")} (in {minutes_until}min)')
        
        # Summary
        self.stdout.write(f'\nSUMMARY:')
        self.stdout.write(f'   Active tournaments: {active_events.count()}')
        self.stdout.write(f'   Matches that should be live: {total_live_matches}')
        
        if total_live_matches > 0:
            self.stdout.write('\nACTION NEEDED: Run "python manage.py update_live_matches" to update these matches')
        else:
            self.stdout.write('\nNo matches should be live right now')
    
    def _get_status_name(self, status_code):
        """Get human-readable status name"""
        status_names = {
            0: 'Scheduled',
            1: 'Running',
            2: 'On Break', 
            3: 'Finished'
        }
        return status_names.get(status_code, f'Unknown({status_code})')