const { withStringsXml } = require('@expo/config-plugins');

// Google Play's automatic app-string translation feature re-translates any
// ordinary (translatable) Android string resource into per-locale APK splits
// after upload, and does not reliably re-sync them on later releases. This
// silently froze `expo_runtime_version` at an old value ("1.0.0") in the
// Hebrew (iw) locale split for this app while the base module correctly
// moved to "2.0.0" at build 67 — any device running in that locale resolves
// the stale split value instead of the base one, so expo-updates polls the
// production channel for the wrong runtime version forever and never finds
// a compatible update. Marking these resources non-translatable stops Play
// from generating/overwriting locale-specific copies of them at all.
// See docs/broken_pipeline.md and https://github.com/expo/expo/issues/48148.
const NON_TRANSLATABLE_STRING_NAMES = ['expo_runtime_version', 'app_name'];

const withNonTranslatableStrings = (config) => {
  return withStringsXml(config, (config) => {
    const items = config.modResults.resources.string;
    if (items) {
      for (const item of items) {
        if (NON_TRANSLATABLE_STRING_NAMES.includes(item.$.name)) {
          item.$.translatable = 'false';
        }
      }
    }
    return config;
  });
};

module.exports = withNonTranslatableStrings;
