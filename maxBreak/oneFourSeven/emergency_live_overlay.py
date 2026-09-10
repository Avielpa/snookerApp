# oneFourSeven/emergency_live_overlay.py
"""
EMERGENCY / BREAK-GLASS ONLY.

Request-time live-score overlay for when api.snooker.org is down but the
public results page (www.snooker.org/res/index.asp) is still live.

This is a *read-path* augmentation only — it never writes to the DB and
never touches api_client.py, data_savers.py, or auto_live_monitor. It is
called from matches_of_an_event_view() right before the response is
returned, wrapped in a try/except there so any failure here is invisible
to the API response (falls back to whatever the DB already has).

Self-limiting by design:
- Only activates for events currently in progress (today between
  StartDate/EndDate) — never fetches the public page for old/future events.
- In-process cached for CACHE_SECONDS so concurrent app requests don't each
  trigger a fetch of the public page.
- Only ever overlays score/status onto matches not already Status=Finished
  in our DB — never invents matches, never overwrites a finished result.
- Once auto_live_monitor resumes writing real live data from the real API,
  this overlay keeps running but just reconfirms the same values — it does
  not need to be manually turned off, and can be deleted once no longer
  needed without touching any other file.
"""

import re
import time
import logging
from datetime import date
from typing import Dict, Tuple, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

RESULTS_URL = "https://www.snooker.org/res/index.asp"
CACHE_SECONDS = 20
FETCH_TIMEOUT = 4  # seconds — must stay well under request/response budget

# {event_id: (fetched_at_epoch, overlay_dict)}
_cache: Dict[int, Tuple[float, Dict[Tuple[int, int], dict]]] = {}


def _parse_live_overlay(html: str) -> Dict[Tuple[int, int], dict]:
    """Returns {(round, number): {player1_id, player2_id, score1, score2, live}}"""
    soup = BeautifulSoup(html, "html.parser")
    overlay = {}

    for tr in soup.find_all("tr"):
        classes = tr.get("class") or []
        round_match = next((re.match(r"^round(\d+)$", c) for c in classes if re.match(r"^round(\d+)$", c)), None)
        if not round_match or "oneonone" not in classes:
            continue
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
            continue

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
            continue

        overlay[(round_num, number)] = {
            "player1_id": player1_id,
            "player2_id": player2_id,
            "score1": int(score1_text),
            "score2": int(score2_text),
            "live": "unfinished" in classes,
        }

    return overlay


def _fetch_overlay(event_id: int) -> Optional[Dict[Tuple[int, int], dict]]:
    now = time.time()
    cached = _cache.get(event_id)
    if cached and (now - cached[0]) < CACHE_SECONDS:
        return cached[1]

    try:
        resp = requests.get(
            RESULTS_URL,
            params={"event": event_id},
            timeout=FETCH_TIMEOUT,
            headers={"User-Agent": "Mozilla/5.0 (compatible; MaxBreakEmergencyOverlay/1.0)"},
        )
        resp.raise_for_status()
        overlay = _parse_live_overlay(resp.text)
    except Exception as e:
        logger.debug(f"[emergency_live_overlay] fetch/parse failed for event {event_id}: {e}")
        # Keep serving a stale cache rather than nothing, if we have one.
        return cached[1] if cached else None

    _cache[event_id] = (now, overlay)
    return overlay


def event_is_in_progress(event_instance) -> bool:
    try:
        today = date.today()
        start = event_instance.StartDate
        end = event_instance.EndDate
        if not start or not end:
            return False
        return start <= today <= end
    except Exception:
        return False


def apply_emergency_live_overlay(event_instance, response_data: list) -> list:
    """
    Mutates and returns response_data: for events currently in progress,
    overlays live score/status from the public results page onto matches
    that aren't already Finished in our DB. Any failure is swallowed and
    response_data is returned unchanged.
    """
    try:
        if not event_is_in_progress(event_instance):
            return response_data

        overlay = _fetch_overlay(event_instance.ID)
        if not overlay:
            return response_data

        for match_dict in response_data:
            # Only ever touch matches not already finished in our own DB.
            if match_dict.get("status_code") == 2:
                continue

            key = (match_dict.get("round"), match_dict.get("number"))
            row = overlay.get(key)
            if not row:
                continue

            db_ids = {match_dict.get("player1_id"), match_dict.get("player2_id")}
            page_ids = {row["player1_id"], row["player2_id"]}
            if None not in db_ids and db_ids != page_ids:
                continue  # different match than we think — don't touch it

            if match_dict.get("player1_id") == row["player1_id"]:
                s1, s2 = row["score1"], row["score2"]
            else:
                s1, s2 = row["score2"], row["score1"]

            match_dict["score1"] = s1
            match_dict["score2"] = s2
            if row["live"]:
                match_dict["status_code"] = 1
                match_dict["status_display"] = "Running / Live"

        return response_data
    except Exception as e:
        logger.debug(f"[emergency_live_overlay] overlay failed: {e}")
        return response_data
