# iOS Build Handoff — Firebase Crash Fix

## For the Apple/iOS developer

**Do not merge your own local changes with this branch.** Pull this exact
version of `master` and build from it as-is — this commit is the intended
final state for the next iOS build. If you have local changes, stash or
discard them first; do not merge.

```bash
git fetch origin
git checkout master
git reset --hard origin/master
```

Then build:

```bash
cd FrontMaxBreak
npx eas build --platform ios --profile production
```

That's the only thing that needs to happen on your end. Everything below is
context for why, in case something looks unfamiliar in the diff.

---

## What happened

1. Firebase Analytics (`@react-native-firebase/analytics`) was added to the
   app across several days. It requires an iOS app to be registered in the
   Firebase Console with a `GoogleService-Info.plist` bundled into the app —
   **this was never set up for iOS** (only Android's `google-services.json`
   exists). The very first iOS build attempt with these Firebase plugins in
   place failed outright during Expo prebuild with:
   `Path to GoogleService-Info.plist is not defined`.
2. Despite that, an iOS build ended up installed on a real device (a
   different build, made outside this failing path) that apparently has some
   Firebase native scaffolding present without valid config.
3. Once JS code that calls into Firebase Analytics (`useAnalyticsScreenTracking`
   in the root layout, firing on every screen) reached that device via an
   OTA update, the app started **crashing immediately and silently on every
   launch** — a native-level crash, not a catchable JS exception, so no
   error screen, no stack trace, and a JS-side `try/catch` around the
   Firebase call did not prevent it.
4. **Confirmed empirically**: reverting the iOS bundle (via OTA) to a version
   from before Firebase Analytics existed fixed the crash immediately. This
   ruled out other theories and confirmed Firebase is the direct cause.
5. Android was never affected the same way — its production binary never had
   Firebase native code compiled in at all until a separate native build was
   made specifically for Android, so there's no dormant scaffolding to crash.

## What's fixed now, and what still needs a native build

Two changes are already committed to `master`:

- **`FrontMaxBreak/services/analyticsService.ts`** — analytics is now
  hard-disabled at runtime on iOS (`Platform.OS !== 'ios'` check), so no JS
  code will ever call into the Firebase native module on iOS, regardless of
  what's compiled into the binary. This is what let us safely restore the
  full current feature set to iOS via OTA update — **but it doesn't remove
  whatever broken Firebase scaffolding is already inside the currently
  installed iOS binary.**
- **`FrontMaxBreak/app.config.js`** — the `@react-native-firebase/app` and
  `@react-native-firebase/analytics` config plugins are now excluded from
  iOS builds entirely (`EAS_BUILD_PLATFORM === 'ios'` check), so the *next*
  build made from this repo will not attempt to link Firebase's native SDK
  into iOS at all. This is the fix that actually needs a new build to take
  effect — nothing OTA-side can change what's already compiled into an
  installed app.

**Once you build and submit the new iOS version, it should no longer be
capable of hitting this crash at all**, since Firebase won't be linked into
iOS in the first place. Android is unaffected either way and keeps Firebase
Analytics normally.

## Optional follow-up (not required for this fix)

If you'd like iOS to actually have Firebase Analytics working properly in
the future (not just crash-free), that requires:
1. Registering an iOS app in Firebase Console (project `snooker-maxbreak`,
   bundle ID `com.avielpahima.maxbreaksnooker`).
2. Downloading the resulting `GoogleService-Info.plist` and wiring it into
   `app.config.js` (`ios.googleServicesFile`), mirroring how Android's
   `googleServicesFile` is already configured.
3. Removing the iOS exclusion in `app.config.js`'s `plugins` array and the
   `Platform.OS !== 'ios'` check in `analyticsService.ts`.

This is optional — the app works fully without iOS Analytics; it's purely a
"nice to have" for tracking iOS user behavior in Firebase, matching what
Android already has.
