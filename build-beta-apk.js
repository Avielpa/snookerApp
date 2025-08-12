#!/usr/bin/env node
/**
 * MaxBreak Beta APK Builder
 * Simplified script to build and get APK download link
 */

const { execSync } = require('child_process');
const path = require('path');

function runCommand(command, description) {
  console.log(`\n🔄 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    process.exit(1);
  }
}

function buildBetaAPK() {
  console.log('🚀 MaxBreak Beta APK Builder');
  console.log('===========================\n');

  // Check if EAS is installed
  try {
    execSync('npx eas --version', { stdio: 'pipe' });
  } catch (error) {
    console.log('📦 Installing EAS CLI...');
    runCommand('npm install -g @expo/eas-cli', 'EAS CLI installation');
  }

  // Check if we're in the right directory
  if (!require('fs').existsSync('./app.json')) {
    console.error('❌ Please run this script from the FrontMaxBreak directory');
    console.log('Usage: cd FrontMaxBreak && node build-beta-apk.js');
    process.exit(1);
  }

  // Login to EAS (if not already logged in)
  console.log('\n🔐 Checking EAS login status...');
  try {
    execSync('npx eas whoami', { stdio: 'pipe' });
    console.log('✅ Already logged in to EAS');
  } catch (error) {
    console.log('🔐 Please login to EAS...');
    runCommand('npx eas login', 'EAS login');
  }

  // Initialize EAS project if needed
  console.log('\n⚙️ Checking EAS project configuration...');
  try {
    const projectConfig = require('./app.json');
    if (!projectConfig.expo.extra?.eas?.projectId) {
      console.log('🔧 Initializing EAS project...');
      runCommand('npx eas init', 'EAS project initialization');
    }
  } catch (error) {
    console.log('🔧 Initializing EAS project...');
    runCommand('npx eas init', 'EAS project initialization');
  }

  // Build the APK
  console.log('\n📱 Building Beta APK...');
  console.log('This may take 10-15 minutes for the first build...');
  runCommand('npx eas build --profile beta --platform android --non-interactive', 'Beta APK build');

  console.log('\n🎉 Beta APK Build Complete!');
  console.log('===============================');
  console.log('📥 Your APK download link is shown above');
  console.log('📱 Share this link with your beta testers');
  console.log('🔄 Future builds will be faster (incremental updates)');
  console.log('\n💡 Next steps:');
  console.log('1. Test the APK on your device');
  console.log('2. Share with beta testers');
  console.log('3. Deploy your Railway backend');
  console.log('4. Update API URL with: node ../deployment-setup.js <railway-url>');
}

// Run the build process
buildBetaAPK();