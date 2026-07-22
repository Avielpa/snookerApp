# management/commands/rebuild_player_stats.py
"""
One-time command: rebuild PlayerCareerStats for the top 128 ranked players.

Sources:
  1. snooker.org t=4 API  — refreshes NumRankingTitles, NumMaximums, Born,
                             Nationality, FirstSeasonAsPro on the Player model
  2. CueTracker career-total-statistics — frames, prize money, finishes,
                             breaks, career best rank

Also fills Ranking table gaps (seasons missing MoneyRankings rows) using
per-season prize money from CueTracker.

Run once on Railway, then delete this command.

Usage:
  python manage.py rebuild_player_stats
  python manage.py rebuild_player_stats --player-id 5
  python manage.py rebuild_player_stats --dry-run
"""

import re
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand

from oneFourSeven.models import Player, PlayerCareerStats, Ranking


# ── Constants ────────────────────────────────────────────────────────────────

API_HEADERS = {'X-Requested-By': 'FahimaApp128'}
CT_HEADERS  = {'User-Agent': 'Mozilla/5.0 (compatible; MaxBreakApp/1.0)'}
REQUEST_TIMEOUT = 12

# Fields to refresh from snooker.org t=4
API_FIELD_MAP = {
    'NumRankingTitles': 'NumRankingTitles',
    'NumMaximums':      'NumMaximums',
    'FirstSeasonAsPro': 'FirstSeasonAsPro',
    'Born':             'Born',
    'Nationality':      'Nationality',
}

DELAY_BETWEEN_PLAYERS = 30  # seconds — every player also calls snooker.org t=4
# (2 req/min rate limit, see verify_player_stats.py / sync_career_history.py);
# CueTracker itself has no rate limit but shares this loop's per-player delay.


# ── Encoding helper ───────────────────────────────────────────────────────────

def _s(text):
    """Safe encode for Windows console (cp1255 fallback)."""
    try:
        str(text).encode('cp1255')
        return str(text)
    except (UnicodeEncodeError, LookupError):
        return str(text).encode('ascii', 'replace').decode('ascii')


# ── snooker.org helpers ───────────────────────────────────────────────────────

def _fetch_api_t4(player_id):
    """Fetch player profile from snooker.org t=4. Returns dict or None."""
    try:
        r = requests.get(
            f'https://api.snooker.org/?t=4&p={player_id}',
            headers=API_HEADERS, timeout=REQUEST_TIMEOUT,
        )
        if r.status_code == 200:
            data = r.json()
            return data[0] if data else None
    except Exception:
        pass
    return None


# ── CueTracker helpers ────────────────────────────────────────────────────────

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

    # ── Breaks: data row has all digits (skip header row with "50s 60s…") ──
    # Format after header: Breaks | {50s} | {60s} | {70s} | {80s} | {90s} | {100s=centuries} | {total 50+}
    m = re.search(
        r'\|\s*Breaks\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)'
        r'\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)\s*\|\s*(\d[\d,]*)',
        text,
    )
    if m:
        out['total_centuries'] = int(m.group(6).replace(',', ''))  # 100s column
        out['total_50plus']    = int(m.group(7).replace(',', ''))  # Total column

    # ── Finishes: ranking row and total row ──────────────────────────────
    # Section: "Category | Winner | Final | Semi | … | Ranking | 31 | 22 | 22 | … | Total | 44 | 34 | …"
    ranking_m = re.search(
        r'Category\s*\|\s*Winner.*?'
        r'(?:^|\|\s*)Ranking\s*\|\s*(\d+)\s*\|\s*(\d+)',
        text, re.DOTALL,
    )
    if ranking_m:
        out['ranking_titles']  = int(ranking_m.group(1))  # ranking events won
        out['ranking_runner_up'] = int(ranking_m.group(2))

    total_m = re.search(
        r'6-reds.*?'
        r'Total\s*\|\s*(\d+)\s*\|\s*(\d+)',
        text, re.DOTALL,
    )
    if total_m:
        out['total_titles']    = int(total_m.group(1))  # all events won
        out['total_runner_up'] = int(total_m.group(2))  # all runner-up finishes

    # finals_reached = titles won + runner-up appearances
    if 'total_titles' in out and 'total_runner_up' in out:
        out['finals_reached'] = out['total_titles'] + out['total_runner_up']

    # ── Career best ranking ──────────────────────────────────────────────
    m = re.search(r'Highest ranking:\s*(\d+)', text)
    if m:
        out['career_best_rank'] = int(m.group(1))

    # ── Career prize money total ─────────────────────────────────────────
    # "Prize money | season | … | Total | 9,975,871"
    prize_m = re.search(r'Prize money.*?Total\s*\|\s*([\d,]+)', text, re.DOTALL)
    if prize_m:
        out['career_prize_total'] = int(prize_m.group(1).replace(',', ''))

    # ── Per-season prize money (for Ranking gap-fill) ────────────────────
    # e.g. "2022-2023 | 507,400"
    season_prizes = {}
    for yr_str, amt_str in re.findall(r'(\d{4})-\d{2,4}\s*\|\s*([\d,]+)', text):
        year = int(yr_str)
        amount = int(amt_str.replace(',', ''))
        if amount > 0:
            season_prizes[year] = amount
    out['season_prizes'] = season_prizes

    return out


