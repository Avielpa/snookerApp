#!/usr/bin/env bash
set -euo pipefail

# EAS Build runs this at the PRE_INSTALL_HOOK phase, before INSTALL_DEPENDENCIES
# and well before PREBUILD.
#
# Since build 67 (2026-07-21), EAS Build's workingdir has not been fully fresh
# between builds: PREBUILD logged "Created native directory | reusing /android"
# instead of a clean create (confirmed NOT caused by git tracking, eas.json's
# cache setting, or an npm postinstall script), and INSTALL_DEPENDENCIES has
# logged "up to date" against a node_modules that already existed before npm
# install ran - on a supposedly fresh checkout. Both point to the same thing:
# something in EAS's infra persists the workingdir across builds rather than
# starting from nothing.
#
# `git clean -fdx` removes every untracked/ignored file (node_modules,
# android/, ios/, .expo/, dist/, etc.) so the workingdir always matches
# exactly what's in git for this commit before anything else runs - no stale
# leftovers from a previous build can survive into this one, regardless of
# where they came from. Everything gitignored here is either regenerated
# later in the build (node_modules via npm install, android/ios via prebuild,
# GoogleService-Info.plist via app.config.js from an EAS secret) or already
# absent from the workingdir on every build regardless (google-services.json -
# confirmed by EAS's own "not checked in, won't be uploaded" warning).
echo "[eas-build-pre-install] git clean -fdx: wiping workingdir back to exactly what's tracked in git"
git clean -fdx -e eas-build-pre-install.sh
