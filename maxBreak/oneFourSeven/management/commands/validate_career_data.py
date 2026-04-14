# management/commands/validate_career_data.py
"""
Systematic sanity checks for career match history data across top N players.
No API calls — pure DB + progress file analysis.

Usage:
  python manage.py validate_career_data
  python manage.py validate_career_data --top 128
  python manage.py validate_career_data --verbose   # print every player, not just flagged
"""

import json
from datetime import datetime
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Avg, Count, Q

from oneFourSeven.models import Player, PlayerMatchHistory, Ranking

PROGRESS_FILE = Path(__file__).resolve().parent.parent.parent.parent / 'backfill_progress.json'

# Minimum matches per year as pro (very conservative — even a bad season has 10+)
MIN_MATCHES_PER_SEASON = 10

# Round names that indicate the data is populated
KNOWN_ROUND_NAMES = {
    'Final', 'Semi-Final', 'Quarter-Final',
    'Last 16', 'Last 32', 'Last 64', 'Last 128', 'Qualifying Round',
}


class Command(BaseCommand):
    help = 'Validate career match history completeness and quality for top N players'

    def add_arguments(self, parser):
        parser.add_argument('--top', type=int, default=128)
        parser.add_argument('--verbose', action='store_true',
                            help='Print every player row, not just flagged ones')

    def handle(self, *args, **options):
        current_season = datetime.now().year - 1
        top_n = options['top']
        verbose = options['verbose']

        # ── Get top N player IDs from rankings ──────────────────────────────
        top_ids = list(
            Ranking.objects.filter(
                Type='MoneyRankings',
                Season__in=[current_season, current_season - 1],
            ).order_by('Position').values_list('Player_id', flat=True)[:top_n]
        )
        players = list(Player.objects.filter(ID__in=top_ids))
        self.stdout.write(f'\nValidating {len(players)} players...\n')

        # ── Load progress file ───────────────────────────────────────────────
        progress = {}
        if PROGRESS_FILE.exists():
            try:
                progress = json.loads(PROGRESS_FILE.read_text())
            except Exception:
                pass

        # ── Get top-32 player IDs for finals check ───────────────────────────
        top32_ids = set(
            Ranking.objects.filter(
                Type='MoneyRankings',
                Season__in=[current_season, current_season - 1],
            ).order_by('Position').values_list('Player_id', flat=True)[:32]
        )

        # ── Per-player analysis ──────────────────────────────────────────────
        ok_count = 0
        flagged_count = 0
        flagged_players = []

        header = f'{"Player":<28} {"Matches":>7} {"Seasons":>7} {"RN%":>5} {"Flags"}'
        self.stdout.write('─' * 70)
        self.stdout.write(header)
        self.stdout.write('─' * 70)

        for player in players:
            first = player.FirstSeasonAsPro or 2005
            years_as_pro = current_season - first + 1

            # All career matches in DB
            total_matches = PlayerMatchHistory.objects.filter(
                player_id=player.ID
            ).count()

            # Seasons that have at least 1 row in DB
            seasons_with_data = PlayerMatchHistory.objects.filter(
                player_id=player.ID
            ).values('season').distinct().count()

            # Round name coverage
            named_rounds = PlayerMatchHistory.objects.filter(
                player_id=player.ID,
                round_name__isnull=False,
            ).count()
            rn_pct = (named_rounds / total_matches * 100) if total_matches else 0

            # Finals reached
            finals_reached = PlayerMatchHistory.objects.filter(
                player_id=player.ID,
                round_name__iexact='Final',
            ).count()

            # Orphaned seasons: seasons in FirstSeasonAsPro..current with neither DB rows nor progress entry
            orphaned = []
            for season in range(first, current_season + 1):
                key = f'{player.ID}:{season}'
                has_rows = PlayerMatchHistory.objects.filter(
                    player_id=player.ID, season=season
                ).exists()
                if not has_rows and key not in progress:
                    orphaned.append(season)

            # ── Flag checks ──────────────────────────────────────────────────
            flags = []

            if years_as_pro >= 2 and total_matches == 0:
                flags.append('NO_MATCHES')

            if years_as_pro >= 2 and total_matches < years_as_pro * MIN_MATCHES_PER_SEASON:
                flags.append(f'LOW({total_matches}<{years_as_pro * MIN_MATCHES_PER_SEASON})')

            if player.ID in top32_ids and years_as_pro >= 5 and finals_reached == 0:
                flags.append('NO_FINALS')

            if total_matches >= 20 and rn_pct < 80:
                flags.append(f'RN%={rn_pct:.0f}')

            if orphaned:
                flags.append(f'ORPHAN({len(orphaned)}seasons)')

            name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()[:27]
            flag_str = ' '.join(flags) if flags else 'OK'

            if flags:
                flagged_count += 1
                flagged_players.append((player, flags, orphaned))
                line = (
                    f'{name:<28} {total_matches:>7} {seasons_with_data:>7} '
                    f'{rn_pct:>4.0f}% {flag_str}'
                )
                self.stdout.write(self.style.WARNING(line))
            else:
                ok_count += 1
                if verbose:
                    line = (
                        f'{name:<28} {total_matches:>7} {seasons_with_data:>7} '
                        f'{rn_pct:>4.0f}% {flag_str}'
                    )
                    self.stdout.write(line)

        self.stdout.write('─' * 70)
        self.stdout.write(
            f'\n  Players OK      : {ok_count}'
            f'\n  Players FLAGGED : {flagged_count}'
        )

        if flagged_players:
            self.stdout.write('\n\nFlagged players — fix commands:')
            for player, flags, orphaned in flagged_players:
                name = f'{player.FirstName or ""} {player.LastName or ""}'.strip()
                self.stdout.write(
                    self.style.WARNING(f'\n  {name} (ID={player.ID}) — {", ".join(flags)}')
                )
                if 'NO_MATCHES' in flags or any(f.startswith('LOW') for f in flags):
                    self.stdout.write(
                        f'    python manage.py backfill_career_history --player-id {player.ID} --force'
                    )
                if orphaned:
                    seasons_str = ', '.join(str(s) for s in orphaned[:5])
                    extra = f' (+{len(orphaned)-5} more)' if len(orphaned) > 5 else ''
                    self.stdout.write(f'    Missing seasons: {seasons_str}{extra}')
                    self.stdout.write(
                        f'    python manage.py backfill_career_history --player-id {player.ID} --force'
                    )
        else:
            self.stdout.write(self.style.SUCCESS('\n  All players passed validation!'))

        self.stdout.write('')
