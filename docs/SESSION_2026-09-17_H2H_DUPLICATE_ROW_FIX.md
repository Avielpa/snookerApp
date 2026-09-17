# Session 2026-09-17 — H2H duplicate-row bug, nightly-check exit code, prize-money mislabel

## Symptom

User was looking at the Compare screen for Mark Selby vs Judd Trump and asked for the data
to be verified against snooker.org/CueTracker for accuracy. A Facebook post the user saw
claimed different H2H numbers than the app.

## Root-cause chain

### 1. H2H `TotalMeetings`/win counts were exactly 2x the real numbers, for every player pair

- `PlayerMatchHistory` intentionally stores **one row per player per match** (confirmed by
  the model's own docstring and its `unique_together = ['player_id','event_id','round_number',
  'player1_id','player2_id']`) — each player's own match-history fetch (`t=8` API) writes
  their own copy of every match they played.
- `h2h_view` (`maxBreak/oneFourSeven/views.py`) queried
  `Q(player1_id=p1,player2_id=p2) | Q(player1_id=p2,player2_id=p1)` with **no `player_id`
  constraint** — so for every real match it matched *both* players' own rows (one row has
  `player1_id=p1`, the mirror row has `player1_id=p2`), doubling every count.
- Verified against 7 pairs / 14 players (Trump/Selby, Zhao/Robertson, Wu/Wilson,
  O'Sullivan/Higgins, Hawkins/Bingham, Murphy/Carter, Ding/Zhang): every single pair showed
  exactly 2x inflation, and every de-duplicated count matched snooker.org's own published
  total exactly (confirmed by fetching `snooker.org/res/index.asp?player1=X&player2=Y`
  directly for each pair). CueTracker's totals differ for older legends (e.g. O'Sullivan vs
  Higgins: CueTracker says 80, snooker.org and our data say 50) — that's a genuine scope
  difference between the two providers' databases, not a bug, since the app is built on
  snooker.org as the canonical source.
- **The write side is healthy** — a prior migration (`0017_deduplicate_player_match_history.py`)
  already cleaned up a *different* duplication case (API match-ID rotation on session breaks),
  and the `unique_together` constraint plus `update_or_create` in all 3 writers
  (`backfill_career_history.py`, `sync_career_history.py`, `update_player_details.py`) prevent
  it recurring. This was purely a read-side query bug.

**Fix**: added `player_id=p1_int` to the existing query filter in `h2h_view`
(`maxBreak/oneFourSeven/views.py`) — a one-line correction to the query that was already
there, not a new dedup function layered on top. This also incidentally resolves a secondary
oddity: the two mirror rows for a match can carry independently-scraped `round_name` values
(e.g. "Qualifying Round" vs "Round 7" for the same `api_match_id`) — since the fix always
reads from p1's own copy, there's no second copy left to disagree with.

Tests: new file `maxBreak/oneFourSeven/tests_h2h_view.py` (6 tests, all passing) — covers
the two-mirror-row case, multiple matches, round-name divergence, reversed player order, a
single row with no mirror, and the empty case.

### 2. `nightly_stats_check` GitHub Action reported "failure" every night for 8+ days — but was actually working

- Checked via `gh run list --workflow=nightly_stats_check.yml`: every scheduled run since at
  least 2026-09-09 shows `failure`.
- Reading the actual log (`gh run view <id> --log-failed`): the command completes real work
  (`OK: 73 AUTO-FIXED: 9 STILL FLAGGED: 646 ERRORS: 0`) — it only fails because the command
  (`nightly_stats_check.py`) exits 1 whenever `still_flagged or errors` is non-empty. Hundreds
  of retired/amateur players will *always* have a permanently-unfixable flag (`NO_MATCHES` on
  a player who genuinely has no professional matches), so this workflow could never show green
  under the old condition — training false-alarm blindness to what should be a meaningful
  signal.

**Fix**: changed the exit condition in `nightly_stats_check.py` to `if not dry_run and errors:`
— only a real `ERRORS` count (an exception during processing) fails the run now;
`still_flagged` alone (expected, most nights) does not.

This is a **behavior change**, not just a code tweak — it required updating ~20 existing
tests in `tests_nightly_stats_check.py` that encoded the old (buggy) "exit 1 whenever
anything is flagged" contract. Each was checked individually against the command's actual
`errors` vs `still_flagged` classification (read from `nightly_stats_check.py`'s handle()
loop) before deciding whether to keep or drop its `assertRaises(SystemExit)`. Genuine error
scenarios (an exception raised inside `attempt_autofix` or `build_snapshot`) still correctly
expect `SystemExit`; flags-only scenarios no longer do. Replaced
`test_exit_code_nonzero_when_still_flagged` (asserted the old, now-wrong contract) with
`test_exit_code_zero_when_only_still_flagged_no_errors` and a new
`test_exit_code_nonzero_when_errors_present`.

All 113 tests in `tests_nightly_stats_check.py` pass after the update.

### 3. `ADMIN_EXPO_PUSH_TOKEN` GitHub secret was never configured — separate, still-open finding

While investigating #2, found via `gh secret list` that this repo's secrets are
`DATABASE_URL`, `EXPO_TOKEN`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_SERVICES_JSON_B64`,
`SECRET_KEY` — no `ADMIN_EXPO_PUSH_TOKEN`. Every nightly log confirms:
`Notification skipped: something was flagged but no --notify-token was configured.` The
notify code itself is correct; the secret was just never set. **Not fixed in this session**
— needs the user to run `gh secret set ADMIN_EXPO_PUSH_TOKEN`. Logged as open mission #23.

