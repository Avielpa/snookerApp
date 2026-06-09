# management/commands/verify_player_stats.py
"""
Verifies our PlayerMatchHistory data against snooker.org career aggregates (t=4).

For each player it:
  1. Calls t=4 to get the official career stats (NumRankingTitles, NumMaximums)
  2. Checks season coverage (no gaps between FirstSeasonAsPro and now)
  3. Checks total match count is plausible (>= years_as_pro * 10)
  4. Checks win rate is sane (30–90%)
  5. Cross-checks NumRankingTitles: player must have reached at least that many finals

Usage:
  python manage.py verify_player_stats
  python manage.py verify_player_stats --top 128
  python manage.py verify_player_stats --player-id 5   # single player
"""

import json
import time
from datetime import datetime
from pathlib import Path

import requests
from django.core.management.base import BaseCommand

from oneFourSeven.constants import API_BASE_URL, HEADERS
from oneFourSeven.models import Player, PlayerMatchHistory, Ranking

API_CALL_DELAY = 30  # seconds — 2 calls/min (snooker.org rate limit)
PROGRESS_FILE = Path(__file__).resolve().parent.parent.parent.parent / 'backfill_progress.json'

MIN_MATCHES_PER_SEASON = 10
WIN_RATE_MIN = 0.30
WIN_RATE_MAX = 0.90


class Command(BaseCommand):
    help = 'Verify PlayerMatchHistory data against snooker.org t=4 career aggregates'

    def add_arguments(self, parser):
        parser.add_argument('--top', type=int, default=128)
        parser.add_argument('--player-id', type=int)
        parser.add_argument('--no-api', action='store_true',
                            help='Skip t=4 API calls — only run DB checks')

    def handle(self, *args, **options):
        current_season = datetime.now().year - 1

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
            players = list(Player.objects.filter(ID__in=top_ids))

        progress = {}
        if PROGRESS_FILE.exists():
            try:
                progress = json.loads(PROGRESS_FILE.read_text())
            except Exception:
                pass

        self.stdout.write(f'\nVerifying {len(players)} players...\n')
        self.stdout.write('─' * 80)
        self.stdout.write(
            f'{"Player":<28} {"Matches":>7} {"Win%":>5} {"Titles":>6} {"API":>5} {"Flags"}'
        )
        self.stdout.write('─' * 80)

        ok = 0
        flagged = 0
        flagged_list = []

        for player in players:
            first = player.FirstSeasonAsPro or 2005
            years_as_pro = current_season - first + 1

            # ── DB stats ─────────────────────────────────────────────────────
            total = PlayerMatchHistory.objects.filter(player_id=player.ID).count()
            wins = PlayerMatchHistory.objects.filter(player_id=player.ID, winner_id=player.ID).count()
            losses = PlayerMatchHistory.objects.filter(
                player_id=player.ID
            ).exclude(winner_id=player.ID).exclude(winner_id__isnull=True).count()
            win_rate = wins / (wins + losses) if (wins + losses) > 0 else 0

            # Finals reached (all events — inflated until events table is complete)
            finals_db = PlayerMatchHistory.objects.filter(
                player_id=player.ID, round_name__iexact='Final'
            ).count()

            # Orphaned seasons
            orphaned = []
            for season in range(first, current_season + 1):
                key = f'{player.ID}:{season}'
                has_rows = PlayerMatchHistory.objects.filter(
                    player_id=player.ID, season=season
                ).exists()
                if not has_rows and key not in progress:
                    orphaned.append(season)

            # ── API call t=4 ─────────────────────────────────────────────────
            api_titles = None
            api_maximums = None
            if not options['no_api']:
                try:
                    time.sleep(API_CALL_DELAY)
                    resp = requests.get(
                        f'{API_BASE_URL}?t=4&p={player.ID}',
                        headers=HEADERS, timeout=15
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        if data:
                            api_titles = data[0].get('NumRankingTitles') or 0
                            api_maximums = data[0].get('NumMaximums') or 0
                            # Update Player model if changed
                            changed = False
                            if player.NumRankingTitles != api_titles:
                                player.NumRankingTitles = api_titles
                                changed = True
                            if player.NumMaximums != api_maximums:
                                player.NumMaximums = api_maximums
                                changed = True
                            if changed:
                                player.save(update_fields=['NumRankingTitles', 'NumMaximums'])
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  API error for {player.ID}: {e}'))
            else:
                api_titles = player.NumRankingTitles or 0

            # ── Flag checks ──────────────────────────────────────────────────
            flags = []

            if years_as_pro >= 2 and total == 0:
                flags.append('NO_MATCHES')

            if years_as_pro >= 2 and total < years_as_pro * MIN_MATCHES_PER_SEASON:
                flags.append(f'LOW_MATCHES({total}<{years_as_pro * MIN_MATCHES_PER_SEASON})')

            if (wins + losses) > 20 and not (WIN_RATE_MIN <= win_rate <= WIN_RATE_MAX):
                flags.append(f'BAD_WIN%({win_rate:.0%})')

            if orphaned:
                flags.append(f'GAPS({len(orphaned)}seasons)')

            # If we have API titles, our finals count (even inflated) must be >= titles
            # A player with 10 ranking titles must have reached at least 10 finals
            if api_titles and api_titles > 0 and finals_db < api_titles:
                flags.append(f'FINALS<TITLES({finals_db}<{api_titles})')

            name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()[:27]
            api_str = str(api_titles) if api_titles is not None else 'skip'
            flag_str = ' '.join(flags) if flags else 'OK'

            line = (
                f'{name:<28} {total:>7} {win_rate:>4.0%} '
                f'{finals_db:>6} {api_str:>5}  {flag_str}'
            )

            if flags:
                flagged += 1
                flagged_list.append((player, flags, orphaned))
                self.stdout.write(self.style.WARNING(line))
            else:
                ok += 1
                self.stdout.write(line)

        self.stdout.write('─' * 80)
        self.stdout.write(f'\n  OK      : {ok}')
        self.stdout.write(f'  FLAGGED : {flagged}')

        if flagged_list:
            self.stdout.write('\n\nFix commands:')
            for player, flags, orphaned in flagged_list:
                name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()
                self.stdout.write(self.style.WARNING(f'\n  {name} (ID={player.ID})'))
                for flag in flags:
                    self.stdout.write(f'    [{flag}]')
                self.stdout.write(
                    f'    python manage.py backfill_career_history --player-id {player.ID} --force'
                )
        else:
            self.stdout.write(self.style.SUCCESS('\n  All players verified!'))

        self.stdout.write('')
