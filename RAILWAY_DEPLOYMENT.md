# Railway Live Monitoring Deployment Guide

## 🚀 Automatic Live Score Updates Setup

### What This Does:
- **Automatically detects matches 30 minutes before they start**
- **Updates scores every 2 minutes during live matches**  
- **Works for ALL tournaments (World Games, Saudi Arabia Masters, etc.)**
- **No manual intervention required**

---

## Railway Configuration Steps:

### 1. **Push Your Code**
```bash
git add .
git commit -m "Add automatic live monitoring system"
git push origin master
```

### 2. **Railway Dashboard Configuration**
1. Go to your Railway project dashboard
2. **Settings** → **Environment** → **Services**
3. Enable **TWO services**:
   - `web` - Your main Django app
   - `live_monitor` - Background live score updates

### 3. **Verify Services Are Running**
In Railway logs, you should see:
```
[web] Starting Django server...
[live_monitor] [START] AUTO LIVE MONITOR STARTING...
[live_monitor] [CHECK] Checking at 2025-08-14 19:00:00
```

---

## 🕐 19:30 ISR Match Timeline:

| Time | Action |
|------|--------|
| **19:00** | Monitor starts detecting (30 min before) |
| **19:30** | Match begins, status → Live |
| **19:32** | First live score update |
| **19:34** | Score updates every 2 minutes |
| **19:36** | Continues until match ends |
| **23:30** | Stops monitoring (4 hours max) |

---

## ✅ What Works Automatically:

- ✅ **Saudi Arabia Masters** - Currently detecting 2 live matches
- ✅ **World Games (Men & Women)** - All matches tracked  
- ✅ **All Tournament Types** - main/other/seniors/womens
- ✅ **Score Updates** - Every 2 minutes during matches
- ✅ **Smart Scheduling** - Sleeps when no active tournaments
- ✅ **Error Recovery** - Auto-restart with exponential backoff

---

## 🔍 Monitoring Commands:

```bash
# Check if live monitor is working
railway logs --service live_monitor

# Manual test (if needed)
python manage.py auto_live_monitor --active-interval 120
```

---

## 🎯 Result:
**Users will see live scores update automatically without any manual commands from you!**

The system is now fully automated - it will detect evening matches at 19:30 ISR and keep scores updated throughout the matches.