# management/commands/fetch_ct_centuries.py
"""
Scrapes CueTracker for current-season century statistics.
Replaces scrape_century_stats.py (which used snookerinfo.co.uk).

Source: https://cuetracker.net/statistics/centuries/most-made/season
Writes to: CenturyRecord table (same model as before)

- season_current: scraped from CueTracker
- career_total / career_147s: read from PlayerCareerStats / Player in DB
  (kept from existing record if player not yet matched)
- season_prev1 / season_prev2: NOT updated — kept from previous scrapes

Safe: if fetch fails, existing data is kept untouched.

Runs daily at 2 AM UTC inside auto_live_monitor (only when active tour).

Usage:
    python manage.py fetch_ct_centuries
    python manage.py fetch_ct_centuries --dry-run
"""

import logging
import time
from datetime import date

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)

def _s(text):
    """Safe encode for Windows console (cp1255 fallback)."""
    try:
        str(text).encode('cp1255')
        return str(text)
    except (UnicodeEncodeError, LookupError):
        return str(text).encode('ascii', 'replace').decode('ascii')


CT_URL = 'https://cuetracker.net/statistics/centuries/most-made/season'
CT_HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; MaxBreakApp/1.0)'}
REQUEST_TIMEOUT = 20


def _current_season_label() -> str:
    """Return the current snooker season label e.g. '2025-26'.
    Season runs roughly May-April. May is used as the rollover point,
    matching the frontend's useSeasonSelector.ts.
    """
    today = date.today()
    if today.month >= 5:
        return f"{today.year}-{str(today.year + 1)[2:]}"
    else:
        return f"{today.year - 1}-{str(today.year)[2:]}"


def _parse_ct_centuries_page(html: str) -> list:
    """
    Parse CueTracker centuries/most-made/season page.
    Returns list of {'ct_slug': str, 'player_name': str, 'season_current': int}.
    """
    soup = BeautifulSoup(html, 'html.parser')
    results = []

    for table in soup.find_all('table'):
        rows = table.find_all('tr')
        if not rows:
            continue

        # Detect century-count column from <thead> th elements (no <tr> wrapper on cuetracker)
        thead = table.find('thead')
        if thead:
            header_cells = thead.find_all(['th', 'td'])
        else:
            header_cells = rows[0].find_all(['th', 'td'])
            rows = rows[1:]  # first row is header only if no thead

        headers = [c.get_text(strip=True).lower() for c in header_cells]

        century_col = None
        for i, h in enumerate(headers):
            if 'centur' in h or 'breaks' in h or 'total' in h:
                century_col = i
                break

        for row in rows:
            cells = row.find_all('td')
            if not cells:
                continue

            # Find the player link (href contains /players/)
            ct_slug = None
            player_name = None
            for cell in cells:
                a = cell.find('a', href=True)
                if a and '/players/' in a['href']:
                    player_name = a.get_text(strip=True)
                    slug = a['href'].rstrip('/').split('/')[-1]
                    if slug:
                        ct_slug = slug
                    break

            if not player_name:
                continue

            # Get century count
            if century_col is not None and century_col < len(cells):
                raw = cells[century_col].get_text(strip=True).replace(',', '')
                if raw.isdigit():
                    season_current = int(raw)
                else:
                    continue
            else:
                # Fall back: rightmost numeric cell
                season_current = None
                for cell in reversed(cells):
                    t = cell.get_text(strip=True).replace(',', '')
                    if t.isdigit():
                        season_current = int(t)
                        break
                if season_current is None:
                    continue

            results.append({
                'ct_slug': ct_slug,
                'player_name': player_name,
                'season_current': season_current,
            })

        if results:
            break  # First table with player data is the one we want

    return results


