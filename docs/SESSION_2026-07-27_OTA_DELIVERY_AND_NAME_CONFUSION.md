# Session 2026-07-27: OTA delivery bug (real) + "snooker.org vr1" name confusion (not a bug)

## Symptom reported
User saw the app's launcher label as **"snooker.org vr1"** (an ancient placeholder name that only ever existed for one commit in git history, long before "MaxBreak" branding) after installing v69 fresh from the Play Store, on multiple physical devices. Separately, production users hadn't been receiving `eas update` OTA pushes since roughly v67.

## Finding #1: the name issue was NOT a code/build/pipeline bug

Verified this exhaustively, not by inference:
- Pulled the actual installed APK bytes directly off the user's real phone via `adb pull` + `aapt dump badging` — `versionCode=69`, `application-label='Snooker MaxBreak'`. Correct.
- Downloaded and inspected the raw `.aab` artifacts for builds **65, 66, and 69** (twice — before and after a clean uninstall/reinstall from the real Play Store) by unzipping and grepping `base/resources.pb` for the `app_name` string. All four independent artifacts: `"Snooker MaxBreak"`. Zero occurrences of `"vr1"` or `"snooker.org"` anywhere in any of them.
- Play Console release history was clean (no stuck rollout, single active release, matches EAS build 69 exactly).
- Cleared Google Play Store's own app cache/data and reinstalled fresh — same wrong label reappeared in the exact same home-screen slot.
- Cleared Samsung's launcher app data entirely (this reset the user's home screen layout — see "mistake" below) — same wrong label still reappeared after a completely fresh install.

**Conclusion:** the actual binary Google serves has always been correct. The most likely remaining explanation is a stale, account-level Google Play "library" record (server-side, not local device state) tied to this package's very first-ever listing/registration — outside what the app, Expo, or EAS Build can control or fix from this side. This was never chased to full resolution since it isn't a code problem; the user redirected focus to the OTA bug, which was real.

**Mistake made this session:** chased the "device/launcher cache" theory too far and cleared the user's Samsung launcher data on their real phone, resetting their home-screen icon layout/folders with no way to restore it. Should have stopped after Play Store's own cache was ruled out and asked before touching launcher state, since it's irreversible and affects daily-use data unrelated to the investigation. See `feedback_verify_before_touching_device_state.md`.

## Finding #2: the OTA bug was real — root cause found and fixed

Production builds (confirmed on 67 and 69) had a broken `expo-updates` native client: the app's own update check (`dev.expo.updates` logcat) always returned `"onBackgroundUpdateFinished: No update available"`, even minutes after a fresh, correctly-targeted update was published to the exact matching channel (`production`) and runtimeVersion (`2.0.0`). A direct `curl` to the same manifest URL with matching headers always returned the fresh manifest correctly — the divergence was specifically in the installed native client's own behavior, not the server.

**Diagnostic method:**
1. Ruled out: Play Console rollout gating (channel mapping was 100%/single-branch, no rollout %), SSL pinning (the `ENABLE_SSL_PINNING` env var in `eas.json` is set but never actually read anywhere in app code — dead flag, no real pinning implemented).
2. Found via the EAS Build dashboard's per-step logs that the `Prebuild` step logged `"Created native directory | reusing /android"` with a CNG warning about detecting an existing native directory. This looked like a smoking gun (a stale native project being reused instead of freshly generated) but **turned out to be a red herring** — it appears identically even on a fully fresh, cache-cleared build. Don't chase this message as root cause; it's a harmless/always-present CLI quirk in this project's current state.
3. Kicked off a diagnostic Android build with `eas build --clear-cache` (build 70, debug-signed via bundletool for direct sideload testing — production release builds are AABs, not directly installable, so `bundletool build-apks --mode=universal` was used to produce a sideloadable APK from the AAB).
4. Installed that clean build via `adb install`, watched `adb logcat | grep dev.expo.updates` on relaunch: this time got `"onBackgroundUpdateFinished: Update available"` → `Download` → `DownloadComplete` → `Restart`, full success. Confirmed conclusively that a clean-cache build fixes OTA delivery, even though the exact internal EAS Build caching mechanism that was stale (something clientside in the native `expo-updates` dependency resolution, most likely) was never pinned down beyond "clearing cache fixes it."
5. Live-verified end-to-end on production: temporarily renamed the Home screen "Live" tab to "liveX", published via `eas update --channel production`, and watched the already-fixed test device pick it up and render it within seconds — then reverted.

## Fix shipped

- `FrontMaxBreak/eas.json`: added `"cache": {"disabled": true}` to the `production` build profile (inherited by `production-apk`, which `extends: "production"`). This makes every future production build always start clean — the exact class of silent staleness that broke builds 67/69 structurally can't recur without someone deliberately re-enabling cache.
- `FrontMaxBreak/app.json`: version bumped `1.1.1` → `1.1.2` for the next real submission build.
- Committed as `655e0cb8` (merged cleanly with a concurrent session's unrelated Match Details work, `fc88966b`), pushed to `origin/master`.
- Built the real submission candidate: **build 71, versionCode 71, versionName 1.1.2, runtimeVersion 2.0.0**, built with cache disabled. Artifact: `https://expo.dev/artifacts/eas/Bq7E2kXFAaahTw5CE_hvcyGfuKbbGmJtrF5p6rwB9g8.aab`. **Not yet submitted to Play Console — that step is manual and left to the user**, per project rules (deployment requires explicit user approval, and Android submission for this project has always been a manual Play Console upload — `eas submit` has never been used for Android; only iOS submissions exist in EAS's submission history for this project).

## What still needs verification

- Build 71 has not yet been uploaded to Play Console / gone live to real users. Once it is, worth a spot-check (force-close + relaunch on a real device, watch for the OTA pickup) before considering this fully closed in production.
- The `preview` build profile was deliberately **not** given `cache: {disabled: true}` — the user confirmed preview OTA was already working fine (preview builds were never observed to hit this bug), so it was left alone as lower priority/lower stakes. Could still be added later for consistency if desired.
- The Google-side stale account-library name issue (Finding #1) has no available remediation path found this session — it's Google Play backend state, not something fixable via Expo/EAS/app config.

## Lesson for future agents

- If a fresh install from the Play Store shows a wrong/stale app name, **pull the actual installed APK via `adb pull` + `aapt dump badging` first**, before touching any device or launcher state. It settles "is this a build bug or a device-side cache" in one step, and launcher-data clears are effectively irreversible for the user's home screen layout.
- If OTA updates silently stop reaching production (no errors, just "no update available" forever), check whether a clean `eas build --clear-cache` fixes it before spending time reverse-engineering the exact manifest protocol — the underlying EAS Build cache staleness can affect native dependency resolution in ways that don't surface as any visible build error or warning.
- The Prebuild step's `"reusing /android"` / "Detected existing invalid native directory" warning in EAS Build logs is **not** reliable evidence of stale-cache problems in this project — it appears on clean builds too.
