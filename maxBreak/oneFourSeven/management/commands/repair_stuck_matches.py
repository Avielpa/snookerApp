# management/commands/repair_stuck_matches.py
"""
One-off, idempotent repair for matches whose true final result never reached
our DB because their round aged out of snooker.org's live-matches API (t=6)
response window during the auto_live_monitor outage on 2026-08-24 (see
docs/SESSION_2026-08-24_*.md for the full root-cause writeup).

This command carries a small hardcoded manifest of known-stuck matches with
their correct final data, copied by hand from snooker.org's own Results page
(https://www.snooker.org/res/index.asp?template=22&event=2757) at the time
of the incident.

SAFE BY CONSTRUCTION:
- Each entry only applies if the row's CURRENT Score1/Score2/Status still
  exactly match the known-stale snapshot recorded below. If the row has
  already been corrected (by this command running again, or by a future
  sync catching it some other way), the guard fails and it's skipped.
- Runs once from auto_live_monitor's _startup_sync() and becomes a
  permanent no-op after its first successful run -- safe to leave in place.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime, timezone as dt_timezone

from oneFourSeven.models import MatchesOfAnEvent

# (db_row_id, api_match_id, expected_stale_score1, expected_stale_score2,
#  expected_stale_status, correct_score1, correct_score2, correct_winner_id,
#  correct_end_date_utc, label)
MANIFEST = [
    (6065, 10291448, 3, 0, 1, 5, 0, 946,
     datetime(2026, 8, 24, 7, 25, tzinfo=dt_timezone.utc),
     "Zhao Xintong vs Gao Yang"),
    (6081, 10291464, 2, 0, 1, 5, 0, 97,
     datetime(2026, 8, 24, 7, 46, tzinfo=dt_timezone.utc),
     "Shaun Murphy vs Alfie Burden"),
    (6083, 10291466, 0, 1, 1, 5, 2, 17,
     datetime(2026, 8, 24, 8, 58, tzinfo=dt_timezone.utc),
     "Mark Selby vs Fan Zhengyi"),
    (6088, 10291471, 1, 0, 1, 4, 5, 3534,
     datetime(2026, 8, 24, 8, 55, tzinfo=dt_timezone.utc),
     "Wu Yize vs Artemijs Zizins (Zizins won 5-4)"),
]


class Command(BaseCommand):
    help = "Repair specific matches stuck at stale scores from the 2026-08-24 outage"

    def handle(self, *args, **options):
        fixed, skipped = 0, 0

        for (row_id, api_id, stale_s1, stale_s2, stale_status,
             correct_s1, correct_s2, winner_id, end_date, label) in MANIFEST:
            try:
                match = MatchesOfAnEvent.objects.get(id=row_id)
            except MatchesOfAnEvent.DoesNotExist:
                self.stdout.write(f"[SKIP] {label}: row {row_id} not found")
                skipped += 1
                continue

            still_stale = (
                match.api_match_id == api_id and
                match.Score1 == stale_s1 and
                match.Score2 == stale_s2 and
                match.Status == stale_status
            )
            if not still_stale:
                self.stdout.write(
                    f"[SKIP] {label}: row {row_id} no longer matches stale "
                    f"snapshot (already fixed or changed) -- current "
                    f"{match.Score1}-{match.Score2} status={match.Status}"
                )
                skipped += 1
                continue

            match.Score1 = correct_s1
            match.Score2 = correct_s2
            match.WinnerID = winner_id
            match.Status = 3  # matches the value already used for finished
                               # matches throughout this DB (see models.py
                               # STATUS_FINISHED comment vs actual API usage)
            match.Unfinished = False
            match.OnBreak = False
            match.EndDate = end_date
            match.save()

            self.stdout.write(
                f"[FIXED] {label}: row {row_id} -> {correct_s1}-{correct_s2}, "
                f"winner={winner_id}, status=3"
            )
            fixed += 1

        self.stdout.write(
            self.style.SUCCESS(f"repair_stuck_matches done: fixed={fixed}, skipped={skipped}")
        )
