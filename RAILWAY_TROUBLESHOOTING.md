# Railway Deployment - Troubleshooting Guide

## 🔧 Fixed: pip command not found error

The error you encountered:
```
process "/bin/bash -ol pipefail -c pip install -r requirements.txt" did not complete successfully: exit code: 127
```

Has been fixed with the following changes:

### ✅ **Solution Applied**

1. **Updated nixpacks.toml** - Added explicit pip and setuptools packages
2. **Fixed requirements.txt** - Removed BOM character that was causing encoding issues  
3. **Added railway.yml** - Alternative Railway configuration
4. **Added runtime.txt** - Explicit Python version specification

## 🚀 **Retry Deployment Now**

Your Railway deployment should now work. Try deploying again:

```bash
# In your maxBreak directory
railway up
```

## 📋 **Alternative Deployment Methods**

If you still encounter issues, try these approaches:

### Method 1: Use Railway CLI with Force Rebuild
```bash
cd maxBreak
railway up --detach
railway logs  # Watch the build process
```

### Method 2: Manual Environment Variables
```bash
railway variables set DJANGO_SETTINGS_MODULE=maxBreak.production
railway variables set DEBUG=False
railway variables set RAILWAY_ENVIRONMENT=production
railway up
```

### Method 3: GitHub Integration (Recommended)
1. Push your code to GitHub
2. Connect Railway to your GitHub repo
3. Railway will automatically deploy from your repo

## 🔍 **Debugging Steps**

### Check Build Logs
```bash
railway logs --deployment
```

### Verify Environment
```bash
railway shell
python3 --version
pip --version
```

### Test Local Build
```bash
# Test the exact same commands locally
python3 -m pip install --upgrade pip setuptools wheel
python3 -m pip install -r requirements.txt --no-cache-dir
python3 manage.py collectstatic --noinput --clear
python3 manage.py migrate --noinput
```

## 📁 **Files Updated to Fix the Issue**

1. **nixpacks.toml** - More robust Python build configuration
2. **requirements.txt** - Removed BOM, clean encoding
3. **railway.yml** - Alternative build configuration  
4. **runtime.txt** - Explicit Python version

## 🎯 **After Successful Deployment**

Once your Railway deployment succeeds:

1. **Initialize your database:**
   ```bash
   railway run python manage.py railway_init --quick
   ```

2. **Test your API:**
   ```bash
   curl https://your-app.up.railway.app/oneFourSeven/calendar/main/
   ```

3. **Configure your React Native app:**
   ```bash
   node deployment-setup.js https://your-app.up.railway.app
   ```

## 🆘 **Still Having Issues?**

If problems persist, try this minimal approach:

1. **Delete nixpacks.toml** (let Railway auto-detect)
2. **Keep only these files:**
   - requirements.txt
   - runtime.txt  
   - Procfile
3. **Deploy with just:**
   ```bash
   railway up
   ```

Your MaxBreak Snooker App deployment should now work smoothly! 🚀