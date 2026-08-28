# Session: Home / Tour sequential round path

Date: 2026-08-23

## Symptom
Home showed mixed round names (Last 64, Round 1, Quarter-Finals) and skipped live Last 64 because those matches live on the Qualifiers event (e.g. Wuhan 2758) while Home loads the main event (2757).

## Root cause
1. Main-draw Last 64 is stored on the sibling Qualifiers event. `matches_of_an_event_view` only returned rows for the requested event.
2. The UI mixed snooker.org names (Last 64 / QF) with generic `Round N` labels.

## What changed
Backend keeps whatever round numbers snooker.org uses. The UI always shows **Round 1, Round 2, Round 3, …** along one knockout path.

- `maxBreak/oneFourSeven/tournament_path.py` — merge qualifier main-draw matches onto the main event; `sequential_round_map` / `path_round_for_match`.
- `matches_of_an_event_view` and `match_detail_view` attach `path_round` (1-based).
- Home, Tour list, Draw, match screen, and Other Tours use sequential labels and ignore Last 64 / QF copy.

## Verified
- `node home_drawtab_test.mjs` — 63/63
- `node bracket_chain_test.mjs` — 44/44
- Full FrontMaxBreak Node suite from CLAUDE.md (game/train/mega/freeball/stats/offseason) — all passed

Django tests in `tests_tournament_path.py` were **not** run here (`python3` has no Django in this environment).

## Not in this change
Player profile match history still uses API round names (Last 64, etc.). That list spans many events, so sequential Round 1 per event would be misleading without extra context.

## Deploy
Backend must go to Railway (`git push` of `maxBreak/`) for Last 64 to appear in the main event match list and for `path_round` on match detail. Then `eas update` for the JS labels. Do not ship either without an explicit ask.
