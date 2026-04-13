# management/commands/check_backfill_status.py
"""
Shows how complete the career history backfill is for the top N players.

Usage:
  python manage.py check_backfill_status
  python manage.py check_backfill_status --top 128
"""

from datetime import datetime
from django.core.management.base import BaseCommand
from oneFourSeven.models import Player, PlayerMatchHistory, Ranking


class Command(BaseCommand):
    help = 'Check career history backfill coverage for top N players'

    def add_arguments(self, parser):
        parser.add_argument('--top', type=int, default=128)

    def handle(self, *args, **options):
        current_season = datetime.now().year - 1  # 2025 = the 2025/26 season
        top_n = options['top']

        top_ids = list(
            Ranking.objects.filter(
                Type='MoneyRankings',
                Season__in=[current_season, current_season - 1],
            ).order_by('Position').values_list('Player_id', flat=True)[:top_n]
        )
        players = Player.objects.filter(ID__in=top_ids)

        total_expected = 0
        total_fetched = 0
        missing = []

        for player in players:
            first = player.FirstSeasonAsPro or 2005
            for season in range(first, current_season + 1):
                total_expected += 1
                has_data = PlayerMatchHistory.objects.filter(
                    player_id=player.ID, season=season,
                ).exists()
                if has_data:
                    total_fetched += 1
                else:
                    missing.append((player, season))

        pct = total_fetched / total_expected * 100 if total_expected else 0
        remaining_calls = total_expected - total_fetched
        eta_min = remaining_calls * 6 / 60  # 6 sec per call

        self.stdout.write(f'\n{"─" * 55}')
        self.stdout.write(f'  Players checked : {players.count()}')
        self.stdout.write(f'  Expected        : {total_expected} player+season combos')
        self.stdout.write(f'  Fetched         : {total_fetched}')
        self.stdout.write(f'  Missing         : {len(missing)}')
        self.stdout.write(f'  Coverage        : {pct:.1f}%')
        self.stdout.write(f'  ETA to complete : ~{eta_min:.0f} min ({eta_min/60:.1f} hours)')
        self.stdout.write(f'{"─" * 55}')

        if missing:
            self.stdout.write('\nFirst 20 missing:')
            for player, season in missing[:20]:
                self.stdout.write(
                    f'  {player.FirstName} {player.LastName} ({player.ID}) — season {season}'
                )
            if len(missing) > 20:
                self.stdout.write(f'  ... and {len(missing) - 20} more')
        else:
            self.stdout.write(self.style.SUCCESS('\n  All career data fetched!'))

        self.stdout.write('')
