# 🚀 Install Railway CLI First

You need to install Railway CLI before running the setup.

## Step 1: Install Railway CLI

**Option A: Using npm (if you have Node.js)**
```bash
npm install -g @railway/cli
```

**Option B: Download directly from Railway**
1. Go to: https://docs.railway.app/develop/cli#installation
2. Download Railway CLI for Windows
3. Install it

**Option C: Using PowerShell (Easiest)**
Open PowerShell as Administrator and run:
```powershell
iwr -useb https://railway.app/install.ps1 | iex
```

## Step 2: Login to Railway
```bash
railway login
```

## Step 3: Navigate to Your Project
```bash
cd C:\Users\Aviel\vsprojects\snookerApp
```

## Step 4: Run the Setup Script Again
Double-click `setup_railway.bat`

---

## Alternative: Manual Railway Setup (If CLI doesn't work)

### Go to Railway Dashboard Instead:
1. Go to https://railway.app/dashboard
2. Click **"New Project"**  
3. Click **"Deploy from GitHub repo"**
4. Select your snookerApp repository
5. After it deploys, go to **Settings** → **Environment**
6. Add these variables:
   ```
   DJANGO_SETTINGS_MODULE = maxBreak.settings
   DATABASE_URL = (your database URL)
   ```

### Then Create the Live Monitor Service:
1. In your project, click **"+ New Service"**
2. Select **"GitHub Repo"** (same repo)
3. Name it `live-monitor`
4. Go to Settings → **Start Command**
5. Set start command to:
   ```
   cd maxBreak && python manage.py intelligent_live_monitor
   ```
6. Add the same environment variables

This will solve your live match update problem! 🎯