# management/commands/auto_live_monitor.py
"""
AUTOMATIC LIVE MATCH MONITOR
This is the ULTIMATE solution for automatic live match updates and tournament management.

WHAT IT SOLVES:
- Matches not updating automatically during tournaments
- Users having to manually run update commands
- Live scores not being available in real-time
- Rankings not updating after tournaments end
- Players not being updated after tournaments

HOW IT WORKS:
1. Runs continuously in background
2. Monitors ALL active tournaments (not just main tour)
3. Updates every 2 minutes during active matches
4. Smart scheduling - sleeps when no active tournaments
5. Auto-restart on errors with exponential backoff
6. TOURNAMENT END DETECTION: Automatically updates all ranking types and players when tournaments finish
7. Prevents duplicate updates with smart tracking

NEW FEATURES:
- Automatic ranking updates when tournaments end (all types: MoneyRankings, WorldRankings, etc.)
- Automatic player updates when tournaments end
- Tour-specific updates (women's rankings for women's tours, amateur for amateur tours)
- Smart duplicate prevention with cleanup

DEPLOYMENT:
Add to Procfile: live_monitor: cd maxBreak && python manage.py auto_live_monitor
"""

import time
import logging
from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
from oneFourSeven.models import Event, MatchesOfAnEvent

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Automatic live match monitor that runs continuously'

    def __init__(self):
        super().__init__()
        self.should_stop = False
        self.error_count = 0
        self.max_errors = 10
        self.processed_tournament_ends = set()  # Track processed tournament end updates
        self.last_daily_run = None              # Track last date daily updates ran (date object)
        self.last_monthly_run = None            # Track last month monthly updates ran (YYYY-MM string)
        self.last_news_fetch = None             # Track last news RSS fetch time
        self.last_player_history_run = None     # Track last date player history updated during active tour
        self.last_stats_update_run = None       # Track last date nightly stats commands ran during active tour
        self.pretournament_processed = set()    # Track event IDs already pre-synced (new-players-only)
        # Push notification dedup sets (reset at midnight UTC)
        self.notified_live = set()              # api_match_ids already notified as live
        self.notified_result = set()            # api_match_ids already notified as finished
        self.notified_upcoming = set()          # api_match_ids already sent 15-min warning
        self.notified_resume = set()            # api_match_ids already notified as resumed from break
        self.currently_on_break = {}            # {db_pk: api_match_id} for matches at Status=2
                                                # Keyed by DB pk (never changes) so match ID changes
                                                # from snooker.org don't break resume detection
        self.last_notif_reset = None            # date when sets were last cleared

    def add_arguments(self, parser):
        parser.add_argument(
            '--active-interval',
            type=int,
            default=120,  # 2 minutes
            help='Update interval in seconds during active tournaments'
        )
        parser.add_argument(
            '--sleep-interval', 
            type=int,
            default=900,  # 15 minutes
            help='Check interval in seconds when no active tournaments'
        )

    def handle(self, *args, **options):
        active_interval = options.get('active_interval', 120)
        sleep_interval = options.get('sleep_interval', 900)
        
        self.stdout.write('[START] AUTO LIVE MONITOR STARTING...')
        self.stdout.write(f'[ACTIVE] Active interval: {active_interval}s')
        self.stdout.write(f'[SLEEP] Sleep interval: {sleep_interval}s')

        # On startup: sync current season events + import any missing match data
        self._startup_sync()

        while not self.should_stop:
            try:
                current_time = timezone.now()
                self.stdout.write(f'[CHECK] Checking at {current_time.strftime("%Y-%m-%d %H:%M:%S")}')
                
                # Check if we have active tournaments with matches
                has_active_matches = self._has_active_matches(current_time)
                
                if has_active_matches:
                    self.stdout.write('[ACTIVE] ACTIVE TOURNAMENTS FOUND - Starting live updates')
                    self._run_live_updates()

                    # During active tournaments: smart career history sync at 4-5am UTC
                    if self._check_player_history_update():
                        self.stdout.write('[AUTOMATION] Player history update completed')

                    # During active tournaments: centuries + player stats at 2-3am UTC
                    if self._check_nightly_active_updates():
                        self.stdout.write('[AUTOMATION] Nightly active-tour stats update completed')

                    # 1 day before tournament starts: backfill new players only
                    if self._check_pretournament_update():
                        self.stdout.write('[AUTOMATION] Pre-tournament new-player sync completed')

                    # Use short interval during active periods
                    next_check = active_interval
                    self.stdout.write(f'[TIMER] Next check in {next_check//60} minutes')
                else:
                    self.stdout.write('[SLEEP] No active matches - Checking fallback upcoming matches')
                    
                    # Update upcoming matches as fallback when no active tournaments
                    self._update_upcoming_matches_fallback()
                    
                    # Check for scheduled daily updates (3am UTC)
                    if self._check_daily_updates():
                        self.stdout.write('[AUTOMATION] Daily updates completed')
                    
                    # Check for scheduled monthly updates (1st of month, 3am UTC)
                    if self._check_monthly_updates():
                        self.stdout.write('[AUTOMATION] Monthly updates completed')
                    
                    # Check for upcoming tournaments needing match data (every 4 hours)
                    if self._check_upcoming_tournament_updates():
                        self.stdout.write('[AUTOMATION] Upcoming tournament updates completed')
                    
                    # Check for recently finished tournaments needing final updates
                    if self._check_tournament_end_updates():
                        self.stdout.write('[AUTOMATION] Tournament end updates completed')
                    
                    next_check = sleep_interval
                    self.stdout.write(f'[TIMER] Next check in {next_check//60} minutes')
                
                # Fetch news every 2 hours regardless of tournament state
                self._check_news_fetch()

                # Reset error count on successful run
                self.error_count = 0

                # Sleep until next check
                time.sleep(next_check)
                
            except KeyboardInterrupt:
                self.stdout.write('[STOP] Stopping auto live monitor...')
                break
            except Exception as e:
                self.error_count += 1
                logger.error(f'Auto live monitor error ({self.error_count}/{self.max_errors}): {str(e)}')
                self.stdout.write(f'[ERROR] Error: {str(e)}')
                
                if self.error_count >= self.max_errors:
                    self.stdout.write('[STOP] Too many errors - Stopping monitor')
                    break
                
                # Exponential backoff on errors
                error_sleep = min(300, 30 * (2 ** self.error_count))  # Max 5 minutes
                self.stdout.write(f'[WAIT] Sleeping {error_sleep}s due to error')
                time.sleep(error_sleep)

    def _startup_sync(self):
        """On startup: import current season events + any missing match data."""
        try:
            self.stdout.write('[STARTUP] Syncing current season events...')
            call_command('update_tournaments', '--season', '2025', '--tour', 'main')
            self.stdout.write('[STARTUP] Season events synced')
        except Exception as e:
            logger.error(f'Startup tournament sync failed: {e}')
            self.stdout.write(f'[STARTUP] Tournament sync failed: {e}')

        try:
            self.stdout.write('[STARTUP] Importing matches for events with no data...')
            call_command('update_matches', '--empty-only')
            self.stdout.write('[STARTUP] Missing match data imported')
        except Exception as e:
            logger.error(f'Startup match import failed: {e}')
            self.stdout.write(f'[STARTUP] Match import failed: {e}')

        try:
            self.stdout.write('[STARTUP] Refreshing player match history for top 128...')
            call_command('update_player_details', '--top', '128')
            self.stdout.write('[STARTUP] Player match history refreshed')
        except Exception as e:
            logger.error(f'Startup player history sync failed: {e}')
            self.stdout.write(f'[STARTUP] Player history sync failed: {e}')

        try:
            from oneFourSeven.models import PlayerCareerStats
            populated = PlayerCareerStats.objects.count()
            if populated < 50:
                self.stdout.write(
                    f'[STARTUP] PlayerCareerStats has {populated} rows — running rebuild_player_stats...'
                )
                call_command('rebuild_player_stats')
                self.stdout.write('[STARTUP] rebuild_player_stats completed')
            else:
                self.stdout.write(
                    f'[STARTUP] PlayerCareerStats already populated ({populated} rows) — skipping rebuild'
                )
        except Exception as e:
            logger.error(f'rebuild_player_stats startup check failed: {e}')
            self.stdout.write(f'[STARTUP] rebuild_player_stats failed (non-fatal): {e}')

    def _has_active_matches(self, current_time):
        """Check if there are any tournaments currently in their date range."""
        today = current_time.date()

        # A tournament is "active" if today falls within its start/end dates
        active_tournaments = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=today
        )

        if active_tournaments.exists():
            for event in active_tournaments:
                self.stdout.write(f'[MATCH] Active tournament found: {event.Name} (ID: {event.ID})')
            return True

        # Also check tournaments that ended yesterday (matches can run late)
        yesterday = today - timedelta(days=1)
        recent_tournaments = Event.objects.filter(
            StartDate__lte=today,
            EndDate__gte=yesterday
        )

        if recent_tournaments.exists():
            for event in recent_tournaments:
                self.stdout.write(f'[MATCH] Recent tournament found: {event.Name} (ID: {event.ID})')
            return True

        return False

    def _run_live_updates(self):
        """Run the live match update command."""
        try:
            # Run live match updates for all tournaments
            call_command('update_live_matches', '--max-events', '10')
            self.stdout.write('[SUCCESS] Live updates completed')
        except Exception as e:
            logger.error(f'Failed to run live updates: {str(e)}')
            self.stdout.write(f'[FAILED] Live update failed: {str(e)}')
            raise

        # Send push notifications after match data is updated (never raises)
        self._send_match_notifications()

        # Fetch frame scores for any newly completed matches (non-fatal)
        self._try_fetch_frame_scores()

    def _send_match_notifications(self):
        """
        Send push notifications to devices with favourited players/matches.
        Called after each live update cycle. All errors are caught — never blocks updates.
        """
        try:
            from oneFourSeven.models import DeviceToken, MatchesOfAnEvent, Player
            from oneFourSeven.push_notifications import send_expo_push

            # Reset dedup sets at midnight UTC
            today = timezone.now().date()
            if self.last_notif_reset != today:
                self.notified_live.clear()
                self.notified_result.clear()
                self.notified_upcoming.clear()
                self.notified_resume.clear()
                self.last_notif_reset = today

            # --- Helper: get player name ---
            player_name_cache = {}

            def get_name(pid):
                if pid is None:
                    return 'Unknown'
                if pid not in player_name_cache:
                    try:
                        p = Player.objects.get(ID=pid)
                        name = f"{p.FirstName or ''} {p.LastName or ''}".strip()
                        player_name_cache[pid] = name or f"Player {pid}"
                    except Player.DoesNotExist:
                        player_name_cache[pid] = f"Player {pid}"
                return player_name_cache[pid]

            # --- Notify: matches that just went live (status=1) ---
            recently_started = timezone.now() - timedelta(minutes=4)
            live_matches = MatchesOfAnEvent.objects.filter(Status=1, StartDate__gte=recently_started)
            for match in live_matches:
                mid = match.api_match_id
                if mid is None or mid in self.notified_live:
                    continue

                p1_name = get_name(match.Player1ID)
                p2_name = get_name(match.Player2ID)

                # Devices following this specific match
                match_devices = DeviceToken.objects.filter(favorite_match_ids__contains=[mid])
                match_tokens = [d.push_token for d in match_devices if d.push_token]
                if match_tokens:
                    send_expo_push(match_tokens, '🎱 Live Now',
                                   f'{p1_name} vs {p2_name}',
                                   {'type': 'match_live', 'match_id': mid})
                    self.stdout.write(f'[NOTIFY] Match live: {p1_name} vs {p2_name} → {len(match_tokens)} devices')

                # Devices following Player 1
                if match.Player1ID:
                    p1_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player1ID]
                    )
                    p1_tokens = [d.push_token for d in p1_devices if d.push_token]
                    if p1_tokens:
                        send_expo_push(p1_tokens, '🎱 Now Live',
                                       f'{p1_name} vs {p2_name}',
                                       {'type': 'player_live', 'player_id': match.Player1ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Player live: {p1_name} → {len(p1_tokens)} devices')

                # Devices following Player 2
                if match.Player2ID:
                    p2_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player2ID]
                    )
                    p2_tokens = [d.push_token for d in p2_devices if d.push_token]
                    if p2_tokens:
                        send_expo_push(p2_tokens, '🎱 Now Live',
                                       f'{p2_name} vs {p1_name}',
                                       {'type': 'player_live', 'player_id': match.Player2ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Player live: {p2_name} → {len(p2_tokens)} devices')

                self.notified_live.add(mid)

            # --- Notify: matches that just finished (status=3, ended recently) ---
            finished_matches = MatchesOfAnEvent.objects.filter(
                Status=3,
                EndDate__gte=timezone.now() - timedelta(minutes=10),
            )
            for match in finished_matches:
                mid = match.api_match_id
                if mid is None or mid in self.notified_result:
                    continue

                p1_name = get_name(match.Player1ID)
                p2_name = get_name(match.Player2ID)
                s1 = match.Score1 if match.Score1 is not None else 0
                s2 = match.Score2 if match.Score2 is not None else 0

                # Match followers
                match_devices = DeviceToken.objects.filter(favorite_match_ids__contains=[mid])
                match_tokens = [d.push_token for d in match_devices if d.push_token]
                if match_tokens:
                    send_expo_push(match_tokens, '✅ Result',
                                   f'{p1_name} {s1} – {s2} {p2_name}',
                                   {'type': 'match_result', 'match_id': mid})
                    self.stdout.write(f'[NOTIFY] Match result: {p1_name} {s1}-{s2} {p2_name} → {len(match_tokens)} devices')

                # Player 1 followers
                if match.Player1ID:
                    won = match.WinnerID == match.Player1ID
                    p1_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player1ID]
                    )
                    p1_tokens = [d.push_token for d in p1_devices if d.push_token]
                    if p1_tokens:
                        outcome = 'won' if won else 'lost'
                        send_expo_push(p1_tokens, f'✅ {p1_name} {outcome}',
                                       f'{p1_name} {s1}–{s2} {p2_name}',
                                       {'type': 'player_result', 'player_id': match.Player1ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Player result: {p1_name} {outcome} → {len(p1_tokens)} devices')

                # Player 2 followers
                if match.Player2ID:
                    won = match.WinnerID == match.Player2ID
                    p2_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player2ID]
                    )
                    p2_tokens = [d.push_token for d in p2_devices if d.push_token]
                    if p2_tokens:
                        outcome = 'won' if won else 'lost'
                        send_expo_push(p2_tokens, f'✅ {p2_name} {outcome}',
                                       f'{p2_name} {s2}–{s1} {p1_name}',
                                       {'type': 'player_result', 'player_id': match.Player2ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Player result: {p2_name} {outcome} → {len(p2_tokens)} devices')

                self.notified_result.add(mid)

            # --- Notify: matches starting in the next 5–30 minutes (15-min heads-up) ---
            now = timezone.now()
            window_start = now + timedelta(minutes=5)
            window_end = now + timedelta(minutes=30)
            upcoming_matches = MatchesOfAnEvent.objects.filter(
                Status=0,
                ScheduledDate__gte=window_start,
                ScheduledDate__lte=window_end,
            )
            for match in upcoming_matches:
                mid = match.api_match_id
                if mid is None or mid in self.notified_upcoming:
                    continue

                p1_name = get_name(match.Player1ID)
                p2_name = get_name(match.Player2ID)

                # Match followers
                match_devices = DeviceToken.objects.filter(favorite_match_ids__contains=[mid])
                match_tokens = [d.push_token for d in match_devices if d.push_token]
                if match_tokens:
                    send_expo_push(match_tokens, '⏰ Starting Soon',
                                   f'{p1_name} vs {p2_name} in ~15 min',
                                   {'type': 'match_upcoming', 'match_id': mid})
                    self.stdout.write(f'[NOTIFY] Upcoming match: {p1_name} vs {p2_name} → {len(match_tokens)} devices')

                # Player 1 followers
                if match.Player1ID:
                    p1_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player1ID]
                    )
                    p1_tokens = [d.push_token for d in p1_devices if d.push_token]
                    if p1_tokens:
                        send_expo_push(p1_tokens, '⏰ Starting Soon',
                                       f'{p1_name} vs {p2_name} in ~15 min',
                                       {'type': 'player_upcoming', 'player_id': match.Player1ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Upcoming player: {p1_name} → {len(p1_tokens)} devices')

                # Player 2 followers
                if match.Player2ID:
                    p2_devices = DeviceToken.objects.filter(
                        favorite_player_ids__contains=[match.Player2ID]
                    )
                    p2_tokens = [d.push_token for d in p2_devices if d.push_token]
                    if p2_tokens:
                        send_expo_push(p2_tokens, '⏰ Starting Soon',
                                       f'{p2_name} vs {p1_name} in ~15 min',
                                       {'type': 'player_upcoming', 'player_id': match.Player2ID, 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Upcoming player: {p2_name} → {len(p2_tokens)} devices')

                self.notified_upcoming.add(mid)

            # --- Notify: matches that resumed from break (Status=2 → Status=1) ---
            # Track by DB pk (never changes) so api_match_id changes don't break detection.

            # Step 1: current on-break matches keyed by DB pk
            current_on_break = {
                m.pk: m.api_match_id
                for m in MatchesOfAnEvent.objects.filter(Status=2)
            }

            # Step 2: pks that were on break last cycle but are no longer Status=2
            resumed_pks = set(self.currently_on_break.keys()) - set(current_on_break.keys())

            if resumed_pks:
                resumed_matches = MatchesOfAnEvent.objects.filter(
                    Status=1, pk__in=resumed_pks
                )
                for match in resumed_matches:
                    mid = match.api_match_id
                    if mid is None or mid in self.notified_resume:
                        continue

                    p1_name = get_name(match.Player1ID)
                    p2_name = get_name(match.Player2ID)
                    s1 = match.Score1 if match.Score1 is not None else 0
                    s2 = match.Score2 if match.Score2 is not None else 0

                    # Match followers
                    match_devices = DeviceToken.objects.filter(favorite_match_ids__contains=[mid])
                    match_tokens = [d.push_token for d in match_devices if d.push_token]
                    if match_tokens:
                        send_expo_push(match_tokens, '▶️ Match Resumed',
                                       f'{p1_name} {s1}–{s2} {p2_name}',
                                       {'type': 'match_resumed', 'match_id': mid})
                        self.stdout.write(f'[NOTIFY] Match resumed: {p1_name} vs {p2_name} → {len(match_tokens)} devices')

                    # Player 1 followers
                    if match.Player1ID:
                        p1_devices = DeviceToken.objects.filter(
                            favorite_player_ids__contains=[match.Player1ID]
                        )
                        p1_tokens = [d.push_token for d in p1_devices if d.push_token]
                        if p1_tokens:
                            send_expo_push(p1_tokens, '▶️ Match Resumed',
                                           f'{p1_name} {s1}–{s2} {p2_name}',
                                           {'type': 'player_resumed', 'player_id': match.Player1ID, 'match_id': mid})
                            self.stdout.write(f'[NOTIFY] Resume: {p1_name} → {len(p1_tokens)} devices')

                    # Player 2 followers
                    if match.Player2ID:
                        p2_devices = DeviceToken.objects.filter(
                            favorite_player_ids__contains=[match.Player2ID]
                        )
                        p2_tokens = [d.push_token for d in p2_devices if d.push_token]
                        if p2_tokens:
                            send_expo_push(p2_tokens, '▶️ Match Resumed',
                                           f'{p2_name} {s2}–{s1} {p1_name}',
                                           {'type': 'player_resumed', 'player_id': match.Player2ID, 'match_id': mid})
                            self.stdout.write(f'[NOTIFY] Resume: {p2_name} → {len(p2_tokens)} devices')

                    self.notified_resume.add(mid)

            # Step 3: update on-break tracking for next cycle
            self.currently_on_break = current_on_break

        except Exception as e:
            logger.error(f'[NOTIFY] Push notification error (non-fatal): {e}')
            self.stdout.write(f'[NOTIFY] Error (non-fatal): {e}')
    
    def _check_player_history_update(self) -> bool:
        """
        During active tournaments: smart career history sync at 4-5am UTC.
        Full backfill for new top-128 entrants; current season only for existing players.
        Runs once per day when a tournament is active.
        """
        current_time = timezone.now()

        # 4-5am UTC window
        if 4 <= current_time.hour <= 5:
            today = current_time.date()
            if self.last_player_history_run != today:
                self.stdout.write('[PLAYER_HISTORY] Running 4am career history sync...')
                try:
                    call_command('sync_career_history', '--top', '128')
                    self.stdout.write('[SUCCESS] Career history sync completed')
                except Exception as e:
                    logger.error(f'Career history sync failed: {e}')
                    self.stdout.write(f'[FAILED] Career history sync failed: {e}')
                self.last_player_history_run = today
                return True

        return False

    def _check_nightly_active_updates(self) -> bool:
        """
        During active tournaments: run century stats + player stats at 2-3 AM UTC.
        Targets only players with matches today (smart targeting).
        Runs once per day.
        """
        current_time = timezone.now()

        # 2-3 AM UTC window
        if 2 <= current_time.hour <= 3:
            today = current_time.date()
            if self.last_stats_update_run != today:
                self.stdout.write('[STATS] Running 2am active-tour stats update...')

                try:
                    call_command('fetch_ct_centuries')
                    self.stdout.write('[SUCCESS] Century stats updated from CueTracker')
                except Exception as e:
                    logger.warning(f'fetch_ct_centuries failed (non-fatal): {e}')
                    self.stdout.write(f'[WARNING] Century stats failed: {e}')

                try:
                    call_command('update_player_api_stats')
                    self.stdout.write('[SUCCESS] Player API stats updated')
                except Exception as e:
                    logger.warning(f'update_player_api_stats failed (non-fatal): {e}')
                    self.stdout.write(f'[WARNING] Player API stats failed: {e}')

                try:
                    call_command('update_player_ct_stats')
                    self.stdout.write('[SUCCESS] Player CueTracker stats updated')
                except Exception as e:
                    logger.warning(f'update_player_ct_stats failed (non-fatal): {e}')
                    self.stdout.write(f'[WARNING] Player CT stats failed: {e}')

                self.last_stats_update_run = today
                return True

        return False

    def _check_pretournament_update(self) -> bool:
        """
        1 day before a tournament starts: backfill career history for new top-128 players only.
        Skips existing players (fast). Deduped per event ID.
        """
        try:
            tomorrow = (timezone.now() + timedelta(days=1)).date()
            upcoming = Event.objects.filter(StartDate=tomorrow)
            for event in upcoming:
                if event.ID not in self.pretournament_processed:
                    self.stdout.write(
                        f'[PRETOUR] Tournament starting tomorrow: {event.Name} — syncing new players'
                    )
                    try:
                        call_command('sync_career_history', '--top', '128', '--new-players-only')
                        self.stdout.write(f'[PRETOUR] New-player sync complete for {event.Name}')
                    except Exception as e:
                        logger.error(f'Pre-tournament sync failed for event {event.ID}: {e}')
                        self.stdout.write(f'[PRETOUR] Sync failed: {e}')
                    self.pretournament_processed.add(event.ID)
                    return True
        except Exception as e:
            logger.error(f'_check_pretournament_update error: {e}')
        return False

    def _update_upcoming_matches_fallback(self):
        """Update upcoming matches as fallback when no active tournaments."""
        try:
            from django.utils import timezone
            from oneFourSeven.models import UpcomingMatch
            
            # Check if we need to update upcoming matches (every 4 hours)
            recent_update = UpcomingMatch.objects.filter(
                created_at__gte=timezone.now() - timedelta(hours=4)
            ).exists()
            
            if not recent_update:
                self.stdout.write('[FALLBACK] Updating upcoming matches - no recent data')
                call_command('update_upcoming_matches', '--tour', 'main')
                self.stdout.write('[SUCCESS] Upcoming matches fallback updated')
            else:
                self.stdout.write('[SKIP] Upcoming matches fallback recent - skipping')
                
        except Exception as e:
            logger.error(f'Failed to update upcoming matches fallback: {str(e)}')
            self.stdout.write(f'[FAILED] Upcoming matches fallback failed: {str(e)}')

    def _check_daily_updates(self):
        """Check if daily updates should run (3am UTC)."""
        current_time = timezone.now()

        # Check if it's around 3am UTC (within 1 hour window)
        if 2 <= current_time.hour <= 4:
            today = current_time.date()

            # Use instance variable to track last run - avoids querying missing fields
            if self.last_daily_run != today:
                self.stdout.write('[DAILY] Running daily updates at 3am...')
                self._run_daily_updates()
                self.last_daily_run = today
                return True

        return False
    
    def _run_daily_updates(self):
        """Run daily maintenance updates."""
        try:
            self.stdout.write('[DAILY] Starting daily matches and round updates...')

            # Update active tournaments
            call_command('update_matches', '--active-only')
            self.stdout.write('[SUCCESS] Daily matches updated')

            # Import matches for any event in DB that has zero match data (any season)
            call_command('update_matches', '--empty-only')
            self.stdout.write('[SUCCESS] Empty events import done')

            # Update round details for the current season (top 10 most recent events)
            call_command('update_round_details', '--limit', '10')
            self.stdout.write('[SUCCESS] Daily round details updated')

            # Update player match history daily so profiles stay current
            call_command('update_player_details', '--top', '128')
            self.stdout.write('[SUCCESS] Daily player details updated')

            # Sync other tours (women's, seniors, Q tour) into separate tables
            call_command('sync_other_tours')
            self.stdout.write('[SUCCESS] Other tours synced')

            # Scrape century stats from CueTracker (replaces snookerinfo.co.uk)
            try:
                call_command('fetch_ct_centuries')
                self.stdout.write('[SUCCESS] Century stats scraped from CueTracker')
            except Exception as scrape_err:
                # Non-fatal: existing century data is kept even on failure
                logger.warning(f'Century stats scrape failed (data kept): {scrape_err}')
                self.stdout.write(f'[WARNING] Century stats scrape failed: {scrape_err}')

            # Fetch frame scores for all unfetched completed matches (catches overnight sessions)
            self._try_fetch_frame_scores()

        except Exception as e:
            logger.error(f'Daily updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Daily updates failed: {str(e)}')

    def _check_monthly_updates(self):
        """Check if monthly updates should run (1st of month)."""
        current_time = timezone.now()

        # Check if it's the 1st day of the month and early morning
        if current_time.day == 1 and 2 <= current_time.hour <= 4:
            # Use YYYY-MM string to track which month we last ran
            this_month = current_time.strftime('%Y-%m')

            if self.last_monthly_run != this_month:
                self.stdout.write('[MONTHLY] Running monthly full updates...')
                self._run_monthly_updates()
                self.last_monthly_run = this_month
                return True

        return False
    
    def _run_monthly_updates(self):
        """Run monthly comprehensive updates."""
        try:
            self.stdout.write('[MONTHLY] Starting monthly comprehensive updates...')
            
            # Update tournaments for current season
            call_command('update_tournaments', '--season', '2025', '--tour', 'main')
            self.stdout.write('[SUCCESS] Monthly tournaments updated')
            
            # Update players
            call_command('update_players', '--status', 'pro', '--sex', 'men')
            call_command('update_players', '--status', 'pro', '--sex', 'women')
            self.stdout.write('[SUCCESS] Monthly players updated')
            
            # Update all ranking types (MoneyRankings, QTRankings, WomensRankings, etc.)
            call_command('update_rankings', '--ranking-type', 'all')
            self.stdout.write('[SUCCESS] Monthly rankings updated (all types)')

            # Refresh PlayerCareerStats from snooker.org t=4 + CueTracker (titles, prize, rank, etc.)
            try:
                call_command('rebuild_player_stats')
                self.stdout.write('[SUCCESS] PlayerCareerStats refreshed')
            except Exception as stats_err:
                logger.warning(f'PlayerCareerStats monthly refresh failed (non-fatal): {stats_err}')
                self.stdout.write(f'[WARNING] PlayerCareerStats refresh failed: {stats_err}')

        except Exception as e:
            logger.error(f'Monthly updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Monthly updates failed: {str(e)}')
    
    def _check_upcoming_tournament_updates(self):
        """Check if upcoming tournaments need match/round data updates (every 4 hours)."""
        current_time = timezone.now()
        
        # Only run every 2 hours (check if current hour is divisible by 2) - more frequent updates
        if current_time.hour % 2 != 0:
            return False
        
        # Check if we already ran this hour
        from oneFourSeven.models import Event, MatchesOfAnEvent, RoundDetails
        
        # Find upcoming tournaments in next 1-7 days without match data
        upcoming_start = current_time.date() + timedelta(days=1)
        upcoming_end = current_time.date() + timedelta(days=7)
        
        upcoming_tournaments = Event.objects.filter(
            StartDate__gte=upcoming_start,
            StartDate__lte=upcoming_end
        )
        
        tournaments_needing_update = []
        for tournament in upcoming_tournaments:
            match_count = MatchesOfAnEvent.objects.filter(Event=tournament).count()
            round_count = RoundDetails.objects.filter(Event=tournament).count()
            
            # Tournament needs update if it has no matches, or if matches exist but none have a ScheduledDate
            scheduled_count = MatchesOfAnEvent.objects.filter(
                Event=tournament, ScheduledDate__isnull=False
            ).count()
            if match_count == 0 or scheduled_count == 0:
                tournaments_needing_update.append(tournament)
        
        if tournaments_needing_update:
            self.stdout.write(f'[UPCOMING] Found {len(tournaments_needing_update)} tournaments needing data updates')
            self._run_upcoming_tournament_updates(tournaments_needing_update)
            return True
        
        return False
    
    def _run_upcoming_tournament_updates(self, tournaments):
        """Update match and round data for upcoming tournaments."""
        try:
            for tournament in tournaments:
                self.stdout.write(f'[UPCOMING] Updating {tournament.Name} (ID: {tournament.ID})')
                
                # Try to update matches first
                try:
                    call_command('update_matches', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated matches for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No matches yet for {tournament.Name}: {str(e)}')
                
                # Try to update round details
                try:
                    call_command('update_round_details', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated round details for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No round details yet for {tournament.Name}: {str(e)}')
                
                # Try to update prize money
                try:
                    call_command('update_prize_money', '--event-id', str(tournament.ID))
                    self.stdout.write(f'[SUCCESS] Updated prize money for {tournament.Name}')
                except Exception as e:
                    self.stdout.write(f'[INFO] No prize money yet for {tournament.Name}: {str(e)}')
                
                # Small delay between tournaments to respect API limits
                import time
                time.sleep(2)
                
        except Exception as e:
            logger.error(f'Upcoming tournament updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Upcoming tournament updates failed: {str(e)}')
    
    def _check_tournament_end_updates(self):
        """Check for recently finished tournaments that need ranking and player updates."""
        current_time = timezone.now()
        
        # Find tournaments that ended in the last 48 hours
        end_cutoff = current_time - timedelta(hours=48)
        recently_ended = Event.objects.filter(
            EndDate__gte=end_cutoff,
            EndDate__lt=current_time
        )
        
        # Clean up old processed tournament IDs (older than 7 days)
        old_cutoff = current_time - timedelta(days=7)
        old_tournaments = Event.objects.filter(
            EndDate__lt=old_cutoff,
            ID__in=list(self.processed_tournament_ends)
        ).values_list('ID', flat=True)
        
        for old_id in old_tournaments:
            self.processed_tournament_ends.discard(old_id)
        
        # Check if we have tournaments that ended and might need final updates
        tournaments_needing_final_updates = []
        for tournament in recently_ended:
            # Skip if already processed
            if tournament.ID in self.processed_tournament_ends:
                continue
                
            # Check if this tournament has finished matches (status 3)
            finished_matches = MatchesOfAnEvent.objects.filter(
                Event=tournament,
                Status=3  # Finished
            ).count()
            
            # If tournament has finished matches, it probably ended
            if finished_matches > 0:
                tournaments_needing_final_updates.append(tournament)
        
        if tournaments_needing_final_updates:
            self.stdout.write(f'[TOUR_END] Found {len(tournaments_needing_final_updates)} recently ended tournaments')
            self._run_tournament_end_updates(tournaments_needing_final_updates)
            return True
        
        return False
    
    def _run_tournament_end_updates(self, tournaments):
        """Run comprehensive updates after tournament ends - rankings and players."""
        try:
            for tournament in tournaments:
                self.stdout.write(f'[TOUR_END] Processing end updates for {tournament.Name} (ID: {tournament.ID})')
                
                # Update all ranking types after tournament ends
                ranking_types = [
                    'MoneyRankings',
                    'WorldRankings', 
                    'OneYearRanking',
                    'OneYearMoneyRankings',
                    'MoneySeedings',
                    'QTRankings'
                ]
                
                # Add women's rankings if applicable
                if tournament.Tour in ['womens', 'main']:
                    ranking_types.append('WomensRankings')
                
                # Add amateur rankings if applicable  
                if tournament.Tour in ['amateur', 'other']:
                    ranking_types.append('AmateurRankings')
                
                # Update each ranking type
                for ranking_type in ranking_types:
                    try:
                        self.stdout.write(f'[RANKINGS] Updating {ranking_type} after {tournament.Name}')
                        call_command('update_rankings', '--ranking-type', ranking_type, '--current-season-only')
                        self.stdout.write(f'[SUCCESS] Updated {ranking_type}')
                        
                        # Small delay between ranking updates
                        import time
                        time.sleep(3)
                        
                    except Exception as e:
                        self.stdout.write(f'[WARNING] Failed to update {ranking_type}: {str(e)}')
                        # Continue with other ranking types
                
                # Update players (might have new data after tournament)
                try:
                    self.stdout.write(f'[PLAYERS] Updating players after {tournament.Name}')

                    # Update different player categories based on tournament type
                    if tournament.Tour == 'womens':
                        call_command('update_players', '--status', 'pro', '--sex', 'women')
                    elif tournament.Tour == 'amateur':
                        call_command('update_players', '--status', 'amateur')
                    else:
                        # Main tour - update professional men
                        call_command('update_players', '--status', 'pro', '--sex', 'men')

                    self.stdout.write(f'[SUCCESS] Updated players after {tournament.Name}')

                except Exception as e:
                    self.stdout.write(f'[WARNING] Failed to update players: {str(e)}')

                # Smart career history sync: full backfill for new top-128 entrants, current season for existing
                try:
                    self.stdout.write(f'[CAREER_SYNC] Running post-tournament career history sync for top 128')
                    call_command('sync_career_history', '--top', '128')
                    self.stdout.write(f'[SUCCESS] Career history sync completed')
                except Exception as e:
                    self.stdout.write(f'[WARNING] Career history sync failed: {str(e)}')

                # Mark tournament as processed to avoid duplicate updates
                self.processed_tournament_ends.add(tournament.ID)
                
                # Delay between tournaments to respect API limits
                import time
                time.sleep(5)
                
        except Exception as e:
            logger.error(f'Tournament end updates failed: {str(e)}')
            self.stdout.write(f'[FAILED] Tournament end updates failed: {str(e)}')

    def _try_fetch_frame_scores(self):
        """Fetch frame scores for all unfetched completed matches. Non-fatal.

        All scraping logic lives in fetch_frame_scores.py — if CueTracker dies
        or we switch to a paid API, only that file needs to change.
        """
        try:
            self.stdout.write('[FRAMES] Fetching frame scores for completed matches...')
            call_command('fetch_frame_scores', '--top-ranked', '128')
            self.stdout.write('[FRAMES] Frame scores fetch completed')
        except Exception as e:
            logger.error(f'fetch_frame_scores error (non-fatal): {e}')
            self.stdout.write(f'[FRAMES] Error (non-fatal): {e}')

    def _check_news_fetch(self):
        """Fetch news from RSS feeds every 2 hours."""
        current_time = timezone.now()
        if (self.last_news_fetch is None or
                (current_time - self.last_news_fetch).total_seconds() >= 7200):
            self.stdout.write('[NEWS] Fetching news from RSS feeds...')
            try:
                self._fetch_news()
                self.last_news_fetch = current_time
            except Exception as e:
                self.stdout.write(f'[NEWS] News fetch error: {str(e)}')

    def _fetch_news(self):
        """Delegate to the fetch_news management command (single source of truth)."""
        call_command('fetch_news')
        self.stdout.write('[NEWS] fetch_news command completed')