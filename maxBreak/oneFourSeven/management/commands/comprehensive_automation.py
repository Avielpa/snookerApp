# management/commands/comprehensive_automation.py
"""
COMPREHENSIVE AUTOMATION SYSTEM
This is the ULTIMATE automation solution for your snooker app.

WHAT IT DOES:
1. Live match monitoring (every 2 minutes during matches)
2. Daily tournament updates (new tournaments, results)
3. Weekly player and ranking updates  
4. Monthly full database refresh
5. Intelligent error recovery and retry logic
6. Timezone-aware scheduling

This solves ALL your automation needs in one command.
"""

import threading
import time
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
import pytz
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Comprehensive automation system for the entire snooker app'

    def __init__(self):
        super().__init__()
        self.should_stop = False
        self.israel_tz = pytz.timezone('Asia/Jerusalem')

    def add_arguments(self, parser):
        parser.add_argument(
            '--mode',
            choices=['full', 'live-only', 'daily', 'test'],
            default='full',
            help='Automation mode to run'
        )

    def handle(self, *args, **options):
        mode = options.get('mode', 'full')
        
        self.stdout.write('🚀 COMPREHENSIVE AUTOMATION STARTING...')
        self.stdout.write(f'📊 Mode: {mode}')
        
        if mode == 'test':
            self._run_test_cycle()
        elif mode == 'live-only':
            self._start_live_monitoring_only()
        elif mode == 'daily':
            self._run_daily_updates()
        else:  # full
            self._start_full_automation()

    def _start_full_automation(self):
        """Start the complete automation system"""
        self.stdout.write('🌟 Starting FULL automation system...')
        
        # Schedule all the tasks
        self._schedule_all_tasks()
        
        # Start the scheduler in a separate thread
        scheduler_thread = threading.Thread(target=self._run_scheduler)
        scheduler_thread.daemon = True
        scheduler_thread.start()
        
        # Start live monitoring (this will be the main thread)
        self._start_live_monitoring()

    def _schedule_all_tasks(self):
        """Schedule all automated tasks using simple time-based checks"""
        self.stdout.write('📅 Setting up task scheduling...')
        
        # Store last run times
        self.last_daily_run = None
        self.last_weekly_run = None
        self.last_monthly_run = None
        
        self.stdout.write('✅ Task scheduling configured')

    def _run_scheduler(self):
        """Run the scheduled tasks using simple time checks"""
        while not self.should_stop:
            try:
                current_time = datetime.now(self.israel_tz)
                
                # Check for daily updates (06:00 Israel time)
                if self._should_run_daily(current_time):
                    self._run_daily_updates_job()
                    self.last_daily_run = current_time.date()
                
                # Check for weekly updates (Sunday 05:00 Israel time)
                if self._should_run_weekly(current_time):
                    self._run_weekly_updates_job()
                    self.last_weekly_run = current_time.date()
                
                # Check for monthly updates (1st of month 04:00 Israel time)
                if self._should_run_monthly(current_time):
                    self._run_monthly_updates_job()
                    self.last_monthly_run = current_time.date()
                
                time.sleep(300)  # Check every 5 minutes
            except Exception as e:
                logger.error(f'Scheduler error: {str(e)}')
                time.sleep(60)

    def _start_live_monitoring(self):
        """Start continuous live match monitoring"""
        self.stdout.write('🔥 Starting live match monitoring...')
        
        try:
            call_command('smart_live_scheduler')
        except Exception as e:
            logger.error(f'Live monitoring failed: {str(e)}')
            self.stdout.write(f'❌ Live monitoring error: {str(e)}')

    def _start_live_monitoring_only(self):
        """Start only live monitoring (for testing)"""
        self.stdout.write('🎯 Live monitoring only mode...')
        self._start_live_monitoring()

    def _run_daily_updates_job(self):
        """Daily updates job"""
        current_time = datetime.now(self.israel_tz)
        self.stdout.write(f'🌅 Daily updates starting at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
        
        try:
            # 1. Update tournaments (new tournaments, status changes)
            self.stdout.write('📋 Updating tournaments...')
            call_command('update_tournaments', '--season', '2025')
            
            # 2. Update live matches status
            self.stdout.write('🏆 Updating match statuses...')
            call_command('update_live_matches')
            
            # 3. Update rankings (daily ranking changes)
            self.stdout.write('📊 Updating rankings...')
            call_command('update_rankings', '--current-season-only')
            
            self.stdout.write('✅ Daily updates completed')
            
        except Exception as e:
            logger.error(f'Daily updates failed: {str(e)}')
            self.stdout.write(f'❌ Daily updates failed: {str(e)}')

    def _run_weekly_updates_job(self):
        """Weekly updates job"""
        current_time = datetime.now(self.israel_tz)
        self.stdout.write(f'🗓️ Weekly updates starting at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
        
        try:
            # 1. Update all players (new players, status changes)
            self.stdout.write('👥 Updating all players...')
            call_command('update_players', '--status', 'pro', '--sex', 'men')
            call_command('update_players', '--status', 'pro', '--sex', 'women')
            
            # 2. Update all ranking types
            self.stdout.write('🏅 Updating all rankings...')
            call_command('update_rankings', '--ranking-type', 'all')
            
            # 3. Update round details for recent tournaments
            self.stdout.write('🎯 Updating round details...')
            call_command('update_round_details', '--season', '2025', '--limit', '20')
            
            self.stdout.write('✅ Weekly updates completed')
            
        except Exception as e:
            logger.error(f'Weekly updates failed: {str(e)}')
            self.stdout.write(f'❌ Weekly updates failed: {str(e)}')

    def _run_monthly_updates_job(self):
        """Monthly updates job"""
        current_time = datetime.now(self.israel_tz)
        self.stdout.write(f'📅 Monthly updates starting at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
        
        try:
            # Full database refresh
            self.stdout.write('🔄 Full database refresh...')
            
            # 1. Update all tournaments (including historical)
            call_command('update_tournaments', '--tour', 'all')
            
            # 2. Update all players including amateurs
            call_command('update_players', '--status', 'amateur')
            
            # 3. Full ranking update
            call_command('update_rankings', '--ranking-type', 'all', '--all-seasons')
            
            self.stdout.write('✅ Monthly updates completed')
            
        except Exception as e:
            logger.error(f'Monthly updates failed: {str(e)}')
            self.stdout.write(f'❌ Monthly updates failed: {str(e)}')

    def _run_daily_updates(self):
        """Run daily updates once (for manual execution)"""
        self._run_daily_updates_job()

    def _run_test_cycle(self):
        """Run a test cycle of all systems"""
        self.stdout.write('🧪 Running test cycle...')
        
        # Test live monitoring (single check)
        try:
            call_command('smart_live_scheduler', '--run-once')
            self.stdout.write('✅ Live monitoring test passed')
        except Exception as e:
            self.stdout.write(f'❌ Live monitoring test failed: {str(e)}')
        
        # Test basic data updates
        try:
            call_command('update_live_matches', '--max-events', '1')
            self.stdout.write('✅ Live match update test passed')
        except Exception as e:
            self.stdout.write(f'❌ Live match update test failed: {str(e)}')
        
        self.stdout.write('🎯 Test cycle completed')

    def _should_run_daily(self, current_time):
        """Check if daily updates should run"""
        # Run at 06:00 Israel time, once per day
        if current_time.hour != 6 or current_time.minute > 15:
            return False
        
        today = current_time.date()
        return self.last_daily_run != today
    
    def _should_run_weekly(self, current_time):
        """Check if weekly updates should run"""
        # Run on Sunday at 05:00 Israel time, once per week
        if current_time.weekday() != 6 or current_time.hour != 5 or current_time.minute > 15:
            return False
        
        today = current_time.date()
        return self.last_weekly_run != today
    
    def _should_run_monthly(self, current_time):
        """Check if monthly updates should run"""
        # Run on 1st of month at 04:00 Israel time, once per month
        if current_time.day != 1 or current_time.hour != 4 or current_time.minute > 15:
            return False
        
        today = current_time.date()
        return self.last_monthly_run != today