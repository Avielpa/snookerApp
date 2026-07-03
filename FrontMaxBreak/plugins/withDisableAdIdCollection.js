// plugins/withDisableAdIdCollection.js
// MaxBreak has no ads — this disables Firebase Analytics' advertising ID (AD_ID)
// collection so the AD_ID permission isn't added to the manifest, avoiding the
// Play Console "advertising ID declaration" requirement entirely.
const { withAndroidManifest } = require('@expo/config-plugins');

function withDisableAdIdCollection(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    const application = manifest.application[0];
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    const existing = application['meta-data'].find(
      (item) => item.$['android:name'] === 'google_analytics_adid_collection_enabled'
    );
    if (existing) {
      existing.$['android:value'] = 'false';
      existing.$['tools:replace'] = 'android:value';
    } else {
      application['meta-data'].push({
        $: {
          'android:name': 'google_analytics_adid_collection_enabled',
          'android:value': 'false',
          'tools:replace': 'android:value',
        },
      });
    }
    return config;
  });
}

module.exports = withDisableAdIdCollection;
