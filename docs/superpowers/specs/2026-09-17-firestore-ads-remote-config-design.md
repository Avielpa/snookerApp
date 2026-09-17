# Firestore Remote Ads Config — Design

Date: 2026-09-17
Status: Approved (pending user sign-off on this doc before implementation plan)

## Problem

Ads (banners via `BannerAdSlot.tsx`, interstitials via `adsService.ts` hooks) are
currently gated only by build-time ad-unit-ID presence (`ADS_ENABLED`). There is no
way to:

1. Kill banners and/or interstitials app-wide without a new build/OTA release
   (e.g. to react quickly to an AdMob policy issue or a bad eCPM period).
2. Disable ads on a *specific device* — needed when recording app-store/demo/marketing
   screen recordings, where ads look bad and break the flow, without affecting real
   users.

## Approach

A single Firestore document acts as a remote kill-switch, read once per app launch.
No admin UI — managed directly in the Firebase Console. No live listener — simplicity
was explicitly chosen over real-time updates; a relaunch is enough to change ad
behavior for a device.

### Data model

Collection `remote_config`, document `ads`:

```
{
  bannersEnabled: boolean,        // default true if missing
  interstitialsEnabled: boolean,  // default true if missing
  disabledDeviceIds: string[]     // default [] if missing
}
```

`disabledDeviceIds` holds device UUIDs produced by the existing
`utils/deviceIdentity.ts::getOrCreateDeviceId()` (already used for favorites/push).
A UUID in this list disables **both** banners and interstitials on that device,
overriding the two booleans above for that device only. One switch per UUID —
no separate banner/interstitial granularity per device (confirmed: not needed).

### Fetch & fallback

- Fetched once at app startup, alongside the existing `initAds()` call site in
  `app/_layout.tsx`.
- On any failure (offline, Firestore error, missing doc, missing fields) — fail
  safe to **ads fully on** (`bannersEnabled: true, interstitialsEnabled: true`,
  no device disabled). This matches today's behavior exactly, so a Firestore outage
  never silently kills monetization.
- No local caching of the last-known value — unnecessary since the failure default
  already equals "ads on," and re-fetching each launch is cheap (one doc read).

### New file: `services/adsConfigService.ts`

- `initAdsConfig(): Promise<void>` — fetches the doc once (memoized promise, same
  pattern as `initAds()` in `adsService.ts`), computes and caches the effective
  per-device flags in a module-level variable.
- `isAdsConfigEnabled(kind: 'banner' | 'interstitial'): boolean` — synchronous
  getter. Returns `true` (safe default) until `initAdsConfig()` has resolved, then
  returns the fetched/overridden value.
- Device-disabled check: reads `getOrCreateDeviceId()` (already async — resolved
  during the same init call) and checks membership in `disabledDeviceIds`.

### Integration points (both existing choke points, 1-line gate each)

- `components/ads/BannerAdSlot.tsx`: extend the existing
  `if (!ADS_ENABLED || failed || !BANNER_AD_UNIT_ID)` early-return to also check
  `!isAdsConfigEnabled('banner')`.
- `services/adsService.ts`: `createOnceInterstitialHook` (covers
  `scoreboard-frame-complete` and `match-detail` triggers) and
  `useMediaTabInterstitial` add `!isAdsConfigEnabled('interstitial')` to their
  existing early-return guards alongside `ADS_ENABLED`.
- `app/_layout.tsx`: call `initAdsConfig()` once at startup, same place/pattern as
  the existing ad-SDK init wiring — fire-and-forget, no blocking UI on it (the
  synchronous getter's safe-default means nothing needs to wait).

### Recording workflow

1. Note device UUID from the existing debug log line already emitted by
   `deviceIdentity.ts` (`[DeviceIdentity] ...` — visible via Metro/`adb logcat`).
   No new UI, no new log line needed — reuse what's already there (confirm during
   implementation that a UUID value is actually logged at INFO/log level, add one
   log line if not).
2. Add that UUID to `disabledDeviceIds` in the Firebase Console for the `remote_config/ads` doc.
3. Relaunch the app on that device — ads are now off for that device only.
4. Remove the UUID from the array after recording.

### New dependency

`@react-native-firebase/firestore` is not currently installed (only `/app` and
`/analytics` are, per `package.json`). This is a **native module addition** —
requires `eas build --profile preview` (not just `eas update`) before it can reach
any device, per this repo's OTA-vs-build rule. Preview build + device test required
before promoting to production, per standard workflow.

## Out of scope (explicitly deferred)

- Live/real-time config updates (`onSnapshot` listener) — deferred in favor of
  fetch-once-per-launch simplicity, per user decision.
- In-app admin screen for editing the config — deferred in favor of Firebase
  Console-only management, per user decision.
- Per-UUID granular banner/interstitial split — deferred in favor of one switch
  per UUID, per user decision.
- Local persistence/caching of last-known config value — unnecessary given the
  fail-safe-to-on default.

## Testing plan

Per CLAUDE.md rule #8 (test every feature): unit tests for
`adsConfigService.ts` covering:
- Default-on behavior before init resolves.
- Correct flag computation from a fetched doc (all combinations of the two
  booleans × device-in-list / device-not-in-list).
- Fail-safe-to-on behavior on fetch rejection, missing doc, and missing/malformed
  fields.
- `BannerAdSlot` and the interstitial hooks: confirm the new gate suppresses ads
  when `isAdsConfigEnabled` returns false, and behaves exactly as before (no
  regression) when it returns true.

Old-data compatibility (CLAUDE.md rule #9): a missing/never-created Firestore doc
must produce identical behavior to today (all ads on) — this is the same code path
as "fetch failed," so no separate handling needed.
