# management/commands/fetch_frame_scores.py
#
# Fetches per-frame point data from CueTracker and saves to MatchFrameScore.
# All scraping logic is isolated here. The API view only reads from DB.
#
# Usage:
#   python manage.py fetch_frame_scores                  # process 50 newest unfetched matches
#   python manage.py fetch_frame_scores --limit 200      # process 200
#   python manage.py fetch_frame_scores --match-id 12345 # single match by api_match_id
#   python manage.py fetch_frame_scores --refetch        # re-fetch even if data exists

import re
import time
import requests
from bs4 import BeautifulSoup

from django.core.management.base import BaseCommand

from oneFourSeven.models import MatchesOfAnEvent, MatchFrameScore
from oneFourSeven.views import get_player_names


# ---------------------------------------------------------------------------
# Module-level helpers (pure functions, easy to test in isolation)
# ---------------------------------------------------------------------------

def _to_ct_slug(name: str) -> str:
    """Convert a player's full name to a CueTracker URL slug.

    Examples:
        "Ronnie O'Sullivan" -> "ronnie-osullivan"
        "Xu Si"             -> "xu-si"
        "Neil Robertson"    -> "neil-robertson"
    """
    name = name.lower()
    name = name.replace("\u2019", "").replace("'", "")  # curly + straight apostrophes
    name = re.sub(r"[^a-z0-9\s-]", "", name)            # remove other special chars
    name = re.sub(r"\s+", "-", name.strip())             # spaces -> hyphens
    return name


def _parse_frame_string(raw: str, swap: bool) -> list:
    """Parse CueTracker frame string into a list of frame dicts.

    Format:  "80(80)-8; 47-62; 71(61)-23"
      - Each token is one frame: left_score(left_break)-right_score(right_break)
      - Break in parentheses = highest break scored by that side in the frame
      - Only stored if the break value exists in the string (≥ any value)

    swap=False: CueTracker's left side = our Player1
    swap=True:  CueTracker's left side = our Player2 (scores need to be flipped)
    """
    pattern = re.compile(r"(\d+)(?:\((\d+)\))?-(\d+)(?:\((\d+)\))?")
    frames = []
    for i, token in enumerate(raw.split(";"), start=1):
        m = pattern.match(token.strip())
        if not m:
            continue
        ct_left = int(m.group(1))
        ct_left_brk = int(m.group(2)) if m.group(2) else None
        ct_right = int(m.group(3))
        ct_right_brk = int(m.group(4)) if m.group(4) else None

        if swap:
            p1, p1_brk = ct_right, ct_right_brk
            p2, p2_brk = ct_left, ct_left_brk
        else:
            p1, p1_brk = ct_left, ct_left_brk
            p2, p2_brk = ct_right, ct_right_brk

        frames.append({
            "frame": i,
            "p1": p1,
            "p2": p2,
            "p1_break": p1_brk,
            "p2_break": p2_brk,
            "winner": 1 if p1 > p2 else 2,
        })
    return frames


def _parse_cuetracker_html(html: str, our_s1: int, our_s2: int) -> list:
    """Find the matching match block on a CueTracker H2H page and parse its frames.

    CueTracker HTML structure:
        <div class="match">
            <div class="player_1_score">10</div>  ← ALWAYS winner's score
            <div class="player_2_score">9</div>   ← ALWAYS loser's score
            <div class="frame_scores">80(80)-8; 47-62; ...</div>
        </div>

    IMPORTANT: CueTracker always shows the winner's score as player_1_score
    regardless of which player appears in the URL. So we accept (s1,s2) OR (s2,s1).

    Returns parsed frame list, or [] if no matching block found.
    """
    soup = BeautifulSoup(html, "html.parser")
    match_divs = soup.find_all(class_="match")

    for div in match_divs:
        ct_s1_el = div.find(class_="player_1_score")
        ct_s2_el = div.find(class_="player_2_score")
        frame_el = div.find(class_="frame_scores")  # underscore, not hyphen
        if not all([ct_s1_el, ct_s2_el, frame_el]):
            continue
        try:
            ct_s1 = int(ct_s1_el.get_text(strip=True))
            ct_s2 = int(ct_s2_el.get_text(strip=True))
        except ValueError:
            continue

        raw_frames = frame_el.get_text(strip=True)
        if not raw_frames:
            continue

        if ct_s1 == our_s1 and ct_s2 == our_s2:
            return _parse_frame_string(raw_frames, swap=False)
        elif ct_s1 == our_s2 and ct_s2 == our_s1:
            return _parse_frame_string(raw_frames, swap=True)

    return []


