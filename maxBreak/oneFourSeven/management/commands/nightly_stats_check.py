# management/commands/nightly_stats_check.py
"""
Nightly, automated player-stats accuracy check.

Runs DB-only consistency checks over every player, plus a rolling
snooker.org t=4 cross-check over a slice of the roster each night
(cursor-based, so every player eventually gets checked, not just the
top-ranked ones). Flags in the known-safe set (NO_MATCHES, LOW_MATCHES,
ORPHAN) are auto-repaired via the existing backfill_career_history
command, then re-verified. Sends one push notification only if something
is still wrong after that — a clean or fully self-healed run is silent.

See docs/superpowers/specs/2026-08-31-nightly-player-stats-check-design.md.

Usage:
  python manage.py nightly_stats_check
  python manage.py nightly_stats_check --dry-run
  python manage.py nightly_stats_check --no-api
  python manage.py nightly_stats_check --notify-token ExponentPushToken[xxx]
"""

import time
from pathlib import Path

from django.core.management.base import BaseCommand

from oneFourSeven import nightly_stats_checks as nsc

DEFAULT_CURSOR_FILE = Path(__file__).resolve().parent.parent.parent.parent / 'nightly_stats_cursor.json'
DEFAULT_BATCH_SIZE = 100
DEFAULT_MAX_AUTOFIX = 20
DEFAULT_SLEEP_SECONDS = 30


class Command(BaseCommand):
    help = 'Nightly automated player-stats accuracy check with auto-fix and admin notification'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true',
                            help='Run checks and print the report, skip auto-fix and notification')
        parser.add_argument('--no-api', action='store_true',
                            help='Skip the snooker.org t=4 cross-check pass entirely (DB-only)')
        parser.add_argument('--notify-token', default=None,
                            help='Expo push token to notify when something is still flagged')
        parser.add_argument('--batch-size', type=int, default=DEFAULT_BATCH_SIZE,
                            help='How many players to API-cross-check per run')
        parser.add_argument('--max-autofix', type=int, default=DEFAULT_MAX_AUTOFIX,
                            help='Cap on auto-fix attempts per run')
        parser.add_argument('--cursor-file', default=str(DEFAULT_CURSOR_FILE),
                            help='Path to the rolling-sweep cursor file')
        parser.add_argument('--sleep-seconds', type=int, default=DEFAULT_SLEEP_SECONDS,
                            help='Delay between snooker.org API calls')

    def handle(self, *args, **options):
        from oneFourSeven.constants import current_season_int

        # Some player names contain non-ASCII characters (accents, etc.).
        # A console/log destination stuck on a legacy codepage (seen on
        # some Windows dev setups) would otherwise crash on write() for a
        # perfectly valid player name — replace instead of raising. Real
        # CLI usage has self.stdout wrapping sys.stdout directly (and
        # attempt_autofix's nested backfill_career_history call inherits
        # that same reconfigured stream); the test suite captures output
        # into a StringIO, which has no reconfigure(), so this is a no-op
        # there and test behavior is unaffected.
        for stream in (getattr(self.stdout, '_out', None), getattr(self.stderr, '_out', None)):
            if stream is not None and hasattr(stream, 'reconfigure'):
                try:
                    stream.reconfigure(errors='replace')
                except Exception:
                    pass

        current_season = current_season_int()
        dry_run = options['dry_run']
        no_api = options['no_api']
        max_autofix = options['max_autofix']
        cursor_file = options['cursor_file']

        top32_ids = nsc.get_top32_ids(current_season)
        players = list(nsc.iter_all_players())
        player_ids = [p.ID for p in players]

        api_batch_ids = set()
        next_cursor = nsc.load_cursor(cursor_file)
        if not no_api and player_ids:
            batch, next_cursor = nsc.select_batch(player_ids, nsc.load_cursor(cursor_file), options['batch_size'])
            api_batch_ids = set(batch)

        still_flagged = []
        autofixed = []
        errors = []
        autofix_attempts = 0

        for player in players:
            try:
                snapshot = nsc.build_snapshot(player, current_season, top32_ids)
                flags = nsc.compute_db_flags(snapshot)

                if player.ID in api_batch_ids:
                    time.sleep(options['sleep_seconds'])
                    api_titles = nsc.fetch_api_titles(player.ID)
                    flags += nsc.compute_api_flags(snapshot, api_titles)
            except Exception as e:
                errors.append(f'Check failed for player {player.ID}: {e}')
                continue

            if not flags:
                self.stdout.write(f'{snapshot.name} (ID={snapshot.player_id}): OK')
                continue

            flag_str = ', '.join(f.detail for f in flags)

            if dry_run:
                self.stdout.write(self.style.WARNING(
                    f'{snapshot.name} (ID={snapshot.player_id}): {flag_str} [dry-run, no fix attempted]'
                ))
                still_flagged.append((snapshot, flags))
                continue

            if nsc.is_auto_fixable(flags) and autofix_attempts < max_autofix:
                autofix_attempts += 1
                try:
                    fixed_ok = nsc.attempt_autofix(player.ID)
                except Exception as e:
                    fixed_ok = False
                    errors.append(f'Auto-fix raised for player {player.ID}: {e}')

                if fixed_ok:
                    try:
                        recheck_snapshot = nsc.build_snapshot(player, current_season, top32_ids)
                        remaining = nsc.compute_db_flags(recheck_snapshot)
                    except Exception as e:
                        remaining = flags
                        errors.append(f'Re-check failed for player {player.ID}: {e}')

                    if remaining:
                        still_flagged.append((recheck_snapshot, remaining))
                        self.stdout.write(self.style.WARNING(
                            f'{snapshot.name} (ID={snapshot.player_id}): auto-fix attempted, '
                            f'still flagged: {", ".join(f.detail for f in remaining)}'
                        ))
                    else:
                        autofixed.append(snapshot)
                        self.stdout.write(self.style.SUCCESS(
                            f'{snapshot.name} (ID={snapshot.player_id}): auto-fixed ({flag_str})'
                        ))
                else:
                    still_flagged.append((snapshot, flags))
                    self.stdout.write(self.style.WARNING(
                        f'{snapshot.name} (ID={snapshot.player_id}): auto-fix failed, flags: {flag_str}'
                    ))
            else:
                still_flagged.append((snapshot, flags))
                self.stdout.write(self.style.WARNING(
                    f'{snapshot.name} (ID={snapshot.player_id}): {flag_str} [not auto-fixable]'
                ))

        if not dry_run and not no_api:
            nsc.save_cursor(cursor_file, next_cursor)

        self.stdout.write('')
        self.stdout.write(f'OK: {len(players) - len(still_flagged) - len(autofixed)}  '
                          f'AUTO-FIXED: {len(autofixed)}  STILL FLAGGED: {len(still_flagged)}  '
                          f'ERRORS: {len(errors)}')

        if not dry_run:
            notification = nsc.build_notification(still_flagged, autofixed, errors)
            if notification and options['notify_token']:
                title, body = notification
                nsc.send_admin_notification(options['notify_token'], title, body)

        if not dry_run and (still_flagged or errors):
            raise SystemExit(1)
