# management/commands/sync_career_history.py
"""
Lightweight career history sync — designed for automated daily/tournament-triggered runs.

Logic per player:
  - No historical seasons in DB → NEW player: full career backfill via backfill_career_history
  - Has historical data      → EXISTING player: fetch current season only (fast)

Flags:
  --top N            Top N ranked players (default 128)
  --new-players-only Skip current-season update; only backfill genuinely new players (pre-tournament use)

Called automatically by auto_live_monitor:
  1. Daily 4-5 AM UTC during active tours
  2. After tournament final is completed
  3. 1 day before a tournament starts (--new-players-only)

Duplicate safety:
  - update_or_create on api_match_id prevents any duplicate rows
  - New-player detection: after first full backfill the player has history → second run
    falls into current-season-only path automatically
"""

import logging
import time
from collections import defaultdict
from datetime import datetime

import requests
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import close_old_connections

from oneFourSeven.constants import API_BASE_URL, HEADERS
from oneFourSeven.models import Event, Player, PlayerMatchHistory, Ranking

logger = logging.getLogger(__name__)

API_CALL_DELAY = 30  # seconds — 2 calls/min (snooker.org rate limit)

ROUND_NAME_FROM_TOP = [
    'Final', 'Semi-Final', 'Quarter-Final',
    'Last 16', 'Last 32', 'Last 64', 'Last 128', 'Qualifying Round',
]


def _infer_round_name(round_number, max_round):
    if not round_number or not max_round:
        return None
    dist = max_round - round_number
    if 0 <= dist < len(ROUND_NAME_FROM_TOP):
        return ROUND_NAME_FROM_TOP[dist]
    return f'Round {round_number}'


class Command(BaseCommand):
    help = 'Smart career history sync: full backfill for new players, current season for existing'

    def add_arguments(self, parser):
        parser.add_argument('--top', type=int, default=128)
        parser.add_argument(
            '--new-players-only', action='store_true',
            help='Only backfill players with no existing career data (pre-tournament use)',
        )

    def handle(self, *args, **options):
        from oneFourSeven.constants import current_season_int
        current_season = current_season_int()
        top_n = options['top']
        new_players_only = options['new_players_only']

        # ── Get top N players from rankings ──────────────────────────────────
        top_ids = list(
            Ranking.objects.filter(
                Type='MoneyRankings',
                Season__in=[current_season, current_season - 1],
            ).order_by('Position').values_list('Player_id', flat=True)[:top_n]
        )
        players = list(Player.objects.filter(ID__in=top_ids))
        self.stdout.write(f'[sync_career_history] {len(players)} players | new-only={new_players_only}')

        new_players = []
        existing_players = []

        for player in players:
            has_career = PlayerMatchHistory.objects.filter(
                player_id=player.ID,
                season__lt=current_season,
            ).exists()
            if has_career:
                existing_players.append(player)
            else:
                new_players.append(player)

        self.stdout.write(
            f'  New players (full backfill needed): {len(new_players)}'
            f' | Existing: {len(existing_players)}'
        )

        # ── Full career backfill for new players ─────────────────────────────
        for player in new_players:
            name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()
            self.stdout.write(f'[NEW] {name} (ID={player.ID}) — running full career backfill')
            try:
                call_command(
                    'backfill_career_history',
                    player_id=player.ID,
                    stdout=self.stdout,
                    stderr=self.stderr,
                )
                self.stdout.write(f'[NEW] {name} — backfill complete')
            except Exception as e:
                logger.error(f'sync_career_history: full backfill failed for {player.ID}: {e}')
                self.stdout.write(f'[ERROR] {name} full backfill failed: {e}')

        if new_players_only:
            self.stdout.write('[sync_career_history] --new-players-only: skipping current-season update')
            return

        # ── Current season update for existing players ────────────────────────
        self.stdout.write(f'[sync_career_history] Updating current season ({current_season}) for {len(existing_players)} players')
        updated = 0
        errors = 0

        for i, player in enumerate(existing_players):
            name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()
            try:
                close_old_connections()
                saved = self._fetch_and_save(player, current_season)
                updated += 1
                if (i + 1) % 20 == 0:
                    self.stdout.write(f'  [{i+1}/{len(existing_players)}] {name} season {current_season}: {saved} matches')
            except Exception as e:
                errors += 1
                logger.error(f'sync_career_history: season update failed for {player.ID}: {e}')
                self.stdout.write(f'[ERROR] {name}: {e}')

        self.stdout.write(
            f'[sync_career_history] Done — updated={updated} errors={errors}'
        )

    # ── Fetch + save a single player+season ──────────────────────────────────

    _player_cache: dict = {}
    _event_cache: dict = {}

    def _fetch_and_save(self, player, season: int) -> int:
        url = f'{API_BASE_URL}?t=8&p={player.ID}&s={season}'
        time.sleep(API_CALL_DELAY)
        response = requests.get(url, headers=HEADERS, timeout=20)

        if response.status_code in (403, 404):
            return 0
        response.raise_for_status()

        matches_data = response.json()
        if not matches_data:
            return 0

        # Infer round names from max round per event
        event_max_round: dict = defaultdict(int)
        for m in matches_data:
            eid = m.get('EventID')
            rnd = m.get('Round') or 0
            if eid and rnd > event_max_round[eid]:
                event_max_round[eid] = rnd

        close_old_connections()
        saved = 0
        for m in matches_data:
            try:
                event_id = m.get('EventID')
                round_number = m.get('Round')
                max_rnd = event_max_round.get(event_id, 0) if event_id else 0
                round_name = _infer_round_name(round_number, max_rnd)

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
                logger.error(f'sync_career_history: failed to save match {m.get("ID")} for {player.ID}: {e}')

        return saved

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

    def _event_name(self, event_id) -> str:
        if not event_id:
            return None
        if event_id not in self._event_cache:
            try:
                self._event_cache[event_id] = Event.objects.get(ID=event_id).Name
            except Exception:
                self._event_cache[event_id] = None
        return self._event_cache[event_id]

    def _parse_date(self, s):
        if not s:
            return None
        try:
            from datetime import datetime as dt
            from django.utils import timezone
            d = dt.fromisoformat(s.replace('Z', '+00:00'))
            return d if timezone.is_aware(d) else timezone.make_aware(d)
        except Exception:
            return None
