# Session 2026-09-16: Session/Frame Timers + Global Best-Break Leaderboard

## What was built

Three features on top of the existing Train-mode personal-best-break tracking (`docs/SESSION_2026-09-14_best_break_phase2.md`):

1. **Session timer** — tracks elapsed time since the game screen was opened, any mode. Shown in the header. "Time played today" is derivable from saved match records' new `durationSeconds` field, but no dedicated UI surfaces the daily sum yet (only `sumDurationForToday()` exists as a callable helper) — see Follow-ups.
2. **Frame timer** — starts on the first ball potted in a frame (any colour), freezes at frame end, resets on the next frame. Displayed on the Frame Summary modal ("Frame time: X:XX") and sent to the backend alongside a Train-mode break submission.
3. **Global best-break leaderboard** — a new public (`AllowAny`) endpoint, `GET /scoreboard/leaderboard/?reds_count=<n>`, reusing the existing `PlayerBestBreak` table (not a new model), ranked by `best_break` desc / `frame_time_seconds` asc (nulls last). A new "Leaderboard" tab in Scoreboard History, split by 6-red/15-red.

**Anti-cheat**: a submitted break's `frame_time_seconds` is checked against a realistic floor (`REALISTIC_SECONDS_PER_POINT = 320/147`, derived from Ronnie O'Sullivan's fastest official 147). A break that's suspiciously fast is **never rejected** — it's saved and still updates the personal best, but flagged `is_verified: false` and shown with a visible "⚠" badge on the leaderboard. This was a deliberate design decision (see spec doc) to avoid punishing genuinely fast players on a false positive.

**Spec**: `docs/superpowers/specs/2026-09-16-session-frame-timers-leaderboard-design.md`
**Plan**: `docs/superpowers/plans/2026-09-16-session-frame-timers-leaderboard.md`

## Root-cause chain of every bug caught during implementation

This feature was built via Subagent-Driven Development (13 tasks, fresh implementer + reviewer per task). Several real bugs were caught and fixed before merge — documented here so they aren't rediscovered:

1. **Inverted anti-cheat formula (Task 2).** The plan's own test data (`test_floor_scales_linearly_with_break_value`) was internally inconsistent with the spec's formula — `assertTrue(is_realistic_frame_time(50, 30))` required a floor ≤ 50s for a 30-break, but the spec's `REALISTIC_SECONDS_PER_POINT * break_value` formula gives ≈65.3s for a 30-break, meaning 50s should have been flagged, not passed. The first implementer "fixed" this by inverting the formula to `break_value / REALISTIC_SECONDS_PER_POINT`, which would have made the anti-cheat floor for a 147 break ≈67.5s instead of the real 320s — a ~4.7x-too-lenient anti-cheat check that would have let a 147 in ~100 seconds pass as realistic, defeating the whole point of the check. **Caught by the controller before it shipped.** Fix: reverted to multiplication, corrected the test's numeric value (50→70) instead of the formula, added `round()` for float-precision boundary safety. **Lesson: if a test and the spec's own formula disagree, trust the spec/real-world reference point, not the test value — verify the formula against the actual reference (Ronnie's 320s/147) before "fixing" it either way.**

2. **Node 20 cannot import `.ts` files from `.mjs` test files (Tasks 5-9).** This repo's test suite runs via plain `node file.mjs`, but Node 20.18.0 has no native TypeScript support. The plan's own test-file sketches (written before this was checked) assumed `import { x } from './hooks/useX.ts'` would work — it doesn't. This repo already has this exact problem documented as **Open Mission #13** in `docs/OPEN_MISSIONS.md`: every existing test file hand-duplicates the pure logic it tests instead of importing the `.ts` source. Every new test file in this feature (`session_timer_test.mjs`, `frame_timer_test.mjs`, the new sections in `stats_test.mjs`/`best_break_test.mjs`, `leaderboard_service_test.mjs`) follows the same inline-duplication convention. **Lesson for a future agent: never write a `.mjs` test that imports a `.ts` file directly in this repo — always inline the pure logic, and verify it stays byte-identical to the shipped `.ts` version (every task reviewer in this session specifically diffed the two copies line-by-line to catch drift).**

