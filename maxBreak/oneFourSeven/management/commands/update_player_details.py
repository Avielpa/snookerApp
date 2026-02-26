# management/commands/update_player_details.py
"""
Django management command to update player photos and match history.
Fetches data from API t=4 (player details with photos) and t=8 (match history).

Rate limit: snooker.org allows ~10 requests/minute.
All API calls go through _api_get() which enforces a 6-second delay before
each call, keeping us safely under the limit regardless of how many players
or seasons are being fetched.

Usage:
  python manage.py update_player_details --player-id 1
  python manage.py update_player_details --all-active  # All active players
  python manage.py update_player_details --top 50      # Top 50 ranked players
"""

import logging
import time
import requests
from datetime import datetime
from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from oneFourSeven.models import Player, PlayerMatchHistory, Event, Ranking
from oneFourSeven.constants import API_BASE_URL, HEADERS

logger = logging.getLogger(__name__)

# 6 seconds between calls = 10 calls/minute, safely within the snooker.org limit
API_CALL_DELAY = 6


class Command(BaseCommand):
    help = 'Update player photos and match history from API'

    def add_arguments(self, parser):
        parser.add_argument(
            '--player-id',
            type=int,
            help='Specific player ID to update',
        )
        parser.add_argument(
            '--all-active',
            action='store_true',
            help='Update all active professional players',
        )
        parser.add_argument(
            '--top',
            type=int,
            help='Update top N ranked players',
        )
        parser.add_argument(
            '--seasons',
            type=int,
            default=1,
            help='Number of seasons to fetch match history (default: 1 = current season only)',
        )

    def handle(self, *args, **options):
        self.stdout.write('[START] Updating player details...')

        player_id = options.get('player_id')
        all_active = options.get('all_active')
        top_n = options.get('top')
        seasons_count = options.get('seasons', 1)

        # Determine which players to update
        players = []

        if player_id:
            try:
                player = Player.objects.get(ID=player_id)
                players = [player]
                self.stdout.write(f'[PLAYER] Updating single player: {player}')
            except Player.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'Player {player_id} not found'))
                return

        elif all_active:
            players = Player.objects.filter(
                Q(LastSeasonAsPro=0) | Q(LastSeasonAsPro__isnull=True)
            ).order_by('ID')
            self.stdout.write(f'[PLAYERS] Updating {players.count()} active players')

        elif top_n:
            current_year = datetime.now().year
            top_player_ids = Ranking.objects.filter(
                Type='MoneyRankings',
                Season__in=[current_year, current_year - 1]
            ).order_by('Position').values_list('Player_id', flat=True)[:top_n]

            players = Player.objects.filter(ID__in=top_player_ids)
            self.stdout.write(f'[PLAYERS] Updating top {top_n} ranked players')

        else:
            self.stdout.write(self.style.ERROR('Please specify --player-id, --all-active, or --top N'))
            return

        success_count = 0
        error_count = 0

        for player in players:
            try:
                self.stdout.write(f'\n[UPDATING] Player: {player.ID} - {player}')

                photo_updated = self._update_player_photo(player)
                matches_updated = self._update_player_matches(player, seasons_count)

                if photo_updated or matches_updated:
                    success_count += 1
                    self.stdout.write(self.style.SUCCESS(f'[OK] Updated {player}'))

            except Exception as e:
                error_count += 1
                logger.error(f'Failed to update player {player.ID}: {str(e)}')
                self.stdout.write(self.style.ERROR(f'[FAILED] {player}: {str(e)}'))

        self.stdout.write(f'\n[SUMMARY] Success: {success_count}, Errors: {error_count}')

    def _api_get(self, url):
        """
        Make a rate-limited GET request to snooker.org.
        Sleeps BEFORE every call so back-to-back calls are always spaced out,
        regardless of how many calls happen per player or per loop iteration.
        """
        time.sleep(API_CALL_DELAY)
        return requests.get(url, headers=HEADERS, timeout=15)

    def _update_player_photo(self, player):
        """Fetch and update player photo from API t=4"""
        try:
            url = f"{API_BASE_URL}?t=4&p={player.ID}"
            response = self._api_get(url)
            if response.status_code in (403, 404):
                return False
            response.raise_for_status()

            data = response.json()
            if data and len(data) > 0:
                photo_url = data[0].get('Photo')
                if photo_url and photo_url.startswith('http'):
                    if player.Photo != photo_url:
                        player.Photo = photo_url
                        player.save(update_fields=['Photo'])
                        self.stdout.write(f'  [PHOTO] Updated photo URL')
                        return True
                    else:
                        self.stdout.write(f'  [PHOTO] Photo already up to date')
                else:
                    self.stdout.write(f'  [PHOTO] No valid photo URL')

            return False

        except Exception as e:
            logger.error(f'Failed to fetch photo for player {player.ID}: {str(e)}')
            return False

    def _update_player_matches(self, player, seasons_count):
        """Fetch and update player match history from API t=8"""
        try:
            # The snooker.org API uses the season start year.
            # Season "2025" covers the entire 2025/26 season (including early 2026 matches).
            # We start from current_year - 1 to always land on the active season year.
            current_year = datetime.now().year
            seasons_to_fetch = [current_year - 1 - i for i in range(seasons_count)]

            total_matches = 0

            for season in seasons_to_fetch:
                url = f"{API_BASE_URL}?t=8&p={player.ID}&s={season}"
                response = self._api_get(url)  # rate-limited
                if response.status_code in (403, 404):
                    self.stdout.write(f'  [SKIP] Player {player.ID} season {season}: {response.status_code}')
                    continue
                response.raise_for_status()

                matches_data = response.json()
                if not matches_data:
                    self.stdout.write(f'  [MATCHES] No matches for season {season}')
                    continue

                matches_saved = 0
                for match_data in matches_data:
                    try:
                        event_name = None
                        event_id = match_data.get('EventID')
                        if event_id:
                            try:
                                event = Event.objects.get(ID=event_id)
                                event_name = event.Name
                            except Event.DoesNotExist:
                                pass

                        PlayerMatchHistory.objects.update_or_create(
                            api_match_id=match_data.get('ID'),
                            player_id=player.ID,
                            defaults={
                                'event_id': event_id,
                                'event_name': event_name,
                                'round_number': match_data.get('Round'),
                                'round_name': None,
                                'player1_id': match_data.get('Player1ID'),
                                'player1_name': self._get_player_name(match_data.get('Player1ID')),
                                'score1': match_data.get('Score1'),
                                'player2_id': match_data.get('Player2ID'),
                                'player2_name': self._get_player_name(match_data.get('Player2ID')),
                                'score2': match_data.get('Score2'),
                                'winner_id': match_data.get('WinnerID'),
                                'status': match_data.get('Status', 0),
                                'scheduled_date': self._parse_date(match_data.get('ScheduledDate')),
                                'start_date': self._parse_date(match_data.get('StartDate')),
                                'end_date': self._parse_date(match_data.get('EndDate')),
                                'season': season,
                            }
                        )
                        matches_saved += 1

                    except Exception as e:
                        logger.error(f'Failed to save match {match_data.get("ID")}: {str(e)}')
                        continue

                self.stdout.write(f'  [MATCHES] Season {season}: {matches_saved} matches saved')
                total_matches += matches_saved

            if total_matches > 0:
                self.stdout.write(f'  [MATCHES] Total: {total_matches} matches updated')
                return True

            return False

        except Exception as e:
            logger.error(f'Failed to fetch matches for player {player.ID}: {str(e)}')
            return False

    def _parse_date(self, date_string):
        """Parse date string from API"""
        if not date_string:
            return None
        try:
            dt = datetime.fromisoformat(date_string.replace('Z', '+00:00'))
            return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
        except Exception:
            return None

    def _get_player_name(self, player_id):
        """Get player name from database"""
        if not player_id:
            return "Unknown"
        try:
            player = Player.objects.get(ID=player_id)
            return str(player)
        except Player.DoesNotExist:
            return f"Player {player_id}"