# ---------------------------------------------------------------------------
# Management command
# ---------------------------------------------------------------------------

class Command(BaseCommand):
    help = "Fetch per-frame point data from CueTracker for completed matches"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit", type=int, default=50,
            help="Max number of matches to process per run (default: 50)",
        )
        parser.add_argument(
            "--match-id", type=int, default=None,
            help="Process a single match by api_match_id",
        )
        parser.add_argument(
            "--refetch", action="store_true",
            help="Re-fetch even if frame score data already exists",
        )

    def handle(self, *args, **options):
        qs = MatchesOfAnEvent.objects.filter(
            Status=3,
            Score1__isnull=False,
            Score2__isnull=False,
            Player1ID__isnull=False,
            Player2ID__isnull=False,
        )

        if not options["refetch"]:
            already_done = MatchFrameScore.objects.values_list(
                "match_id", flat=True
            ).distinct()
            qs = qs.exclude(id__in=already_done)

        if options["match_id"]:
            qs = qs.filter(api_match_id=options["match_id"])

        qs = qs.select_related("Event").order_by("-Event__Season", "-StartDate")
        qs = qs[: options["limit"]]

        total = qs.count()
        self.stdout.write(f"Processing {total} matches...")

        success, skipped, failed = 0, 0, 0
        for match in qs:
            result = self._fetch_and_save(match)
            if result == "ok":
                success += 1
            elif result == "skip":
                skipped += 1
            else:
                failed += 1
            # Be polite to CueTracker — don't hammer the server
            time.sleep(0.5)

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — success: {success}, skipped: {skipped}, failed: {failed}"
            )
        )

    def _fetch_and_save(self, match: MatchesOfAnEvent) -> str:
        """Scrape CueTracker for one match and save frames to DB.

        Returns: "ok" | "skip" | "fail"
        """
        names_map = get_player_names({match.Player1ID, match.Player2ID})
        p1_name = names_map.get(match.Player1ID, "")
        p2_name = names_map.get(match.Player2ID, "")

        if not p1_name or not p2_name:
            self.stderr.write(
                f"  SKIP match {match.api_match_id}: missing player name(s)"
            )
            return "skip"

        p1_slug = _to_ct_slug(p1_name)
        p2_slug = _to_ct_slug(p2_name)
        url = f"https://cuetracker.net/head-to-head/{p1_slug}/{p2_slug}"

        try:
            resp = requests.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; MaxBreakApp/1.0)"},
                timeout=10,
            )
        except Exception as e:
            self.stderr.write(f"  FAIL match {match.api_match_id}: network error — {e}")
            return "fail"

        if resp.status_code != 200:
            self.stderr.write(
                f"  FAIL match {match.api_match_id}: HTTP {resp.status_code} — {url}"
            )
            return "fail"

        frames = _parse_cuetracker_html(resp.text, match.Score1, match.Score2)

        if not frames:
            self.stderr.write(
                f"  SKIP match {match.api_match_id} ({p1_name} vs {p2_name} "
                f"{match.Score1}-{match.Score2}): no matching block on CueTracker"
            )
            return "skip"

        # Delete existing rows for this match then re-insert
        MatchFrameScore.objects.filter(match=match).delete()
        MatchFrameScore.objects.bulk_create([
            MatchFrameScore(
                match=match,
                frame_number=f["frame"],
                player1_points=f["p1"],
                player2_points=f["p2"],
                player1_break=f["p1_break"],
                player2_break=f["p2_break"],
                winner=f["winner"],
                source="cuetracker",
            )
            for f in frames
        ])

        self.stdout.write(
            f"  OK  match {match.api_match_id} ({p1_name} vs {p2_name} "
            f"{match.Score1}-{match.Score2}) — {len(frames)} frames"
        )
        return "ok"
