# Session: iOS build failure — fmt consteval error on Xcode 26.5

**Date**: 2026-07-22

## Symptom
Apple developer's `eas build --profile production --platform ios` failed during compilation. Log: `xcode-build-aa2346ba-bc85-4bc6-b916-0f3b171e2364.log` (user-provided, not committed to repo).

## Root cause
`FrontMaxBreak/eas.json` pinned `production.ios.image` to `"latest"`, which resolved to an Xcode 26.5 (`iPhoneOS26.5.sdk`) build image. Xcode 26.4+ ships Apple Clang 21, which tightened C++20 `consteval` rules. The `fmt` library version bundled by React Native 0.79.6 (via RCT-Folly) uses `FMT_STRING`/`FMT_COMPILE_STRING` patterns that no longer satisfy those stricter rules, so `Pods/fmt/src/format.cc` fails with 5 "call to consteval function ... is not a constant expression" errors in `format-inl.h`.

This is a known upstream issue (facebook/react-native#55601, fmtlib/fmt#4740). The real fix (bumping `fmt` to 12.1.0) only landed in React Native ≥0.83.9 / Expo SDK 56 — well past this app's Expo SDK 53, so upgrading RN was not a viable quick fix.

`preview`/`beta` build profiles don't override `image`, so they were unaffected — this only broke `production` because it explicitly forced `"latest"`.

## Investigation method
Followed `superpowers:systematic-debugging`. Confirmed via full-log grep that the entire 12,291-line log contained exactly 5 occurrences of "error" (whole-word), all inside the single `fmt/src/format.cc` compile job, and that no other target, linker step, or codesigning step reported a failure — ruling out a second, independent cause. The log has no final `** BUILD FAILED **` banner (stream appears to cut off mid-parallel-compile), so a downstream failure at export/upload stage can't be ruled out from this log alone — that's the next checkpoint to watch on the next build attempt.

## Fix
One-line change in `FrontMaxBreak/eas.json`: production iOS profile `"image"` changed from `"latest"` to `"macos-sequoia-15.5-xcode-16.4"` (Xcode 16.4 — last known-good Xcode for Expo SDK 53, predates the consteval tightening).

## What was verified vs not
- Verified: root cause confirmed from log evidence + matching upstream GitHub issues; only one failure signal present in the log.
- Not verified: an actual successful build/submit on the new pinned image — no build has been re-run yet. Next `eas build --profile production --platform ios` + `eas submit` will confirm.

## Lesson for future agents
Don't leave `eas.json` iOS build profiles on `"image": "latest"` for production — it silently tracks whatever Xcode EAS currently offers, which can break native compilation of any pod using bleeding-edge-incompatible C++ (this project uses RN 0.79.6 / Expo SDK 53, several Xcode majors behind "latest"). Pin an explicit image and bump deliberately when doing an RN/Expo SDK upgrade, not automatically.
