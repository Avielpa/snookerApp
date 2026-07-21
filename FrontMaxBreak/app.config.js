// app.config.js
// Dynamic config that reads environment variables set by EAS build profiles.
// app.json is still the source of truth — this file only overrides what changes per profile.
const fs = require('fs');
const path = require('path');
const baseConfig = require('./app.json').expo;

const isPreview =
  process.env.EAS_BUILD_PROFILE === 'preview' ||
  process.env.ANDROID_PACKAGE === 'com.avielpahima.maxbreaksnooker.preview' ||
  process.env.APP_VARIANT === 'preview';

// iOS build detection
const isIosBuild = process.env.EAS_BUILD_PLATFORM === 'ios' || process.env.SDK_PLATFORM === 'ios';

// Support providing GoogleService-Info.plist via an EAS secret as a base64-encoded
// environment variable named `GOOGLE_SERVICE_INFO_PLIST_BASE64`.
// This keeps the plist out of source control but makes it available during EAS builds.
const plistPath = path.join(__dirname, 'GoogleService-Info.plist');
if (process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64) {
  try {
    const decoded = Buffer.from(process.env.GOOGLE_SERVICE_INFO_PLIST_BASE64, 'base64').toString('utf8');
    fs.writeFileSync(plistPath, decoded, { encoding: 'utf8' });
  } catch (e) {
    // If writing fails, we still continue — build will fail later with an explanatory message.
    console.warn('Failed to write GoogleService-Info.plist from base64 env var:', e && e.message);
  }
}

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
      // Prefer an explicitly-provisioned plist written from the EAS secret, if present.
      googleServicesFile: fs.existsSync(plistPath) ? './GoogleService-Info.plist' : baseConfig.ios.googleServicesFile,
    },
    plugins: [
      ...(baseConfig.plugins || []),
      'expo-secure-store',
      ...(isIosBuild ? [
        './plugins/withFmtFix',
      ] : [
        '@react-native-firebase/app',
        '@react-native-firebase/analytics',
        './plugins/withDisableAdIdCollection',
      ]),
    ],
  },
};
