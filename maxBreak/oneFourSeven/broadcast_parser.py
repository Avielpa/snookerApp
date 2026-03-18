# oneFourSeven/broadcast_parser.py
"""
Parses broadcaster information from Event.CommonNote HTML.
No Django imports — pure Python, independently testable.
Every function is wrapped in try/except so a failure never breaks the caller.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Known broadcaster URL patterns → canonical display name
BROADCASTER_PATTERNS = [
    (r'eurosport', 'Eurosport'),
    (r'discoveryplus|discovery\+|discoverylus', 'Discovery+'),
    (r'bbc\.co\.uk|bbc\.com', 'BBC'),
    (r'dazn\.com', 'DAZN'),
    (r'huya\.com', 'Huya'),
    (r'wst\.tv', 'WST TV'),
    (r'laola1', 'Laola1'),
    (r'sport1', 'Sport1'),
    (r'viaplay', 'Viaplay'),
]


def parse_broadcasters(common_note_html: str) -> list:
    """
    Extracts broadcaster info from an HTML string such as:
      '<a href="https://www.discoveryplus.com/">Discovery+</a>,
       <a href="https://www.huya.com/...">Huya</a>'

    Returns a list of dicts: [{'name': 'Discovery+', 'url': 'https://...'}]
    Empty list if nothing found, input is empty, or any error occurs.
    """
    try:
        if not common_note_html:
            return []

        results = []
        seen_names = set()

        links = re.findall(
            r'<a\s+href=["\']([^"\']+)["\'][^>]*>([^<]+)</a>',
            common_note_html,
            re.IGNORECASE,
        )

        for url, label in links:
            name = _resolve_name(url, label)
            if name and name not in seen_names:
                seen_names.add(name)
                results.append({'name': name, 'url': url.strip()})

        return results
    except Exception as e:
        logger.error(f'[broadcast_parser] parse_broadcasters failed: {e}')
        return []


def _resolve_name(url: str, label: str) -> str:
    """Match URL against known patterns; fall back to the link label."""
    try:
        url_lower = url.lower()
        for pattern, name in BROADCASTER_PATTERNS:
            if re.search(pattern, url_lower):
                return name
        cleaned = re.sub(r'\s+', ' ', label).strip()
        return cleaned if cleaned else None
    except Exception:
        return None