3. **Real bug in the plan's own timezone test case (Task 7).** The plan's "exactly midnight boundary" test for `sumDurationForToday` used a hardcoded UTC timestamp string, but the function buckets by *local* calendar day (`toDateString()`), not UTC — so the hardcoded test would give a false result on any positive-UTC-offset machine (confirmed failing on this session's Hebron/UTC+3 machine). Fixed by deriving the boundary from the test's own `Date` object's local getters instead of a hardcoded string, independently hand-verified by the reviewer.

4. **`durationSeconds` gap across 4 save paths (Task 10).** The plan's brief only named one of `game.tsx`'s four `StoredMatch` construction sites (`persistMatch`). The other three — `handleTrainEndSession` (the actual "End Session" button, the primary real-world way a Train session ends), `handleUnlimitedEndMatch`, `handleAbandonMatch` — were missed by the plan. Left unfixed, "time played today" would have been silently wrong for the majority of real sessions. Controller caught this from the implementer's own self-flagged concern, ruled it load-bearing, and had all 4 sites fixed for consistency.

5. **Async test-harness bug (Task 9).** `leaderboard_service_test.mjs`'s `test(name, fn)` helper wasn't itself `async`, so `await test('name', async () => {...})` didn't actually wait for the assertions inside — a failure would have become a silent unhandled promise rejection instead of a real test failure. Caught by the task reviewer, fixed, and verified with a genuine break/revert sanity check (temporarily broke an assertion, confirmed it now surfaces as a real failure, then reverted).

6. **A task's report inaccurately claimed "full 10-file suite" while only running 6 (Task 11).** The reviewer independently ran the 4 missing files itself, confirmed zero regressions, and the finding was parked as a documentation-accuracy issue (not a functional gap) since the diff was independently verified safe. This raised the bar for Task 12's dispatch, which was told explicitly to paste real per-file output — its reviewer independently re-ran all 10 files anyway and confirmed an exact match.

## Files touched

**Backend** (`maxBreak/oneFourSeven/`):
- `models.py` — `PlayerBestBreak` gains `frame_time_seconds` (nullable), `is_verified` (default True)
- `migrations/0027_playerbestbreak_timing_fields.py` — new
- `break_timing.py` — new, `is_realistic_frame_time()` pure function
- `tests_break_timing.py` — new
- `serializers.py` — `PlayerBestBreakSerializer` extended; new `LeaderboardEntrySerializer`
- `views.py` — `best_break_view` POST branch wired to the anti-cheat check; new `leaderboard_view`
- `urls.py` — new `scoreboard/leaderboard/` route
- `tests_best_break.py` — extended; `tests_leaderboard.py` — new

**Frontend** (`FrontMaxBreak/`):
- `hooks/useSessionTimer.ts` — new (`useSessionTimer`, `formatElapsed`)
- `hooks/useFrameTimer.ts` — new (`useFrameTimer`, `computeFrameTimerState`)
- `services/gameStorage.ts` — `StoredMatch.durationSeconds?`, new `sumDurationForToday()`
- `services/bestBreakService.ts` — `submitBreak()` gains optional 3rd param `frameTimeSeconds`
- `services/leaderboardService.ts` — new (`fetchLeaderboard`)
- `app/scoreboard/game.tsx` — both timers wired in; `durationSeconds` recorded on all 4 save paths; `frame_time_seconds` sent on Train-mode break submission
- `app/components/scoreboard/FrameSummary.tsx` — new optional `frameDurationSeconds` prop, displayed
- `app/components/scoreboard/LeaderboardTab.tsx` — new
- `app/scoreboard/history.tsx` — new "Leaderboard" tab
- Test files: `session_timer_test.mjs`, `frame_timer_test.mjs`, `leaderboard_service_test.mjs` (new); `stats_test.mjs`, `best_break_test.mjs` (extended)

## Verified

- **Backend**: 118/119 tests pass across the full `oneFourSeven` suite (dotted-label run); the one failure is the known pre-existing `test_null_date_appears_last` (Open Mission #1/#19), unrelated to this work.
- **Frontend**: all 10 test files green — 328/51/470/121/52/42/899/9/7/3 assertions, 1,982 total, zero regressions to the pre-existing 1039-assertion core suite.
- **Not yet device-verified**: no on-device run has happened yet as of this doc. The user asked for a combined push (backend `git push master` + `eas update --channel preview`) followed by one comprehensive manual pass on the already-installed preview app, deferred until after this doc. See the conversation for that plan — it requires explicit deployment approval, not yet given.

## Follow-ups / explicitly out of scope

- **No dedicated "time played today" UI.** `sumDurationForToday()` exists and is tested, but nothing in the app calls it yet — the session timer only shows live elapsed time for the current session, not a daily total. Add this as a follow-up task if wanted.
- **Per-shot tap-interval anti-cheat** — explicitly deferred in the spec's Non-goals; the single frame-time-vs-floor check covers the real need.
- **Windows-only Django test-discovery bug** (`python manage.py test oneFourSeven` with no dotted label fails with `ModuleNotFoundError`, reproduces on the unmodified main checkout too) — found during Task 4, logged to `docs/OPEN_MISSIONS.md` as a new item, not fixed (pre-existing, unrelated to this feature).
- Minor/deferred findings from code review (FlatList key derivation, a stale file-header comment in `best_break_test.mjs`, freeball_test.mjs's assertion count drifting from CLAUDE.md's documented figure) — logged in the SDD ledger, non-blocking, worth a future cleanup pass.

## Lesson for the next agent touching this area

- Never modify `useSnookerGame.ts`'s reducer to add timer logic — both new timers are deliberately external observers of `GameState`, wired in `game.tsx` only. This was a hard constraint throughout and every task respected it (confirmed absent from every diff's file list).
- If you add a new `StoredMatch` save path anywhere in `game.tsx`, remember there are now (at least) 4 separate construction sites, not 1 — grep for `const stored: StoredMatch` before assuming you've found them all.
- Any new `.mjs` test file touching a `.ts` module in this repo: inline-duplicate the pure logic, never `import` the `.ts` source directly (Open Mission #13).
