# Audit — Android 16 (API 36) targetSdk Bump (scoping only, no code changed)

**Date**: 2026-08-27. **Status**: audit only, per user request — no code touched. Deadline: Play Console requires targetSdk 36+ for any *new* update from **Aug 31, 2026**; the already-live app is unaffected either way.

## Current state (confirmed by reading the repo)
- `FrontMaxBreak/app.config.js` and `FrontMaxBreak/eas.json` have **no** `expo-build-properties` overrides for `compileSdkVersion` / `targetSdkVersion` — so the app inherits whatever the installed Expo SDK ships by default.
- `package.json`: `"expo": "^53.0.0"` (React Native 0.79 generation). Expo SDK 53's default Android target is API 35 (Android 15) — consistent with the Play Console policy page showing that requirement as already satisfied/enforced, and the API 36 requirement as the new warning.
- `production` EAS profile already pins `android.ndk: "28.2.13676358"` (kept for the 16KB page-size fix — see MEMORY.md). No `compileSdkVersion`/`targetSdkVersion` keys alongside it.
- Memory note: `runtimeVersion` is currently `2.0.0` and **must bump** on any native/SDK change that alters JS↔native compatibility, or old installed binaries will pull an incompatible OTA JS bundle and hard-crash (`WeakRef`). A targetSdk bump counts as a native change.

## Two ways to reach API 36

**Option A — Upgrade Expo SDK (53 → 54+).**
Expo SDK 54 (RN 0.81 generation) is the first Expo release built against API 36 by default, so this is the "supported path" Expo/Google expect. This is the larger change:
- Every `expo-*` package in `package.json` needs re-aligning to the SDK-54-compatible versions (`npx expo install --check` after bumping).
- Any native module compatibility needs re-verification (ads SDK, notifications, secure-store, tracking-transparency, build-properties, etc.) — same category of risk as the earlier 16KB-page-size / NDK r27 issue in memory.
- `runtimeVersion` **must** bump (native change) — every device on the old binary needs a new store build before it can receive further OTA updates; devices left on old binaries keep working on old native code but stop getting JS updates until they update the app.
- This is squarely an EAS **build**, not an OTA update — requires `eas build` for both preview and production, full device retest before shipping, per CLAUDE.md rule 6/7.

**Option B — Stay on Expo SDK 53, force targetSdk 36 via `expo-build-properties`.**
Add to `app.config.js` plugins:
```js
['expo-build-properties', { android: { targetSdkVersion: 36, compileSdkVersion: 36 } }]
```
- Smaller diff, no dependency churn.
- Risk: RN 0.79 / Expo 53's native code was never tested by Expo against API 36 — behavior changes in Android 16 (e.g. stricter background-service limits, further scoped-storage/permission changes, predictive-back) could surface bugs the Expo 53 generation's native modules don't yet handle. This is "swimming upstream" of what Expo actually ships and tests for that SDK line — higher unknown-unknown risk than Option A even though the diff is smaller.
- Still requires a `runtimeVersion` bump and a real device rebuild/retest (native change, not OTA).

## Recommendation
Option A (upgrade to Expo SDK 54+) is the safer default — it's the path Expo/Google actually test together — but it is real scope: dependency bump audit, native rebuild, `runtimeVersion` bump, full device retest on preview before production, not a quick patch. Option B is faster but carries more unverified risk on an already-live app with real users.

Either way this is a **build**, not an OTA update, and needs explicit approval before any Edit/Write per CLAUDE.md rules 6, 7, and 9 (audit every caller/affected logic before changing shared code — here "shared" = the whole native layer).

## Not yet done (deliberately, awaiting decision)
- No package.json changes, no app.config.js changes, no build triggered.
- Next step is a user decision: which option, and when to schedule the build/test cycle before the Aug 31 deadline.
