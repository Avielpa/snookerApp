# management/commands/sync_other_tours.py
"""
Syncs events and matches from non-main tours: women's, seniors, Q tour.
Writes only to OtherTourEvent / OtherTourMatch / OtherTourPlayer tables.
The main Event / MatchesOfAnEvent / Player tables are never touched.

Player resolution order (to minimise API calls):
  1. Main Player table (pro players who also play other tours)
  2. OtherTourPlayer table (previously discovered players)
  3. snooker.org t=4 single-player fetch → save to OtherTourPlayer
  4. Fallback: store "Unknown Player"

Rate limit: 6 seconds between each API request (10 req/min limit).

Usage:
    python manage.py sync_other_tours               # current season
    python manage.py sync_other_tours --season 2025
    python manage.py sync_other_tours --tour womens  # single tour only
"""

import time
import requests
from django.core.management.base import BaseCommand
from oneFourSeven.models import Player, OtherTourEvent, OtherTourPlayer, OtherTourMatch
from oneFourSeven.constants import API_BASE_URL, HEADERS, DEFAULT_TIMEOUT

RATE_LIMIT_SECONDS = 6
TOURS_TO_SYNC = ['womens', 'seniors', 'qtour']


def _api_get(params: dict) -> list:
    """Single snooker.org API call. Returns list or raises."""
    response = requests.get(API_BASE_URL, params=params, headers=HEADERS, timeout=DEFAULT_TIMEOUT)
    response.raise_for_status()
    data = response.json()
    return data if isinstance(data, list) else []


def _resolve_player(player_id: int, name_cache: dict, stdout) -> tuple:
    """
    Resolve a snooker.org player ID to (full_name, nationality).
    Checks main Player table, then OtherTourPlayer, then fetches from API.
    Returns ('TBD', None) if all lookups fail.
    Updates name_cache in place to avoid duplicate lookups within a sync run.
    """
    if not player_id or player_id == 376:   # 376 = snooker.org TBD placeholder
        return 'TBD', None

    if player_id in name_cache:
        return name_cache[player_id]

    # 1. Main Player table
    try:
        p = Player.objects.get(ID=player_id)
        if p.SurnameFirst:
            name = f"{p.LastName} {p.FirstName}".strip()
        else:
            name = f"{p.FirstName} {p.LastName}".strip()
        result = (name or 'TBD', p.Nationality or None)
        name_cache[player_id] = result
        return result
    except Player.DoesNotExist:
        pass

    # 2. OtherTourPlayer table
    try:
        p = OtherTourPlayer.objects.get(snooker_id=player_id)
        name = f"{p.first_name} {p.last_name}".strip()
        result = (name or 'TBD', p.nationality)
        name_cache[player_id] = result
        return result
    except OtherTourPlayer.DoesNotExist:
        pass

    # 3. Fetch from snooker.org (rate-limited by caller)
    stdout.write(f'    [PLAYER] Fetching unknown player {player_id} from API...')
    try:
        time.sleep(RATE_LIMIT_SECONDS)
        data = _api_get({'t': '4', 'p': player_id})
        if data:
            p_data = data[0] if isinstance(data, list) else data
            first = p_data.get('FirstName', '')
            last = p_data.get('LastName', '')
            nat = p_data.get('Nationality', None)
            surname_first = p_data.get('SurnameFirst', False)
            if surname_first:
                name = f"{last} {first}".strip()
            else:
                name = f"{first} {last}".strip()
            if name:
                OtherTourPlayer.objects.update_or_create(
                    snooker_id=player_id,
                    defaults={'first_name': first, 'last_name': last, 'nationality': nat}
                )
                result = (name, nat)
                name_cache[player_id] = result
                stdout.write(f'    [PLAYER] Saved: {name}')
                return result
    except Exception as e:
        stdout.write(f'    [PLAYER] Fetch failed for {player_id}: {e}')

    # 4. Fallback
    result = ('Unknown Player', None)
    name_cache[player_id] = result
    return result


