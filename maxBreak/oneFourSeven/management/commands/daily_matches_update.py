# management/commands/daily_matches_update.py
"""
DAILY MATCHES UPDATE - Updates match data for active tournaments at 3 AM
Runs daily to refresh match information for active tournaments

Usage: python manage.py daily_matches_update
"""

from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from oneFourSeven.models import Event
from oneFourSeven.constants import MIN_REQUEST_INTERVAL
import time

class Command(BaseCommand):
    help = 'Updates matches for active tournaments - runs daily at 3 AM'

    def handle(self, *args, **options):
        self.stdout.write('🌅 DAILY MATCHES UPDATE STARTING (3 AM Update)...')
        
        # Find active tournaments
        today = date.today()
        active_events = Event.objects.filter(
            StartDate__lte=today + timedelta(days=1),  # Started by tomorrow
            EndDate__gte=today - timedelta(days=1)     # Ended after yesterday
        ).order_by('StartDate')[:10]  # Limit to 10 to avoid API limits
        
        if not active_events.exists():
            self.stdout.write('❌ No active tournaments found')
            return
        
        updated_count = 0
        failed_count = 0
        
        for i, event in enumerate(active_events):
            self.stdout.write(f'🔄 Updating matches for: {event.Name}')
            
            try:
                call_command('update_matches', '--event-id', event.ID, verbosity=0)
                updated_count += 1
                self.stdout.write(f'  ✅ Updated {event.Name}')
                
                # API rate limiting - wait 6 seconds between requests
                if i < len(active_events) - 1:
                    time.sleep(MIN_REQUEST_INTERVAL)  # Respect snooker.org's 2 requests/minute limit
                    
            except Exception as e:
                failed_count += 1
                self.stdout.write(f'  ❌ Failed {event.Name}: {str(e)[:50]}')
        
        self.stdout.write(f'✅ DAILY MATCHES UPDATE COMPLETE: {updated_count} updated, {failed_count} failed')