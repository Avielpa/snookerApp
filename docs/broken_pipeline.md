# Broken Pipeline Investigation — 2026-07-28

Full record of a multi-hour investigation into why Android production builds break (wrong app name + OTA updates never applying), while preview builds and iOS production have never had the problem. Session used a `bug-fix-expert`-style deep investigation, 6 parallel research subagents, a live wireless-ADB connection to the reporter's real device, and byte-level forensic analysis of multiple `.aab`/`.apk` artifacts.

**Status at end of session: two real bugs found and fixed (prebuild contamination, target API level). The OTA-never-applies-on-Android-production symptom is still unresolved. The app-name investigation surfaced a real, confirmed finding (see "App name — closed direction" below) but the reporter has closed that direction as not the relevant explanation; kept here for the record, not being actively pursued.**

---

## Symptom (as originally reported)

- Every EAS Build production (AAB) build, since version 67, logs a prebuild warning: "Detected existing invalid native directory."
- The installed app (from Google Play) shows the app's name as "snooker.org vr1" — a name it had many months ago, not the current "Snooker MaxBreak."
- OTA updates (`eas update --channel production`) never apply to the Android production build, even after full app relaunches, even though the exact same publish applies fine on: the Android **preview** channel (sideloaded internal APK), and a friend's **iOS** production install.
- Builds 65 and earlier (and all preview/APK builds throughout) never showed any of this. It started at build 67.

---

## CONFIRMED FIX #1 — EAS Build prebuild directory reuse

**Root cause:** A stale `android/` directory (and a stale `.expo/` cache dir) had been sitting on the **local development machine's disk** since around April 2026 — gitignored, so invisible to `git status`, but **`eas build`/`eas update` archive and upload the local project directory as-is** (they do not git-clone on the remote builder — confirmed the hard way, see "Dead end" below). Every single `eas build` call from this machine, for every profile, silently included that stale directory in its upload.

EAS Build's `PREBUILD` phase, finding a pre-existing `/android`, logged `Created native directory | reusing /android` instead of a clean create, and (per Expo's own docs) ran `expo prebuild` **without `--clean`**, which "layers changes on top of existing files... some config plugins aren't idempotent." The plugins added right in the build-65→67 window (`react-native-google-mobile-ads`, `@react-native-firebase/app`, `@react-native-firebase/analytics` — AdMob/Firebase integration) are exactly the kind of plugin that misbehaves when layered onto stale output instead of a clean generation. This lines up exactly with why the bug started at build 67 and not earlier.

**Evidence:**
- Build 65 (last good) log: `✔ Created native directory` — clean.
- Build 67 onward: `✔ Created native directory | reusing /android` — every single build since, preview and production alike.
- `ls -la` on the local `FrontMaxBreak/` directory found a real `android/` folder (dated ~Apr 23) and a stale `.expo/` cache (dated Sept 2025), neither tracked by git.
- Upload size dropped from 27.3 MB → 26.0 MB immediately after deleting those two directories, confirming they were genuinely being archived and uploaded before.

**Dead end worth recording:** first attempted fix was an `eas-build-pre-install.sh` hook running `git clean -fdx`. This **catastrophically deleted the entire project** (`package.json`, `app.json`, `app/`, everything) on the very next build, because EAS's remote workingdir has **no `.git` directory at all** (it's a tarball upload, not a git clone) — `git clean` with no repo to compare against treats every file as untracked. Build failed immediately in `READ_EAS_JSON`. Reverted to an explicit `rm -rf android ios .expo`.

**Fix (3 commits, `FrontMaxBreak/`):**
1. `8359fb2d` — added `eas-build-pre-install.sh` doing `rm -rf android ios` (this alone had a bug: EAS doesn't auto-detect hook scripts by filename).
2. `6c662887` — registered the hook properly via `package.json`'s `"eas-build-pre-install"` script key (per Expo's build-hooks docs, hooks are **only** ever invoked because `package.json` points to them — dropping a file at the project root does nothing).
3. `e8382620` — reverted the `git clean -fdx` attempt back to explicit `rm -rf android ios .expo` after it destroyed a build.
4. Locally: deleted the actual stale `android/` and `.expo/` directories from disk (the real fix — the hook is a remote-side backstop for other build paths, not the fix itself for the CLI-triggered path).

