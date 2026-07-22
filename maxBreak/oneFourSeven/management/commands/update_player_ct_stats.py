# management/commands/update_player_ct_stats.py
"""
Daily update of PlayerCareerStats from CueTracker career-total-statistics pages.
Targets only players with matches scheduled today (smart targeting).

Fields updated on PlayerCareerStats:
  ct_frames_played, ct_frames_won, ct_career_prize_total,
  ct_total_titles, ct_ranking_titles, ct_finals_reached,
  ct_career_best_rank, ct_total_50plus, ct_total_centuries,
  titles_verified, ct_synced_at

Also cross-validates ranking titles: snooker.org NumRankingTitles vs CueTracker.

Runs daily at 2 AM UTC via auto_live_monitor (only when active tour).
Safe: logs every change; skips players with no ct_slug.
0.5s delay between CueTracker requests (polite scraping).

Usage:
    python manage.py update_player_ct_stats
    python manage.py update_player_ct_stats --dry-run
    python manage.py update_player_ct_stats --player-id 5
"""

import logging
import re
import time
from datetime import date, datetime, timezone as dt_timezone

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

CT_HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; MaxBreakApp/1.0)'}
REQUEST_TIMEOUT = 12
DELAY_BETWEEN_PLAYERS = 0.5


# ── Helpers (copied from rebuild_player_stats.py) ────────────────────────────

def _fetch_ct_career_html(ct_slug):
    """Fetch CueTracker career-total-statistics HTML. Returns (status, html)."""
    url = f'https://cuetracker.net/players/{ct_slug}/career-total-statistics'
    try:
        r = requests.get(url, headers=CT_HEADERS, timeout=REQUEST_TIMEOUT)
        return r.status_code, r.text
    except Exception:
        return 0, ''


def _parse_ct_career(html):
    """
    Parse CueTracker career-total-statistics page.
    Returns dict with all fields we care about, or empty dict on failure.
    """
    soup = BeautifulSoup(html, 'html.parser')
    text = soup.get_text(separator=' | ', strip=True)
    out = {}

    # ── Frames ──────────────────────────────────────────────────────────
    m = re.search(
        r'Frames\s*\|\s*Played:\s*([\d,]+)\s*\|\s*Won:\s*\|\s*([\d,]+)',
        text,
    )
    if m:
        out['frames_played'] = int(m.group(1).replace(',', ''))
        out['frames_won']    = int(m.group(2).replace(',', ''))

    # ── Breaks ──────────────────────────────────────────────────────────
    m = re.search(
        r'\|\s*Breaks\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)'
        r'\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)',
        text,
    )
    if m:
        out['total_centuries'] = int(m.group(6).replace(',', ''))
        out['total_50plus']    = int(m.group(7).replace(',', ''))

    # ── Finishes ────────────────────────────────────────────────────────
    ranking_m = re.search(
        r'Category\s*\|\s*Winner.*?'
        r'(?:^|\|\s*)Ranking\s*\|\s*(\d+)\s*\|\s*(\d+)',
        text, re.DOTALL,
    )
    if ranking_m:
        out['ranking_titles']    = int(ranking_m.group(1))
        out['ranking_runner_up'] = int(ranking_m.group(2))

    total_m = re.search(
        r'6-reds.*?'
        r'Total\s*\|\s*(\d+)\s*\|\s*(\d+)',
        text, re.DOTALL,
    )
    if total_m:
        out['total_titles']    = int(total_m.group(1))
        out['total_runner_up'] = int(total_m.group(2))

    if 'total_titles' in out and 'total_runner_up' in out:
        out['finals_reached'] = out['total_titles'] + out['total_runner_up']

    # ── Career best ranking ──────────────────────────────────────────────
    m = re.search(r'Highest ranking:\s*(\d+)', text)
    if m:
        out['career_best_rank'] = int(m.group(1))

    # ── Career prize money ───────────────────────────────────────────────
    prize_m = re.search(r'Prize money.*?Total\s*\|\s*([\d,]+)', text, re.DOTALL)
    if prize_m:
        out['career_prize_total'] = int(prize_m.group(1).replace(',', ''))

    return out


def _get_todays_player_ids():
    """
    Return set of player IDs with matches today or yesterday (main tour).
    Includes Finished matches (status=3) — a player's career stats only
    change once their match is finished, so excluding that status meant
    the job could never catch the case it exists for. Yesterday is
    included because this job runs at 2 AM UTC, shortly after most
    evening matches finish.
    """
    from datetime import timedelta

    from oneFourSeven.models import UpcomingMatch
    today = date.today()
    yesterday = today - timedelta(days=1)
    matches = UpcomingMatch.objects.filter(
        scheduled_date__date__in=[today, yesterday],
        tour_type='main',
    )

    p1s = set(matches.values_list('player1_id', flat=True))
    p2s = set(matches.values_list('player2_id', flat=True))
    return (p1s | p2s) - {None}


