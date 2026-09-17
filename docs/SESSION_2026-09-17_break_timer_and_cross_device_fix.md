# Session 2026-09-17: Frame/break timer fixes, break-timer capture feature, cross-device match leak fix

## Summary

User opened this session with 4 items. All 4 are now shipped to production:

1. **Frame timer never displayed live** — fixed.
2. **Break timer feature** (Match/Unlimited mode) — built end-to-end, including a leaderboard extension.
3. **Global leaderboard missing Match-mode breaks** ("Yuval's higher breaks don't show") — root-caused as deliberate Train-mode-only scoping from a 2026-09-14 fix, closed by item 2's leaderboard extension.
4. **Cross-device account match leak** — investigated, confirmed real, fixed.

Plus, along the way: registered `PlayerBestBreak`/`BreakTimingRecord` in Django admin for manual leaderboard management, and caught+fixed a process gap where an earlier fix had only ever been deployed via OTA, never committed to git.

## Item 1: Frame/break timer never rendered live

**Symptom**: user reported "no timer when frame started" — the session timer (header) worked, but there was no live per-frame timer anywhere on screen, in any mode.

**Root cause chain**: `useFrameTimer`'s calculation (`frameElapsedSeconds`) was always correct, but had only two consumers in `game.tsx`: (a) silent submission to the backend in Train mode only, and (b) the `FrameSummary` post-frame modal, which only rendered it in the Train-mode branch. No code path anywhere rendered it live during play, in any mode. This was a scope gap from the original 2026-09-16 feature build, not a regression.

**Fix**: `FrontMaxBreak/app/scoreboard/game.tsx` — added a live "Session X:XX · Frame X:XX" line to the header for all modes. `FrontMaxBreak/app/components/scoreboard/FrameSummary.tsx` — added the same "Frame time: X:XX" line to the Match/Unlimited branch (previously Train-only). `FrontMaxBreak/hooks/useFrameTimer.ts` — converted from a `useRef`-mutated-in-effect pattern to `useState`, fixing a stale-read fragility that became load-bearing once the value was rendered live (same class of bug independently avoided in the new `useBreakTimer.ts` by using `useState` from the start).

**Verified**: on-device S24, live ticking confirmed via screenshot sequence (0:00→0:13→0:30...).

**⚠️ Process note for future sessions**: this fix was tested and approved via `eas update --channel preview` (which reads the working directory, not git) but was left **uncommitted** for the rest of the session — deployed to preview without ever being in git history. Only caught and fixed when merging a later branch produced a conflict against master's dirty working tree. **Always commit a fix immediately after device approval, before moving to the next task** — don't let "already deployed to preview" substitute for "committed."

Commit: `25f1bd3d` (committed retroactively, mid-session, when the gap was caught).

## Item 2: Break-timer capture (Match/Unlimited mode)

Full spec: `docs/superpowers/specs/2026-09-17-break-timer-capture-design.md`. Full plan: `docs/superpowers/plans/2026-09-17-break-timer-capture.md`. Built via `subagent-driven-development` (8 tasks, each independently reviewed) + a final whole-branch review.

**What it does**: a live per-break timer in the `Break N` badge (Match/Unlimited only), a "who are you?" player-attribution picker at setup (required, no silent default), a new `BreakTimingRecord` backend model/endpoint for personal analytics (feeds a future Profile tab, not yet built), and — the key piece — extends the **existing, unmodified** `PlayerBestBreak`/`submitBreak` leaderboard infrastructure to Match/Unlimited mode for the "me" player only.

**The final whole-branch review caught two real bugs invisible task-by-task**:
- **Critical**: `mePlayerIndex` silently defaulted to slot 0 with no confirmation, and a legacy pre-feature `sb_draft` resume had no `mePlayerIndex` at all — both collapsed to slot 0, reopening the exact 2026-09-14 misattribution bug class, now against the *public* leaderboard. Fixed: no default selection, Start blocked until an explicit choice, unset/legacy treated as "never submit."
- **Important**: `useBreakTimer` had no frame-boundary reset (unlike sibling `useFrameTimer`) — when the same player breaks first in a new frame (~half of all frame transitions, since the reducer alternates by frame-number parity, not by who was on strike), the badge showed the previous frame's stale frozen time and the submitted duration was inflated. Fixed: added `frameNumber` to `BreakTimerInput`, mirrored `useFrameTimer`'s reset-on-change pattern.

