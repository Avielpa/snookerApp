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

### 6. Match-mute toggle is a frontend-only UI shell, not wired to notifications
- **Found**: 2026-07-27, while building the Pinned Matches feature (`docs/SESSION_2026-07-27_PINNED_MATCHES_AND_SPACING.md`).
- **Status**: Explicitly requested as a UI shell only. `services/mutedMatchesService.ts` persists mute state locally (AsyncStorage) but the backend's notification sender (`push_notifications.py::get_tokens_for_match`, called from `auto_live_monitor.py`) has no concept of "muted" and will still notify a device for a match it has favorited/pinned, even if the user muted it in the app.
- **Impact**: user-facing — toggling the bell icon on the match-detail screen currently does nothing functionally; it will look like a bug once someone assumes it works.
- **Next step when picked up**: add a parallel `muted_match_ids` (or similar) field to `DeviceToken`/`UserFavorite`, sync it the same way `favorite_match_ids` is synced, and have `get_tokens_for_match`/`get_tokens_for_match_db_id` exclude devices that muted that specific match.

### 7. `MatchesOfAnEvent.Status` and frontend `status_code` use conflicting conventions
- **Found**: 2026-07-27, while fixing the Match Details screen showing "Finished" for an on-break match (`docs/SESSION_2026-07-27_MATCH_DETAILS_PREMIUM_REFINEMENT.md`).
- **Status**: Explicitly scoped OUT of that fix — worked around on the frontend instead of touching the backend model mid-UI-task. `oneFourSeven/models.py`'s `MatchesOfAnEvent.Status` field has its own `STATUS_CHOICES` (0=Scheduled, 1=Running, 2=Finished, 3=Unknown), and `views.py`'s `matches/<id>/` endpoint serializes both `"status_code": match.Status` (raw int, this model's convention) AND `"status_display": match.get_Status_display()` (human string, same convention) into the API response. But the rest of the frontend (`MatchItem.tsx`, `LiveIndicator`, this screen's own `matchStats`) already interprets `status_code` using a DIFFERENT convention: 0=Scheduled, 1=Live, 2=On Break, 3=Finished. So for a match on break, `status_code` can be `2` (read correctly as "On Break" by most of the frontend) while `status_display` says "Finished" (per the first model's own choices) — not a typo, a genuine cross-model convention mismatch.
- **Impact**: cosmetic-but-confusing — any frontend code trusting the raw `status_display` string can show the wrong word for an on-break match. Fixed for the one place that surfaced it (`app/match/utils/matchStatusLabel.ts` now derives the label from `status_code` using the frontend's own convention instead), but `status_display`/`match.Status`'s underlying meaning is still inconsistent with `status_code` at the source.
- **Next step when picked up**: needs a real backend investigation (bug-fix-expert workflow, not a drive-by) — determine whether `MatchesOfAnEvent.Status` is really a separate field from the `on_break`-producing status logic, whether `auto_live_monitor.py`/sync commands ever actually write `Status=2` for a live-but-on-break match (confirming the mismatch actually manifests, not just a theoretical clash), and whether the fix is renaming/aligning one model's choices, or dropping `status_display` from the API in favor of a single frontend-computed label everywhere.

## Resolved / closed
(move items here with a one-line resolution note when closed, don't delete history)

### Match Details tab-content gap (was open mission #8, "pull-to-refresh removed")
- **Resolved**: 2026-07-27. Original entry logged `RefreshControl`/`SwipeRefreshLayout` as the suspected root cause and removed it as a trade-off. That was a red herring — confirmed by reproducing the bug live in an Android emulator (`adb`/`uiautomator dump`) even with `RefreshControl` fully removed. The real cause: `TabNavigation.tsx`'s horizontal `ScrollView` (`styles.tabContainer`, `height: 40`) was not respecting its own `style.height` on Android — the native `HorizontalScrollView`'s real laid-out bounds measured 682px tall (vs. ~110px of actual visible tab-pill content) via `uiautomator dump`'s ground-truth view hierarchy, silently reserving ~570px of genuinely empty native scroll area that pushed all tab content down by that amount. Fixed by wrapping the `ScrollView` in a plain `<View style={styles.tabContainer}>` (with `overflow:'hidden'` on that style) instead of applying `style` directly to the `ScrollView` — plain `View`s reliably enforce a fixed height on Android where a horizontal `ScrollView`'s own `style.height` did not. `RefreshControl` was restored on all 5 tabs afterward since it was never the cause. See `docs/SESSION_2026-07-27_MATCH_DETAILS_TAB_GAP_FIX.md` for the full investigation, including the earlier failed hypotheses.
