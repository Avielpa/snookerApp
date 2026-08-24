# Session 2026-08-24: PR #1 review — foul-scoring, respot-choice guard bug, local Android build recovery

## Summary

PR #1 ("Fix foul scoring when a ball is potted alongside a cue-ball in-off",
branch `fix/foul-cue-ball-in-off-scoring`) went through the full
`/engineering-workflow` pipeline: conflict check → 5-agent + confidence-scored
code review → a real correctness bug found and fixed → full test suite →
real on-device (emulator) verification via a freshly-built local dev client.

## Conflict check

Clean. `mergeStateStatus: CLEAN`, `mergeable: MERGEABLE`, and `master` was a
full git ancestor of the PR branch already (branch included the latest
master tip, no rebase needed).

## Code review (5 parallel Sonnet agents + Haiku confidence scoring)

Findings and scores (rubric: 0 = false positive, 100 = certain/frequent):

| Finding | Score | Outcome |
|---|---|---|
| Only 53 new tests added; CLAUDE.md requires 100+ for a new feature | 100 | Posted to PR as GitHub comment |
| `FoulModal` has no ScrollView/maxHeight — new picker can push Confirm/Cancel off-screen on short viewports (same bug class already fixed once for the main game screen, commits `62fb5062`/`04ee1abb`) | 80 | Posted to PR as GitHub comment (not yet fixed — flagging only) |
| `frameHighestBreak` not reset by `convertLastPotToFoul` | 0 | Filtered — matches pre-existing `undo()` behavior, not a regression |
| Colour picker shown but inert during the `respottedBlackActive` shootout (asks a pointless question) | 65 | Filtered — cosmetic, below 80 threshold |
| **`convertLastPotToFoul` checks the wrong state snapshot for the `awaitingRespotChoice` guard** — found independently by 2 review agents (git-blame-history + code-comments agents), confidence-scored 75 | 75 | **Below the strict auto-comment threshold but fixed anyway** — real reachable correctness bug, not noise |

PR comment posted: https://github.com/Avielpa/snookerApp/pull/1#issuecomment-5392993214

## The bug that got fixed: wrong-snapshot guard in `convertLastPotToFoul`

**Root cause.** Every mutator in `useSnookerGame.ts` (`potBall`, `endVisit`,
`applyFoul`, `addExtraRed`, `concede`, `declareFreesBall`, `applyFreeBall`)
guards against acting while the game is waiting on a tied-final-black respot
decision by checking the **live** snapshot: `if (prev.current.awaitingRespotChoice) return prev;`.
The PR's new `convertLastPotToFoul` instead checked `preShot.awaitingRespotChoice`
— the snapshot from *before* the shot being converted, not the current one.
The new "⚠ This was a foul" button in `game.tsx` also had no gate of its own.

