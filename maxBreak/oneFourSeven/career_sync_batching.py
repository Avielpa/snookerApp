# oneFourSeven/career_sync_batching.py
"""
Rolling-sweep cursor helpers for `sync_career_history`'s opt-in
`--batch-size` mode.

This intentionally mirrors the cursor/batch pattern already used by
`nightly_stats_checks.load_cursor` / `save_cursor` / `select_batch`
(same shape: a JSON file holding a position index, `select_batch`
wraps around the roster instead of raising when it shrinks/grows) but
lives in its own module with its own cursor file so the two rolling
sweeps never collide or share state — they cover different commands,
different data sources (snooker.org t=8 match history vs CueTracker
career totals), and run on different schedules.

Kept as pure, dependency-free functions (no Django imports) so they're
trivially unit-testable without a database, same as the nightly-check
originals.
"""

import json as _json
from pathlib import Path


def load_cursor(path) -> int:
    """Read the rolling-sweep position cursor. Returns 0 (start of the
    candidate list) if the file is missing or unreadable — a reset is
    harmless, it just means the sweep starts over from the first
    player in the (sorted) candidate list."""
    path = Path(path)
    if not path.exists():
        return 0
    try:
        data = _json.loads(path.read_text())
        return int(data.get('next_index', 0))
    except Exception:
        return 0


def save_cursor(path, next_index: int) -> None:
    Path(path).write_text(_json.dumps({'next_index': next_index}))


def select_batch(player_ids: list, cursor: int, batch_size: int):
    """Return (batch, next_cursor) — up to batch_size player IDs
    starting at cursor's *position* in player_ids, wrapping to the
    start once the end of the list is reached. cursor is a position
    index, not a player ID, so a shrinking/growing roster (e.g. the
    top-N ranking list changing week to week) degrades gracefully
    instead of raising or skipping players."""
    n = len(player_ids)
    if n == 0:
        return [], 0

    start = cursor if 0 <= cursor < n else 0
    batch = [player_ids[(start + i) % n] for i in range(min(batch_size, n))]
    next_cursor = (start + len(batch)) % n
    return batch, next_cursor
