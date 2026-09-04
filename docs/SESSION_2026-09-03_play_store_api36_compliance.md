# Session 2026-09-03: Play Store API 36 compliance + stale test tracks

## Symptom
Google Play Console flagged the app as non-compliant: "App must target Android 16
(API level 36) or higher... you won't be able to release app updates" — enforced
Aug 31, 2026 (already passed as of this session).

## Root cause (not what it looked like at first)
The app's **source config was already fixed** back on Jul 28 (commit `103ae6f5`,
`compileSdkVersion`/`targetSdkVersion` 35→36 in `FrontMaxBreak/app.json`), and
**production build 78** (versionCode 78, uploaded Aug 26) already targets API 36
— confirmed directly in Play Console's App Bundle Explorer ("Target SDK: 36").

The actual problem: Google's target-API requirement applies to **every active,
publicly-available release track**, not just production. Two other tracks were
still serving pre-fix builds:
- **Internal testing**: build 17 (v1.0.0), uploaded **Aug 29, 2025**
- **Open testing**: build 34 (v1.0.0), uploaded **Feb 24, 2026**

Both predate the Jul 28 targetSdk fix, so both still targeted API 35.

## Fix
No new EAS build needed — build 78's AAB already existed in Play Console's
artifact library and already targeted API 36. Published that same bundle to
both stale tracks via Play Console → Testing → \<track\> → Create new release →
Add app bundle from library → select only version 78:
- **Internal testing**: published immediately (no review needed for internal).
- **Open testing**: required Google review (~a few hours here); after approval,
  published from Publishing overview → "Ready to publish" → user clicked publish.

Both tracks now show build 78 (1.1.2, API 36) as of Sep 3, 2026. Production was
untouched throughout — it's been on build 78 since Aug 26 the whole time.

## Important side-finding: build 78 is missing one native fix
While auditing whether build 78 was safe to also push to the testing tracks,
diffed build 78's source commit (`d3662ae1`, **Aug 23**) against `HEAD`. Found
**17 commits landed after build 78 was cut**, only **one** of which is
native-build-relevant:

- `73e81413` (Aug 26, 16:44) — adds `FrontMaxBreak/plugins/withDisablePredictiveBack.js`
  and wires it into `app.config.js`, to fix a scoreboard freeze: Android's
  predictive-back **edge-swipe gesture** (gesture-nav only, Android 13+) dismisses
  the native Foul-dialog Modal at the OS level before RN's `BackHandler`/
  `onRequestClose` ever runs, desyncing JS state and freezing the scoreboard screen.
  - The commit's own JS-only mitigation (`onRequestClose` on scoreboard modals,
    `e738a200`) **was** already shipped via OTA (`eas update`) and is live.
  - The **native** half (disabling predictive-back so BackHandler dispatch stays
    reliable) requires a fresh **native build** — cannot be delivered via OTA.
    Build 78 does not have it.
- All other 16 commits since Aug 23 (Home screen, Today's Matches, foul-scoring
  edge cases, etc.) are pure JS and were confirmed already live on the
  `production` OTA channel via `eas update:list`.

**Verified live on a connected physical device** (Samsung S24, adb id
`RFCX11GB0MK`, running build 78): opened the Foul modal, pressed the Android
system back button, screen stayed fully responsive (confirmed by successfully
potting a ball afterward, not just a static screenshot). No freeze reproduced.

**Caveat that matters for future sessions:** that device is set to **3-button
navigation** (`adb shell settings get secure navigation_mode` → `0`), not
gesture navigation. The predictive-back edge-swipe gesture the native fix
targets simply doesn't exist in 3-button nav mode, so this test — while a
legitimate real-world verification for that device/nav-mode — does **not**
prove the gesture-nav race condition is absent from build 78. It almost
certainly still is, since the plugin genuinely isn't compiled in. Android's
default (and most common) nav mode is gesture nav, so this is a real
residual gap, just not one that reproduced on the specific device tested.

## What still needs doing (not done this session — flagged, not fixed)
- A fresh native build (`eas build --profile preview` → real-device test with
  **gesture navigation enabled** → promote to production) to actually ship the
  `withDisablePredictiveBack` fix everywhere. User deferred this after
  confirming button-nav behavior was fine; not yet scheduled.
- `docs/OPEN_MISSIONS.md` — add this native-build gap there if not already
  tracked, so it isn't silently fixed as a drive-by in an unrelated session.

## Files/state touched
- No source files changed this session — Play Console publishing actions only.
- Verified via: `npx eas build:list`, `npx eas update:list`, `git log`/`git diff`
  against commit `d3662ae1` (build 78's source), Play Console App Bundle Explorer,
  and a live adb-driven device test.

## Lesson for future agents
When a Play Store policy/compliance issue names "the app" as non-compliant,
check **every active track** (production, internal, closed, open testing), not
just production — Play's enforcement isn't production-scoped. A track can be
years stale and still count against you. `Play Console → Test and release →
Latest releases and bundles → All app bundles` shows every uploaded AAB with
its actual Target SDK column — trust that over assuming `app.json` reflects
what's actually been built and shipped.
