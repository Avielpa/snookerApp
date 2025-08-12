# MaxBreak Snooker APK - Build Instructions

## 🚀 **Quick Build (Recommended)**

### **Option 1: Use Build Script**
```bash
cd FrontMaxBreak
build-apk.bat
```

### **Option 2: Manual Commands**
```bash
cd FrontMaxBreak

# Install EAS CLI
npm install -g @expo/eas-cli

# Login (use: aviel107pahima@gmail.com)
eas login

# Build APK
eas build --profile beta --platform android
```

## ⏰ **Build Process**

1. **Login Required**: Use `aviel107pahima@gmail.com`
2. **Build Time**: 10-15 minutes (first build takes longer)
3. **Download Link**: EAS provides direct download URL
4. **QR Code**: Also provided for easy mobile access

## 📱 **After Build Completes**

EAS will show:
```
✅ Build completed!
📥 APK Download: https://expo.dev/artifacts/eas/xxx.apk
📱 Install Link: https://expo.dev/accounts/aviel107pahima/projects/maxbreak-snooker/builds/xxx
```

## 🎯 **Install on Your Phone**

1. **Download APK** from the provided link
2. **Enable "Install from Unknown Sources"** in Android settings
3. **Install the APK** 
4. **Open MaxBreak Snooker app**
5. **Test**: Should connect to https://snookerapp.up.railway.app/

## 🔧 **Configuration Confirmed**

✅ **Railway Backend**: https://snookerapp.up.railway.app/oneFourSeven/  
✅ **Email**: aviel107pahima@gmail.com  
✅ **Build Profile**: Beta APK  
✅ **App ID**: com.avielpahima.maxbreaksnooker  

## 🆘 **Troubleshooting**

**If EAS login fails:**
```bash
eas logout
eas login
```

**If build fails:**
```bash
eas build --clear-cache --profile beta --platform android
```

**Test backend first:**
- Visit: https://snookerapp.up.railway.app/oneFourSeven/calendar/main/
- Should show tournament data

Your MaxBreak Snooker app is ready to build! 🏆