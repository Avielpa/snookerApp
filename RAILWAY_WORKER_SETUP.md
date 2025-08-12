# Railway Comprehensive Data Scheduler Guide

## What Changed

I've created a complete automated data management system for your snooker app:

### 🔧 **Mobile App Fixes**
- ✅ **API URL Fixed**: Changed from local `http://10.0.2.2:8000` to production `https://snookerapp.up.railway.app/oneFourSeven/`
- ✅ **Environment Variables**: Properly configured for production APK builds
- ✅ **Dynamic Configuration**: App now uses environment variables correctly

### 🚀 **Comprehensive Scheduler System**
- ✅ **Live Matches**: Every minute when tournaments have active matches
- ✅ **Match Updates**: When tournaments start/end + daily during active tournaments
- ✅ **Round Details**: When new tournaments start
- ✅ **Rankings**: Weekly + after major tournaments end
- ✅ **Tournaments**: Once per season + when season changes
- ✅ **Players**: Every 3 months
- ✅ **Season Detection**: Daily check for season transitions

## Railway Worker Setup

After your next deployment, you need to enable the worker in Railway:

### Step 1: Go to Railway Dashboard
1. Visit [railway.app](https://railway.app) 
2. Go to your `snookerapp` project

### Step 2: Enable Worker Process
1. Click on your service
2. Go to **Settings** tab
3. Look for **Processes** section
4. You should see:
   - `web` (already enabled)
   - `worker` (needs to be enabled)
5. **Enable the `worker` process**

### Step 3: Verify It's Working
Check the logs in Railway dashboard:
- You should see: `🚀 Starting Live Match Updater...`
- Every minute: `⏰ [HH:MM:SS] Running smart live update...`
- When active matches exist: `✅ [HH:MM:SS] Live update completed`
- When no matches: `No active tournaments found. Skipping live update to save resources.`

## How It Works

1. **Worker Process**: Runs `comprehensive_scheduler.py` continuously in the background
2. **Intelligent Scheduling**: Each data type updates based on tournament lifecycle:
   - **Live Matches**: Every minute (only when matches are actually running)
   - **Match Data**: When tournaments start/end + daily during active tournaments
   - **Round Details**: When new tournaments are detected
   - **Rankings**: Weekly + after major tournaments conclude
   - **Tournaments**: Once per season + when season transitions (Aug→Sep)
   - **Players**: Every 3 months (pros change rarely)
   - **Season Detection**: Daily check (snooker season: Aug-May)
3. **Smart Detection**: Only runs updates when actually needed - saves resources
4. **Tournament Lifecycle**: Understands when tournaments start, are active, or finish
5. **Season Awareness**: Automatically detects August→September season transition

## Benefits

- ✅ **Fully Automated**: Complete data management with zero manual work
- ✅ **Tournament-Aware**: Updates based on actual tournament lifecycle
- ✅ **Real-time Live Data**: Match scores update every minute during active matches
- ✅ **Season Intelligence**: Automatically handles season transitions
- ✅ **Resource Efficient**: Only runs updates when actually needed
- ✅ **Professional Quality**: Rankings, tournaments, and players stay current
- ✅ **No Railway Redeployments**: Commands run inside existing container
- ✅ **Reliable**: Robust error handling prevents service disruption

## New APK

The new APK build is in progress. Once complete, you'll get a new download link with:
- ✅ Working tabs and navigation
- ✅ Real-time data from Railway API
- ✅ Proper production configuration
- ✅ All features working on mobile devices

## Monitoring

You can monitor all automated updates in Railway logs:
- Go to your Railway project → your service → **Logs** tab

### Expected Log Messages:
```
🚀 Starting Comprehensive Snooker Data Scheduler...
📊 Schedule:
   • Live matches: Every minute (when active)
   • Match updates: Tournament start/end + daily during active
   • Round details: When tournaments start
   • Rankings: Weekly + after major tournaments
   • Tournaments: Once per season
   • Players: Every 3 months
   • Season detection: Daily
🏆 Scheduler initialized for season 2025

🕐 [14:30:15] Running scheduler cycle...
🔄 Updating live matches...
✅ Live matches updated successfully
✅ [14:30:15] Completed updates: live_matches

⏭️  [14:31:15] No updates needed - all data current
```

### Update Indicators:
- `✅ Completed updates: live_matches` = Live scores updated
- `✅ Completed updates: match_updates` = Tournament matches updated
- `✅ Completed updates: rankings` = Rankings refreshed
- `✅ Completed updates: tournaments` = New season tournaments loaded
- `🎉 Season transition detected` = New season started (Aug→Sep)