### 4. "Prize (Season)" label was mislabeled, not miscalculated

`prize_money_this_year` (backend `views.py`, `Player` type in `matchServices.ts`, shown as
"Prize (Season)" in Compare and "Prize Money / This season" on the player profile screen) is
actually `Ranking.Sum` for the player's current `MoneyRankings` entry — snooker.org's own
rolling ranking-list money total (correct data, matches the correct ranking position), not a
single-season figure. Verified: Trump's 2026-27 season prize money on CueTracker is
£269,200, while the app showed £1,109,550 for the same "season" label.

**Fix**: renamed the field end-to-end (root fix, no compatibility alias left behind):
- `views.py`: `player_data['prize_money_this_year']` → `player_data['career_ranking_money']`
- `matchServices.ts`: `Player.prize_money_this_year` → `Player.career_ranking_money`
- `app/player/[id].tsx`: label "Prize Money" / "This season" → "Ranking Money" / "Ranking-list total"
- `app/compare/index.tsx`: label "Prize (Season)" → "Ranking Money"
- Grepped the whole repo afterward for `prize_money_this_year` — zero remaining references.

## Files touched

- `maxBreak/oneFourSeven/views.py` — H2H query fix (added `player_id=p1_int`); prize-money
  field rename (2 lines).
- `maxBreak/oneFourSeven/management/commands/nightly_stats_check.py` — exit-code condition fix.
- `maxBreak/oneFourSeven/tests_nightly_stats_check.py` — ~20 test updates to match the
  corrected exit-code contract, 2 new tests.
- `maxBreak/oneFourSeven/tests_h2h_view.py` — new, 6 tests for the H2H dedup fix.
- `FrontMaxBreak/services/matchServices.ts` — `Player` type field rename (2 occurrences).
- `FrontMaxBreak/app/player/[id].tsx` — field rename + label change.
- `FrontMaxBreak/app/compare/index.tsx` — field rename + label change.
- `docs/OPEN_MISSIONS.md` — added items #21 (WinnerID=0 anomaly), #22 (no automation for
  `sync_career_history`), #23 (missing `ADMIN_EXPO_PUSH_TOKEN` secret).

## Verified vs. still needs confirmation

**Verified (backend)**:
- `tests_h2h_view.py`: 6/6 pass.
- `tests_nightly_stats_check.py`: 113/113 pass (after the ~20 updates above).
- Full backend suite (`oneFourSeven.tests*`, 391 tests total): 1 failure, confirmed
  **pre-existing and unrelated** — `PlayerMatchHistoryOrderingTest.test_null_date_appears_last`,
  already tracked as open mission #1/#19. Confirmed by `git stash`-ing this session's changes
  and re-running the same test in isolation: it fails identically on the pre-change baseline.

**Verified (frontend)**:
- `npx tsc --noEmit` in `FrontMaxBreak/`: clean, zero errors.
- Grep confirms zero remaining references to the old `prize_money_this_year` name anywhere
  in the repo.

**NOT yet done — needs explicit approval before proceeding**:
- Backend changes (H2H fix + exit-code fix + prize-money rename) are **not pushed to
  `master`** yet — Railway auto-deploys on push, so this needs the user's go-ahead first.
- Post-deploy curl verification against production (`/h2h/12/17/` should show
  `TotalMeetings: 43`, `23-20` for Trump/Selby) has not been done yet — production still has
  the buggy code.
- Frontend changes (prize-money rename + label) have not been through `eas update --channel
  preview` or a real-device check yet, per CLAUDE.md's preview-before-production rule.
- `ADMIN_EXPO_PUSH_TOKEN` secret still needs the user to set it (open mission #23) — not
  something this session could do.

## Lessons for a future agent touching this area

- **`h2h_view`'s query needs `player_id=p1_int`.** If you ever see this constraint missing
  again (e.g. a refactor that "simplifies" the `Q(...)` filter), it will silently reintroduce
  the doubling bug — there's no DB-level constraint preventing it, only the query is correct now.
- **`PlayerMatchHistory` legitimately has two rows per match** (one per player) — this is
  intentional, not a bug, for any other view/command that touches this table. Don't "fix" it
  by adding a distinct/unique constraint across both players; the correct read pattern is to
  constrain on `player_id` for whichever player's perspective you want.
- **`nightly_stats_check`'s exit code now means something.** A red ❌ on this workflow going
  forward is a real signal (an actual exception during the run), not routine noise — don't
  reflexively re-add a "fail if anything flagged" condition without re-deriving why that was
  wrong (see root-cause #2 above).
- **CueTracker and snooker.org can legitimately disagree** on historical totals for
  long-career players (CueTracker's database includes more/older matches). When verifying
  H2H or career numbers, snooker.org is this app's actual source of truth — don't "fix" a
  correct snooker.org-matching number just because CueTracker shows something bigger.
