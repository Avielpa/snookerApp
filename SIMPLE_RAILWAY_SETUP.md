# 🚀 Simple Railway Setup for Live Match Updates

This will fix your live match problem in just a few steps.

## Step 1: Deploy to Railway (Copy and Paste These Commands)

Open your terminal in the project folder and run these commands **one by one**:

```bash
# Make sure you're in the right folder
cd C:\Users\Aviel\vsprojects\snookerApp

# Deploy your main web app (if not already deployed)
railway up

# Create and deploy the live match monitor
railway service create live-monitor
railway link --service live-monitor
railway up --service live-monitor
```

## Step 2: Set Environment Variables in Railway Dashboard

1. Go to your Railway dashboard: https://railway.app/dashboard
2. Click on your `live-monitor` service
3. Go to the **Variables** tab
4. Add these variables (click **+ New Variable** for each):

```
DJANGO_SETTINGS_MODULE = maxBreak.settings
DATABASE_URL = (copy from your main web service)
PORT = 8000
```

## Step 3: Test It's Working

In your Railway dashboard:
1. Click on your `live-monitor` service
2. Go to the **Deployments** tab
3. Click on the latest deployment
4. Check the logs - you should see:

```
🚀 Starting Intelligent Live Match Monitor
=== Live Monitor Check at 14:30:15 ===
📅 Checking tournaments...
```

## Step 4: Verify Live Matches Work

1. Wait for a tournament with matches scheduled
2. Check your mobile app 2-5 minutes after match start time
3. Matches should now show as "LIVE" automatically

## If Something Goes Wrong:

### Problem: Service won't start
**Solution:** Check the logs in Railway dashboard, usually it's a missing environment variable

### Problem: No live matches detected  
**Solution:** Run this test command in Railway console:
```bash
cd maxBreak && python manage.py smart_live_update --force
```

### Problem: Too many API requests
**Solution:** The system automatically handles rate limiting, but you can slow it down:
```bash
# In Railway, redeploy with slower intervals
railway up --service live-monitor
# The system will use slower intervals automatically during quiet periods
```

## That's It! 🎉

Your live match update problem should now be solved. The system will:
- ✅ Run continuously in the background
- ✅ Check for live matches every 2 minutes during active periods  
- ✅ Automatically update match statuses
- ✅ Handle API rate limits
- ✅ Work with your Israeli timezone

No more manual updates needed!