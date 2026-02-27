// app.config.js
// Dynamic config that reads environment variables set by EAS build profiles.
// app.json is still the source of truth — this file only overrides what changes per profile.
const baseConfig = require('./app.json').expo;

const isPreview = process.env.ANDROID_PACKAGE === 'com.avielpahima.maxbreaksnooker.preview';

module.exports = {
  expo: {
    ...baseConfig,
    // Preview builds get a different name and package so they install
    // as a separate app alongside the Play Store version.
    name: isPreview ? 'MaxBreak (Preview)' : baseConfig.name,
    android: {
      ...baseConfig.android,
      package: process.env.ANDROID_PACKAGE || baseConfig.android.package,
    },
  },
};
