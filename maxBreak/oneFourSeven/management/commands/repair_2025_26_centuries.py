# management/commands/repair_2025_26_centuries.py
"""
One-time repair for CenturyRecord rows mislabeled "2025-26".

Before the season-boundary fix (Sept -> May cutoff), the daily
fetch_ct_centuries job kept writing new-2026-27-season low century counts
into the "2025-26" bucket, silently overwriting last season's real final
totals for any player who already had centuries in the new season.

This re-scrapes CueTracker's dedicated historical season page and restores
season_current for the "2025-26" label. Safe to re-run; not part of the
daily/on-demand fetch_all_data pipeline since it targets a fixed past
season and only needs to run once.

Usage: python manage.py repair_2025_26_centuries
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'One-time repair of the "2025-26" CenturyRecord data corrupted by the season-boundary bug'

    def handle(self, *args, **options):
        call_command(
            'fetch_ct_centuries',
            url='https://cuetracker.net/statistics/centuries/most-made/season/2025-2026',
            season='2025-26',
        )
