# Session 2026-09-17 — Tied-score `PlayerMatchHistory` rows (Open Mission #21) — investigated, NOT fixed with code

## Symptom

Open Mission #21 described a small, apparently-fixable data anomaly found while verifying H2H
data in an earlier session: two `PlayerMatchHistory` rows (Murphy vs Carter, match IDs
`8323068` / 2007 season and `8322904` / 2008 season) had `status=3` (completed), `score1==score2`
(2-2), and `winner_id=0` — a tied score with no winner, which snooker (no draws) should never
produce. The mission asked to find the full extent of this pattern and, where the real winner
is recoverable from snooker.org, correct `winner_id` via a new dry-run/`--apply` management
command.

## Root-cause chain

### 1. The pattern is 500x bigger than the two known examples, and still happening today

Query against the real production DB (`maxBreak/`, `DATABASE_URL` from `.env`):

```python
PlayerMatchHistory.objects.filter(status=3, score1=F('score2')).filter(Q(winner_id=0)|Q(winner_id__isnull=True))
```

Result: **1,037 rows / 669 distinct `api_match_id`s**, not "a couple." Season breakdown:

```
2007: 70   2008: 76   2010: 14   2012: 2   2019: 65   2020: 104
2021: 99   2022: 119  2023: 120  2024: 141 2025: 140  2026: 87
```

This is ongoing into the **current, 2026 season** — not a historical backfill artifact confined
to old data, which was the working assumption behind the mission entry.

### 2. `round_number=19` / `round_name='Final'` is a real, reused round label — not itself corrupt