def _link_player(ct_slug, player_name):
    """
    Find the matching Player DB record.
    1. Match by ct_slug (exact, reliable)
    2. Fall back to last-name / first-name matching (Western + Chinese names)
    Returns Player or None.
    """
    from oneFourSeven.models import Player

    if ct_slug:
        try:
            return Player.objects.get(ct_slug=ct_slug)
        except Player.DoesNotExist:
            pass

    # Name-based fallback
    parts = player_name.split()
    if not parts:
        return None

    for candidate_last in [parts[-1], parts[0]]:
        qs = Player.objects.filter(LastName__iexact=candidate_last)
        if qs.count() == 1:
            return qs.first()
        if qs.count() > 1 and len(parts) >= 2:
            candidate_first = parts[0] if candidate_last == parts[-1] else parts[-1]
            qs2 = qs.filter(FirstName__iexact=candidate_first)
            if qs2.count() == 1:
                return qs2.first()

    return None


def fetch_and_save(dry_run: bool = False, stdout=None, url: str = None, season_label: str = None) -> int:
    """
    Fetch CueTracker centuries page, parse, save to CenturyRecord.
    Returns number of rows saved/updated. Raises on unrecoverable error.

    url/season_label let this be pointed at a historical CueTracker season
    page (e.g. .../most-made/season/2025-2026) to repair a specific
    season_label's data without touching the current-season scrape path.
    """
    from oneFourSeven.models import CenturyRecord, PlayerCareerStats

    def log(msg):
        logger.info(msg)
        if stdout:
            stdout.write(msg)

    fetch_url = url or CT_URL
    season_label = season_label or _current_season_label()
    log(f'[CT-CENTURIES] Fetching {fetch_url} (season {season_label})')

    try:
        r = requests.get(fetch_url, headers=CT_HEADERS, timeout=REQUEST_TIMEOUT)
        r.raise_for_status()
    except Exception as e:
        logger.error(f'[CT-CENTURIES] Fetch failed: {e}')
        raise

    rows = _parse_ct_centuries_page(r.text)
    if not rows:
        raise ValueError('[CT-CENTURIES] No data parsed — CueTracker page structure may have changed')

    log(f'[CT-CENTURIES] Parsed {len(rows)} players')

    now = timezone.now()
    saved = 0

    for entry in rows:
        player_name = entry['player_name']
        ct_slug = entry['ct_slug']
        season_current = entry['season_current']

        player_obj = _link_player(ct_slug, player_name)

        defaults = {
            'player': player_obj,
            'season_current': season_current,
            'scraped_at': now,
        }

        # Pull career stats from DB (don't overwrite with 0 if player not linked)
        if player_obj:
            defaults['career_147s'] = player_obj.NumMaximums or 0
            try:
                stats = PlayerCareerStats.objects.get(player=player_obj)
                if stats.ct_total_centuries is not None:
                    defaults['career_total'] = stats.ct_total_centuries
            except PlayerCareerStats.DoesNotExist:
                pass

        linked_note = f'-> Player ID={player_obj.ID}' if player_obj else '-> unlinked'
        log(f'  {_s(player_name)} {linked_note}: {season_current} centuries this season')

        if not dry_run:
            CenturyRecord.objects.update_or_create(
                player_name=player_name,
                season_label=season_label,
                defaults=defaults,
            )
        saved += 1

    log(f'[CT-CENTURIES] {"[DRY RUN] " if dry_run else ""}Done - {saved} records {"would be " if dry_run else ""}saved')
    return saved


class Command(BaseCommand):
    help = 'Scrape CueTracker for current-season century stats and save to CenturyRecord'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Parse and log everything but make no DB changes',
        )
        parser.add_argument(
            '--url', type=str, default=None,
            help='Override the CueTracker URL (e.g. a historical season page)',
        )
        parser.add_argument(
            '--season', type=str, default=None,
            help='Override the season_label to save under (e.g. 2025-26)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write('[DRY RUN] No DB changes will be made')
        try:
            count = fetch_and_save(
                dry_run=dry_run, stdout=self.stdout,
                url=options.get('url'), season_label=options.get('season'),
            )
            self.stdout.write(f'[CT-CENTURIES] Done — {count} records processed.')
        except Exception as e:
            logger.error(f'[CT-CENTURIES] Scrape failed — existing data kept: {e}')
            self.stdout.write(f'[CT-CENTURIES] FAILED (existing data kept): {e}')
