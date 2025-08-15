# maxBreak/scheduler_startup.py
"""
Auto-start scheduler when Railway environment variable is detected.
This runs the comprehensive scheduler in the background when RAILWAY_RUN_SCHEDULER=true
"""

import os
import threading
import time
import logging
from django.core.management import call_command

logger = logging.getLogger(__name__)

def start_scheduler():
    """Start the comprehensive scheduler in a background thread."""
    try:
        logger.info("Starting comprehensive scheduler in background thread...")
        # Run the scheduler (it will run continuously)
        call_command('comprehensive_scheduler')
    except Exception as e:
        logger.error(f"Error in background scheduler: {e}")

def check_and_start_scheduler():
    """Check if scheduler should be started and start it if needed."""
    should_start = os.getenv('RAILWAY_RUN_SCHEDULER', 'false').lower() == 'true'
    
    if should_start:
        logger.info("RAILWAY_RUN_SCHEDULER=true detected. Starting background scheduler...")
        
        # Start scheduler in a daemon thread
        scheduler_thread = threading.Thread(target=start_scheduler, daemon=True)
        scheduler_thread.start()
        
        logger.info("Background scheduler thread started successfully")
    else:
        logger.info("RAILWAY_RUN_SCHEDULER not set or false. Scheduler not started.")

# Auto-start when this module is imported (during Django startup)
if __name__ != '__main__':
    # Small delay to ensure Django is fully loaded
    def delayed_start():
        time.sleep(10)  # Wait 10 seconds after Django startup
        check_and_start_scheduler()
    
    startup_thread = threading.Thread(target=delayed_start, daemon=True)
    startup_thread.start()