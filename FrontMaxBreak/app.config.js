// app.config.js
// Dynamic config that reads environment variables set by EAS build profiles.
// app.json is still the source of truth — this file only overrides what changes per profile.
const baseConfig = require('./app.json').expo;

const isPreview =
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.ANDROID_PACKAGE === 'com.avielpahima.maxbreaksnooker.preview' ||
  process.env.APP_VARIANT === 'preview';

// iOS has no GoogleService-Info.plist configured yet (no iOS app registered in
// Firebase Console) — @react-native-firebase's config plugins fail prebuild
// entirely without it, and a build made without proper config crashes natively
// on launch. Excluded from iOS builds until that's set up; Android keeps it.
const isIosBuild = process.env.EAS_BUILD_PLATFORM === 'ios';

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
      [
        'react-native-google-mobile-ads',
        {
          androidAppId: 'ca-app-pub-3940256099942544~3347511713',
          iosAppId: 'ca-app-pub-3940256099942544~1458002511',
        },
      ],
      ...(isIosBuild ? [] : [
        '@react-native-firebase/app',
        '@react-native-firebase/analytics',
        './plugins/withDisableAdIdCollection',
      ]),
    ],
  },
};
