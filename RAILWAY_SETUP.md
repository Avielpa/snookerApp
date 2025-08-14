# 🚀 Railway Deployment Guide - Simple & Complete

## What This Sets Up:
- **Main Django API** - Your snooker app backend
- **Live Match Updates** - Automatic score updates every 2 minutes
- **Daily Data Updates** - Rankings, tournaments, players
- **PostgreSQL Database** - Provided by Railway

---

## Quick Deploy Steps:

### 1. Deploy to Railway
```bash
# Push your changes first
git add .
git commit -m "Add Railway configuration"
git push origin master

# Then deploy (Railway will auto-detect from your GitHub repo)
```

### 2. Add PostgreSQL Database
1. In Railway dashboard → Add service → PostgreSQL
2. Railway automatically provides these environment variables:
   - `PGDATABASE`
   - `PGUSER` 
   - `PGPASSWORD`
   - `PGHOST`
   - `PGPORT`

### 3. Configure Your Main Service
Your web service is ready! Railway will run:
```bash
cd maxBreak && python manage.py migrate && python manage.py collectstatic --noinput && gunicorn maxBreak.wsgi:application --bind 0.0.0.0:$PORT
```

---

## ⏰ Set Up Automated Tasks

Railway supports scheduled tasks (cron jobs). Create these separate services:

### Live Match Monitor (Continuous)
1. **Create new service** → Deploy from same GitHub repo
2. **Settings** → **Command Override**: `cd maxBreak && python manage.py auto_live_monitor`
3. **Settings** → **Service Name**: `live-monitor`
4. This runs 24/7, updating live matches every 2 minutes

### Daily Rankings Update
1. **Create new service** → Deploy from same GitHub repo  
2. **Settings** → **Command Override**: `cd maxBreak && python manage.py update_rankings --ranking-type all`
3. **Settings** → **Cron Schedule**: `0 2 * * *` (daily at 2 AM)
4. **Settings** → **Service Name**: `daily-rankings`

### Daily Tournaments Update
1. **Create new service** → Deploy from same GitHub repo
2. **Settings** → **Command Override**: `cd maxBreak && python manage.py update_tournaments --tour all --season 2025`
3. **Settings** → **Cron Schedule**: `0 3 * * *` (daily at 3 AM)  
4. **Settings** → **Service Name**: `daily-tournaments`

### Weekly Player Update
1. **Create new service** → Deploy from same GitHub repo
2. **Settings** → **Command Override**: `cd maxBreak && python manage.py update_players --status pro --sex men`
3. **Settings** → **Cron Schedule**: `0 4 * * 0` (weekly on Sunday at 4 AM)
4. **Settings** → **Service Name**: `weekly-players`

---

## 🎯 Final Result:
- ✅ **Web API**: Always running, serving your frontend
- ✅ **Live Matches**: Auto-update every 2 minutes during tournaments
- ✅ **Rankings**: Updated daily at 2 AM
- ✅ **Tournaments**: Updated daily at 3 AM  
- ✅ **Players**: Updated weekly on Sundays
- ✅ **Database**: PostgreSQL managed by Railway

**Users get live scores automatically without any manual work from you!**

---

## 🔍 Monitor Your Services:
```bash
# Check logs for any service
railway logs --service web
railway logs --service live-monitor
railway logs --service daily-rankings
```

That's it! Your snooker app is now fully automated on Railway.