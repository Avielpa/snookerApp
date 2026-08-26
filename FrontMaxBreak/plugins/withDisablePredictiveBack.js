const { withAndroidManifest } = require('@expo/config-plugins');

// Android 13+ Predictive Back Gesture bypasses React Native's BackHandler and
// Modal.onRequestClose entirely at the OS level when the app doesn't opt out —
// the gesture dismisses/exits at the native Activity/Dialog layer before any
// JS ever runs, desyncing React state (e.g. a Modal that visually closes but
// leaves `visible=true` in JS, freezing touch input on the screen behind it).
// This app's React Native version (old architecture) does not register a
// predictive-back-compatible callback, so opting out via this manifest flag
// restores the legacy `Activity.onBackPressed()` dispatch that BackHandler
// and Modal.onRequestClose actually rely on. See docs/SCOREBOARD.md bug notes.
const withDisablePredictiveBack = (config) => {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];
    if (application) {
      application.$['android:enableOnBackInvokedCallback'] = 'false';
    }
    return config;
  });
};

module.exports = withDisablePredictiveBack;
