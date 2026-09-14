# Session 2026-09-14 — Personal-best-break tracking + guest-session data leak fix

## Context

Two-part feature, both agreed in a design discussion earlier the same session:

1. **Guest-session leak fix**: `saveMatch()` (`gameStorage.ts`) wrote to local `AsyncStorage`
   for every player, logged in or not. `scoreboardSyncService.ts`'s `syncOnLogin() →
   syncAllLocal()` then uploads whatever's in local storage to whichever account just logged
   in — meaning a guest's pre-login matches could get silently attributed to a real account on
   a shared/reused device. Fix: gate `saveMatch()` itself on login status.
2. **Personal-best-break tracking, per reds-count, login-gated** (Dream League-style "beat your
   own record" mechanic). Deliberately scoped to **personal only, Phase 1** — no global
   leaderboard yet (self-reported scores have no anti-cheat, a public leaderboard would be
   trivially gameable; see the design discussion for the full reasoning). Tracked separately
   per `reds_count` since a 6-red break and a 15-red break aren't comparable (different max
   possible values).

## What was built

### Backend (`maxBreak/oneFourSeven/`)

- **New model** `PlayerBestBreak(user, reds_count, best_break, achieved_at)`, unique per
  `(user, reds_count)`. Migration `0026_playerbestbreak`.
- **New endpoint** `GET/POST /oneFourSeven/scoreboard/best-break/` (`IsAuthenticated`, same
  pattern as the existing `scoreboard_matches_view`):
  - `GET` returns all of the user's records.
  - `POST {reds_count, break}` upserts **only if strictly higher** — never lowers a record.
    Returns the current record plus `is_new_record` so the frontend knows whether to
    celebrate (not wired up yet — that's Phase 2).
- New `PlayerBestBreakSerializer`.
- **New test file** `oneFourSeven/tests_best_break.py` — 17 tests: upsert-if-higher logic
  (higher replaces, lower/equal doesn't), per-reds_count isolation, input validation
  (negative/missing/non-integer rejected, 0 and 147 accepted as valid edge values), per-user
  isolation, auth required on both GET and POST (401 without a token).

### Frontend (`FrontMaxBreak/`)

- **New `services/bestBreakService.ts`**: `submitBreak(redsCount, breakValue)` and
  `fetchBestBreaks()` — both login-gated, no-op (never throw) for guests. Also exports
  `isPotentialNewRecord(breakValue, knownBest)`, a pure client-side pre-check (not currently
  used to skip network calls, but available for Phase 2's live celebration trigger).
- **`gameStorage.ts`**: `saveMatch()` now checks `isLoggedIn()` first and no-ops for guests.
  `saveDraft`/`loadDraft`/`clearDraft` (mid-session crash recovery) are **untouched** — a
  guest can still resume an interrupted game, they just never get a permanent History record
  once it ends. This was a deliberate, confirmed choice (see the design discussion — NOT "zero
  persistence even mid-game", which would have killed crash recovery for the majority of
  current users).
- **`app/scoreboard/game.tsx`**: in the existing `snap.isFrameOver` effect (already the single
  choke point where a frame/break is detected as complete), submits the break(s):
  - Train mode: `snap.scores[0]` (matches what `FrameSummary`/the share flow already display).
  - Match/Unlimited mode: **both players'** `frameHighestBreak` for that frame, not just the
    winner's — a break counts toward a personal best even in a frame you go on to lose.
- **`app/scoreboard/index.tsx`** (Play Mode setup): fetches the user's best breaks on focus,
  shows "🏆 Your best break: X (Y reds)" next to the existing "Starting points / Max break"
  line, live-updating as the reds-count selector changes. Logged-in only (reuses the existing
  `useAuth()`/`loggedIn` check already on this screen — no new sign-in banner needed).
- **New `best_break_test.mjs`** — 896 assertions on `isPotentialNewRecord`'s pure logic
  (monotonic sanity check across the full 0–147 break range, known-best comparisons, the
  null-known-best first-submission case).

## What was NOT built (explicitly deferred to Phase 2)

- Live "New Personal Best!" celebration mid-game (would reuse the existing
  `CenturyCelebration`/`shouldTriggerCentury` pattern).
- A distinct share message for new-record moments in `shareService.ts`.
- A "Your Records" list on the History screen.
- Any global/cross-user leaderboard.

## Tests

- Backend: `python manage.py test oneFourSeven.tests_best_break` — 17/17 passed. Full backend
  suite (`oneFourSeven.tests` + all other `tests_*` modules, run via explicit dotted paths —
  see note below) — 360 tests, **1 pre-existing unrelated failure**
  (`PlayerMatchHistoryOrderingTest.test_null_date_appears_last`, already logged in
  `docs/OPEN_MISSIONS.md` #1/#19, confirmed unrelated to this change).
- Frontend: `best_break_test.mjs` (896/896) + the full existing suite (`game_test.mjs` 328,
  `train_test.mjs` 51, `mega_test.mjs` 470, `freeball_test.mjs` 121, `stats_test.mjs` 48,
  `offseason_tab_test.mjs` 42, `share_test.mjs` 186) — all green, 2,142 total assertions.
- `npx tsc --noEmit` — clean, no errors.

**Gotcha for next agent**: `python manage.py test oneFourSeven` (bare app label) fails with
`ModuleNotFoundError: No module named 'maxBreak.oneFourSeven'` in this environment — looks
like a stray `__init__.py` at the repo-root `maxBreak/` directory (not the Django settings
package one level down) confuses unittest's package discovery. Workaround: pass explicit
dotted module paths (`oneFourSeven.tests oneFourSeven.tests_best_break ...`) instead of the
bare app label. Did not investigate/fix the stray `__init__.py` itself — out of scope for this
session, logged here rather than fixed as a drive-by.

## Verified, not yet deployed

Both backend and frontend changes are code-complete and test-verified, but **nothing has been
pushed or published yet**:
- Backend needs `git push master` (Railway auto-deploys + runs the migration) before the new
  endpoint exists anywhere reachable.
- Frontend needs an `eas update` (preview first, per standard workflow) — but it depends on
  the backend being live first, since `bestBreakService.ts` calls the new endpoint.
- User has asked for a **physical S24 test** once this is done — that requires the backend
  live first (the device talks to the real Railway API, not a local dev server), so the
  sequence is: backend push (needs approval) → preview OTA → device test → production.

## Next session / immediate next step

Get explicit approval to `git push master` (backend), then `eas update --channel preview`
(frontend), then device-test on the S24: verify a guest never gets a History entry, verify a
logged-in user's break correctly upserts via the new endpoint, verify the Play Mode screen
shows the right best-break number per reds-count.
