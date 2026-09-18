// ads_config_test.mjs — tests for computeEffectiveAdsConfig
// Runs in Node.js, no React/RN needed. Logic mirrors services/adsConfigService.ts exactly.

function computeEffectiveAdsConfig(doc, deviceId) {
  const SAFE_DEFAULT = { bannersEnabled: true, interstitialsEnabled: true };
  if (!doc) return SAFE_DEFAULT;
  const bannersEnabled = typeof doc.bannersEnabled === 'boolean' ? doc.bannersEnabled : true;
  const interstitialsEnabled = typeof doc.interstitialsEnabled === 'boolean' ? doc.interstitialsEnabled : true;
  const disabledDeviceIds = Array.isArray(doc.disabledDeviceIds) ? doc.disabledDeviceIds : [];
  if (disabledDeviceIds.includes(deviceId)) {
    return { bannersEnabled: false, interstitialsEnabled: false };
  }
  return { bannersEnabled, interstitialsEnabled };
}

let passed = 0;
let failed = 0;

function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label} — got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

const DEVICE_A = 'device-aaaa';
const DEVICE_B = 'device-bbbb';

console.log('\nSECTION 1 — Missing/null doc (fetch failed) → safe default');
assertEq(computeEffectiveAdsConfig(null, DEVICE_A), { bannersEnabled: true, interstitialsEnabled: true }, 'null doc → both true');
assertEq(computeEffectiveAdsConfig(undefined, DEVICE_A), { bannersEnabled: true, interstitialsEnabled: true }, 'undefined doc → both true');

console.log('\nSECTION 2 — Normal doc, device not in disabled list');
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: true, interstitialsEnabled: true, disabledDeviceIds: [] }, DEVICE_A),
  { bannersEnabled: true, interstitialsEnabled: true },
  'both enabled, empty disabled list → both true'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: false, interstitialsEnabled: true, disabledDeviceIds: [] }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: true },
  'banners off, interstitials on → respected independently'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: true, interstitialsEnabled: false, disabledDeviceIds: [] }, DEVICE_A),
  { bannersEnabled: true, interstitialsEnabled: false },
  'banners on, interstitials off → respected independently'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: false, interstitialsEnabled: false, disabledDeviceIds: [] }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: false },
  'both off globally → both false'
);

console.log('\nSECTION 3 — Device IS in disabledDeviceIds → overrides both to false');
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: true, interstitialsEnabled: true, disabledDeviceIds: [DEVICE_A] }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: false },
  'device in list, both globally on → device override wins, both false'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: false, interstitialsEnabled: false, disabledDeviceIds: [DEVICE_A] }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: false },
  'device in list, both globally off anyway → still both false'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: true, interstitialsEnabled: true, disabledDeviceIds: [DEVICE_A, DEVICE_B] }, DEVICE_B),
  { bannersEnabled: false, interstitialsEnabled: false },
  'multiple devices in list, second entry matches → still false'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: true, interstitialsEnabled: true, disabledDeviceIds: [DEVICE_A] }, DEVICE_B),
  { bannersEnabled: true, interstitialsEnabled: true },
  'device NOT in list (different device disabled) → unaffected, both true'
);

console.log('\nSECTION 4 — Malformed/missing fields on an existing doc → per-field safe default');
assertEq(
  computeEffectiveAdsConfig({}, DEVICE_A),
  { bannersEnabled: true, interstitialsEnabled: true },
  'empty object doc → both default true, empty disabled list'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: 'yes', interstitialsEnabled: 1, disabledDeviceIds: 'not-an-array' }, DEVICE_A),
  { bannersEnabled: true, interstitialsEnabled: true },
  'wrong types on every field → all fall back to safe defaults'
);
assertEq(
  computeEffectiveAdsConfig({ bannersEnabled: false }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: true },
  'only bannersEnabled present → interstitialsEnabled defaults true, disabledDeviceIds defaults empty'
);
assertEq(
  computeEffectiveAdsConfig({ disabledDeviceIds: [DEVICE_A] }, DEVICE_A),
  { bannersEnabled: false, interstitialsEnabled: false },
  'only disabledDeviceIds present, device matches → override still applies even with missing booleans'
);

console.log('\nSECTION 5 — Determinism');
{
  const doc = { bannersEnabled: true, interstitialsEnabled: false, disabledDeviceIds: [] };
  const a = computeEffectiveAdsConfig(doc, DEVICE_A);
  const b = computeEffectiveAdsConfig(doc, DEVICE_A);
  assertEq(a, b, 'repeated calls with identical inputs return identical results (pure function)');
}

console.log('\n' + '═'.repeat(60));
if (failed === 0) {
  console.log(`✅  All ${passed} assertions passed`);
} else {
  console.log(`❌  ${failed} failed / ${passed} passed`);
  process.exit(1);
}
