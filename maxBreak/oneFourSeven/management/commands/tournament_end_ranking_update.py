# management/commands/tournament_end_ranking_update.py
"""
TOURNAMENT END RANKING UPDATE - Updates rankings when tournaments finish
Detects when tournaments end (final match finished) and updates rankings

Usage: python manage.py tournament_end_ranking_update
"""

from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from oneFourSeven.models import Event, MatchesOfAnEvent

class Command(BaseCommand):
    help = 'Updates rankings when tournaments finish'

    def handle(self, *args, **options):
        self.stdout.write('🏆 TOURNAMENT END RANKING UPDATE STARTING...')
        
        # Find tournaments that just finished (ended in last 3 days)
        today = date.today()
        recent_finished = Event.objects.filter(
            EndDate__gte=today - timedelta(days=3),
            EndDate__lt=today
        )
        
        ranking_updates_needed = 0
        
        for event in recent_finished:
            # Check if final match is finished
            final_matches = MatchesOfAnEvent.objects.filter(
                Event=event,
                Status=2  # Finished
            ).count()
            
            total_matches = MatchesOfAnEvent.objects.filter(Event=event).count()
            
            # If most matches are finished, tournament is done
            if total_matches > 0 and final_matches / total_matches > 0.8:
                self.stdout.write(f'🎯 Tournament finished: {event.Name}')
                ranking_updates_needed += 1
        
        # Update rankings if tournaments finished
        if ranking_updates_needed > 0:
            self.stdout.write(f'🔄 Updating rankings for {ranking_updates_needed} finished tournaments...')
            try:
                call_command('update_rankings', '--current-season-only', verbosity=0)
                self.stdout.write('✅ Rankings updated successfully')
                
                # Also update players
                call_command('update_players', '--status', 'pro', '--sex', 'men', verbosity=0) 
                self.stdout.write('✅ Players updated successfully')
                
            except Exception as e:
                self.stdout.write(f'❌ Failed to update rankings: {str(e)[:50]}')
        else:
            self.stdout.write('ℹ️ No tournaments finished recently - no ranking update needed')
        
        self.stdout.write('✅ TOURNAMENT END UPDATE COMPLETE')