# oneFourSeven/management/commands/emergency_html_fallback.py
"""
EMERGENCY / BREAK-GLASS ONLY.

Standalone fallback for when api.snooker.org (the JSON API) is down/blocked but
the public website (www.snooker.org/res/index.asp) is still serving live scores.

This is intentionally isolated from the normal pipeline:
- Does NOT touch api_client.py, data_savers.py, or auto_live_monitor.
- Does NOT create new matches or events, and never overwrites finished
  (Status=2) matches — it only updates score/status for matches that are
  already in our DB and currently live/unfinished on the public page.
- Run manually only, while api.snooker.org is confirmed down. Not wired into
  the 24/7 daemon (the HTML page isn't a stable structured API — scraping it
  continuously would be fragile and risky as a permanent data source).

Usage:
    python manage.py emergency_html_fallback --event 2546
    python manage.py emergency_html_fallback --event 2546 --dry-run
"""

import re
import logging

import requests
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.utils import timezone

from oneFourSeven.models import MatchesOfAnEvent, Event

logger = logging.getLogger(__name__)

RESULTS_URL = "https://www.snooker.org/res/index.asp"

# We only ever move a match INTO these two states from HTML scraping.
STATUS_RUNNING = MatchesOfAnEvent.STATUS_RUNNING   # 1
STATUS_FINISHED = MatchesOfAnEvent.STATUS_FINISHED  # 2


class Command(BaseCommand):
    help = "EMERGENCY: scrape www.snooker.org public results page as a fallback live-score source when api.snooker.org is down."

    def add_arguments(self, parser):
        parser.add_argument("--event", type=int, required=True, help="snooker.org event ID (e.g. 2546)")
        parser.add_argument("--dry-run", action="store_true", help="Parse and print changes without saving")

    def handle(self, *args, **options):
        event_id = options["event"]
        dry_run = options["dry_run"]

        try:
            event = Event.objects.get(ID=event_id)
        except Event.DoesNotExist:
            self.stderr.write(self.style.ERROR(f"Event {event_id} not found in our DB — aborting."))
            return

        self.stdout.write(f"[EMERGENCY] Fetching public results page for event {event_id} ({event.Name})...")
        html = self._fetch(event_id)
        if not html:
            self.stderr.write(self.style.ERROR("Failed to fetch public results page — aborting."))
            return

        rows = self._parse_rows(html)
        self.stdout.write(f"[EMERGENCY] Parsed {len(rows)} match rows from public page.")

        updated, skipped, unmatched = 0, 0, 0
        for row in rows:
            result = self._apply_row(event, row, dry_run=dry_run)
            if result == "updated":
                updated += 1
            elif result == "skipped":
                skipped += 1
            else:
                unmatched += 1

        mode = "DRY-RUN — nothing saved" if dry_run else "SAVED"
        self.stdout.write(self.style.SUCCESS(
            f"[EMERGENCY] Done ({mode}): {updated} updated, {skipped} unchanged/skipped, {unmatched} no DB match."
        ))

    def _fetch(self, event_id: int) -> str | None:
        try:
            resp = requests.get(
                RESULTS_URL,
                params={"event": event_id},
                timeout=15,
                headers={"User-Agent": "Mozilla/5.0 (compatible; MaxBreakEmergencyFallback/1.0)"},
            )
            resp.raise_for_status()
            return resp.text
        except requests.RequestException as e:
            logger.error(f"[EMERGENCY] Fetch failed: {e}")
            return None

    def _parse_rows(self, html: str) -> list[dict]:
        """
        Parse each match <tr> from the public results table.
        Returns dicts: {round, number, player1_id, player2_id, score1, score2, live}
        Only rows with BOTH player hrefs present (i.e. not TBD) are returned.
        """
        soup = BeautifulSoup(html, "html.parser")
        results = []

        for tr in soup.find_all("tr"):
            classes = tr.get("class") or []
            round_match = next((re.match(r"^round(\d+)$", c) for c in classes if re.match(r"^round(\d+)$", c)), None)
            if not round_match or "oneonone" not in classes:
                continue  # not a real match row (e.g. "info" rows, header rows)

            round_num = int(round_match.group(1))

            number_td = tr.find("td", class_="number")
            if not number_td or not number_td.get("title"):
                continue
            number_match = re.search(r"Match No\. (\d+)", number_td["title"])
            if not number_match:
                continue
            number = int(number_match.group(1))

            player_links = tr.find_all("a", href=re.compile(r"/res/index\.asp\?player=\d+"))
            if len(player_links) < 2:
                continue  # TBD vs TBD, or not yet drawn

            def player_id_from(a):
                m = re.search(r"player=(\d+)", a["href"])
                return int(m.group(1)) if m else None

            player1_id = player_id_from(player_links[0])
            player2_id = player_id_from(player_links[1])
            if not player1_id or not player2_id:
                continue

            first_score_td = tr.find("td", class_=lambda c: c and "first-score" in c)
            last_score_td = tr.find("td", class_=lambda c: c and "last-score" in c)
            score1_text = first_score_td.get_text(strip=True) if first_score_td else ""
            score2_text = last_score_td.get_text(strip=True) if last_score_td else ""

            if not score1_text.isdigit() or not score2_text.isdigit():
                continue  # not started yet, nothing to update

            is_live = "unfinished" in classes

            results.append({
                "round": round_num,
                "number": number,
                "player1_id": player1_id,
                "player2_id": player2_id,
                "score1": int(score1_text),
                "score2": int(score2_text),
                "live": is_live,
            })

        return results

    def _apply_row(self, event: Event, row: dict, dry_run: bool) -> str:
        try:
            match = MatchesOfAnEvent.objects.get(Event=event, Round=row["round"], Number=row["number"])
        except MatchesOfAnEvent.DoesNotExist:
            self.stdout.write(self.style.WARNING(
                f"  no DB match for R{row['round']} #{row['number']} (players {row['player1_id']} vs {row['player2_id']})"
            ))
            return "unmatched"

        # Never touch a match we already have marked Finished — the public page's
        # "unfinished" flag can lag, and finished results are authoritative once set.
        if match.Status == STATUS_FINISHED:
            return "skipped"

        # Sanity-check we're updating the right match (players should line up,
        # allowing for swapped player1/player2 order).
        known_ids = {match.Player1ID, match.Player2ID}
        scraped_ids = {row["player1_id"], row["player2_id"]}
        if known_ids and known_ids != {None} and known_ids != scraped_ids:
            self.stdout.write(self.style.WARNING(
                f"  player mismatch for R{row['round']} #{row['number']}: DB has {known_ids}, page has {scraped_ids} — skipping"
            ))
            return "skipped"

        # Map score1/score2 onto whichever of our player1/player2 slots they belong to.
        if match.Player1ID == row["player1_id"]:
            new_score1, new_score2 = row["score1"], row["score2"]
        else:
            new_score1, new_score2 = row["score2"], row["score1"]

        new_status = STATUS_RUNNING if row["live"] else match.Status
        changed = (
            match.Score1 != new_score1
            or match.Score2 != new_score2
            or (row["live"] and match.Status != STATUS_RUNNING)
        )
        if not changed:
            return "skipped"

        self.stdout.write(
            f"  R{row['round']} #{row['number']}: {match.Score1}-{match.Score2} -> {new_score1}-{new_score2} "
            f"(live={row['live']})"
        )

        if not dry_run:
            match.Score1 = new_score1
            match.Score2 = new_score2
            match.Status = new_status
            match.save(update_fields=["Score1", "Score2", "Status"])

        return "updated"
