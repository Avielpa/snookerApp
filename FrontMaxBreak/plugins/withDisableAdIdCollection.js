// plugins/withDisableAdIdCollection.js
// MaxBreak has no ads — this disables Firebase Analytics' advertising ID (AD_ID)
// collection so the AD_ID permission isn't added to the manifest, avoiding the
// Play Console "advertising ID declaration" requirement entirely.
const { withAndroidManifest } = require('@expo/config-plugins');

function withDisableAdIdCollection(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    if (!application['meta-data']) {
      application['meta-data'] = [];
    }
    const alreadyPresent = application['meta-data'].some(
      (item) => item.$['android:name'] === 'google_analytics_adid_collection_enabled'
    );
    if (!alreadyPresent) {
      application['meta-data'].push({
        $: {
          'android:name': 'google_analytics_adid_collection_enabled',
          'android:value': 'false',
        },
      });
    }
    return config;
  });
}

module.exports = withDisableAdIdCollection;