1,034 of the 1,037 anomalous rows have `round_number=19`. But `round_number=19` overall has
10,397 `status=3` rows in the table, of which only 1,034 (~10%) are tied — the other 9,278 have
normal distinct scores and real winners (e.g. `Igor Figueiredo 2-0 Fabio Vieria`, Americas Q Tour
2 Group A). snooker.org clearly reuses round 19 as "the Final round" across many small/amateur
tour formats (Q Tours, Women's Tour, Seniors, qualifying groups), not just the main tour. So the
round number itself is a legitimate, working piece of data — it just happens to be where these
ties cluster, because it's the round that includes group-decider matches.

### 3. Direct verification against snooker.org's own live H2H page: at least one "anomaly" IS the real, correct result

Fetched `snooker.org`'s live head-to-head listing for Murphy vs Carter. It independently lists:

> **Championship League - Group 3 (10-11 Mar 2008) — Match ended 2-2**

This is an exact match for our DB's `api_match_id=8322904`/`8323068`-era row for that pair and
season (Championship League Group stage) — confirmed by `event_id` cross-reference. **snooker.org
itself, today, records this specific match as a tie with no winner.** This directly falsifies the
mission's working assumption that these are recoverable data-entry mistakes — for this example
(and, by the pattern below, most of the dataset), there is no "real winner" to look up.

### 4. The anomalous rows are overwhelmingly round-robin/group-format events, where individual match draws are a real, permitted outcome

Checked event names/IDs for all 295 distinct `event_id`s among the anomalous rows:
- 69 have an `Event` row in our DB, and **100% of those 69 event names contain "Group"/"League"/
  "Q Tour"** (Championship League Stage One groups, Q Tour groups, Women's Snooker Open groups,
  etc.) — all round-robin mini-league formats where standings are decided by aggregate
  frames/points across the group, not necessarily a single-match win/loss.
- 226 have **no matching `Event` row at all** (event IDs mostly clustered in the 1040s–1550s
  range, all pre-2012 seasons) — these are old amateur/qualifying groups that were never stored
  as full `Event` records, only backfilled into `PlayerMatchHistory` via career-history sync.
  Their `event_name` is null on the row itself too. Given the season/ID clustering matches the
  same era and shape as the confirmed-group cases above, and no distinct-score anomaly was found
  outside round 19, these are very likely the same round-robin-group phenomenon, just for events
  our DB doesn't have full records of — not independently verifiable without a match-by-match
  snooker.org lookup for all 226.
- Score-pair breakdown across all 1,037 rows: `(2,2)` ×1,005, `(3,3)` ×28, `(0,0)` ×4 — all
  plausible round-robin mini-match tie scores (best-of-4 or similar formats ending level), not a
  pattern suggesting corrupted/truncated data.

### Conclusion: root cause is NOT a data-entry bug for the large majority of rows

The original mission's framing — "snooker has no drawn matches, this must be a data-entry
artifact, find the real winner" — does not hold once the full extent is examined. The most
likely true root cause is: **round-robin group-stage matches in several tour formats
(Championship League, Q Tour, Women's Tour, and older unnamed qualifying groups) can genuinely
end level**, and `winner_id=0`/`null` is snooker.org's own correct representation of that,
faithfully carried through by our scraper/backfill code. This is confirmed directly for at least
one of the two originally-cited examples.

## Why no fix command was written (bug-fix-expert rule 1)

The task's rule 1 requires stopping and reporting back, instead of proceeding, if what's found is
"materially riskier or larger in scope" than what was described. Both are true here:
- **Scope**: 1,037 rows / 669 matches across 20 seasons including the current one, vs. "a couple"
  of old rows.
- **Nature**: the task assumed a recoverable data-entry mistake fixable via snooker.org research;
  the evidence instead shows most of these are correct, intentional representations of round-robin
  draws that have no "real winner" to recover.

Building the requested `fix_tied_score_matches.py` management command as specified — flag rows,
then correct `winner_id` for ones where a winner is "determined by research" — is not appropriate
at this point: for the ~800+ confirmed/highly-likely round-robin cases there is no winner to
assign (writing one in would be fabricating a result, not fixing an error), and for the small
remainder there is no reliable way to distinguish "genuinely uncorrectable draw" from "actually a
mis-recorded single-elimination final" without individually re-verifying against snooker.org for
each of up to 226 unnamed old events — far beyond what a single session can respectably verify
match-by-match, and risky to have a script guess at.

**No code was written or changed.** Only two documentation files were updated (this session doc,
and `docs/OPEN_MISSIONS.md` item #21).

## Files touched

- `docs/OPEN_MISSIONS.md` — item #21 rewritten to reflect the actual investigated scope and
  conclusion (still open, reframed as a product-scope question rather than a pending data fix).
- `docs/SESSION_2026-09-17_tied_score_match_fix.md` — this file (new).

No application code, management commands, or tests were added or modified. No database writes
were made (all queries were read-only `SELECT`s via the Django ORM against the real DB).

## What was verified

- Real DB query (`maxBreak/`, `source ../venv/Scripts/activate`, Django ORM via
  `python manage.py shell`) confirming 1,037 rows / 669 distinct matches, with the round-number,
  score-pair, season, and event-name breakdowns quoted above from actual query output.
- Live `WebFetch` against `snooker.org`'s head-to-head page for Murphy/Carter, independently
  confirming one of the two originally-cited example matches as a genuine "Match ended 2-2" per
  snooker.org's own current data — not something this session asserted, something snooker.org
  itself currently states.
- Cross-referenced 295 distinct `event_id`s among the anomalous rows against the local `Event`
  table; classified all 69 resolvable ones as round-robin group/league/Q-Tour formats (100%).

## What was NOT done / still needs human review

- **No management command or tests were written**, contrary to the original task's steps 3-4 —
  this is the deliberate stop-and-report outcome per bug-fix-expert rule 1, not an omission. If
  the user still wants a command after reading this, it should likely be a **flag-only /
  reporting** command (no `--apply` correction path at all), since there is no defensible
  correction logic for the majority case.
- **The 226 event_ids with no local `Event` row are not individually verified** — only inferred
  by pattern (ID clustering, season era, score-pair shapes) to be the same round-robin-group
  phenomenon as the 69 confirmed ones. A human could spot-check a handful of these against
  snooker.org if more certainty is wanted, but verifying all 226 is a large, separate effort.
- **No decision was made about whether win/loss aggregation logic should treat these differently**
  (e.g. explicitly labeling them "drawn/no result" somewhere in the UI vs. silent exclusion, which
  is the current de facto behavior). That's a product question for the user, not something this
  investigation should decide unilaterally.
- Temporary one-off query scripts used during investigation (`q1.py` in the OS temp dir, and
  several `check_*.py` scripts created directly under `maxBreak/` during the session) were deleted
  after use — none were left in the working tree.
