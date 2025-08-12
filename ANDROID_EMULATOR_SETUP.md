# 📱 Android Emulator Setup - Fixed Configuration

## ✅ Issues Fixed for Android Emulator

### 1. API Base URL Configuration
**Fixed**: Changed from `localhost` to `10.0.2.2` for Android emulator compatibility

**Files Updated**:
- `FrontMaxBreak/services/api.ts` 
- `FrontMaxBreak/.env`

**Configuration**:
```javascript
// Now uses Android emulator localhost mapping
const API_BASE_URL = 'http://10.0.2.2:8000/oneFourSeven/'
```

### 2. Django Server Configuration
**Fixed**: Added `10.0.2.2` to ALLOWED_HOSTS and updated CORS settings

**File Updated**: `maxBreak/maxBreak/settings.py`

**Configuration**:
```python
ALLOWED_HOSTS = ['10.0.2.2', '127.0.0.1', 'localhost', '*']

CORS_ALLOWED_ORIGINS = [
    "http://10.0.2.2:19006",  # Android emulator
    "http://localhost:19006",
    # ... other origins
]
```

### 3. Server Startup
**Fixed**: Django server now binds to `0.0.0.0:8000` instead of `127.0.0.1:8000`

**Command**: 
```bash
python manage.py runserver 0.0.0.0:8000
```

## 🚀 How to Run with Android Emulator

### Step 1: Start Django Backend
```bash
cd maxBreak
python manage.py runserver 0.0.0.0:8000
```
**Important**: Must use `0.0.0.0:8000` not `127.0.0.1:8000`

### Step 2: Verify Backend is Working
Test in browser: http://localhost:8000/oneFourSeven/debug/status/

### Step 3: Start React Native App
```bash
cd FrontMaxBreak
npm start
```

### Step 4: Run in Android Emulator
1. Press `a` in Metro bundler
2. Or scan QR code with physical Android device
3. App will connect to `http://10.0.2.2:8000/oneFourSeven/`

## 🔧 Network Mapping Explained

| Platform | Address | Maps to |
|----------|---------|---------|
| Browser/Web | `localhost:8000` | Host machine |
| Android Emulator | `10.0.2.2:8000` | Host machine |
| iOS Simulator | `localhost:8000` | Host machine |
| Physical Device | `192.168.x.x:8000` | Host machine IP |

## 🧪 Testing the Connection

### Quick Test in Browser
Visit: http://localhost:8000/oneFourSeven/debug/status/

Should return JSON with database status.

### Test from Android App
The app logs should show:
```
[API Setup] Using API Base URL: http://10.0.2.2:8000/oneFourSeven/
```

### Verify Data Loading
1. Home screen should load tournament data
2. Matches should appear with proper filtering
3. No "Network Error" messages

## ❗ Troubleshooting

### "Network Error" in Android Emulator
1. **Check Django Server**: Must run with `0.0.0.0:8000`
2. **Check URL**: App should use `10.0.2.2:8000`
3. **Check Firewall**: Windows Firewall might block connections
4. **Restart Emulator**: Sometimes emulator networking needs reset

### "Connection Refused"
```bash
# Make sure server is running
python manage.py runserver 0.0.0.0:8000

# Check if port is in use
netstat -an | findstr :8000
```

### Still Not Working?
1. Try restarting Android emulator
2. Try `npm start -- --reset-cache`
3. Check if antivirus/firewall blocking port 8000
4. Verify emulator can access internet (open browser in emulator)

## 📋 Configuration Summary

All these settings are now properly configured:

- ✅ API Base URL: `http://10.0.2.2:8000/oneFourSeven/`
- ✅ Django ALLOWED_HOSTS: includes `10.0.2.2`
- ✅ CORS Settings: allows Android emulator origin
- ✅ Server Binding: `0.0.0.0:8000` (accessible from emulator)
- ✅ Environment Files: `.env` configured for development

Your Android emulator should now successfully connect to the Django backend and load tournament/match data properly! 🎉