**Verified against real snooker rules before fixing** (source:
[rulesofsport.com](https://www.rulesofsport.com/sports/snooker.html),
[Snooker Island forum](https://www.snookerisland.com/forum/viewtopic.php?f=468&t=6861)):
when a pot/foul on the final black leaves scores level, the black is
respotted and **no other action is legal** until the players choose who
breaks off — "the next score or foul ends the frame." The app's existing
`respottedBlackActive` handling (forfeit-on-any-foul) was already correct;
the fix just makes `convertLastPotToFoul` respect the same
already-established, rules-grounded invariant every other function respects.

**Reachable path (pre-fix):** pot the final black to a tied score →
`awaitingRespotChoice` flips true on the live snapshot → the convert button
is still visible/tappable (no gate) → tap it → guard checks the stale
`preShot` snapshot (still false) → falls through instead of being blocked,
producing an out-of-turn state mutation.

**Fix** (3 files, on `fix/foul-cue-ball-in-off-scoring`, commit `f665a97a`):
1. `FrontMaxBreak/hooks/useSnookerGame.ts` — `convertLastPotToFoul` guard
   changed to `prev.current.awaitingRespotChoice`, matching the other 7
   mutators.
2. `FrontMaxBreak/app/scoreboard/game.tsx` — the convert button is now also
   hidden while `snap.awaitingRespotChoice` is true.
3. `FrontMaxBreak/foulconvert_test.mjs` — new test 48 drives the **real**
   `potBall` sequence (pot final black to a genuine tie) instead of
   hand-splicing state, to reproduce the actual reachable bug path; the
   file's own mirrored `convertLastPotToFoul` was updated to match.

## Verification

- `node foulconvert_test.mjs` — **55/55** assertions pass (was 53; +2 new for
  test 48), including the new regression test proving the fix.
- All 6 pre-existing suites — **1060/1060** assertions pass, zero
  regressions (`game_test.mjs` 328, `train_test.mjs` 51, `mega_test.mjs` 470,
  `freeball_test.mjs` 121, `stats_test.mjs` 48, `offseason_tab_test.mjs` 42).
- `npx tsc --noEmit` — clean.
- Pushed to the PR branch: `70a31b06..f665a97a`.

## Real on-device (emulator) verification — infra recovery notes for next time

The user asked to verify via emulator. This required real problem-solving,
documented here so it isn't rediscovered from scratch:

1. **Both installed APKs on the emulator (preview v34, production v76)
   crashed identically** with `ReferenceError: Property 'WeakRef' doesn't
   exist` on launch — this is the **pre-existing, already-documented**
   `runtimeVersion`-mismatch bug (see memory:
   `project_2026-07-21_stats_crash_and_ios_ads_fix.md`) — an **old native
   binary** receiving **newer JS** (OTA or local) that uses a JS feature
   (`WeakRef`) the binary's bundled engine predates. **Not a PR #1
   regression** — reproduced identically on unmodified production.
2. User asked to uninstall both and build fresh locally to rule out stale
   install state. Built via `npx expo run:android` (local Gradle, no
   EAS/Play Console).
3. **Windows path-length limit broke the native CMake/ninja build**
   (`ninja: error: manifest 'build.ninja' still dirty after 100 tries`) when
   building from the git worktree at
   `.claude/worktrees/pr1-foul-fix/FrontMaxBreak/...` — CMake explicitly
   warned object file paths were 205–209 chars, too close to Windows' 250-char
   safe limit for the deeply-nested worktree path. **Fix: create the
   worktree at a short path** (`C:\wt\pr1` instead of nested under
   `.claude/worktrees/`) — the identical build then compiled natively
   without any ninja errors. **Lesson for future native Android builds on
   Windows from a worktree: always use a short worktree path, not the
   default `.claude/worktrees/<name>` nesting.**
4. `local.properties`' `sdk.dir` needed **forward slashes**, not backslashes
   — a Windows-style path with single backslashes gets corrupted because
   Java `.properties` files treat backslash as an escape character.
5. A transient `:app:packageDebug` failure (`IncrementalSplitterRunnable`,
   no further detail) was a one-off Windows file-lock flake — an immediate
   retry succeeded in 25s (mostly cache-hit).
6. Once installed, connecting the dev-client to the local Metro server
   required the manual-URL path (`http://10.0.2.2:8081`, not
   `10.0.0.25:8081` which was the emulator's own LAN-facing IP and
   unreachable from the host's Metro).
7. **Screenshots (`adb exec-out screencap`) were unreliable/blank on this
   sandboxed emulator throughout** (confirms
   `feedback_use_uiautomator_for_native_layout_bugs` memory) — including a
   case where a system permission dialog was fully present and
   touch-intercepting but **completely invisible in the screenshot**. Used
   `adb shell uiautomator dump` + `adb pull` + text/bounds grep for all
   real interaction and verification instead; this was reliable throughout.

**Live verification result:** fresh debug build, no WeakRef crash, real
production data loading. Played a red, tapped the PR's new "⚠ This was a
foul" convert button, confirmed the FoulModal's convert mode renders
correctly, confirmed the score/turn/points-on-table all update correctly
after conversion (score reversed 1→0, opponent +4, red stayed off table,
turn passed correctly, points-on-table recalculated correctly). Did not
attempt to manually reproduce the exact tied-final-black edge case via UI
taps (would need ~30+ more shots to engineer a genuine tie) — that exact
path is already covered by the new automated regression test (48).

## What still needs to happen

- Push to preview channel (`eas update --channel preview`) — **not done yet,
  needs explicit user approval per CLAUDE.md**.
- The FoulModal missing-scroll-guard finding (confidence 80, posted to PR)
  was **not fixed this session** — flagged only, out of scope for this pass.
- PR #1 itself still needs a merge decision from the user.
