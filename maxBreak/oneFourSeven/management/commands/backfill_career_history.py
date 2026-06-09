# management/commands/backfill_career_history.py
"""
Backfills complete career match history for the top N ranked players.

Fetches every season from each player's FirstSeasonAsPro up to the current
season using the snooker.org API (t=8). Also infers round_name from round
position within each event (max round = Final, second-highest = Semi-Final, etc.)
so that finals/semi-final career stats work correctly.

Rate limit: 10 calls/minute → 6-second delay before each call.
Resumable: already-fetched player+season combos are skipped automatically.
Progress is printed live with an ETA.

Usage:
  python manage.py backfill_career_history --top 128
  python manage.py backfill_career_history --top 128 --from-season 2000
  python manage.py backfill_career_history --player-id 1
  python manage.py backfill_career_history --top 128 --force   # re-fetch all (fixes round_name)
"""

import json
import logging
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import requests
from django.core.management.base import BaseCommand
from django.db import close_old_connections
from django.utils import timezone

from oneFourSeven.constants import API_BASE_URL, HEADERS
from oneFourSeven.models import Player, PlayerMatchHistory, Ranking

logger = logging.getLogger(__name__)

API_CALL_DELAY = 30  # seconds — 2 calls/min (snooker.org rate limit)

ROUND_NAME_FROM_TOP = [
    'Final',
    'Semi-Final',
    'Quarter-Final',
    'Last 16',
    'Last 32',
    'Last 64',
    'Last 128',
    'Qualifying Round',
]

PROGRESS_FILE = Path(__file__).resolve().parent.parent.parent.parent / 'backfill_progress.json'


def infer_round_name(round_number: int, max_round: int) -> str | None:
    """
    Infer round name based on distance from the final round.
    max_round is the highest round number in that event (= the Final).
    """
    if not round_number or not max_round:
        return None
    dist = max_round - round_number  # 0 = Final, 1 = Semi-Final, etc.
    if 0 <= dist < len(ROUND_NAME_FROM_TOP):
        return ROUND_NAME_FROM_TOP[dist]
    return f'Round {round_number}'


