@echo off
echo 🚀 Deploying Live Match Monitor to Railway...
echo.

echo Step 1: Make sure we're in the right directory...
cd /d "C:\Users\Aviel\vsprojects\snookerApp"
echo Current directory: %cd%
echo.

echo Step 2: Creating live-monitor service...
railway service create live-monitor
echo.

echo Step 3: Linking to the live-monitor service...
railway link --service live-monitor
echo.

echo Step 4: Setting up environment variables...
echo Setting DJANGO_SETTINGS_MODULE...
railway variables set DJANGO_SETTINGS_MODULE=maxBreak.settings

echo Setting PORT...
railway variables set PORT=8000
echo.

echo Step 5: Deploying the live monitor...
railway up --service live-monitor
echo.

echo ✅ Deployment complete!
echo.
echo 🎯 Your live match monitor is now running!
echo.
echo Next steps:
echo 1. Go to https://railway.app/dashboard
echo 2. Click on your 'live-monitor' service
echo 3. Check the logs to see if it's working
echo 4. You should see: "🚀 Starting Intelligent Live Match Monitor"
echo.
echo 🎉 Your live match updates should now work automatically!
echo Matches will show as live within 2-5 minutes of starting.
echo.
pause