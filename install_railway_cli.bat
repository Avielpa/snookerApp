@echo off
echo 🚀 Installing Railway CLI...
echo.

echo Checking if npm is available...
npm --version >nul 2>&1
if %errorlevel% == 0 (
    echo ✅ npm found! Installing Railway CLI...
    npm install -g @railway/cli
    echo.
    echo ✅ Railway CLI installed!
    echo.
    echo Now run: railway login
    echo Then run the setup_railway.bat script again
) else (
    echo ❌ npm not found. 
    echo.
    echo Please install Railway CLI manually:
    echo 1. Go to: https://docs.railway.app/develop/cli#installation
    echo 2. Download Railway CLI for Windows
    echo 3. Install it
    echo 4. Then run setup_railway.bat again
)

echo.
pause