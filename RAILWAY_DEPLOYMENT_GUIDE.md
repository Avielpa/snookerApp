# MaxBreak Snooker App - Railway Deployment Guide

## 🚀 Complete Deployment Instructions

Your MaxBreak Snooker App is ready for Railway deployment! This guide will walk you through the entire process.

## Prerequisites
- Railway account (sign up at railway.app)
- Railway CLI installed: `npm install -g @railway/cli`
- EAS CLI installed: `npm install -g @expo/eas-cli`

## Part 1: Backend Deployment (Django on Railway)

### Step 1: Deploy to Railway

```bash
# Login to Railway
railway login

# Initialize Railway project in your Django directory
cd maxBreak
railway init

# Set environment variables
railway variables set DJANGO_SETTINGS_MODULE=maxBreak.production
railway variables set RAILWAY_ENVIRONMENT=production
railway variables set DEBUG=False

# Deploy your app
railway up
```

### Step 2: Initialize Your Database

```bash
# Run the Railway initialization (quick setup - 2 minutes)
railway run python manage.py railway_init --quick

# Or for full setup with all data (8 minutes)
railway run python manage.py railway_init
```

### Step 3: Set Up Automatic Updates

Your `railway.toml` is already configured with intelligent scheduling:
- **Smart Live Updates**: Every 1 minute (only when tournaments are active)
- **Daily Maintenance**: 6 AM UTC (update recent tournaments/matches)
- **Weekly Refresh**: Sunday 4 AM UTC (comprehensive data update)

### Step 4: Test Your Backend

Visit your Railway URL to test endpoints:
- `https://your-app.up.railway.app/oneFourSeven/calendar/main/`
- `https://your-app.up.railway.app/oneFourSeven/rankings/mens/`

## Part 2: Frontend Configuration (React Native)

### Step 5: Configure API URLs

Run the configuration script with your Railway URL:

```bash
# From your project root
node deployment-setup.js https://your-app.up.railway.app
```

This automatically updates:
- `FrontMaxBreak/services/api.ts`
- `FrontMaxBreak/eas.json`

## Part 3: APK Creation for Beta Testing

### Step 6: Build Your Beta APK

```bash
cd FrontMaxBreak

# Configure EAS project
eas init

# Build APK for beta testing
eas build --profile beta --platform android
```

This will:
- Build your app with production API settings
- Create an APK file for direct download
- Provide a download link for beta testers

### Step 7: Get Your Beta APK Link

After the build completes, EAS will provide:
- Direct download link for the APK
- QR code for easy download
- Build details page

Share this link with your beta testers!

## Management Commands Available

Your app includes these management commands for Railway:

### Core Commands
- `python manage.py smart_live_update` - Intelligent live match updates (only when needed)
- `python manage.py railway_init [--quick]` - Initial deployment setup
- `python manage.py deploy_update --mode daily` - Daily maintenance updates
- `python manage.py comprehensive_update --focus upcoming` - Full data updates

### Data Management
- `python manage.py update_tournaments --current-season-only`
- `python manage.py update_rankings --ranking-type MoneyRankings`
- `python manage.py update_matches --active-only`
- `python manage.py verify_data`

## Production Configuration Summary

✅ **Railway Configuration**
- SQLite database (Railway-optimized)
- Intelligent cron scheduling
- Production Django settings
- CORS configured for mobile app

✅ **API Intelligence**
- Smart live updates (only when tournaments are active)
- Rate limit respect (6-10 seconds between requests)
- Comprehensive error handling
- Resource-efficient scheduling

✅ **Mobile App Ready**
- Production API endpoints configured
- EAS build profiles set up
- Beta testing APK generation ready
- Environment variables properly configured

✅ **Data Coverage**
- All tournament types (main, women's, seniors, other)
- Player database (professional men, women, amateurs)
- Ranking systems (Money, World, Women's, Amateur)
- Round formats with intelligent naming
- Prize money display system

## Troubleshooting

### If Railway build fails:
```bash
railway logs
```

### If data updates are slow:
```bash
railway run python manage.py verify_data
```

### If API endpoints return errors:
```bash
railway run python manage.py check --deploy
```

### If mobile app can't connect:
1. Check your Railway URL is correct
2. Verify CORS settings in production.py
3. Test API endpoints in browser first

## Next Steps After Deployment

1. **Monitor your app**: Use Railway dashboard to monitor performance
2. **Beta testing**: Share APK with testers via the EAS link
3. **Data updates**: Commands will run automatically per schedule
4. **Future scaling**: When ready, migrate from SQLite to PostgreSQL
5. **App store**: After beta testing, create production builds for app stores

## Support

Your app is now fully configured for:
- ⚡ Real-time snooker match updates
- 📊 Comprehensive ranking systems  
- 🏆 Tournament calendars and results
- 📱 Cross-platform mobile experience
- 🔄 Automated data synchronization

**Your MaxBreak Snooker App is ready for the world!** 🎯