**Verified fixed:** builds 74, 75, 76 all show clean `PREBUILD` (`Created native directory`, no `reusing`), matching build 65's signature exactly. Confirmed both via raw EAS build logs and by downloading/inspecting each build's actual compiled `.aab` (see byte-level verification method below).

---

## CONFIRMED FIX #2 — Target API level 36

Google Play requires app **updates** to target API level 36 (Android 16) by 2026-08-31 (extension to 2026-11-01 available). Bumped `compileSdkVersion`/`targetSdkVersion` from 35→36 and added explicit `buildToolsVersion: "36.0.0"` in `app.json`'s `expo-build-properties` plugin block (commit `103ae6f5`). `minSdkVersion` deliberately left untouched — separate, unrelated setting; user explicitly declined raising it (would drop support for devices on Android 13 and below).

Community discussion (Expo GitHub) suggested API 36 support wasn't officially validated until SDK 54 (this app is on SDK 53) — tested via a preview build first specifically to catch this risk. **Confirmed working**: both preview (versionCode 35) and production (versionCode 75) compiled and ran successfully against API 36 on SDK 53.

---

## Byte-level verification method (used repeatedly this session)

Standard procedure developed to check what's *actually* in a built artifact, rather than trusting build logs alone:
1. `npx eas build:list --json` → get the build's `logFiles` URL and `applicationArchiveUrl` (.aab download link).
2. `curl -s --compressed <logUrl>` — **must** use `--compressed`, the raw response is gzip and a plain `curl -o` saves garbage bytes.
3. `unzip <build>.aab base/resources.pb base/manifest/AndroidManifest.xml` — both are compiled protobuf, but literal UTF-8 strings (resource names/values, URLs) are still findable via plain byte/regex search.
4. For an authoritative (not manual-parsing) check: `bundletool build-apks --bundle=X.aab --output=X.apks --mode=universal`, extract `universal.apk`, then `aapt2 dump badging` — this is Google's own tool resolving the real `application-label` the way Android/Play would.
5. For the most rigorous check: install the universal APK on an emulator/device (`adb install`) and read the **live launcher's** rendering via `adb shell uiautomator dump` → look for `content-desc="Predicted app: <name>"` in the XML — this is literally what Android itself renders, not any static analysis.

Checked this way across builds 71, 72, 74, 75, 76: every one's **base/default** resources are clean (`app_name` = "Snooker MaxBreak", correct `u.expo.dev` update URL, no "vr1"/"snooker.org" anywhere in the base module).

---

## App name — closed direction (reporter has ruled this out, not being pursued further)

Late in the session, the reporter provided live wireless-ADB access to their real device (Samsung SM-S921B, Android 16/API 36). Paired via `adb pair <ip:port> <code>`, connected automatically via mDNS.

**On-device findings:**
- `dumpsys package com.avielpahima.maxbreaksnooker`: `versionCode=76 minSdk=24 targetSdk=36`, `versionName=1.1.2`, install time same-day, `signatures=...past signatures:[]` (no legacy-key history on this specific install).
- Pulled the actual installed split APKs directly off the device: `base.apk`, `split_config.arm64_v8a.apk`, `split_config.iw.apk` (Hebrew locale split), `split_config.xxhdpi.apk`.
- `aapt2 dump badging` on the real installed `base.apk`: `application-label:'Snooker MaxBreak'` — clean, confirming the base/default resources genuinely are correct on the real device too.
- `aapt2 dump resources` on the real installed **Hebrew (`iw`) locale split**:
  ```
  resource 0x7f11001d string/app_name
    (iw) "snooker.org vr1"
  ```
  A stale, Hebrew-only translated override of `app_name`, never updated when the English/default name was changed, sitting in a resource split completely separate from everything checked earlier in the session (which only ever looked at the base/default module).

**Exact source not pinpointed before this direction was closed.** Searched the current repo and `node_modules` for the literal string "snooker.org vr1" and for any `values-iw`/`values-he` resource directories — no hit in current tracked files. One git-history lead (`git log --all --diff-filter=A -- "**/values-iw/*"` → commit `5ad4785a`, 2025-08-12, the very first "deploy" commit of the whole project) turned out to be React Native's own internal framework strings (`devsupport/values-iw/strings.xml`, `views/uimanager/values-iw/strings.xml` — RN's dev-menu strings), unrelated to the app's own `app_name`.

