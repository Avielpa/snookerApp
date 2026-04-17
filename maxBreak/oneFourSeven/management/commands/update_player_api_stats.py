# management/commands/update_player_api_stats.py
"""
Daily update of Player model fields from the snooker.org t=4 API.
Targets only players with matches scheduled today (smart targeting).

Fields updated on Player:
  NumRankingTitles, NumMaximums, Born, Nationality, FirstSeasonAsPro

Runs daily at 2 AM UTC via auto_live_monitor (only when active tour).
Safe: logs every change; skips players where API returns no data.

Usage:
    python manage.py update_player_api_stats
    python manage.py update_player_api_stats --dry-run
    python manage.py update_player_api_stats --player-id 5
"""

import logging
import time
from datetime import date

import requests
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

API_HEADERS = {'X-Requested-By': 'FahimaApp128'}
REQUEST_TIMEOUT = 12
DELAY_BETWEEN_PLAYERS = 0.3

API_FIELD_MAP = {
    'NumRankingTitles': 'NumRankingTitles',
    'NumMaximums':      'NumMaximums',
    'FirstSeasonAsPro': 'FirstSeasonAsPro',
    'Born':             'Born',
    'Nationality':      'Nationality',
}


def _fetch_api_t4(player_id):
    """Fetch player profile from snooker.org t=4. Returns dict or None."""
    try:
        r = requests.get(
            f'https://api.snooker.org/?t=4&p={player_id}',
            headers=API_HEADERS, timeout=REQUEST_TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()
            return data[0] if data else None
    except Exception:
        pass
    return None


def _get_todays_player_ids():
    """
    Return the set of player IDs (from UpcomingMatch) who have matches today.
    Excludes finished matches (status=3).
    """
    from oneFourSeven.models import UpcomingMatch
    today = date.today()
    matches = UpcomingMatch.objects.filter(
        scheduled_date__date=today,
        tour_type='main',
    ).exclude(status=3)

    p1s = set(matches.values_list('player1_id', flat=True))
    p2s = set(matches.values_list('player2_id', flat=True))
    ids = (p1s | p2s) - {None}
    return ids


class Command(BaseCommand):
    help = 'Update Player fields from snooker.org t=4 for players with matches today'

    def add_arguments(self, parser):
        parser.add_argument('--player-id', type=int, help='Update a single player by ID')
        parser.add_argument('--dry-run', action='store_true', help='Log changes without writing to DB')

    def handle(self, *args, **options):
        from oneFourSeven.models import Player

        dry_run   = options['dry_run']
        single_id = options.get('player_id')

        if dry_run:
            self.stdout.write('[DRY RUN] No DB changes will be made')

        if single_id:
            player_ids = {single_id}
        else:
            player_ids = _get_todays_player_ids()

        if not player_ids:
            self.stdout.write('[API-STATS] No players with matches today - skipping')
            return

        self.stdout.write(f'[API-STATS] Updating {len(player_ids)} players from snooker.org t=4')

        updated_count = 0
        skipped_count = 0
        error_count   = 0

        for pid in sorted(player_ids):
            try:
                player = Player.objects.get(ID=pid)
            except Player.DoesNotExist:
                self.stdout.write(f'  [SKIP] Player ID={pid} not in DB')
                skipped_count += 1
                continue

            name = f'{player.FirstName} {player.LastName}'.strip()
            api_row = _fetch_api_t4(pid)

            if not api_row:
                self.stdout.write(f'  [WARN] {name} (ID={pid}): snooker.org t=4 returned no data')
                skipped_count += 1
                time.sleep(DELAY_BETWEEN_PLAYERS)
                continue

            changes = {}
            for api_key, db_field in API_FIELD_MAP.items():
                api_val = api_row.get(api_key)
                db_val  = getattr(player, db_field, None)
                if api_val is not None and str(api_val) != str(db_val):
                    changes[db_field] = api_val

            if changes:
                for field, new_val in changes.items():
                    old_val = getattr(player, field, None)
                    self.stdout.write(f'  [UPDATE] {name} {field}: {old_val!r} → {new_val!r}')
                if not dry_run:
                    Player.objects.filter(ID=pid).update(**changes)
                updated_count += 1
            else:
                self.stdout.write(f'  [OK] {name} (ID={pid}): all fields current')

            time.sleep(DELAY_BETWEEN_PLAYERS)

        self.stdout.write(
            f'[API-STATS] Done — updated={updated_count} skipped={skipped_count} errors={error_count}'
        )
