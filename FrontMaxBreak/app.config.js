// app.config.js
// Dynamic config that reads environment variables set by EAS build profiles.
// app.json is still the source of truth — this file only overrides what changes per profile.
const baseConfig = require('./app.json').expo;

const isPreview =
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.ANDROID_PACKAGE === 'com.avielpahima.maxbreaksnooker.preview' ||
  process.env.APP_VARIANT === 'preview';

module.exports = {
  expo: {
    ...baseConfig,
    name: isPreview ? 'MaxBreak (Preview)' : baseConfig.name,
    android: {
      ...baseConfig.android,
      package: isPreview ? 'com.avielpahima.maxbreaksnooker.preview' : (process.env.ANDROID_PACKAGE || baseConfig.android.package),
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? (isPreview ? './google-services-preview.json' : baseConfig.android.googleServicesFile),
    },
    ios: {
      ...baseConfig.ios,
      bundleIdentifier: isPreview
        ? 'com.avielpahima.maxbreaksnooker.preview'
        : baseConfig.ios.bundleIdentifier,
    },
    plugins: [
      ...(baseConfig.plugins || []),
      'expo-secure-store',
    ],
  },
};