**Reporter's position:** closed this direction — states they didn't change their device's language/locale, doesn't consider it the relevant explanation. Documented here as a real, on-device-confirmed finding for the record, but not being actively investigated further per reporter's instruction.

---

## OTA never applies on Android production — UNRESOLVED

Confirmed real via a live test: renamed the "Live" tab to "LiveX" in `app/index.tsx`, published via `eas update --channel production` (runtimeVersion 2.0.0, matching the installed build), asked the reporter to force-close and reopen the app multiple times. The change never applied. Meanwhile the identical mechanism works on: the Android **preview** channel, and a friend's **iOS** production install.

**Ruled out:**
- Rollout percentage gating — channel shows `Rollout Percentage: N/A` (full rollout).
- SSL pinning interference — `ENABLE_SSL_PINNING=true` exists in `eas.json` but is **dead code**, never actually consumed anywhere in the JS (`grep` found zero implementation, only the env var name).
- The JS-side update logic in `app/_layout.tsx` (`Updates.useUpdates()` → `fetchUpdateAsync()` → `reloadAsync()`) — standard, correct usage, no bug found.
- The manifest embedded in the published update itself — confirmed via `eas channel:view`/`eas update:view` to contain the correct name and config.

**Leading unconfirmed theory:** Google Play's **App Signing "legacy APK"** mechanism. `git log` confirms **two distinct keystores exist** in this project's history — `@avielpa__MaxBreak.jks` (current, MD5 `e7edc396...`) and `@avielpa__MaxBreak_OLD_1.jks`/`_OLD_2.jks` (old, MD5 `66f1eb08...`, identical to each other) — all four `.jks` files landed together in a single commit `f6cb40ea` (2026-04-12, message just `"//"`), alongside a full native `android/` project dump. No documentation anywhere (git log, `docs/`, session writeups) explains when or why this key rotation happened. If Play is still serving a legacy-key-signed APK to some devices/accounts due to this undocumented rotation, it would explain both symptoms (name = wholly different old binary; OTA = genuinely mismatched runtimeVersion) via one mechanism — but the one real-device signature check this session (`past signatures:[]`) didn't show evidence of it on that specific install.

**Not yet checked:** Play Console → Test and release → Setup → App signing, to see whether a "legacy APK" / key-upgrade state is active and whether the legacy APK slot has gone stale.

---

## Full findings from the 6 parallel research subagents (2026-07-28)

