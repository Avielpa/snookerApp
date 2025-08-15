# management/commands/daily_rounds_update.py
"""
DAILY ROUNDS UPDATE - Updates round details for active tournaments
Runs every day to keep round formats current

Usage: python manage.py daily_rounds_update
"""

from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from oneFourSeven.models import Event, RoundDetails

class Command(BaseCommand):
    help = 'Updates round details for active tournaments daily'

    def handle(self, *args, **options):
        self.stdout.write('📊 DAILY ROUNDS UPDATE STARTING...')
        
        # Find active tournaments that need round updates
        today = date.today()
        active_events = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today + timedelta(days=1)  # Include tomorrow
        )
        
        updated_count = 0
        
        for event in active_events:
            # Check if event needs round details
            existing_rounds = RoundDetails.objects.filter(Event=event).count()
            
            if existing_rounds < 5:  # Needs round details
                self.stdout.write(f'🔄 Updating rounds for: {event.Name}')
                try:
                    call_command('update_round_details', '--event-id', event.ID, verbosity=0)
                    updated_count += 1
                    self.stdout.write(f'  ✅ Updated {event.Name}')
                except Exception as e:
                    self.stdout.write(f'  ❌ Failed {event.Name}: {str(e)[:50]}')
        
        self.stdout.write(f'✅ ROUNDS UPDATE COMPLETE: {updated_count} tournaments updated')