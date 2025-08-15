# management/commands/monthly_full_update.py
"""
MONTHLY FULL UPDATE - Complete database refresh once per month
Updates all data: tournaments, matches, players, rankings, rounds

Usage: python manage.py monthly_full_update
"""

from datetime import date
from django.core.management.base import BaseCommand
from django.core.management import call_command
import time

class Command(BaseCommand):
    help = 'Complete database refresh - runs monthly'

    def handle(self, *args, **options):
        self.stdout.write('🌍 MONTHLY FULL UPDATE STARTING...')
        
        try:
            # 1. Update tournaments
            self.stdout.write('1️⃣ Updating tournaments...')
            call_command('update_tournaments', '--season', '2025', verbosity=0)
            time.sleep(10)
            
            # 2. Update players
            self.stdout.write('2️⃣ Updating players...')
            call_command('update_players', '--status', 'pro', '--sex', 'men', verbosity=0)
            time.sleep(10)
            call_command('update_players', '--status', 'pro', '--sex', 'women', verbosity=0)
            time.sleep(10)
            
            # 3. Update rankings
            self.stdout.write('3️⃣ Updating rankings...')
            call_command('update_rankings', '--current-season-only', verbosity=0)
            time.sleep(10)
            
            # 4. Update recent tournament matches
            self.stdout.write('4️⃣ Updating recent tournament matches...')
            call_command('daily_matches_update', verbosity=0)
            
            # 5. Update round details
            self.stdout.write('5️⃣ Updating round details...')
            call_command('daily_rounds_update', verbosity=0)
            
            self.stdout.write('✅ MONTHLY FULL UPDATE COMPLETE - All data refreshed!')
            
        except Exception as e:
            self.stdout.write(f'❌ MONTHLY UPDATE FAILED: {str(e)}')
            
    def _show_progress(self, step, total, description):
        """Show update progress"""
        progress = int((step / total) * 100)
        self.stdout.write(f'[{progress}%] {description}')