class Command(BaseCommand):
    help = 'Backfill complete career match history for top N players'

    def add_arguments(self, parser):
        parser.add_argument('--top', type=int, default=128,
                            help='Top N ranked players to backfill (default: 128)')
        parser.add_argument('--player-id', type=int,
                            help='Backfill a single player by ID')
        parser.add_argument('--from-season', type=int, default=None,
                            help='Override start season (default: use FirstSeasonAsPro per player)')
        parser.add_argument('--to-season', type=int, default=None,
                            help='Override end season (default: current season)')
        parser.add_argument('--force', action='store_true',
                            help='Re-fetch seasons already in DB (useful to fix round_name)')

    def handle(self, *args, **options):
        current_season = datetime.now().year - 1  # snooker.org stores 2025/26 season as 2025
        end_season = options['to_season'] or current_season
        force = options['force']

        # ── Select players ──────────────────────────────────────────────────
        if options['player_id']:
            try:
                players = [Player.objects.get(ID=options['player_id'])]
            except Player.DoesNotExist:
                self.stderr.write(f'Player {options["player_id"]} not found')
                return
        else:
            top_n = options['top']
            top_ids = list(
                Ranking.objects.filter(
                    Type='MoneyRankings',
                    Season__in=[current_season, current_season - 1],
                ).order_by('Position').values_list('Player_id', flat=True)[:top_n]
            )
            if not top_ids:
                self.stderr.write('No ranking data found. Run update_rankings first.')
                return
            players = list(Player.objects.filter(ID__in=top_ids))
            self.stdout.write(f'Found {len(players)} ranked players to backfill')

        # ── Calculate total work ─────────────────────────────────────────────
        tasks = []  # list of (player, season)
        for player in players:
            from_season = options['from_season'] or (player.FirstSeasonAsPro or 2005)
            for season in range(from_season, end_season + 1):
                if not force and self._already_fetched(player.ID, season):
                    continue
                tasks.append((player, season))

        total = len(tasks)
        if total == 0:
            self.stdout.write(self.style.SUCCESS('Nothing to fetch — all seasons already in DB. Use --force to re-fetch.'))
            return

        total_minutes = total * API_CALL_DELAY / 60
        self.stdout.write(
            f'\n{"─" * 60}\n'
            f'  Players : {len(players)}\n'
            f'  Calls   : {total}\n'
            f'  ETA     : {total_minutes:.0f} min ({total_minutes / 60:.1f} hours)\n'
            f'{"─" * 60}\n'
        )

        # ── Load progress file ───────────────────────────────────────────────
        progress = self._load_progress()

        # ── Main loop ────────────────────────────────────────────────────────
        done = 0
        errors = 0
        start_time = time.time()

        for player, season in tasks:
            done += 1
            elapsed = time.time() - start_time
            rate = done / elapsed if elapsed > 0 else 0
            remaining = (total - done) / rate if rate > 0 else 0
            eta_min = remaining / 60

            self.stdout.write(
                f'[{done}/{total}] {player.FirstName} {player.LastName} | '
                f'season {season} | ETA {eta_min:.0f}m',
                ending='\r'
            )
            self.stdout.flush()

            try:
                close_old_connections()
                saved = self._fetch_and_save(player, season)
                key = f'{player.ID}:{season}'
                progress[key] = saved
                self._save_progress(progress)

                if done % 20 == 0:  # full line every 20 calls
                    self.stdout.write(
                        f'\n[{done}/{total}] {player.FirstName} {player.LastName} '
                        f'season {season}: {saved} matches | ETA {eta_min:.0f}m'
                    )

            except Exception as e:
                errors += 1
                self.stdout.write(
                    self.style.ERROR(f'\n[ERROR] {player} season {season}: {e}')
                )
                logger.error(f'backfill failed for {player.ID} season {season}: {e}')

        elapsed_total = (time.time() - start_time) / 60
        self.stdout.write(
            f'\n\n{"─" * 60}\n'
            f'  Done    : {done} calls\n'
            f'  Errors  : {errors}\n'
            f'  Time    : {elapsed_total:.1f} min\n'
            f'{"─" * 60}'
        )

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _already_fetched(self, player_id: int, season: int) -> bool:
        """Skip if we already called the API for this player+season.
        Checks any match status (not just finished) so seasons with only
        qualifying losses or no-data aren't re-fetched unnecessarily.
        Also checks the progress file for seasons where API returned 0 matches.
        """
        if PlayerMatchHistory.objects.filter(player_id=player_id, season=season).exists():
            return True
        # Check progress file for seasons fetched but returned 0 matches
        key = f'{player_id}:{season}'
        progress = self._load_progress()
        return key in progress

    def _api_get(self, url: str):
        time.sleep(API_CALL_DELAY)
        return requests.get(url, headers=HEADERS, timeout=20)

    def _fetch_and_save(self, player, season: int) -> int:
        url = f'{API_BASE_URL}?t=8&p={player.ID}&s={season}'
        response = self._api_get(url)

        if response.status_code in (403, 404):
            return 0
        response.raise_for_status()

        matches_data = response.json()
        if not matches_data:
            return 0

        # ── Infer round names ────────────────────────────────────────────────
        # Find the highest round number per event in this batch.
        # Highest round number = Final (single-elimination bracket).
        event_max_round: dict[int, int] = defaultdict(int)
        for m in matches_data:
            eid = m.get('EventID')
            rnd = m.get('Round') or 0
            if eid and rnd > event_max_round[eid]:
                event_max_round[eid] = rnd

        # ── Save matches ─────────────────────────────────────────────────────
        close_old_connections()  # reconnect after the API sleep
        saved = 0
        for m in matches_data:
            try:
                event_id = m.get('EventID')
                round_number = m.get('Round')
                max_rnd = event_max_round.get(event_id, 0) if event_id else 0
                round_name = infer_round_name(round_number, max_rnd)

                PlayerMatchHistory.objects.update_or_create(
                    player_id=player.ID,
                    event_id=event_id,
                    round_number=round_number,
                    player1_id=m.get('Player1ID'),
                    player2_id=m.get('Player2ID'),
                    defaults={
                        'api_match_id': m.get('ID'),
                        'event_name': self._event_name(event_id),
                        'round_name': round_name,
                        'player1_name': self._player_name(m.get('Player1ID')),
                        'score1': m.get('Score1'),
                        'player2_name': self._player_name(m.get('Player2ID')),
                        'score2': m.get('Score2'),
                        'winner_id': m.get('WinnerID'),
                        'status': m.get('Status', 0),
                        'scheduled_date': self._parse_date(m.get('ScheduledDate')),
                        'start_date': self._parse_date(m.get('StartDate')),
                        'end_date': self._parse_date(m.get('EndDate')),
                        'season': season,
                    },
                )
                saved += 1
            except Exception as e:
                logger.error(f'Failed to save match {m.get("ID")} for player {player.ID}: {e}')

        return saved

    # ── Caches to avoid N+1 queries inside the match loop ────────────────────

    _player_cache: dict[int, str] = {}
    _event_cache: dict[int, str] = {}

    def _player_name(self, player_id) -> str:
        if not player_id:
            return 'Unknown'
        if player_id not in self._player_cache:
            try:
                p = Player.objects.get(ID=player_id)
                self._player_cache[player_id] = f'{p.FirstName or ""} {p.LastName or ""}'.strip()
            except Player.DoesNotExist:
                self._player_cache[player_id] = f'Player {player_id}'
        return self._player_cache[player_id]

    def _event_name(self, event_id) -> str | None:
        if not event_id:
            return None
        if event_id not in self._event_cache:
            from oneFourSeven.models import Event
            try:
                self._event_cache[event_id] = Event.objects.get(ID=event_id).Name
            except Exception:
                self._event_cache[event_id] = None
        return self._event_cache[event_id]

    def _parse_date(self, s):
        if not s:
            return None
        try:
            dt = datetime.fromisoformat(s.replace('Z', '+00:00'))
            return dt if timezone.is_aware(dt) else timezone.make_aware(dt)
        except Exception:
            return None

    # ── Progress file ─────────────────────────────────────────────────────────

    def _load_progress(self) -> dict:
        if PROGRESS_FILE.exists():
            try:
                return json.loads(PROGRESS_FILE.read_text())
            except Exception:
                return {}
        return {}

    def _save_progress(self, progress: dict):
        try:
            PROGRESS_FILE.write_text(json.dumps(progress))
        except Exception:
            pass
