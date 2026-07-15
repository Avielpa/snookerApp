# iOS Build Guide

For the iOS developer building MaxBreak from a fresh checkout. Follow this in order.

## 1. Get the code

```bash
git clone https://github.com/Avielpa/snookerApp.git
cd snookerApp
git checkout master
git pull
```

Confirm you're on the latest commit — should include AdMob/ads integration, the scoreboard restyle, and banner placements across the app. Check with:

```bash
git log -1 --oneline
```

## 2. Install dependencies

```bash
cd FrontMaxBreak
npm install
```

## 3. Sanity-check before building

Run the test suite — should print `✅ All N assertions passed` for all 6 files (1360 assertions total):

```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```

Also run a typecheck — should produce no output (clean):

```bash
npx tsc --noEmit
```

If either fails, stop and report back before building — don't build on top of a broken state.

## 4. EAS / Apple account setup

You'll need:
- An Expo account with access to this project (ask Aviel to add you as a collaborator on the `avielpa/MaxBreak` EAS project, or share credentials).
- `eas-cli` installed: `npm install -g eas-cli` (or use `npx eas-cli`), then `eas login`.
- Access to the Apple Developer account this app is registered under (bundle ID `com.avielpahima.maxbreaksnooker`), OR let EAS manage credentials automatically on first build (it'll prompt).

## 5. Build

**Preview build first** (internal testing, install directly via TestFlight-less ad-hoc or simulator):

```bash
npx eas build --profile preview --platform ios
```

**Production build** (App Store — only after preview is verified working):

```bash
npx eas build --profile production --platform ios
```

Both are cloud builds — EAS handles signing, provisioning, and produces a downloadable `.ipa`/build artifact link when done. No local Xcode needed unless you want to test via simulator locally.

## 6. What to actually check once installed

- App loads, live scores/rankings/calendar work
- **Scoreboard**: full match works (Match mode, Train mode), save/resume works
- **Ads**: a banner should appear on most screens (Home, Match, Rankings, Calendar, Stats, Player, Tour, and most Scoreboard screens — deliberately NOT on the live scoring screen's tap area, though there is one above the header there too). An interstitial should appear once on cold app launch, and a separate one the first time you open the Scoreboard tab.
  - **Note**: iOS ads currently use Google's public **test** App ID (`ca-app-pub-3940256099942544~1458002511`), not a real one — no iOS app is registered in AdMob yet. Test ads will show correctly, but won't generate revenue. See `docs/ADMOB.md` for the full picture; registering a real iOS AdMob app is a follow-up step on Aviel's side, not something you need to do.

## 7. After building — OTA updates

Once the app is installed from a build, **JS-only changes don't need a new build** — they ship via:

```bash
npx eas update --channel preview --message "description"     # for preview builds
npx eas update --channel production --message "description"  # for production/App Store builds
```

Only rebuild (`eas build`) again if native config changes (new native dependency, `app.config.js`/`app.json` plugin changes, permissions, icons).

## Reference docs

- `docs/ADMOB.md` — full ads integration reference
- `docs/SCOREBOARD.md` — scoreboard architecture
- `CLAUDE.md` — project-wide conventions and commands
