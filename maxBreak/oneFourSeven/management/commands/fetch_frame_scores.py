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

from oneFourSeven.models import MatchesOfAnEvent, MatchFrameScore, Player, Ranking
from oneFourSeven.views import get_player_names


# ---------------------------------------------------------------------------
# Module-level helpers (pure functions, isolated from Django ORM)
# ---------------------------------------------------------------------------

def _to_ct_slug(name: str) -> str:
    """Convert a player full name to a CueTracker URL slug.

    "Ronnie O'Sullivan" -> "ronnie-osullivan"
    "Xu Si"             -> "xu-si"
    """
    name = name.lower()
    name = name.replace("\u2019", "").replace("'", "")  # curly + straight apostrophes
    name = re.sub(r"[^a-z0-9\s-]", "", name)            # remove other special chars
    name = re.sub(r"\s+", "-", name.strip())             # spaces → hyphens
    return name


def _generate_slug_variants(name: str, surname_first: bool) -> list:
    """Return ordered list of CueTracker slug candidates (most likely first).

    Handles two common mismatch cases:
    - Middle initial in our DB:  "Mark J Williams" → also try "mark-williams"
    - SurnameFirst name order:   "Lei Peifan"      → also try "peifan-lei"
    """
    variants = []
    variants.append(_to_ct_slug(name))  # primary: as-is

    parts = name.strip().split()
    if surname_first:
        # e.g. "Lei Peifan" (LastName=Lei, FirstName=Peifan) → try "peifan-lei"
        if len(parts) == 2:
            variants.append(_to_ct_slug(f"{parts[1]} {parts[0]}"))
    else:
        # e.g. "Mark J Williams" → try "mark-williams" (drop middle)
        if len(parts) == 3:
            variants.append(_to_ct_slug(f"{parts[0]} {parts[2]}"))
        elif len(parts) > 3:
            variants.append(_to_ct_slug(f"{parts[0]} {parts[-1]}"))

    # Deduplicate while preserving order
    seen = set()
    return [v for v in variants if not (v in seen or seen.add(v))]


def _name_tokens_match(our_name: str, ct_name: str) -> bool:
    """True if every meaningful word in our_name appears in ct_name (case-insensitive, any order).

    Single-character tokens (middle initials like "J") are ignored because
    CueTracker often omits them. Requires at least 2 characters per token.

    Handles:
    - "Mark J Williams" vs "Mark Williams"       → True  (single-char "j" ignored)
    - "Mark Williams"   vs "Mark John Williams"  → True  (middle name is extra, fine)
    - "Lei Peifan"      vs "Peifan Lei"           → True  (order irrelevant)
    - "Judd Trump"      vs "John Trump"           → False (different first name)
    """
    ct_lower = ct_name.lower()
    tokens = [t for t in our_name.lower().split() if len(t) > 1]
    return bool(tokens) and all(token in ct_lower for token in tokens)


def _fetch_player_page_html(slug: str) -> tuple:
    """GET CueTracker player profile page. Returns (status_code, html). (0, '') on error."""
    url = f"https://cuetracker.net/players/{slug}"
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MaxBreakApp/1.0)"},
            timeout=10,
        )
        return resp.status_code, resp.text
    except Exception:
        return 0, ""


