# Session 2026-09-14 — "Challenge a friend" share flow

## What this is

A new organic-growth lever, decided in a strategy discussion the same day: rather than more
manual Facebook effort or premature creator outreach (correctly called out by the user as not
worth it at ~100 installs — "which creator will post the app with no revenue"), give existing
users a reason to bring a friend. Costs nothing per user, doesn't depend on any external group
or creator, and is measurable through the exact same UTM pipeline already confirmed working.

## What was built

- **`services/shareService.ts`** (new file) — pure, testable message/link builders:
  - `buildShareLink()` — Play Store URL tagged `utm_source=app&utm_medium=referral&utm_campaign=frame_share`, distinct from every FB/growth-push link so this channel is separately measurable in GA4.
  - `buildBreakShareMessage(breakScore)` — Train-mode message ("I just made a break of 36...").
  - `buildFrameShareMessage(winnerName, scoreline)` — Match/Unlimited-mode message.
  - `shareResult(message)` — wraps React Native's built-in `Share.share()` (no new dependency). Failures/cancels are swallowed — sharing is a bonus on top of a real result, never something that should interrupt the scoreboard flow with an error.
- **`app/components/scoreboard/FrameSummary.tsx`** — added an optional `onShare?: () => void` prop. When provided, a small "Challenge a friend 📤" link appears under the Next/End buttons, in both the Train-mode break card and the Match/Unlimited frame-summary card. Optional prop means every other caller of this component is unaffected.
- **`app/scoreboard/game.tsx`** — wires `onShare` on the existing `FrameSummary` render: Train mode shares the just-finished break score (`snap.scores[0]`); Match/Unlimited mode shares the winner's name and the frame/match scoreline (`displayFW[0]–displayFW[1]`), reusing the same values already computed for that render (no new state).

Trigger point matches the plan exactly: right after a completed break/frame/match — a real
moment the player is already proud of — not a random interrupt.

## Tests

New `share_test.mjs` (155 assertions, follows the repo's existing plain-Node `.mjs` mirror
pattern — same reason as `game_test.mjs`/`train_test.mjs`: these suites can't import
TS/React Native directly, see `docs/OPEN_MISSIONS.md` #13):

- Link shape: correct package id, correct UTM triple present and URL-encoded, deterministic, no raw spaces.
- Break messages: every score 0–147 (including the maximum 147 break) renders correctly; zero-score special-cased to avoid "a break of 0"; negative input doesn't crash.
- Frame messages: 8 name/scoreline combinations including a name with an apostrophe, a non-Latin name, a hyphenated name, and a very long name; whitespace trimming; empty/blank name falls back to "I".
- Message-shape sanity: both builders stay under 500 chars, and both end with the link (so a truncated share-sheet preview still shows the human line first).

Full suite run after the change — **all green, 1,215 total assertions, zero failures**:

```
game_test.mjs        328/328
train_test.mjs        51/51
mega_test.mjs        470/470
freeball_test.mjs    121/121
stats_test.mjs        48/48
offseason_tab_test.mjs 42/42
share_test.mjs        155/155
```

`npx tsc --noEmit` — clean, no errors.

## What was NOT touched

No scoring/game-state logic changed — `useSnookerGame.ts` is untouched. No existing prop
became required. No new native dependency (RN's `Share` module is part of core RN, no native
build needed — this ships as a pure JS/OTA change).

## Verified and shipped

- Published to **preview** (`f47d97ff...`), device-tested live on the S24 (Android): Train
  mode and Match mode both confirmed — the native Share sheet opened with the exact expected
  text each time, real share targets shown (WhatsApp, Facebook, contacts).
- **Bug found and fixed same session**: first version only included the Play Store link — the
  user caught it ("why the link is only provide google link and not apple as well"), same
  class of gap as the FB-posts iOS-link miss earlier in the day. Fixed by adding
  `buildAppStoreLink()`/`buildStoreLinksBlock()` to `shareService.ts`; tests grew from 155 to
  186 assertions to cover both links. Republished to preview
  (`5b2940e8-fcca-4d6d-997d-9ef4d96068bd`) and **re-verified on-device**: opened a real
  WhatsApp chat draft (never sent) and read the full un-truncated message, confirming both the
  tagged Play Store link and `https://apps.apple.com/app/id6762826909` are present — WhatsApp
  even auto-rendered a live link-preview card for the Apple link, confirming it resolves.
  Draft was fully cleared and the chat closed without sending anything to the real contact.
- **Shipped to production**: `29e14eb0-9bf0-4be4-b68e-cf2b74d7ff5a`, both platforms, same day.
- **iOS itself remains untested** — no iPhone/simulator was available this session. The code
  path is React Native's own cross-platform `Share.share()` (no iOS-specific branching), and
  the update published to both platforms, but nobody has watched it actually open on iOS.

## Next session

- If an iPhone becomes available, confirm the share sheet opens correctly there too.
- The `frame_share` UTM campaign is now live — becomes a new row to watch in
  `docs/GROWTH_ANALYTICS_LOG.md`'s acquisition checks, first real signal on whether this
  channel converts at all.
- The share-link tap target is small/easy to miss (fat-fingered twice during testing,
  hit a background ad banner once) — not a functional bug, but worth a bit more padding
  if it comes up again.
- If this channel proves out, consider a second share point (e.g. a "share your season"
  summary) — but only after this one has real data, not speculatively.
