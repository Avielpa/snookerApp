# Snooker App - Setup and Development Guide

## Issues Fixed

### 1. ✅ Frontend API Configuration
- **Problem**: API calls were failing due to incorrect base URL configuration
- **Solution**: Updated `services/api.ts` to use `localhost:8000` for development
- **Files Modified**: `FrontMaxBreak/services/api.ts`

### 2. ✅ Django Server Configuration  
- **Problem**: CORS and ALLOWED_HOSTS configuration preventing frontend connections
- **Solution**: Updated Django settings for development environment
- **Files Modified**: `maxBreak/maxBreak/settings.py`

### 3. ✅ Missing Environment Configuration
- **Problem**: Missing .env file and globals.css for NativeWind
- **Solution**: Created proper development environment files
- **Files Created**: `FrontMaxBreak/.env`, `FrontMaxBreak/app/globals.css`

### 4. ✅ Development Startup Scripts
- **Problem**: Complex setup process for running both backend and frontend
- **Solution**: Created simple startup scripts
- **Files Created**: `start_backend.cmd`, `start_frontend.cmd`

## Development Setup Instructions

### Step 1: Start Django Backend

#### Option A: Using Startup Script (Recommended)
1. Double-click `start_backend.cmd`
2. Wait for the message "Starting development server at http://0.0.0.0:8000/"

#### Option B: Manual Command
1. Open Command Prompt
2. Navigate to the project directory:
   ```cmd
   cd "C:\Users\Aviel\vsprojects\snookerApp\maxBreak"
   ```
3. Activate virtual environment and start server:
   ```cmd
   "C:\Users\Aviel\vsprojects\snookerApp\venv\Scripts\activate"
   python manage.py runserver 0.0.0.0:8000
   ```

### Step 2: Verify Backend is Running
1. Open browser and go to: `http://localhost:8000/oneFourSeven/debug/status/`
2. You should see JSON response with database information
3. Check that events count is > 0

### Step 3: Start React Native Frontend

#### Option A: Using Startup Script (Recommended)
1. Double-click `start_frontend.cmd`
2. Wait for Metro bundler to start

#### Option B: Manual Command
1. Open new Command Prompt
2. Navigate to frontend directory:
   ```cmd
   cd "C:\Users\Aviel\vsprojects\snookerApp\FrontMaxBreak"
   ```
3. Start the development server:
   ```cmd
   npm start
   ```

### Step 4: Run the App
1. After Metro bundler starts, you'll see options:
   - Press `w` for web browser
   - Press `a` for Android emulator  
   - Press `i` for iOS simulator
   - Scan QR code with Expo Go app on your phone

## Testing the Fixes

### 1. Test Backend API
Open these URLs in your browser to verify backend is working:
- `http://localhost:8000/oneFourSeven/debug/status/` - System status
- `http://localhost:8000/oneFourSeven/events/` - List of tournaments
- `http://localhost:8000/oneFourSeven/events/1/matches/` - Matches for event ID 1

### 2. Test Frontend
1. Start the app using Step 3 above
2. Check that the home screen loads properly
3. Verify that tournament and match data appears
4. Test the filter buttons (All, Live, Break, Upcoming, Results)
5. Try refreshing the data by pulling down

## Common Issues and Solutions

### Issue: "Connection Error - Server not responding"
- **Cause**: Django backend is not running
- **Solution**: Make sure Django server is started (Step 1)
- **Check**: Visit `http://localhost:8000/oneFourSeven/debug/status/` in browser

### Issue: "No active tournament" or empty match list
- **Cause**: No events in database or incorrect date filtering
- **Solution**: Update database or check event dates
- **Check**: Run `python populate_db.py` to update tournament data

### Issue: Metro bundler won't start
- **Cause**: Port already in use or node_modules issues
- **Solution**: 
  1. Kill any running Metro processes
  2. Delete node_modules and reinstall: `npm install`
  3. Clear Metro cache: `npx expo start -c`

### Issue: Android emulator can't connect to backend
- **Cause**: Android emulator uses different localhost mapping (10.0.2.2 → host localhost)
- **Solution**: ✅ ALREADY CONFIGURED - API uses `http://10.0.2.2:8000/oneFourSeven/`
- **Additional Check**: Make sure Django server runs with `0.0.0.0:8000` (not just `127.0.0.1:8000`)

## Production Deployment Checklist

### Backend (Django)
- [ ] Update `ALLOWED_HOSTS` in settings.py
- [ ] Set `DEBUG = False`
- [ ] Configure proper CORS settings
- [ ] Set up proper database (PostgreSQL)
- [ ] Configure static files serving
- [ ] Set up environment variables for secrets

### Frontend (React Native)
- [ ] Update API_BASE_URL to production backend URL
- [ ] Test on actual devices
- [ ] Configure app signing
- [ ] Update app store metadata
- [ ] Test offline functionality

## File Structure Summary

```
snookerApp/
├── maxBreak/              # Django Backend
│   ├── manage.py
│   ├── maxBreak/settings.py
│   └── oneFourSeven/      # Main app
├── FrontMaxBreak/         # React Native Frontend
│   ├── app/               # App screens
│   ├── services/          # API services
│   ├── .env              # Environment config
│   └── package.json
├── start_backend.cmd      # Backend startup script
├── start_frontend.cmd     # Frontend startup script
└── SETUP_GUIDE.md        # This file
```

## Next Steps

1. Run both backend and frontend using the startup scripts
2. Test all functionality works correctly
3. If deploying, follow the production checklist
4. Consider adding more robust error handling and logging

For any issues not covered here, check the detailed logs in both the Django server output and Metro bundler console.