def _parse_player_page(
    html: str,
    our_s1: int,
    our_s2: int,
    year: int,
    known_is_p1: bool,
    p1_name: str = "",
    p2_name: str = "",
    known_slug: str = "",
) -> tuple:
    """Find a match on a CueTracker player profile page and extract frames + opponent slug.

    Player profile page structure:
        <div class="match">
            <div class="player_1_score">10</div>
            <div class="player_2_score">9</div>
            <div class="played_on">2026-04-05</div>
            <div class="frame_scores">80(80)-8; ...</div>
            <a href="/players/zhao-xintong/season/...">Zhao Xintong</a>  ← opponent link
        </div>

    known_is_p1=True  means the page owner is our Player1
    known_is_p1=False means the page owner is our Player2

    Returns (frames, opponent_slug) or ([], None) if not found.
    The opponent_slug is extracted from the href of the player link in the block.
    """
    soup = BeautifulSoup(html, "html.parser")
    match_divs = soup.find_all(class_="match")

    for div in match_divs:
        # Check year matches
        played_el = div.find(class_="played_on")
        if played_el:
            played_text = played_el.get_text(strip=True)
            if str(year) not in played_text:
                continue

        ct_s1_el = div.find(class_="player_1_score")
        ct_s2_el = div.find(class_="player_2_score")
        frame_el = div.find(class_="frame_scores")
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

        # Score match (accept either order)
        if ct_s1 == our_s1 and ct_s2 == our_s2:
            swap = False
        elif ct_s1 == our_s2 and ct_s2 == our_s1:
            swap = True
        else:
            continue

        # Optional name verification against name elements
        ct_p1_name_el = div.find(class_="player_1_name")
        ct_p2_name_el = div.find(class_="player_2_name")
        if ct_p1_name_el and ct_p2_name_el and (p1_name or p2_name):
            ct_p1_name = ct_p1_name_el.get_text(strip=True)
            ct_p2_name = ct_p2_name_el.get_text(strip=True)
            if not swap:
                if p1_name and not _name_tokens_match(p1_name, ct_p1_name):
                    continue
                if p2_name and not _name_tokens_match(p2_name, ct_p2_name):
                    continue
            else:
                if p2_name and not _name_tokens_match(p2_name, ct_p1_name):
                    continue
                if p1_name and not _name_tokens_match(p1_name, ct_p2_name):
                    continue

        # Extract opponent slug from any /players/{slug}/ link inside the block.
        # CueTracker uses absolute URLs: https://cuetracker.net/players/{slug}/...
        # Skip the page-owner's own slug (known_slug) if provided.
        opponent_slug = None
        for a_tag in div.find_all("a", href=True):
            href = a_tag["href"]
            m = re.search(r"/players/([^/?#]+)", href)
            if m:
                candidate = m.group(1)
                if known_slug and candidate == known_slug:
                    continue  # skip the page owner's own link
                opponent_slug = candidate
                break

        frames = _parse_frame_string(raw_frames, swap)
        if not frames:
            continue

        # Decide which slug belongs to p1/p2 based on known_is_p1 and swap.
        # On the player's own page the known player is always one side; the
        # opponent slug extracted above is for the OTHER player.
        return frames, opponent_slug

    return [], None


def _fetch_h2h_html(p1_slug: str, p2_slug: str) -> tuple:
    """GET CueTracker H2H page. Returns (status_code, html). (0, '') on error."""
    url = f"https://cuetracker.net/head-to-head/{p1_slug}/{p2_slug}"
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MaxBreakApp/1.0)"},
            timeout=10,
        )
        return resp.status_code, resp.text
    except Exception:
        return 0, ""