**Deliberately parked, not fixed** (user's explicit call): submitting a single break's duration into `PlayerBestBreak.frame_time_seconds` — the same field Train mode uses for a whole-frame duration — could bias leaderboard tiebreak ordering and anti-cheat flagging between modes, and could theoretically retroactively affect an existing account's `is_verified` flag on a tied value. **User decision: ship as-is, revisit only if it's observed to actually matter.** Logged as Open Mission below so it isn't silently forgotten.

**Verified end-to-end on S24 against production** (not just simulated):
- Built a real 33-break as Player 1 ("me") → confirmed via `curl` against the live leaderboard API that the public record jumped 24→33 with a correct timestamp, correct duration, and no false anti-cheat flag.
- Built a real 41-break as Player 2 (not "me") → confirmed the public leaderboard **stayed at 33** and confirmed via `logcat` that zero network call was even attempted for that break (vs. one logged attempt — a 404, since the personal-analytics endpoint wasn't deployed yet at that point in the session — for Player 1's break).

**Not device-tested this session**: guest/logged-out path, Unlimited mode specifically (Match mode only was tested), resume-from-legacy-draft, Train-mode regression. Logged as Open Mission below.

Test suite: 17 new frontend pure-function tests (`break_timer_test.mjs`), 12 new backend tests (`tests_break_timing_record.py`), full 13-suite/2,023-assertion regression clean throughout.

PR: [github.com/Avielpa/snookerApp#4](https://github.com/Avielpa/snookerApp/pull/4), merged. Commits: `900612b1`..`fb34259f` (see PR for full list), merge commit `3e1b48af`.

## Item 3: Leaderboard missing Match-mode breaks

Not a bug — `game.tsx`'s comment at the submission site explicitly documents the Train-mode-only restriction as a deliberate 2026-09-14 fix (a local pass-and-play opponent's break could otherwise get misattributed to the logged-in account). Closed by item 2's leaderboard extension, which reuses the exact same `PlayerBestBreak` upsert-if-higher/one-row-per-user infrastructure — confirmed this means a 60-break in Match mode correctly beats an existing 58-break regardless of which mode either was set in, with no duplicate rows.

## Item 4: Cross-device account match leak

**Symptom (user report)**: "if user logs into their account from another device, his matches are saved on the other device alongside the owner's sessions."

**Root cause chain**: `FrontMaxBreak/services/gameStorage.ts` stores completed matches under device-global, account-agnostic AsyncStorage keys (`sb_match_<id>`). `authService.logout()` only ever cleared JWT tokens — never local match data (there was already an unused `clearAllMatches()` function, written but never wired into any call site). `AuthContext`'s `_postLoginSync()` fires automatically and unconditionally on every login, calling `syncOnLogin()` → `syncAllLocal()` → uploads **every** match currently in local storage, with no filter for who created it, under the freshly-logged-in account's auth header. So on a shared/reused device: Account A logs out (tokens cleared, but local matches survive) → Account B logs in → Account B's cloud history silently inherits Account A's old matches.

This is the mirror image of a bug already partially fixed 2026-09-14 (guest→account leak, same-device, same-session) — that fix closed one direction; this closes the other (previous-account's-leftover-data→next-account, across a logout/login boundary).

**Fix**: `FrontMaxBreak/services/gameStorage.ts` — new `clearAllMatchesAndDraft()` (wraps existing `clearAllMatches()` + `clearDraft()`). `FrontMaxBreak/contexts/AuthContext.tsx`'s `doLogout()` — now does a best-effort final `syncAllLocal()` (while still authenticated, so nothing un-synced is destroyed), then `logout()`, then `clearAllMatchesAndDraft()`. Only runs on logout/account-deletion (the delete-account flow already calls `doLogout()`), never on login — a naive clear-on-login would destroy a legitimate re-login's own just-downloaded history.

**Scope, per user's explicit decision**: clear-on-logout only (no additional per-account namespacing of the storage keys — simpler, directly fixes the report). No audit of already-contaminated production `ScoreboardMatch` rows (theoretical risk given the app's small user base; fix stops future contamination, doesn't retroactively clean).

**Verified on-device (S24)**: confirmed 4 real rivalries existed pre-logout (including live test data from this session), logged out, confirmed the account icon changed to logged-out state, then — after navigating away and back to force a fresh AsyncStorage read (the first read was stale, from the still-mounted screen) — confirmed History genuinely showed "No matches yet." **Not verified**: the re-login/download-restore path, since that requires typing a password, which is never done regardless of whether the agent knows it. That path was not touched by this fix (only `doLogout` changed) and is low risk, but should get one real manual login+check.

Commit: `118fedc9`, pushed directly to `master` (no branch/PR — small, isolated, frontend-only fix). Frontend-only, no backend/migration involved.

## Django admin for leaderboard management

User asked to be able to manually edit/reset the global best-break leaderboard via Django admin (after test data from this session's device testing overwrote their real 24-break record with a test 33-break). Registered `PlayerBestBreak` (editable `best_break`/`is_verified`, bulk-delete action) and `BreakTimingRecord` in `maxBreak/oneFourSeven/admin.py`. Shipped as part of the break-timer-capture PR. **The user still needs to actually log into `https://snookerapp.up.railway.app/admin/` themselves and do the reset** — an automated Chrome tab used mid-session wasn't authenticated to their Django admin session, so the agent could not do this for them.

## Deployment record

- Backend: pushed to `master` twice this session (`3e1b48af` merge commit, `f2b88f5c` after resolving the frame-timer commit gap) — both confirmed `SUCCESS` on Railway via the MCP tool, smoke-tested via `curl` (leaderboard endpoint, and the new break-timing endpoint returning 401-not-404 confirming it's live).
- Frontend: `eas update --channel production` run 3 times this session (break-timer-capture + frame-timer fix bundle, then separately the cross-device-leak fix). All confirmed published via the EAS CLI's own success output.

## Open items for next session (also added to docs/OPEN_MISSIONS.md)

1. Break-timer capture's Task 9 device checklist is only partially complete — guest/logged-out path, Unlimited mode specifically, resume-from-legacy-draft, and full Train-mode regression were never device-tested this session (Match mode was, thoroughly).
2. I2 (leaderboard timing-field semantics between Train/Match modes) — shipped as-is per explicit user decision; revisit only if it's observed to actually cause a real tiebreak-fairness or false-anti-cheat-flag complaint.
3. Cross-device fix's re-login/download-restore path (the "existing account logs back in, history comes back from cloud" case) was not device-verified this session — needs one manual pass with real credentials.
4. Django admin leaderboard reset the user originally asked for is still not done — they need to log into `/admin/` themselves now that the UI exists.
