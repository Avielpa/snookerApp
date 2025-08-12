#!/usr/bin/env node
/**
 * Railway Deployment Setup Script
 * Run this after deploying to Railway to configure your React Native app
 * Usage: node deployment-setup.js <your-railway-url>
 */

const fs = require('fs');
const path = require('path');

function updateAPIConfiguration(railwayUrl) {
  if (!railwayUrl) {
    console.error('❌ Please provide your Railway URL');
    console.log('Usage: node deployment-setup.js https://your-app.up.railway.app');
    process.exit(1);
  }

  // Clean up URL (ensure it ends with /)
  if (!railwayUrl.endsWith('/')) {
    railwayUrl += '/';
  }

  console.log(`🚀 Configuring MaxBreak app for Railway deployment...`);
  console.log(`📡 API URL: ${railwayUrl}oneFourSeven/`);

  // Update api.ts
  const apiFilePath = path.join(__dirname, 'FrontMaxBreak', 'services', 'api.ts');
  try {
    let apiContent = fs.readFileSync(apiFilePath, 'utf8');
    
    // Replace the placeholder URL
    const updatedContent = apiContent.replace(
      /https:\/\/YOUR_RAILWAY_APP_NAME\.up\.railway\.app\//g,
      railwayUrl
    );
    
    fs.writeFileSync(apiFilePath, updatedContent);
    console.log(`✅ Updated ${apiFilePath}`);
  } catch (error) {
    console.error(`❌ Failed to update api.ts: ${error.message}`);
  }

  // Update eas.json
  const easJsonPath = path.join(__dirname, 'FrontMaxBreak', 'eas.json');
  try {
    const easContent = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));
    
    // Update all production/preview/beta builds
    const buildsToUpdate = ['preview', 'beta', 'production'];
    
    buildsToUpdate.forEach(buildType => {
      if (easContent.build[buildType]?.env) {
        if (easContent.build[buildType].env.EXPO_PUBLIC_API_URL) {
          easContent.build[buildType].env.EXPO_PUBLIC_API_URL = `${railwayUrl}oneFourSeven/`;
        }
        if (easContent.build[buildType].env.API_BASE_URL) {
          easContent.build[buildType].env.API_BASE_URL = `${railwayUrl}oneFourSeven/`;
        }
      }
    });
    
    fs.writeFileSync(easJsonPath, JSON.stringify(easContent, null, 2));
    console.log(`✅ Updated ${easJsonPath}`);
  } catch (error) {
    console.error(`❌ Failed to update eas.json: ${error.message}`);
  }

  console.log(`\n🎯 Configuration complete! Next steps:`);
  console.log(`1. Test your Railway backend: ${railwayUrl}oneFourSeven/calendar/main/`);
  console.log(`2. Build your APK: cd FrontMaxBreak && npx eas build --profile beta --platform android`);
  console.log(`3. Your app is ready for beta testing!`);
}

// Get Railway URL from command line argument
const railwayUrl = process.argv[2];
updateAPIConfiguration(railwayUrl);