def _parse_frame_string(raw: str, swap: bool) -> list:
    """Parse CueTracker frame string "80(80)-8; 47-62; 71(61)-23" into frame dicts.

    swap=False: CueTracker's left side = our Player1
    swap=True:  CueTracker's left side = our Player2 (flip sides)
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


def _parse_cuetracker_html(
    html: str,
    our_s1: int,
    our_s2: int,
    p1_name: str = "",
    p2_name: str = "",
) -> list:
    """Find matching match block on a CueTracker H2H page and parse its frames.

    CueTracker HTML structure:
        <div class="match">
            <div class="player_1_score">10</div>  ← ALWAYS winner's score
            <div class="player_2_score">9</div>   ← ALWAYS loser's score
            <div class="frame_scores">80(80)-8; ...</div>  ← underscore, not hyphen
            (may also have player_1_name / player_2_name elements)
        </div>

    Score matching: accept (our_s1, our_s2) OR (our_s2, our_s1) because
    CueTracker always shows winner first regardless of URL player order.

    Name verification: when p1_name/p2_name provided and the block has name
    elements, verify our name tokens appear in the CueTracker name. This
    prevents false positives on score collisions.

    Returns parsed frame list or [] if no match found.
    """
    soup = BeautifulSoup(html, "html.parser")
    match_divs = soup.find_all(class_="match")

    for div in match_divs:
        ct_s1_el  = div.find(class_="player_1_score")
        ct_s2_el  = div.find(class_="player_2_score")
        frame_el  = div.find(class_="frame_scores")   # NOTE: underscore, not hyphen
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

        # Score match — accept either ordering
        if ct_s1 == our_s1 and ct_s2 == our_s2:
            swap = False
        elif ct_s1 == our_s2 and ct_s2 == our_s1:
            swap = True
        else:
            continue

        # Optional name verification
        if p1_name or p2_name:
            ct_p1_name_el = div.find(class_="player_1_name")
            ct_p2_name_el = div.find(class_="player_2_name")
            if ct_p1_name_el and ct_p2_name_el:
                ct_p1_name = ct_p1_name_el.get_text(strip=True)
                ct_p2_name = ct_p2_name_el.get_text(strip=True)
                # swap=False: ct_p1 = our p1, ct_p2 = our p2
                # swap=True:  ct_p1 = our p2, ct_p2 = our p1
                if not swap:
                    if p1_name and not _name_tokens_match(p1_name, ct_p1_name):
                        continue
                    if p2_name and not _name_tokens_match(p2_name, ct_p2_name):
                        continue
                else:
                    if p2_name and not _name_tokens_match(p2_name, ct_p1_name):
                        continue
                    if p1_name and not _name_tokens_match(p1_name, ct_p2_name):
                        continue

        return _parse_frame_string(raw_frames, swap)

    return []


# ---------------------------------------------------------------------------
# Management command
# ---------------------------------------------------------------------------

def _safe(s: str) -> str:
    """Return string with non-encodable chars replaced (safe for Windows cp1255 console)."""
    try:
        s.encode("cp1255")
        return s
    except (UnicodeEncodeError, LookupError):
        return s.encode("ascii", "replace").decode("ascii")


class Command(BaseCommand):
    help = "Fetch per-frame point data from CueTracker for completed matches"

    def add_arguments(self, parser):
        parser.add_argument(
            "--limit", type=int, default=None,
            help="Max number of matches to process (default: no limit)",
        )
        parser.add_argument(
            "--match-id", type=int, default=None,
            help="Process a single match by api_match_id",
        )
        parser.add_argument(
            "--refetch", action="store_true",
            help="Re-fetch even if frame score data already exists",
        )
        parser.add_argument(
            "--top-ranked", type=int, default=None,
            help="Only process matches involving the top N ranked players (MoneyRankings, latest season)",
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

        if options["top_ranked"]:
            latest_season = (
                Ranking.objects.filter(Type="MoneyRankings")
                .order_by("-Season")
                .values_list("Season", flat=True)
                .first()
            )
            top_ids = list(
                Ranking.objects.filter(Season=latest_season, Type="MoneyRankings")
                .order_by("Position")[: options["top_ranked"]]
                .values_list("Player_id", flat=True)
            )
            self.stdout.write(
                f"Filtering to top {options['top_ranked']} players "
                f"(season {latest_season}, {len(top_ids)} IDs found)"
            )
            qs = qs.filter(Player1ID__in=top_ids) | qs.filter(Player2ID__in=top_ids)
            qs = qs.distinct()

        qs = qs.select_related("Event").order_by("-Event__Season", "-StartDate")
        if options["limit"]:
            qs = qs[: options["limit"]]

        total = qs.count()
        self.stdout.write(f"Processing {total} matches...")

        success, skipped, failed = 0, 0, 0
        for i, match in enumerate(qs, start=1):
            result = self._fetch_and_save(match)
            if result == "ok":
                success += 1
            elif result == "skip":
                skipped += 1
            else:
                failed += 1
            # Progress every 50 matches
            if i % 50 == 0:
                self.stdout.write(f"  ... {i}/{total} processed (ok:{success} skip:{skipped} fail:{failed})")

        self.stdout.write(
            self.style.SUCCESS(
                f"Done — success: {success}, skipped: {skipped}, failed: {failed}"
            )
        )

    def _fetch_and_save(self, match: MatchesOfAnEvent) -> str:
        """Scrape CueTracker for one match and save frames to DB.

        Returns: "ok" | "skip" | "fail"
        """
        # 1. Load Player objects (need SurnameFirst + ct_slug)
        players = {
            p.ID: p
            for p in Player.objects.filter(ID__in=[match.Player1ID, match.Player2ID])
        }
        p1_obj = players.get(match.Player1ID)
        p2_obj = players.get(match.Player2ID)

        if not p1_obj or not p2_obj:
            self.stderr.write(f"  SKIP {match.api_match_id}: missing player record(s)")
            return "skip"

        # 2. Short-circuit if either player confirmed absent on CueTracker
        if p1_obj.ct_slug == "NOT_FOUND" or p2_obj.ct_slug == "NOT_FOUND":
            self.stderr.write(
                f"  SKIP {match.api_match_id}: player(s) marked NOT_FOUND"
            )
            return "skip"

        # 3. Get full names (handles SurnameFirst for Chinese/Eastern players)
        names_map = get_player_names({match.Player1ID, match.Player2ID})
        p1_name = names_map.get(match.Player1ID, "")
        p2_name = names_map.get(match.Player2ID, "")

        if not p1_name or not p2_name:
            self.stderr.write(
                f"  SKIP {match.api_match_id}: could not build player name(s)"
            )
            return "skip"

        # 4. Build slug candidate lists
        # If stored slug exists → use it only (already verified to work)
        # If null → generate variants to try
        p1_candidates = (
            [p1_obj.ct_slug]
            if p1_obj.ct_slug
            else _generate_slug_variants(p1_name, bool(p1_obj.SurnameFirst))
        )
        p2_candidates = (
            [p2_obj.ct_slug]
            if p2_obj.ct_slug
            else _generate_slug_variants(p2_name, bool(p2_obj.SurnameFirst))
        )

        # 5. Try all p1 × p2 slug combinations
        found_frames = []
        used_p1_slug = None
        used_p2_slug = None

        for p1_slug in p1_candidates:
            for p2_slug in p2_candidates:
                status, html = _fetch_h2h_html(p1_slug, p2_slug)
                if status == 200:
                    frames = _parse_cuetracker_html(
                        html,
                        match.Score1,
                        match.Score2,
                        p1_name,
                        p2_name,
                    )
                    if frames:
                        found_frames = frames
                        used_p1_slug = p1_slug
                        used_p2_slug = p2_slug
                        break
                # Small delay between retries — be polite to CueTracker
                if len(p1_candidates) + len(p2_candidates) > 2:
                    time.sleep(0.3)
            if found_frames:
                break

        # 6. No frames found via H2H — try player profile page fallback
        if not found_frames:
            found_frames, opp_slug, known_is_p1 = self._try_player_page_fallback(
                match, p1_obj, p2_obj, p1_name, p2_name
            )
            if found_frames:
                # Persist slugs: known player's slug is already stored.
                # The opponent slug (discovered via their profile link) goes to the
                # other player if they don't have one yet.
                if known_is_p1:
                    if not p2_obj.ct_slug and opp_slug:
                        Player.objects.filter(ID=p2_obj.ID).update(ct_slug=opp_slug)
                        p2_obj.ct_slug = opp_slug  # keep in-memory in sync
                        self.stdout.write(f"  Stored ct_slug for {_safe(p2_name)} (via profile): {opp_slug}")
                    used_p1_slug = p1_obj.ct_slug
                    used_p2_slug = opp_slug
                else:
                    if not p1_obj.ct_slug and opp_slug:
                        Player.objects.filter(ID=p1_obj.ID).update(ct_slug=opp_slug)
                        p1_obj.ct_slug = opp_slug  # keep in-memory in sync
                        self.stdout.write(f"  Stored ct_slug for {_safe(p1_name)} (via profile): {opp_slug}")
                    used_p1_slug = opp_slug
                    used_p2_slug = p2_obj.ct_slug

        if not found_frames:
            # Do NOT mark NOT_FOUND — a 404 could be the OTHER player's fault.
            # Players stay null; future matches will re-try them.
            self.stderr.write(
                f"  SKIP {match.api_match_id} ({_safe(p1_name)} vs {_safe(p2_name)} "
                f"{match.Score1}-{match.Score2}): not found on CueTracker"
            )
            return "skip"

        # 7. Persist the working slugs on Player records (only if newly discovered)
        # Note: profile-page fallback already persists the opponent slug inline above.
        # Here we only handle the H2H-path case (where slugs come from used_p1/p2_slug).
        if not p1_obj.ct_slug and used_p1_slug:
            Player.objects.filter(ID=p1_obj.ID).update(ct_slug=used_p1_slug)
            self.stdout.write(
                f"  Stored ct_slug for {_safe(p1_name)}: {used_p1_slug}"
            )
        if not p2_obj.ct_slug and used_p2_slug:
            Player.objects.filter(ID=p2_obj.ID).update(ct_slug=used_p2_slug)
            self.stdout.write(
                f"  Stored ct_slug for {_safe(p2_name)}: {used_p2_slug}"
            )

        # 8. Save frames to DB (delete old rows first)
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
            for f in found_frames
        ])

        self.stdout.write(
            f"  OK  {match.api_match_id} ({_safe(p1_name)} vs {_safe(p2_name)} "
            f"{match.Score1}-{match.Score2}) -- {len(found_frames)} frames"
        )
        return "ok"

    def _try_player_page_fallback(
        self,
        match,
        p1_obj,
        p2_obj,
        p1_name: str,
        p2_name: str,
    ) -> tuple:
        """Try to find frame data by fetching the known player's CueTracker profile page.

        Called when all H2H slug combinations failed. Looks for a player that
        already has a confirmed ct_slug and fetches their profile page.

        Returns (frames, opponent_slug, known_is_p1) or ([], None, None) if not found.
        """
        # Determine the match year for filtering (fall back to event season)
        year = None
        if match.StartDate:
            year = match.StartDate.year
        elif match.Event and match.Event.Season:
            # Season string is like "2025-2026" — use the later year
            try:
                year = int(str(match.Event.Season).split("-")[-1])
            except (ValueError, AttributeError):
                pass

        if not year:
            return [], None, None

        # Try known players in order: p1 first, then p2
        candidates = []
        if p1_obj.ct_slug and p1_obj.ct_slug != "NOT_FOUND":
            candidates.append((p1_obj, True))   # (player_obj, known_is_p1)
        if p2_obj.ct_slug and p2_obj.ct_slug != "NOT_FOUND":
            candidates.append((p2_obj, False))

        for known_player, known_is_p1 in candidates:
            status, html = _fetch_player_page_html(known_player.ct_slug)
            if status != 200:
                continue

            frames, opp_slug = _parse_player_page(
                html,
                match.Score1,
                match.Score2,
                year,
                known_is_p1,
                p1_name,
                p2_name,
                known_slug=known_player.ct_slug,
            )
            if frames:
                self.stdout.write(
                    f"  OK (profile) {match.api_match_id} ({_safe(p1_name)} vs {_safe(p2_name)} "
                    f"{match.Score1}-{match.Score2}) via {known_player.ct_slug} -- "
                    f"{len(frames)} frames"
                )
                return frames, opp_slug, known_is_p1

            time.sleep(0.3)

        return [], None, None
