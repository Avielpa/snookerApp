// app.config.js
// Dynamic config that reads environment variables set by EAS build profiles.
// app.json is still the source of truth — this file only overrides what changes per profile.
const baseConfig = require('./app.json').expo;

const isPreview = process.env.ANDROID_PACKAGE === 'com.avielpahima.maxbreaksnooker.preview';

// Custom plugin: patches build.gradle to use NDK 28 (16KB page size compliance).
// expo-build-properties 0.13.3 does not handle ndkVersion — must patch directly.
const withNdk28 = (config) => {
  const { withDangerousMod } = require('@expo/config-plugins');
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const fs = require('fs');
      const path = require('path');
      const buildGradlePath = path.join(config.modRequest.platformProjectRoot, 'build.gradle');
      let contents = fs.readFileSync(buildGradlePath, 'utf-8');
      contents = contents.replace(
        /ndkVersion\s*=\s*["'][^"']*["']/,
        'ndkVersion = "28.2.13676358"'
      );
      fs.writeFileSync(buildGradlePath, contents);
      return config;
    },
  ]);
};

module.exports = {
  expo: {
    ...baseConfig,
    name: isPreview ? 'MaxBreak (Preview)' : baseConfig.name,
    android: {
      ...baseConfig.android,
      package: process.env.ANDROID_PACKAGE || baseConfig.android.package,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? baseConfig.android.googleServicesFile,
    },
    plugins: [
      ...(baseConfig.plugins || []),
      withNdk28,
    ],
  },
};
