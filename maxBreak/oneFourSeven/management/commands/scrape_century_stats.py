# management/commands/scrape_century_stats.py
"""
Scrapes snookerinfo.co.uk for season century and 147 statistics.
Saves to CenturyRecord table. Frontend reads only from DB — never from snookerinfo.co.uk.

Runs daily at 3am UTC via auto_live_monitor.
Safe: if scrape fails, existing data is kept untouched.

Usage:
    python manage.py scrape_century_stats                  # current season
    python manage.py scrape_century_stats --season-url https://snookerinfo.co.uk/2024-25/
"""

import logging
import requests
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)

SNOOKERINFO_URL = 'https://snookerinfo.co.uk/'
SNOOKERINFO_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (compatible; MaxBreakApp/1.0)',
}
REQUEST_TIMEOUT = 20


def _parse_int(value: str) -> int:
    """Parse a cell value to int. Returns 0 for '—', empty, or non-numeric."""
    if not value:
        return 0
    cleaned = value.replace(',', '').replace('—', '0').replace('-', '0').strip()
    try:
        return int(cleaned)
    except ValueError:
        return 0


def _determine_season_label(url: str) -> str:
    """Derive season label from URL. snookerinfo.co.uk/ → '2025-26', /2024-25/ → '2024-25'."""
    import re
    match = re.search(r'(\d{4}-\d{2})', url)
    if match:
        return match.group(1)
    # Default: current season
    from datetime import date
    year = date.today().year
    month = date.today().month
    # Snooker season starts ~September. Before Sep → season started last year.
    if month >= 9:
        return f"{year}-{str(year + 1)[2:]}"
    else:
        return f"{year - 1}-{str(year)[2:]}"


def scrape_and_save(url: str = SNOOKERINFO_URL, stdout=None) -> int:
    """
    Fetch snookerinfo.co.uk, parse century table, save to CenturyRecord.
    Returns number of rows saved. Raises on unrecoverable error.
    """
    from bs4 import BeautifulSoup
    from oneFourSeven.models import CenturyRecord, Player

    def log(msg):
        logger.info(msg)
        if stdout:
            stdout.write(msg)

    season_label = _determine_season_label(url)
    log(f'[CENTURIES] Fetching {url} (season {season_label})')

    try:
        response = requests.get(url, headers=SNOOKERINFO_HEADERS, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
    except Exception as e:
        logger.error(f'[CENTURIES] Fetch failed: {e}')
        raise

    soup = BeautifulSoup(response.text, 'html.parser')

    # Find the main data table — snookerinfo uses a single prominent table
    table = soup.find('table')
    if not table:
        raise ValueError('[CENTURIES] No table found on snookerinfo.co.uk — page structure may have changed')

    rows = table.find_all('tr')
    if len(rows) < 2:
        raise ValueError(f'[CENTURIES] Table has only {len(rows)} rows — unexpected structure')

    # Detect column positions from header row
    header_row = rows[0]
    headers = [th.get_text(strip=True).lower() for th in header_row.find_all(['th', 'td'])]
    log(f'[CENTURIES] Table headers: {headers}')

    # Map column names to indices
    def find_col(candidates):
        for c in candidates:
            for i, h in enumerate(headers):
                if c in h:
                    return i
        return None

    col_player = find_col(['player', 'name'])
    col_total  = find_col(['total', 'career'])
    col_s1     = find_col(['25/26', '2025'])   # current season
    col_s2     = find_col(['24/25', '2024'])
    col_s3     = find_col(['23/24', '2023'])
    col_147    = find_col(['147'])

    if col_player is None or col_total is None:
        raise ValueError(f'[CENTURIES] Cannot find required columns in: {headers}')

    # Build player name → Player FK lookup cache (LastName matching)
    player_cache = {}
    saved = 0
    now = timezone.now()

    for row in rows[1:]:
        cells = row.find_all(['td', 'th'])
        if len(cells) < 2:
            continue

        def cell(idx):
            if idx is None or idx >= len(cells):
                return ''
            return cells[idx].get_text(strip=True)

        player_name = cell(col_player)
        if not player_name or player_name.isdigit():
            continue   # skip rank-number cells or empty rows

        career_total   = _parse_int(cell(col_total))
        season_current = _parse_int(cell(col_s1)) if col_s1 is not None else 0
        season_prev1   = _parse_int(cell(col_s2)) if col_s2 is not None else 0
        season_prev2   = _parse_int(cell(col_s3)) if col_s3 is not None else 0
        career_147s    = _parse_int(cell(col_147)) if col_147 is not None else 0

        # Link to Player table — try multiple name orderings
        # Western names: "Mark Selby" → LastName='Selby' (parts[-1])
        # Chinese names: "Zhao Xintong" → LastName='Zhao' (parts[0])
        if player_name not in player_cache:
            parts = player_name.split()
            linked = None
            if parts:
                # Try last word as LastName first (Western convention)
                for candidate_last in [parts[-1], parts[0]]:
                    qs = Player.objects.filter(LastName__iexact=candidate_last)
                    if qs.count() == 1:
                        linked = qs.first()
                        break
                    elif qs.count() > 1 and len(parts) >= 2:
                        # Try matching first word as FirstName
                        candidate_first = parts[0] if candidate_last == parts[-1] else parts[-1]
                        qs2 = qs.filter(FirstName__iexact=candidate_first)
                        if qs2.count() == 1:
                            linked = qs2.first()
                            break
                    if linked:
                        break
            player_cache[player_name] = linked

        player_obj = player_cache[player_name]

        CenturyRecord.objects.update_or_create(
            player_name=player_name,
            season_label=season_label,
            defaults={
                'player':         player_obj,
                'career_total':   career_total,
                'career_147s':    career_147s,
                'season_current': season_current,
                'season_prev1':   season_prev1,
                'season_prev2':   season_prev2,
                'scraped_at':     now,
            }
        )
        saved += 1

    log(f'[CENTURIES] Saved {saved} records for season {season_label}')
    return saved


class Command(BaseCommand):
    help = 'Scrape snookerinfo.co.uk for century/147 stats and save to CenturyRecord table'

    def add_arguments(self, parser):
        parser.add_argument(
            '--season-url',
            type=str,
            default=SNOOKERINFO_URL,
            help='URL to scrape (default: snookerinfo.co.uk/ for current season)'
        )

    def handle(self, *args, **options):
        url = options.get('season_url') or SNOOKERINFO_URL
        try:
            count = scrape_and_save(url=url, stdout=self.stdout)
            self.stdout.write(f'[CENTURIES] Done — {count} records saved.')
        except Exception as e:
            # Non-fatal: log the error, keep existing DB data intact
            logger.error(f'[CENTURIES] Scrape failed — existing data kept: {e}')
            self.stdout.write(f'[CENTURIES] FAILED (existing data kept): {e}')
