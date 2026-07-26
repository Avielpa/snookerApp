# Open Missions

Running list of known issues, deferred work, and follow-ups that are NOT currently being worked on but should not be forgotten. Claude must check this file at the start of any bug investigation or feature work to see if it's related to an existing open item, and add new items here whenever work surfaces something out-of-scope that shouldn't be lost.

## Open

### 1. `PlayerMatchHistoryOrderingTest.test_null_date_appears_last` fails on current baseline
- **Found**: 2026-07-09, during test run for the match-favorite/notification ID churn fix.
- **Status**: Pre-existing failure, confirmed to fail identically on the pre-fix baseline (not a regression from that fix). Not fixed, not investigated further.
- **Likely cause**: stale test fixture data drifting against the current season — same class of bug as the season-detection hardcoding pattern found and fixed elsewhere on 2026-07-09 (see `project_season_detection_bug_pattern.md` memory). Needs confirming, not assumed.
- **Next step when picked up**: read the test, check for a hardcoded season/date, compare against `constants.current_season_int()` pattern used in the season-detection fixes.

### 2. `NotifDedup` also keyed by volatile `api_match_id`
- **Found**: 2026-07-09, during investigation of the favorite/notification ID churn bug (`BUG_match_favorite_id_churn_2026-07-09.md`).
- **Status**: Explicitly scoped OUT of that fix. Deliberately left untouched.
- **Impact**: lower severity than the favorites bug — worst case is a duplicate/re-fired notification when a match's `api_match_id` churns and its dedup key no longer matches, not a silently missing one.
- **Next step when picked up**: apply the same stable-PK pattern (`MatchesOfAnEvent.pk`) used for the favorites fix — see `push_notifications.py::get_tokens_for_match_db_id` for the reference pattern.

### 3. Dev-only Postgres tooling installed for testing, not committed
- **Found**: 2026-07-09, while running Postgres-specific JSONField (`__contains`) tests locally for the favorites fix (SQLite can't run them).
- **Status**: `pgserver` + `tzdata` were installed into the local venv to make the test suite runnable, but were NOT added to `requirements.txt` since they're dev-only tooling.
- **Next step when picked up**: decide whether to formalize a local Postgres test setup (e.g. documented in CLAUDE.md) or leave it as an ad hoc one-off — currently anyone re-running these specific tests locally will need to reinstall the same packages themselves.

### 4. `FrameSummary.tsx` "Frame tied — black re-spotted" text can still be inaccurate for a concede-at-equal-scores tie
- **Found**: 2026-07-12, during Phase R (respotted-black-on-tie) of the scoreboard restyle/insights plan (`docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md`, section 7.7).
- **Status**: Explicitly scoped OUT of that fix. Phase R correctly implements the real respot-black rule for the actual "black potted, scores level" case (`useSnookerGame.ts`'s `potBall()` now sets `awaitingRespotChoice` instead of ending the frame, resolved via the new `chooseRespotBreaker()` + `RespotBreakerModal.tsx`). It does not touch the separate, pre-existing path where `concede()` is called while scores happen to be equal — in that case `FrameSummary.tsx`'s `isTied` check still shows "black re-spotted" wording even though no black was potted and no respot occurred. This inaccuracy predates Phase R and was not introduced by it.
- **Impact**: cosmetic/copy-only — a misleading modal label in a rare scenario (concede exactly at a tied score), no scoring or state-machine correctness issue.
- **Next step when picked up**: in `FrameSummary.tsx`, distinguish "tied because of a genuine mid-frame concede" from "tied at colours-phase black" (which can no longer reach this component tied, per Phase R) and adjust the copy accordingly — likely just changing the tied-branch wording to something concede-appropriate, no engine change needed.

### 5. Poppins fonts are referenced everywhere but never actually loaded
- **Found**: 2026-07-26, during the UI/typography overhaul session (`docs/SESSION_2026-07-26_UI_MONETIZATION_OVERHAUL.md`), while investigating what to gate the new splash-screen "wait for fonts" logic on.
- **Status**: Not fixed — out of scope for a font-*size* task. Every style file references `fontFamily: 'PoppinsBold' / 'PoppinsSemiBold' / 'PoppinsMedium' / 'PoppinsRegular'`, but there are no font files anywhere in the repo, no `@expo-google-fonts/*` dependency, no `useFonts` hook, and no `Font.loadAsync` call. `app.json` lists the bare `expo-font` config plugin with no `fonts` array to auto-link. Text is silently falling back to each platform's system default font.
- **Impact**: cosmetic — the app doesn't crash or warn, it just isn't rendering in the intended typeface. Likely invisible unless someone compares against a Figma/design mock expecting real Poppins.
- **Next step when picked up**: source/license the actual Poppins `.ttf` files (or add `@expo-google-fonts/poppins` + `expo-font`), add them via the `expo-font` config plugin's `fonts` array (requires a new native build) or a `useFonts()` hook gated behind the splash screen (see `app/_layout.tsx`'s existing `SplashScreen.preventAutoHideAsync()`/`hideAsync()` gating added in the session above — extend the hide condition to also wait on `useFonts()`'s loaded flag).

## Resolved / closed
(move items here with a one-line resolution note when closed, don't delete history)