class Command(BaseCommand):
    help = 'Sync women\'s, seniors, and Q tour events + matches into separate tables'

    def add_arguments(self, parser):
        parser.add_argument('--season', type=int, default=None,
                            help='Season year to sync (default: current API season)')
        parser.add_argument('--tour', type=str, default=None,
                            choices=TOURS_TO_SYNC,
                            help='Sync a single tour only')

    def handle(self, *args, **options):
        season = options.get('season')
        single_tour = options.get('tour')
        tours = [single_tour] if single_tour else TOURS_TO_SYNC

        # Determine season
        if not season:
            try:
                self.stdout.write('[SEASON] Fetching current season...')
                season_data = _api_get({'t': '20'})
                season = season_data[0].get('Season') if season_data else 2026
                time.sleep(RATE_LIMIT_SECONDS)
            except Exception as e:
                self.stdout.write(f'[SEASON] Failed to get season, defaulting to 2026: {e}')
                season = 2026

        self.stdout.write(f'[START] Syncing other tours for season {season}: {tours}')

        name_cache = {}   # player_id → (name, nationality) — shared across all tours
        total_events = 0
        total_matches = 0

        for tour in tours:
            self.stdout.write(f'\n[TOUR] Fetching {tour} events...')
            try:
                events_data = _api_get({'t': '5', 'e': season, 'tr': tour})
                time.sleep(RATE_LIMIT_SECONDS)
            except Exception as e:
                self.stdout.write(f'[TOUR] Failed to fetch {tour} events: {e}')
                continue

            if not events_data:
                self.stdout.write(f'[TOUR] No events found for {tour}')
                continue

            self.stdout.write(f'[TOUR] Found {len(events_data)} {tour} events')

            for event_data in events_data:
                event_id = event_data.get('ID')
                event_name = event_data.get('Name', '')

                if not event_id or not event_name:
                    continue

                # Skip Championship League Stage noise
                if 'Championship League Stage' in event_name:
                    continue

                # Upsert event
                from datetime import date
                def parse_date(s):
                    if not s:
                        return None
                    try:
                        return date.fromisoformat(s[:10])
                    except Exception:
                        return None

                other_event, _ = OtherTourEvent.objects.update_or_create(
                    snooker_id=event_id,
                    defaults={
                        'name': event_name,
                        'tour': tour,
                        'season': season,
                        'start_date': parse_date(event_data.get('StartDate')),
                        'end_date': parse_date(event_data.get('EndDate')),
                        'venue': event_data.get('Venue') or None,
                        'city': event_data.get('City') or None,
                        'country': event_data.get('Country') or None,
                    }
                )
                total_events += 1
                self.stdout.write(f'  [EVENT] {event_name} (id={event_id})')

                # Fetch matches for this event
                try:
                    time.sleep(RATE_LIMIT_SECONDS)
                    matches_data = _api_get({'t': '6', 'e': event_id})
                except Exception as e:
                    self.stdout.write(f'  [MATCHES] Failed to fetch matches for {event_id}: {e}')
                    continue

                if not matches_data:
                    continue

                for m in matches_data:
                    match_id = m.get('ID')
                    if not match_id:
                        continue

                    p1_id = m.get('Player1ID') or None
                    p2_id = m.get('Player2ID') or None

                    p1_name, p1_nat = _resolve_player(p1_id or 0, name_cache, self.stdout)
                    p2_name, p2_nat = _resolve_player(p2_id or 0, name_cache, self.stdout)

                    def parse_dt(s):
                        if not s:
                            return None
                        try:
                            from django.utils.dateparse import parse_datetime
                            return parse_datetime(s)
                        except Exception:
                            return None

                    OtherTourMatch.objects.update_or_create(
                        snooker_id=match_id,
                        defaults={
                            'event': other_event,
                            'round': m.get('Round', 0),
                            'number': m.get('Number', 0),
                            'player1_id': p1_id,
                            'player2_id': p2_id,
                            'player1_name': p1_name,
                            'player2_name': p2_name,
                            'player1_nationality': p1_nat,
                            'player2_nationality': p2_nat,
                            'score1': m.get('Score1') if m.get('Score1') is not None else None,
                            'score2': m.get('Score2') if m.get('Score2') is not None else None,
                            'winner_id': m.get('WinnerID') or None,
                            'status': m.get('Status', 0),
                            'scheduled_date': parse_dt(m.get('ScheduledDate')),
                            'start_date': parse_dt(m.get('StartDate')),
                        }
                    )
                    total_matches += 1

                self.stdout.write(f'  [MATCHES] Saved {len(matches_data)} matches for {event_name}')

        self.stdout.write(
            f'\n[DONE] Sync complete: {total_events} events, {total_matches} matches saved.'
        )