### Agent 1 — Android launcher stale-label bugs
Most likely (at the time, before the on-device Hebrew-split finding superseded it): Pixel Launcher's own `app_icons.db` icon/label cache, keyed by package+activity component name, can retain a stale label across uninstall/reinstall since it's not tied to install state. Fix would be clearing the launcher app's own cache/data, or Play Store's cache/data, not a code fix.
Sources: [Adventures in Launcherland](https://medium.com/@KieronQuinn/adventures-in-launcherland-modding-the-pixel-launcher-without-actually-changing-the-apk-or-using-54a0cf34ef01), [PixelLauncherMods FAQ](https://github.com/KieronQuinn/PixelLauncherMods/blob/master/app/src/main/assets/faq.md), [Play Developer Community — old name/icon showing](https://support.google.com/googleplay/android-developer/thread/381492009).

### Agent 2 — Play App Signing serving issues
Flagged the "App Signing key upgrade / legacy APK" mechanism as the most plausible *officially documented* way Play could serve an old, differently-signed APK despite Console showing a new release as live — tied to per-device/account eligibility Play tracks server-side, survives uninstall+reinstall. Recommended `adb shell dumpsys package ... | grep versionCode` as the decisive test (done — see on-device findings above), and checking Play Console → App integrity → App signing.
Sources: [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en), [Staged rollouts](https://support.google.com/googleplay/android-developer/answer/6346149?hl=en), [expo-updates docs](https://docs.expo.dev/versions/latest/sdk/updates/).

### Agent 3 — Full raw log diff, build 65 vs 76
Confirmed the `PRE_INSTALL_HOOK`/`PREBUILD` fix is present and working in build 76. Found one real (but expected/intentional) divergence: `EAS_USE_CACHE`/ccache config disabled between the two builds — matches this session's own deliberate `eas.json` changes, not a mystery. Build 76's captured log was truncated mid-`RUN_GRADLEW` (before `signReleaseBundle`), so could not confirm or rule out a signing-keystore difference from logs alone — logs never print a keystore SHA/fingerprint. Recommended pulling a complete log or dumping the actual artifact's signing cert directly (superseded by the real-device pull, which did get this: `past signatures:[]`).

### Agent 4 — Deep GitHub/forum search for exact symptom match
No public precedent found combining both symptoms (wrong name from a verified-correct binary + OTA breaking on Play-Store-installed Android production only) as a single documented, resolved bug. Closest related threads (Play Developer Community) describe old name/icon persisting after an update, always unresolved beyond "contact Play support." Found unrelated Firebase/AdMob manifest-merger conflicts (build-time failures, not this). Recommended opening a Play Console support ticket with the strong evidence already gathered, and verifying the friend's install came from the actual production Play listing (not a stale internal/closed-testing opt-in link).
Sources: [Play Developer Community threads #1](https://support.google.com/googleplay/android-developer/thread/381492009), [#2](https://support.google.com/googleplay/android-developer/thread/246071897), [#3](https://support.google.com/googleplay/android-developer/thread/207423291), [react-native-google-mobile-ads#657](https://github.com/invertase/react-native-google-mobile-ads/issues/657).

### Agent 5 — Play App Signing key history investigation
**Confirmed via local git archaeology**: two distinct keystores in the repo (see "OTA never applies" section above for details), both landing in one undocumented commit `f6cb40ea` (2026-04-12, message `"//"`) alongside a full native project dump. No session doc or repo doc anywhere explains the rotation. Explained exactly how to check for legacy-APK serving in Play Console (Setup → App signing; App bundle explorer for per-device generated artifacts) and confirmed mechanistically that a stale legacy APK slot absolutely can still contain old resources like `app_name`, since it's a wholly separate binary from the AAB, not derived from it.
Sources: [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en), [Android App Bundle FAQ](https://developer.android.com/guide/app-bundle/faq), [Legacy release key thread](https://support.google.com/googleplay/android-developer/thread/203616430/my-app-is-signed-with-a-legacy-release-key-app-signing-key-certificate?hl=en).

### Agent 6 — expo-updates runtimeVersion mismatch research
Explained that `expo-updates` embeds its config into a **separate native resource file** (`expo_updates_res_values.xml`, generated by the `withUpdates` config-plugin during prebuild) distinct from the `AndroidManifest.xml` meta-data patched later in `CONFIGURE_EXPO_UPDATES` — meaning a non-idempotent prebuild reuse (fix #1 above) could in principle leave this specific file stale even while the manifest looks correct on inspection. Ruled out `expo-updates`' optional code-signing feature as a cause (not configured in this project). No matching GitHub issue found for "works on preview, not on Play Store production" as a confirmed library bug.
Sources: [EAS Update code signing](https://github.com/expo/expo/blob/main/docs/pages/eas-update/code-signing.mdx), [Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/), [expo/expo#20847](https://github.com/expo/expo/issues/20847) (inconclusive/stale), [App credentials docs](https://docs.expo.dev/app-signing/app-credentials/).

---

## Friend's device screenshot

Reporter's friend, different physical device (Google Pixel) and different Google account, sent a screenshot of their app drawer (alphabetical, near Slack/Slides/SmartThings/Snapchat) showing the icon labeled **"snooker.o..."** (truncated, with a visible literal period after "snooker" — confirmed to read "snooker.org...", not "Snooker MaxBreak..." which would show a space, not a period, at that position). This was the piece of evidence that ruled out "reporter's own device/account history" as a sufficient explanation on its own, before the real-device Hebrew-locale-split finding (which the friend's Pixel likely also has, if set to Hebrew).

---

## Open items for next session

1. **OTA-never-applies-on-Android-production** is still unresolved — the actual blocking mechanism hasn't been confirmed, only theorized (Play App Signing legacy-key serving, unverified on the one real device checked).
2. Check Play Console → Test and release → Setup → App signing for legacy-APK/key-upgrade status — not yet done.
3. The undocumented April 12 2026 keystore rotation (`f6cb40ea`) should be documented properly (why it happened, which keystore is now canonical) regardless of whether it's the cause here.
4. Per reporter's instruction, the app-name/Hebrew-locale-string finding is **not** being pursued further right now, but the on-device evidence is real and preserved above if it becomes relevant again.
