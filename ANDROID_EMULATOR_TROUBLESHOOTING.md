# Android Emulator Troubleshooting Guide

## Common Issue: App Works on Physical Device But Not on Emulator

This is a very common issue with React Native/Expo apps. Here are the most effective solutions:

## 🔧 Quick Fixes (Try These First)

### 1. **Environment Configuration Fix**
The app now automatically detects emulator vs physical device and provides specific diagnostics.

**Check your `.env` file:**
```bash
# Current configuration (should work for both)
EXPO_PUBLIC_API_BASE_URL=https://snookerapp.up.railway.app/oneFourSeven/
```

### 2. **Restart Emulator with Network Settings**
```bash
# Close emulator completely
# Restart with DNS settings:
emulator -avd YOUR_AVD_NAME -dns-server 8.8.8.8,8.8.4.4
```

### 3. **Clear Emulator Data**
- Open Android Studio
- Go to AVD Manager
- Click "Wipe Data" for your emulator
- Restart emulator

## 🔍 Diagnostic Information

The app now includes automatic emulator detection and diagnostics:

1. **Check Logs**: Look for `[EmulatorDebug]` messages in your console
2. **Environment Logging**: App logs current configuration on startup
3. **Network Testing**: Automatically tests multiple connectivity endpoints

## 🛠️ Advanced Troubleshooting

### Network Connectivity Issues

#### Problem: Cannot Reach Railway Backend
**Symptoms:**
- Works on physical device
- Fails on emulator with "Network Error"

**Solutions:**
1. **Check Emulator Internet Access:**
   ```bash
   # In emulator terminal/browser, try accessing:
   https://google.com
   https://snookerapp.up.railway.app/oneFourSeven/events/
   ```

2. **Enable Network Access in AVD:**
   - Open AVD Manager
   - Edit your AVD
   - Show Advanced Settings
   - Network → Speed: Full
   - Network → Latency: None

3. **Proxy Settings:**
   ```bash
   # If behind corporate firewall
   emulator -avd YOUR_AVD -http-proxy http://proxy:port
   ```

#### Problem: Localhost Development
**For local Django development:**

1. **Update Environment:**
   ```bash
   # Change .env to:
   EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:8000/oneFourSeven/
   ```

2. **Start Django Server:**
   ```bash
   # Make sure Django server allows external connections
   python manage.py runserver 0.0.0.0:8000
   ```

3. **Test Connectivity:**
   ```bash
   # In emulator browser, test:
   http://10.0.2.2:8000/oneFourSeven/events/
   ```

### Emulator Performance Issues

#### Cold Boot
```bash
# Complete restart
adb kill-server
adb start-server
# Then restart emulator
```

#### Memory and CPU
- Allocate more RAM to emulator (4GB minimum)
- Enable Hardware Acceleration (Intel HAXM/AMD)
- Use API level 30 or higher

### Google Play Services
```bash
# Install Google Play Services in emulator
# Use "Google Play" system images, not "Google APIs"
```

## 🔍 Network Testing URLs

The app automatically tests these endpoints:

1. **Railway Production:** `https://snookerapp.up.railway.app/oneFourSeven/events/`
2. **Localhost (Emulator):** `http://10.0.2.2:8000/oneFourSeven/events/`
3. **Google DNS:** `https://8.8.8.8`
4. **External API:** `https://httpbin.org/json`

## 🚨 Common Error Messages

### "Network Error"
- **On Emulator:** Usually network configuration issue
- **On Physical Device:** Usually Railway backend or internet connectivity

### "Connection Refused"
- **Localhost:** Django server not running or wrong port
- **Railway:** Backend temporarily down

### "Timeout"
- **Emulator:** Slow network simulation
- **Physical Device:** Poor internet connection

## 🔧 Manual Testing

### Test API Directly in Emulator Browser
1. Open browser in emulator
2. Navigate to: `https://snookerapp.up.railway.app/oneFourSeven/events/`
3. Should show JSON response

### Test Environment Variables
1. Check app logs for: `[EmulatorDebug] === ENVIRONMENT CONFIG ===`
2. Verify `EXPO_PUBLIC_API_BASE_URL` is set correctly

### Test App Diagnostics
1. Open app in emulator
2. Check logs for: `[HomeScreen] 📱 Android emulator detected`
3. Look for diagnostic results and recommendations

## 📱 Emulator Alternatives

If emulator continues to have issues:

1. **Use Physical Device:**
   ```bash
   # Enable USB debugging
   # Connect via USB
   npm run android
   ```

2. **Use Expo Go:**
   ```bash
   npx expo start
   # Scan QR code with Expo Go app
   ```

3. **Use Web Version:**
   ```bash
   npm run web
   ```

## 🔍 Debug Commands

### Check Emulator Network
```bash
# In emulator terminal
ping 8.8.8.8
curl https://google.com
curl https://snookerapp.up.railway.app/oneFourSeven/events/
```

### Check App Environment
The app logs environment details automatically. Look for:
```
[EmulatorDebug] === ENVIRONMENT CONFIG ===
[EmulatorDebug] Is Emulator: true
[EmulatorDebug] API URL: https://snookerapp.up.railway.app/oneFourSeven/
```

### Force Environment Override
```javascript
// Temporary override in api.ts for testing
const API_BASE_URL = 'https://snookerapp.up.railway.app/oneFourSeven/';
```

## ✅ Success Indicators

When everything works correctly, you should see:
```
[HomeScreen] ✅ Emulator configuration looks good
[TourService] Successfully fetched X events
[CalendarEnhanced] Loaded X main tournaments
```

## 🚀 Production Deployment

For final builds, ensure:
```bash
EXPO_PUBLIC_API_BASE_URL=https://snookerapp.up.railway.app/oneFourSeven/
```

This configuration works for:
- Physical devices (all networks)
- Emulators (with internet access)
- Production builds
- Development builds

## 📞 Additional Support

If issues persist:
1. Check Railway backend status: https://snookerapp.up.railway.app/oneFourSeven/events/
2. Review emulator logs in Android Studio
3. Try different AVD configurations
4. Test on multiple emulator API levels

The app now provides comprehensive diagnostics automatically, so check the logs first for specific guidance on your setup.