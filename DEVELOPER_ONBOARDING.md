# MaxBreak Snooker App — Developer Onboarding

Welcome to the MaxBreak project. This document walks you from zero to shipping a feature to production, step by step.

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [One-Time Environment Setup](#2-one-time-environment-setup)
3. [Project Structure](#3-project-structure)
4. [How the App Works — The Big Picture](#4-how-the-app-works--the-big-picture)
5. [Running the App Locally](#5-running-the-app-locally)
6. [Git Workflow](#6-git-workflow)
7. [Shipping a Feature — Step by Step](#7-shipping-a-feature--step-by-step)
8. [Android Preview Build (APK)](#8-android-preview-build-apk)
9. [iOS Preview Build (TestFlight)](#9-ios-preview-build-testflight)
10. [Shipping to Production](#10-shipping-to-production)
11. [Backend — Django / Railway](#11-backend--django--railway)
12. [Quick Reference — Decision Table](#12-quick-reference--decision-table)
13. [Important Rules](#13-important-rules)

---

## 1. Tech Stack Overview

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo SDK 53 (TypeScript) |
| Navigation | Expo Router (file-based routing, like Next.js) |
| Styling | NativeWind (Tailwind for React Native) |
| Backend API | Django 4.2 + Django REST Framework |
| Database | PostgreSQL (managed by Railway) |
| Backend hosting | Railway — auto-deploys on every `git push master` |
| OTA updates | EAS (Expo Application Services) — run manually |
| Push notifications | Firebase Cloud Messaging (FCM V1) |
| Data source | snooker.org API |
| Android package (Preview) | `com.avielpahima.maxbreaksnooker.preview` |
| Android package (Production) | `com.avielpahima.maxbreaksnooker` |

---

## 2. One-Time Environment Setup

### 2.1 Install Prerequisites

Install these tools before anything else:

| Tool | Version | Why |
|---|---|---|
| [Node.js](https://nodejs.org) | 18 or higher | Runs the Expo/React Native frontend |
| [Python](https://www.python.org/downloads/) | 3.11 or higher | Runs the Django backend |
| [Git](https://git-scm.com/) | Any recent | Version control |
| [VS Code](https://code.visualstudio.com/) | Any recent | Recommended editor |

**Recommended VS Code Extensions:**
- ESLint
- Prettier
- Python (Microsoft)
- React Native Tools
- Tailwind CSS IntelliSense

### 2.2 Install Global CLI Tools

```bash
npm install -g eas-cli
```

This is the Expo Application Services CLI — you'll use it to build and update the app.

### 2.3 Clone the Repository

You should already be added to the GitHub repo by Aviel. Then:

```bash
git clone https://github.com/<repo-url>
cd snookerApp
```

### 2.4 Get Secret Files from Aviel

These files are never committed to git. Get them directly from Aviel and place them exactly here:

```
FrontMaxBreak/google-services.json           ← Firebase config for Production
FrontMaxBreak/google-services-preview.json   ← Firebase config for Preview APK
```

Also get the Railway environment variables (for backend local dev):
```
SECRET_KEY
DATABASE_URL
ALLOWED_HOSTS
```

### 2.5 Frontend Setup

```bash
cd FrontMaxBreak
npm install
```

Then log in to EAS using Aviel's Expo account credentials (he will share them):

```bash
eas login
# Enter Aviel's email and password when prompted
```

> **Why Aviel's account?** Expo's team feature requires a paid plan. We use a single personal account. This gives you full access to run `eas build` and `eas update`.

### 2.6 Backend Setup

```bash
# From repo root
python -m venv venv

# Activate the virtual environment:
source venv/Scripts/activate    # Windows (Git Bash / WSL)
source venv/bin/activate        # Mac / Linux

pip install -r requirements.txt
```

Create the file `maxBreak/.env` with the values Aviel gave you:

```
SECRET_KEY=...
DATABASE_URL=...
ALLOWED_HOSTS=...
```

---

## 3. Project Structure

```
snookerApp/                         ← repo root
│
├── FrontMaxBreak/                  ← React Native app (Expo SDK 53)
│   ├── app/                        ← All screens (file = route, Expo Router)
│   │   ├── _layout.tsx             ← Root layout: header, bottom bar, OTA updates
│   │   ├── index.tsx               ← Home screen (current tournaments)
│   │   ├── CalendarEnhanced.tsx    ← Calendar screen
│   │   ├── RankingEnhanced.tsx     ← Rankings screen
│   │   ├── NewsScreen.tsx          ← News screen (RSS feeds, no backend)
│   │   ├── StatsScreen.tsx         ← Stats screen (centuries, titles, records)
│   │   ├── tour/[eventId].tsx      ← Tournament detail page
│   │   ├── match/[matchId].tsx     ← Match detail page
│   │   ├── player/[id].tsx         ← Player profile page
│   │   └── components/             ← Shared UI components (Header, BottomBar…)
│   │
│   ├── services/                   ← API calls + data logic
│   │   ├── api.ts                  ← Axios instance pointing to Railway backend
│   │   ├── tourServices.ts         ← Tournament / match API helpers
│   │   ├── highlightsService.ts    ← YouTube highlights fetch
│   │   ├── newsService.ts          ← RSS feed parser (BBC, WPBSA, SnookerHQ)
│   │   └── favoritesService.ts     ← Local favorites storage
│   │
│   ├── contexts/
│   │   └── ThemeContext.tsx        ← Dark/light theme state (dark mode only)
│   │
│   ├── hooks/
│   │   └── useDeviceType.ts        ← Returns 'phone' | 'tablet' | 'desktop'
│   │
│   ├── utils/
│   │   ├── logger.ts               ← Conditional logging (off in production)
│   │   └── notifications.ts        ← Push notification registration
│   │
│   ├── app.config.js               ← Dynamic Expo config (reads EAS env vars)
│   ├── eas.json                    ← Build profiles (preview / production / beta)
│   ├── app.json                    ← Static Expo config (base values)
│   ├── package.json                ← JS dependencies
│   └── google-services.json        ← NOT in git — get from Aviel
│
├── maxBreak/                       ← Django project root
│   ├── maxBreak/
│   │   ├── settings.py             ← Django settings (reads from .env)
│   │   └── wsgi.py                 ← WSGI entry point for Railway
│   │
│   └── oneFourSeven/               ← Main Django app
│       ├── models.py               ← DB models: Event, Match, Player, Ranking…
│       ├── views.py                ← REST API endpoints
│       ├── urls.py                 ← URL routing
│       ├── serializers.py          ← DRF serializers
│       ├── data_savers.py          ← Saves snooker.org data to DB
│       ├── data_mappers.py         ← Maps raw API fields to Django models
│       └── management/commands/
│           ├── auto_live_monitor.py ← Live scores daemon (runs 24/7 on Railway)
│           └── update_matches.py   ← Manual sync command
│
├── Procfile                        ← Railway process definitions
├── requirements.txt                ← Python dependencies
└── DEVELOPER_ONBOARDING.md        ← This file
```

---

## 4. How the App Works — The Big Picture

### Data Flow

```
snooker.org API
      ↓
  auto_live_monitor (Django daemon, runs 24/7 on Railway)
      ↓ saves to
  PostgreSQL on Railway
      ↓ served by
  Django REST API  ←→  React Native App (Expo)
                              ↓
                      Firebase (push notifications)
                      snooker.org API (direct, for live match polling)
```

### What each piece does

**Railway backend** hosts two processes (see `Procfile`):
- `web` — the Django API. Handles all HTTP requests from the app.
- `live_monitor` — a long-running daemon that polls snooker.org every few seconds during live matches and sends push notifications via Firebase.

**React Native app** (Expo) communicates with the backend via `services/api.ts`. The base URL is set per build profile in `eas.json` via `EXPO_PUBLIC_API_BASE_URL`.

**EAS (Expo Application Services)** handles two things:
- `eas build` — compiles a native binary (APK for Android, IPA for iOS)
- `eas update` — pushes a JS-only update over-the-air to devices that already have the app installed

**Firebase** is used only for push notifications (FCM V1). The backend sends notifications; the app receives them.

### Navigation structure

The app uses **Expo Router** (file-based routing). Each file in `app/` is a screen. The root layout (`app/_layout.tsx`) wraps everything in:
- `ThemeProvider` — provides dark mode colors
- `Header` — top bar (phones only)
- `BottomBar` — bottom navigation (phones only); tablets/desktops get a `SideNav`
- OTA update listener — auto-applies JS updates on launch

---

## 5. Running the App Locally

### Frontend (most common)

```bash
cd FrontMaxBreak
npx expo start
```

- Press `a` to open in Android emulator (requires Android Studio installed)
- Scan the QR code in Expo Go to test on a physical Android device
- Physical device hits the **live Railway backend** automatically
- Emulator hits `localhost:8000` — you must run the backend locally too

### Backend (only needed if changing Python code)

```bash
cd maxBreak
source ../venv/Scripts/activate   # Windows
python manage.py runserver
```

The API will be at `http://localhost:8000/oneFourSeven/`.

---

## 6. Git Workflow

We use a single `master` branch. Feature branches are used for development.

```
feature/my-feature
      ↓ test on Preview APK
      ↓ merge to master
master
      ↓ auto-deploys Django backend to Railway
      ↓ manually push JS update to Preview channel
      ↓ test again on Preview APK
      ↓ manually push JS update to Production channel
```

### Step by step

```bash
# Start a new feature
git checkout master
git pull origin master
git checkout -b feature/my-feature

# ... make changes ...

git add <specific files>
git commit -m "describe what and why"

# Push your branch (does NOT deploy anything yet)
git push origin feature/my-feature

# When ready to merge
git checkout master
git merge feature/my-feature
git push origin master      ← this auto-deploys the backend to Railway
```

---

## 7. Shipping a Feature — Step by Step

This is the full flow from writing code to users having the update.

### Frontend-only change (most features)

A "frontend-only" change means you only edited `.tsx`, `.ts`, or `.js` files — no changes to `AndroidManifest.xml`, native libraries, `app.config.js`, or `eas.json`.

**Step 1 — Develop and test locally**
```bash
cd FrontMaxBreak
npx expo start
# Use physical device or emulator
```

**Step 2 — Push JS update to Preview channel**
```bash
cd FrontMaxBreak
eas update --channel preview --message "describe your change"
```
The Preview APK on your/Aviel's device will auto-update within ~30 seconds on next launch.

**Step 3 — Test on Preview APK**  
Open the Preview APK on the test device. Verify the feature works correctly.

**Step 4 — Merge to master**
```bash
git checkout master
git merge feature/my-feature
git push origin master
```

**Step 5 — Push JS update to Production channel**
```bash
cd FrontMaxBreak
eas update --channel production --message "describe your change"
```
All Play Store users get the update silently on next launch.

---

### Backend change (Django/Python)

**Step 1 — Develop and test locally**
```bash
cd maxBreak
source ../venv/Scripts/activate
python manage.py runserver
```

**Step 2 — Commit and push to master**
```bash
git add maxBreak/oneFourSeven/views.py   # specific files
git commit -m "your change"
git push origin master
```
Railway detects the push and auto-deploys in ~1 minute. No manual steps.

**Step 3 — If you changed `models.py`**  
Railway runs `python manage.py migrate` automatically on deploy (see `Procfile`). You don't need to do anything extra.

---

### Change that requires a native rebuild

You need a new native build only when you change:
- `app.config.js` (app name, package name, permissions)
- `eas.json` (build profiles)
- `AndroidManifest.xml` or native Android/iOS files
- Adding a new Expo module that has native code
- Changing the app icon or splash screen

See sections [8](#8-android-preview-build-apk) and [9](#9-ios-preview-build-testflight) for how to build.

---

## 8. Android Preview Build (APK)

The Preview APK is a separate Android app from the Play Store version. It lives on your test device alongside the production app. It has its own package name (`com.avielpahima.maxbreaksnooker.preview`) and its own Firebase project.

### Build the APK

```bash
cd FrontMaxBreak
eas build --profile preview --platform android
```

EAS builds in the cloud (~10–15 minutes). When done:
1. Go to [expo.dev](https://expo.dev) → your project → Builds
2. Download the `.apk` file
3. Send it to the test device (AirDrop, Google Drive, email, etc.)
4. On the device: enable "Install from unknown sources" in Settings → Security
5. Open the APK file to install it

### How OTA updates work on Preview

Once the APK is installed, you don't need to reinstall it for JS changes. Just run:

```bash
eas update --channel preview --message "..."
```

The app will download and apply the update automatically on next launch.

---

## 9. iOS Preview Build (TestFlight)

> **Prerequisites before this section:**
> - Aviel must enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year) — required to distribute iOS apps
> - Once enrolled, he gets an Apple Team ID — needed in `eas.json`
> - You need a Mac, or EAS cloud build handles the compilation

### One-time setup (Aviel does this once)

1. Enroll at developer.apple.com
2. Log in at [App Store Connect](https://appstoreconnect.apple.com) → create a new App record for MaxBreak
3. Note down the **Apple Team ID** and **App Store Connect App ID**
4. Update `eas.json` under `submit.production.ios`:
   ```json
   "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
   "appleTeamId": "YOUR_TEAM_ID"
   ```

### Build the iOS preview (simulator / TestFlight)

For TestFlight distribution (test on real iPhone):

```bash
cd FrontMaxBreak
eas build --profile production --platform ios
```

EAS builds in the cloud (~15–20 minutes). When done:

```bash
eas submit --platform ios
```

This uploads the build to App Store Connect automatically. Then:
1. Go to [App Store Connect](https://appstoreconnect.apple.com) → your app → TestFlight
2. Add testers by email (Aviel + you)
3. Testers get an email → install the **TestFlight** app from the App Store → accept the invite → install MaxBreak

### iOS OTA updates (JS-only changes)

Same as Android — once the TestFlight build is installed:

```bash
eas update --channel production --message "..."
```

The app updates automatically on next launch. No new TestFlight submission needed.

### Installing TestFlight on iPhone

1. Open the App Store on iPhone
2. Search "TestFlight" — it's a free Apple app
3. Install it
4. Accept the email invite from App Store Connect
5. Open TestFlight → tap MaxBreak → Install

---

## 10. Shipping to Production

### Android (Play Store)

When you need a new native build for production:

```bash
cd FrontMaxBreak
eas build --profile production --platform android
```

When done, download the `.aab` file from expo.dev, then:
1. Go to [Google Play Console](https://play.google.com/console)
2. Select MaxBreak
3. Production → Create new release → Upload the `.aab` file
4. Fill in release notes → Review → Roll out

For JS-only changes, just use `eas update --channel production` — no Play Store submission needed.

### iOS (App Store)

```bash
cd FrontMaxBreak
eas build --profile production --platform ios
eas submit --platform ios
```

Then in App Store Connect → submit for review. Apple review takes 1–3 days.

For JS-only changes, `eas update --channel production` works without App Store review.

---

## 11. Backend — Django / Railway

### Key management commands

```bash
# Sync latest tournament/match data from snooker.org
python manage.py update_matches

# Manually start the live monitor (it runs automatically on Railway)
python manage.py auto_live_monitor

# Run database migrations
python manage.py migrate

# Open Django shell (for debugging)
python manage.py shell
```

### Adding a new API endpoint

1. Add a model to `models.py` if needed, then `python manage.py makemigrations`
2. Add a serializer to `serializers.py`
3. Add a view to `views.py`
4. Add a URL pattern to `urls.py`
5. Test locally: `python manage.py runserver` → hit `localhost:8000/oneFourSeven/your-endpoint/`
6. Deploy: `git push origin master`

### Railway environment

All environment variables (secrets, database URL, etc.) live in the Railway dashboard under **Variables**. Never put them in code or commit them.

The `Procfile` defines two processes Railway runs:
```
web: cd maxBreak && python manage.py migrate && python manage.py collectstatic --noinput && gunicorn --pythonpath . maxBreak.wsgi:application --bind 0.0.0.0:$PORT
live_monitor: cd maxBreak && python manage.py auto_live_monitor
```

The `live_monitor` process is always running — it sends live score push notifications. Do not stop it during a live tournament.

### snooker.org API

The app fetches data from `api.snooker.org`. The required header is:
```
X-Requested-By: FahimaApp128
```
**Do not change this header.** It is how snooker.org identifies our app.

---

## 12. Quick Reference — Decision Table

| You changed... | What to run |
|---|---|
| Any `.tsx` / `.ts` / `.js` in FrontMaxBreak | `eas update --channel preview` then test, then `eas update --channel production` |
| `app.config.js`, `eas.json`, `AndroidManifest.xml`, new native lib | `eas build --profile preview --platform android` |
| Any Django `.py` file | `git push origin master` (Railway auto-deploys) |
| `models.py` (new migration) | `git push origin master` (Railway auto-migrates) |
| Nothing — just want to sync snooker data | `python manage.py update_matches` |

---

## 13. Important Rules

- **Never commit** `google-services.json`, `google-services-preview.json`, `.env`, or any file containing API keys or passwords
- **`eas update` is NOT automatic** — you must run it manually after every JS change you want users to see
- **Railway backend deploys ARE automatic** on every `git push master`
- **`auto_live_monitor` runs 24/7** on Railway — do not kill it carelessly, especially during live tournaments
- **Add specific files to git, not `git add .`** — avoid accidentally committing secret files
- **Dark mode only** — the app has no light mode; all new UI must work on dark backgrounds
- **Test on Preview APK first** before shipping to production — always verify on a real device
- The `app.config.js` file dynamically sets the Android package name based on the `ANDROID_PACKAGE` env var set in `eas.json`. This is what allows Preview and Production to coexist on the same device.

---

## Checklist: First Day

- [ ] Cloned the repo
- [ ] Installed Node.js 18+, Python 3.11+, Git, VS Code
- [ ] Installed `eas-cli` globally
- [ ] Ran `npm install` in `FrontMaxBreak/`
- [ ] Logged in with `eas login` using Aviel's credentials
- [ ] Got `google-services.json` and `google-services-preview.json` from Aviel
- [ ] Got Railway env variables from Aviel, created `maxBreak/.env`
- [ ] Set up Python venv and ran `pip install -r requirements.txt`
- [ ] Ran `npx expo start` and saw the app load on device or emulator
- [ ] Installed the Preview APK on your Android test device
