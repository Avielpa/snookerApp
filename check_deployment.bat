@echo off
echo 🔍 Checking Live Monitor Deployment Status...
echo.

echo Current Railway services:
railway service list
echo.

echo Checking live-monitor service status:
railway status --service live-monitor
echo.

echo Recent logs from live-monitor:
railway logs --service live-monitor --tail 20
echo.

echo 📊 If you see "🚀 Starting Intelligent Live Match Monitor" in the logs above,
echo then your live match system is working!
echo.
pause