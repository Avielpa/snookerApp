@echo off
echo 🚀 MaxBreak Snooker APK Builder
echo ================================
echo Email: aviel107pahima@gmail.com
echo Railway URL: https://snookerapp.up.railway.app/
echo.

echo 📦 Step 1: Installing EAS CLI...
npm install -g @expo/eas-cli

echo.
echo 🔐 Step 2: Login to EAS...
echo Please login with: aviel107pahima@gmail.com
eas login

echo.
echo 📱 Step 3: Building APK...
echo This will take 10-15 minutes...
eas build --profile beta --platform android --non-interactive

echo.
echo 🎉 APK Build Complete!
echo Your download link will be shown above.
echo Share this link to install on any Android device.
pause