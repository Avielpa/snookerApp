# 🚀 MaxBreak Snooker App - Deployment Guide

This guide covers the complete deployment process for the MaxBreak Snooker app to both iOS App Store and Google Play Store.

## 📋 Prerequisites

### Required Accounts
- [ ] Apple Developer Account ($99/year)
- [ ] Google Play Console Account ($25 one-time)
- [ ] Expo Account (free)

### Required Tools
- [ ] Node.js (v16+)
- [ ] Expo CLI (`npm install -g @expo/cli`)
- [ ] EAS CLI (`npm install -g eas-cli`)

## 🔧 Setup & Configuration

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your actual values
```

### 3. Login to Expo
```bash
npx expo login
eas login
```

## 📱 iOS Deployment

### Step 1: Configure Apple Developer Account
1. Add your Apple ID to `eas.json`:
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-apple-id@example.com",
        "ascAppId": "your-app-store-connect-app-id",
        "appleTeamId": "your-apple-team-id"
      }
    }
  }
}
```

### Step 2: Build for iOS
```bash
# Production build
eas build --platform ios --profile production

# Preview build for testing
eas build --platform ios --profile preview
```

### Step 3: Submit to App Store
```bash
eas submit --platform ios --profile production
```

### Step 4: App Store Connect Setup
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Create new app with details:
   - **Name**: MaxBreak Snooker
   - **Bundle ID**: com.avielpahima.maxbreaksnooker
   - **Category**: Sports
   - **Price**: Free

3. Fill in metadata:
   - **Description**: The ultimate snooker app for live tournaments, player rankings, and match tracking
   - **Keywords**: snooker, billiards, sports, tournament, ranking
   - **Screenshots**: Required sizes for different devices
   - **App Icon**: 1024x1024 PNG

## 🤖 Android Deployment

### Step 1: Create Keystore
```bash
eas credentials:configure --platform android
```

### Step 2: Build for Android
```bash
# AAB for Play Store
eas build --platform android --profile production-aab

# APK for testing
eas build --platform android --profile production
```

### Step 3: Submit to Google Play
```bash
eas submit --platform android --profile production
```

### Step 4: Google Play Console Setup
1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app:
   - **App name**: MaxBreak Snooker
   - **Package name**: com.avielpahima.maxbreaksnooker
   - **Category**: Sports

3. Fill in store listing:
   - **Short description**: Ultimate snooker tournament tracking app
   - **Full description**: Comprehensive description with features
   - **Graphics**: Screenshots, feature graphic, app icon

## 🔄 Update Process

### Version Updates
1. Update version in `app.json`:
```json
{
  "expo": {
    "version": "1.0.1"
  }
}
```

2. Build and submit:
```bash
eas build --platform all --profile production
eas submit --platform all --profile production
```

## 📊 App Store Requirements

### iOS App Store
- [ ] App icon (1024x1024)
- [ ] Screenshots (multiple sizes)
- [ ] App description
- [ ] Privacy policy URL
- [ ] Support URL
- [ ] Age rating
- [ ] App review information

### Google Play Store
- [ ] App icon (512x512)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (multiple sizes)
- [ ] App description
- [ ] Privacy policy URL
- [ ] Content rating
- [ ] Target audience

## 🛡️ Security & Privacy

### Required Configurations
1. **App Transport Security** (iOS):
   - Already configured in `app.json`
   - Allows HTTPS connections to backend

2. **Network Permissions** (Android):
   - Already configured in `app.json`
   - INTERNET and ACCESS_NETWORK_STATE

3. **Privacy Policy**:
   - Required for both stores
   - Must be accessible via URL

## 🚨 Common Issues & Solutions

### Build Failures
```bash
# Clear Expo cache
npx expo r -c

# Clear EAS cache
eas build --clear-cache

# Re-install dependencies
rm -rf node_modules package-lock.json
npm install
```

### Submission Rejections
- **iOS**: Check App Store Review Guidelines
- **Android**: Check Google Play Policy
- Common issues: Missing metadata, inappropriate content, broken functionality

### Certificate Issues
```bash
# Reset iOS credentials
eas credentials:configure --platform ios

# Reset Android credentials
eas credentials:configure --platform android
```

## 📈 Post-Launch

### Monitoring
- [ ] Set up crash reporting (Sentry)
- [ ] Monitor app performance
- [ ] Track user analytics
- [ ] Monitor backend API usage

### Updates
- [ ] Regular feature updates
- [ ] Bug fixes
- [ ] Performance improvements
- [ ] New tournament data

## 📞 Support

### Resources
- [Expo Documentation](https://docs.expo.dev/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/about/developer-content-policy/)

### Troubleshooting
1. Check build logs in Expo dashboard
2. Verify all credentials are correct
3. Ensure app meets store requirements
4. Test on real devices before submission

---

🎱 **MaxBreak Snooker App** - Ready for the world's app stores!