class Command(BaseCommand):
    help = 'Update PlayerCareerStats from CueTracker for players with matches today'

    def add_arguments(self, parser):
        parser.add_argument('--player-id', type=int, help='Update a single player by ID')
        parser.add_argument('--dry-run', action='store_true', help='Log changes without writing to DB')

    def handle(self, *args, **options):
        from oneFourSeven.models import Player, PlayerCareerStats

        dry_run   = options['dry_run']
        single_id = options.get('player_id')

        if dry_run:
            self.stdout.write('[DRY RUN] No DB changes will be made')

        if single_id:
            player_ids = {single_id}
        else:
            player_ids = _get_todays_player_ids()

        if not player_ids:
            self.stdout.write('[CT-STATS] No players with matches today - skipping')
            return

        self.stdout.write(f'[CT-STATS] Updating {len(player_ids)} players from CueTracker')

        synced  = 0
        skipped = 0
        failed  = 0
        verified_count  = 0
        conflict_count  = 0

        now = datetime.now(tz=dt_timezone.utc)

        for pid in sorted(player_ids):
            try:
                player = Player.objects.get(ID=pid)
            except Player.DoesNotExist:
                self.stdout.write(f'  [SKIP] Player ID={pid} not in DB')
                skipped += 1
                continue

            name = f'{player.FirstName} {player.LastName}'.strip()
            ct_slug = getattr(player, 'ct_slug', None)

            if not ct_slug or ct_slug == 'NOT_FOUND':
                self.stdout.write(f'  [NO-CT] {name}: no ct_slug — skipping')
                skipped += 1
                continue

            status, html = _fetch_ct_career_html(ct_slug)
            if status != 200:
                self.stdout.write(f'  [FAIL] {name}: HTTP {status} for slug={ct_slug}')
                failed += 1
                time.sleep(DELAY_BETWEEN_PLAYERS)
                continue

            ct_data = _parse_ct_career(html)
            if not ct_data:
                self.stdout.write(f'  [FAIL] {name}: could not parse CueTracker career page')
                failed += 1
                time.sleep(DELAY_BETWEEN_PLAYERS)
                continue

            self.stdout.write(
                f'  [OK] {name}: '
                f'cents={ct_data.get("total_centuries","?")} '
                f'frames={ct_data.get("frames_played","?")} '
                f'ranking_titles={ct_data.get("ranking_titles","?")} '
                f'total_titles={ct_data.get("total_titles","?")} '
                f'rank#{ct_data.get("career_best_rank","?")}'
            )

            # Cross-validate ranking titles
            api_titles = player.NumRankingTitles
            ct_titles  = ct_data.get('ranking_titles')
            if api_titles is not None and ct_titles is not None:
                verified = (int(api_titles) == int(ct_titles))
                if verified:
                    verified_count += 1
                else:
                    self.stdout.write(
                        f'  [CONFLICT] {name}: snooker.org titles={api_titles} != CT={ct_titles}'
                    )
                    conflict_count += 1
            else:
                verified = None

            cs_fields = {
                'ct_frames_played':      ct_data.get('frames_played'),
                'ct_frames_won':         ct_data.get('frames_won'),
                'ct_career_prize_total': ct_data.get('career_prize_total'),
                'ct_total_titles':       ct_data.get('total_titles'),
                'ct_ranking_titles':     ct_data.get('ranking_titles'),
                'ct_finals_reached':     ct_data.get('finals_reached'),
                'ct_career_best_rank':   ct_data.get('career_best_rank'),
                'ct_total_50plus':       ct_data.get('total_50plus'),
                'ct_total_centuries':    ct_data.get('total_centuries'),
                'titles_verified':       verified,
                'ct_synced_at':          now,
            }
            # Drop Nones so we don't overwrite existing data with null
            cs_fields = {k: v for k, v in cs_fields.items() if v is not None}

            if not dry_run:
                PlayerCareerStats.objects.update_or_create(
                    player=player,
                    defaults=cs_fields,
                )
            synced += 1
            time.sleep(DELAY_BETWEEN_PLAYERS)

        self.stdout.write(
            f'[CT-STATS] Done — synced={synced} skipped={skipped} failed={failed} '
            f'verified={verified_count} conflicts={conflict_count}'
        )
