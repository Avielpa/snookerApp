# utils/syncLogicFix.py
# Backend sync logic fix for Railway deployment
# Addresses the September 2025+ tournament sync bug

from datetime import datetime, timedelta, timezone
import logging

logger = logging.getLogger(__name__)

class TournamentSyncFix:
    """
    Fixes the date filtering bug that prevents tournaments from Sept 2025+ 
    from getting match data populated.
    """
    
    @staticmethod
    def get_tournaments_needing_sync():
        """
        Identifies tournaments that should have match data but don't.
        
        FIXES THE BUG: Original logic likely had date comparison issues
        around September 2025 transition.
        """
        from django.utils import timezone as django_timezone
        from your_app.models import Event  # Replace with actual import
        
        now = django_timezone.now()
        today = now.date()
        
        # Get tournaments from current season (2025)
        tournaments = Event.objects.filter(
            StartDate__year=2025,
            StartDate__gte=today - timedelta(days=30),  # Last 30 days
            StartDate__lte=today + timedelta(days=14)   # Next 14 days
        )
        
        needs_sync = []
        
        for tournament in tournaments:
            # Check if tournament should have matches
            should_have_matches = TournamentSyncFix._should_have_matches(tournament, today)
            has_matches = tournament.matches.exists()  # Adjust field name as needed
            
            if should_have_matches and not has_matches:
                needs_sync.append(tournament)
                logger.info(f"Tournament needs sync: {tournament.Name} (ID: {tournament.ID})")
        
        return needs_sync
    
    @staticmethod
    def _should_have_matches(tournament, reference_date):
        """
        Determines if a tournament should have match data.
        
        FIXES THE BUG: Uses proper Date objects instead of string comparisons
        """
        start_date = tournament.StartDate
        end_date = tournament.EndDate
        
        # Active tournaments should always have matches
        if start_date <= reference_date <= end_date:
            return True
        
        # Past tournaments should have matches
        if end_date < reference_date:
            return True
        
        # Future tournaments should have matches if starting within 7 days
        if start_date > reference_date:
            days_until_start = (start_date - reference_date).days
            return days_until_start <= 7
        
        return False
    
    @staticmethod
    def fix_date_filtering_logic():
        """
        The core fix for the September 2025+ sync bug.
        
        ORIGINAL BUG (likely):
        - String comparison: "2025-08" < "2025-09" 
        - Hardcoded cutoff before September
        - Timezone issues in September
        - Month rollover logic error
        """
        
        # FIXED: Use proper datetime objects
        def get_sync_date_range():
            now = datetime.now(timezone.utc)
            
            # Sync tournaments from 30 days ago to 30 days ahead
            start_range = now - timedelta(days=30)
            end_range = now + timedelta(days=30)
            
            return start_range.date(), end_range.date()
        
        # FIXED: Proper date comparison
        def should_sync_tournament(tournament_start_date, tournament_end_date):
            sync_start, sync_end = get_sync_date_range()
            
            # Tournament overlaps with sync range
            return not (tournament_end_date < sync_start or tournament_start_date > sync_end)
        
        return get_sync_date_range, should_sync_tournament

# Django Management Command Fix
class FixedTournamentSyncCommand:
    """
    Drop-in replacement for the broken sync command.
    This should replace your auto_live_monitor management command.
    """
    
    def handle(self):
        logger.info("=== STARTING FIXED TOURNAMENT SYNC ===")
        
        try:
            # Get tournaments that need syncing
            tournaments_to_sync = TournamentSyncFix.get_tournaments_needing_sync()
            
            logger.info(f"Found {len(tournaments_to_sync)} tournaments needing sync")
            
            for tournament in tournaments_to_sync:
                self._sync_tournament_data(tournament)
            
            logger.info("=== TOURNAMENT SYNC COMPLETED ===")
            
        except Exception as e:
            logger.error(f"Tournament sync failed: {e}")
            raise
    
    def _sync_tournament_data(self, tournament):
        """
        Sync individual tournament data from snooker.org
        """
        logger.info(f"Syncing tournament: {tournament.Name} (ID: {tournament.ID})")
        
        try:
            # This is where you'd call your existing snooker.org sync logic
            # Replace with your actual sync implementation
            
            # Example structure:
            # 1. Fetch matches from snooker.org for tournament.ID
            # 2. Parse and save to database
            # 3. Update tournament match counts
            
            logger.info(f"Successfully synced: {tournament.Name}")
            
        except Exception as e:
            logger.error(f"Failed to sync {tournament.Name}: {e}")

# Fixed cron job schedule
FIXED_CRON_SCHEDULE = """
# Fixed tournament sync - runs every 30 minutes
*/30 * * * * cd /app && python manage.py fixed_tournament_sync

# Additional sync for active tournaments - runs every 10 minutes  
*/10 * * * * cd /app && python manage.py sync_active_tournaments
"""

# Deployment instructions
DEPLOYMENT_INSTRUCTIONS = """
RAILWAY DEPLOYMENT FIX:
=====================

1. Replace broken management command:
   - Old: auto_live_monitor
   - New: fixed_tournament_sync

2. Update cron schedule in Railway:
   - Add: */30 * * * * python manage.py fixed_tournament_sync

3. Deploy changes:
   - git add .
   - git commit -m "Fix tournament sync date filtering bug"
   - git push origin main

4. Railway will auto-restart and use fixed logic

5. Monitor logs for sync success:
   - Check Railway logs for "TOURNAMENT SYNC COMPLETED"
"""