# ── Main command ──────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = (
        'Rebuild PlayerCareerStats for top-128 players from snooker.org + CueTracker. '
        'Run once on Railway, then delete this command.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--player-id', type=int, help='Audit a single player by ID')
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Parse and log everything but make no DB changes',
        )

    def handle(self, *args, **options):
        dry_run   = options['dry_run']
        single_id = options.get('player_id')

        if dry_run:
            self.stdout.write('[DRY RUN] No DB changes will be made\n')

        # Collect player IDs
        if single_id:
            player_ids = [single_id]
        else:
            current_year = datetime.now().year
            ids = set()
            for year in [current_year, current_year - 1]:
                ids.update(
                    Ranking.objects
                    .filter(Season=year, Type='MoneyRankings', Position__lte=128)
                    .values_list('Player_id', flat=True)
                )
            player_ids = sorted(ids)

        total = len(player_ids)
        self.stdout.write(f'\nRebuilding stats for {total} players...\n')
        self.stdout.write('=' * 72)

        counters = {
            'api_updated': 0,
            'ct_synced': 0,
            'no_ct_slug': 0,
            'ct_failed': 0,
            'verified': 0,
            'conflict': 0,
            'prize_rows': 0,
            'errors': 0,
        }

        for idx, pid in enumerate(player_ids, 1):
            try:
                self._process_player(pid, idx, total, dry_run, counters)
            except Exception as exc:
                counters['errors'] += 1
                self.stdout.write(f'  [ERROR] {exc}')

            time.sleep(DELAY_BETWEEN_PLAYERS)

        # Summary
        self.stdout.write('\n' + '=' * 72)
        self.stdout.write('DONE')
        self.stdout.write(f'  API field updates : {counters["api_updated"]}')
        self.stdout.write(f'  CT synced         : {counters["ct_synced"]}')
        self.stdout.write(f'  No CT slug        : {counters["no_ct_slug"]}')
        self.stdout.write(f'  CT fetch failed   : {counters["ct_failed"]}')
        self.stdout.write(f'  Titles verified   : {counters["verified"]}')
        self.stdout.write(f'  Title conflicts   : {counters["conflict"]} (check manually)')
        self.stdout.write(f'  Prize rows added  : {counters["prize_rows"]}')
        self.stdout.write(f'  Errors            : {counters["errors"]}')
        if dry_run:
            self.stdout.write('\n[DRY RUN] No changes were written to DB')

    def _process_player(self, pid, idx, total, dry_run, counters):
        try:
            player = Player.objects.get(ID=pid)
        except Player.DoesNotExist:
            self.stdout.write(f'[{idx:3}/{total}] ID={pid}: not in DB — skipping')
            counters['errors'] += 1
            return

        name = _s(f'{player.FirstName} {player.LastName}'.strip())
        self.stdout.write(f'\n[{idx:3}/{total}] {name} (ID={pid})')

        now = datetime.now(tz=timezone.utc)
        api_updates = {}
        ct_data = {}
        prize_added = 0

        # ── Step 1: snooker.org t=4 ───────────────��──────────────────────
        api_row = _fetch_api_t4(pid)
        if api_row:
            for api_key, db_field in API_FIELD_MAP.items():
                api_val = api_row.get(api_key)
                db_val  = getattr(player, db_field, None)
                if api_val is not None and str(api_val) != str(db_val):
                    api_updates[db_field] = api_val
                    self.stdout.write(
                        f'  [API-UPDATE] {db_field}: {_s(str(db_val))} → {_s(str(api_val))}'
                    )

            if api_updates:
                if not dry_run:
                    Player.objects.filter(ID=pid).update(**api_updates)
                    player.refresh_from_db()
                counters['api_updated'] += len(api_updates)
            else:
                self.stdout.write('  [API-OK]    all t=4 fields match')
        else:
            self.stdout.write('  [API-WARN]  could not reach snooker.org t=4')

        # ── Step 2: CueTracker career stats ──────────────────────────────
        ct_slug = getattr(player, 'ct_slug', None)
        if not ct_slug or ct_slug == 'NOT_FOUND':
            self.stdout.write('  [NO-CT]     no ct_slug — skipping CueTracker step')
            counters['no_ct_slug'] += 1
            # Still upsert the career_stats row with just api_synced_at
            if not dry_run:
                PlayerCareerStats.objects.update_or_create(
                    player=player,
                    defaults={'api_synced_at': now},
                )
            return

        status, html = _fetch_ct_career_html(ct_slug)
        if status != 200:
            self.stdout.write(f'  [CT-FAIL]   HTTP {status} for slug={ct_slug}')
            counters['ct_failed'] += 1
            return

        ct_data = _parse_ct_career(html)
        if not ct_data:
            self.stdout.write('  [CT-FAIL]   could not parse career page')
            counters['ct_failed'] += 1
            return

        # Log what we parsed
        self.stdout.write(
            f'  [CT-OK]     '
            f'frames={ct_data.get("frames_played","?")} '
            f'won={ct_data.get("frames_won","?")} | '
            f'titles={ct_data.get("total_titles","?")} '
            f'finals={ct_data.get("finals_reached","?")} | '
            f'50+={ct_data.get("total_50plus","?")} '
            f'cents={ct_data.get("total_centuries","?")} | '
            f'prize=£{ct_data.get("career_prize_total","?"):,}'.replace('?:,', '?')
            + f' | rank#{ct_data.get("career_best_rank","?")}'
        )

        # ── Step 3: Cross-validate ranking titles ─────────────────────────
        api_titles = player.NumRankingTitles  # freshly updated above if changed
        ct_titles  = ct_data.get('ranking_titles')
        if api_titles is not None and ct_titles is not None:
            verified = (int(api_titles) == int(ct_titles))
            if verified:
                self.stdout.write(
                    f'  [VERIFIED]  titles: snooker.org={api_titles} == CT={ct_titles} ✓'
                )
                counters['verified'] += 1
            else:
                self.stdout.write(
                    f'  [CONFLICT]  titles: snooker.org={api_titles} != CT={ct_titles} — showing —'
                )
                counters['conflict'] += 1
        else:
            verified = None

        # ── Step 4: Upsert PlayerCareerStats ─────────────────────────────
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
            'api_synced_at':         now,
            'ct_synced_at':          now,
        }
        # Remove None values so we don't overwrite good data with None
        cs_fields = {k: v for k, v in cs_fields.items() if v is not None}

        if not dry_run:
            PlayerCareerStats.objects.update_or_create(
                player=player,
                defaults=cs_fields,
            )
        counters['ct_synced'] += 1

        # ── Step 5: Fill prize money gaps in Ranking table ────────────────
        season_prizes = ct_data.get('season_prizes', {})
        if season_prizes and not dry_run:
            from django.db.models import Max
            max_id = Ranking.objects.aggregate(m=Max('ID'))['m'] or 0

        for year, amount in season_prizes.items():
            exists = Ranking.objects.filter(
                Player_id=pid,
                Season=year,
                Type='MoneyRankings',
            ).exists()
            if not exists:
                if not dry_run:
                    max_id += 1
                    Ranking.objects.create(
                        ID=max_id,
                        Player_id=pid,
                        Season=year,
                        Type='MoneyRankings',
                        Position=None,
                        Sum=amount,
                    )
                prize_added += 1

        if prize_added:
            self.stdout.write(f'  [PRIZE]     added {prize_added} missing season rows')
            counters['prize_rows'] += prize_added
