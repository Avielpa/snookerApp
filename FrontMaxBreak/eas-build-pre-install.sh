#!/usr/bin/env bash
set -euo pipefail

# EAS Build runs this at the PRE_INSTALL_HOOK phase, before INSTALL_DEPENDENCIES
# and well before PREBUILD. This project uses CNG (app.config.js generates
# android/ and ios/ fresh on every build) — those directories are gitignored
# and must never be checked into source control.
#
# Since build 67 (2026-07-21), EAS Build's PREBUILD phase has been logging
# "Created native directory | reusing /android" instead of a clean create,
# meaning something in EAS's build infra is seeding a stale /android into the
# workingdir before prebuild runs — verified NOT caused by git tracking,
# eas.json's cache setting, or an npm postinstall script. Deleting any
# leftover native dirs here guarantees prebuild always regenerates them from
# the current app.config.js instead of reusing stale, possibly outdated
# native files (old app name, old expo-updates config).
echo "[eas-build-pre-install] Removing any pre-existing native directories to force a clean CNG prebuild"
rm -rf android ios
