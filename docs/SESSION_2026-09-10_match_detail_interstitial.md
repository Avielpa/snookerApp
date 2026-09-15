# Session 2026-09-10 — Match Detail interstitial trigger (revenue lever)

## Symptom / motivation

Ad revenue avg ~$0.02/day. Investigation (see `docs/GROWTH_ANALYTICS_LOG.md`
2026-09-09 addendum) found the blended eCPM was only ~13% of AdMob's own
peer-benchmark average (₪0.86 vs ₪6.68 for similar Action-games Android apps).
Root cause traced via AdMob's eCPM Trends + Ads Activity reports broken out by
format:

- Banner eCPM: ours ₪0.55 vs peer ₪0.85 — mildly behind, not the problem.
- Interstitial eCPM: ours ₪8.94 (Android ₪6.68 / iOS ₪24.39) vs peer ₪8.17 —
  **at or above peer**, pricing is fine.
- The blend is dragged down by volume mix: of 1,038 ad requests in the
  checked week, only 19 (2%) were interstitial vs 1,019 (98%) banner.
  Interstitial earned 37% of the week's revenue from that 2% share.

Not a "market squeeze" or pricing problem — a volume problem. The fix is more
interstitial *opportunities*, not touching banner or existing triggers.

## What was done

Added one new interstitial trigger, reusing the existing generic factory
(`createOnceInterstitialHook` in `services/adsService.ts`) with zero changes
to the two existing triggers (scoreboard frame-complete, Media tab entry):

1. `services/adsService.ts` — new export:
   ```ts
   export const useMatchDetailInterstitial = createOnceInterstitialHook('match-detail');
   ```
2. `app/match/MatchEnhanced.tsx` — one hook call, gated on data actually being
   loaded (not raw screen mount):
   ```ts
   useMatchDetailInterstitial(!loading && !!matchDetails);
   ```
   This reuses the hook's existing 5s post-trigger delay, so the earliest the
   ad can appear is 5s after real match content is on screen — same "let the
   user see value first" pattern already used for scoreboard/Media tab.

Fires at most once per app session (independent label from the other two
triggers — a user could see up to 3 interstitials total in one very long
session, one per trigger, but no more than one of *this* trigger).

## Why Match Detail (not Home or Tour/Calendar)

Discussed 3 options with the user (Match Detail / Home / Tour detail). Home
is the highest-traffic screen but also the very first thing every user sees
each launch — higher perceived-intrusiveness risk even with a delay. Match
Detail is high-traffic (second only to Home) and a genuine deep-engagement
screen (scores/stats/H2H), so a 5s-gated ad there is far less likely to read
as "the app ambushed me the moment I opened it." User deferred to this
judgment explicitly ("do whatever you think will be best and won't trigger
users to leave the app").

## Files touched

- `FrontMaxBreak/services/adsService.ts` — 1 new export line + comment.
- `FrontMaxBreak/app/match/MatchEnhanced.tsx` — 1 import + 1 hook call.
- `FrontMaxBreak/ads_match_detail_trigger_test.mjs` — new test file, 5
  assertions covering the new gating expression only (the hook's own latch/
  session-cap logic was already covered generically, label-independent, by
  `ads_interstitial_latch_test.mjs` and `ads_cooldown_test.mjs` — not
  re-tested here).

## Verified

- `node ads_match_detail_trigger_test.mjs` — 5/5 passed.
- `node ads_interstitial_latch_test.mjs` — 27/27 passed (unchanged, confirms
  no regression to the shared factory).
- Full existing suite (`game_test.mjs`, `train_test.mjs`, `mega_test.mjs`,
  `freeball_test.mjs`, `stats_test.mjs`, `offseason_tab_test.mjs`) — all
  passed, 0 failures (1039 assertions, none touched by this change).
- `npx tsc --noEmit` — clean, no errors.
- `git status` diff confirmed isolated to the 3 files above — nothing else
  in the working tree was touched by this change.

## Deployment (completed 2026-09-10)

- Published to `preview` channel (`eas update --channel preview`), update
  group `3623ccee-cf68-4973-b5fe-5c10dd65dae5`.
- User tested on the real device (S24 preview APK) and confirmed it looked
  right — approved promotion.
- Published to `production` channel, update group
  `78c4b03b-5f86-4c26-a9dd-c52bad6c879a`. Runtime version `2.0.0` on both —
  delivered OTA to existing installs, no new native build needed.
- Committed (`0ef29c00`, master) and pushed to `origin/master`. Note: any
  push to master also triggers a Railway backend redeploy per the Procfile
  even though nothing backend-side changed in this commit — expected no-op
  deploy, not a separate action taken.

## Lesson for next agent

The generic `createOnceInterstitialHook(label)` factory in `adsService.ts` is
the right place to add any future interstitial trigger — it's fully
label-independent (confirmed by the existing latch test being written
generically, not tied to any specific label string) so a new trigger is
always a 1-line export + 1-line call in the target screen, gated on a real
"user has seen value" boolean, never on raw mount. Don't duplicate the
timer/load/show logic inline again like `useMediaTabInterstitial` does for
its cooldown wrapper — if a future trigger needs a persisted cross-session
cooldown (not just a session cap), consider extracting that cooldown wrapper
into its own small reusable helper instead of copy-pasting it a third time.
