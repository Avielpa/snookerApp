@echo off
echo 🚀 Setting up Railway Live Match Monitor...
echo.

echo Step 1: Creating live-monitor service...
railway service create live-monitor

echo.
echo Step 2: Linking to live-monitor service...
railway link --service live-monitor

echo.
echo Step 3: Deploying live-monitor...
railway up --service live-monitor

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Go to railway.app/dashboard
echo 2. Click on 'live-monitor' service
echo 3. Go to Variables tab
echo 4. Add these variables:
echo    DJANGO_SETTINGS_MODULE = maxBreak.settings
echo    DATABASE_URL = (copy from your main service)
echo    PORT = 8000
echo.
echo 🎉 Your live match updates will work automatically after this!
pause