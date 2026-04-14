# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MaxBreak is a snooker app with a Django REST Framework backend (hosted on Railway) and a React Native + Expo frontend.

## Commands

### Frontend (FrontMaxBreak/)

```bash
cd FrontMaxBreak
npx expo start           # Local dev server (press 'a' for Android emulator)
npm install              # Install dependencies
```

**OTA updates (JS-only changes — must run manually):**
```bash
eas update --channel preview --message "description"     # Preview APK
eas update --channel production --message "description"  # Play Store users
```

**Native builds (only when changing app.config.js, eas.json, native libs, permissions, icons):**
```bash
eas build --profile preview --platform android    # Preview APK
eas build --profile production --platform android # Play Store AAB
```

### Backend (maxBreak/)

```bash
source ../venv/Scripts/activate        # Windows (Git Bash)
source ../venv/bin/activate            # Mac/Linux
python manage.py runserver             # Dev server at localhost:8000
python manage.py makemigrations        # After changing models.py
python manage.py migrate               # Apply migrations
python manage.py shell                 # Django shell for debugging
```

**Key management commands:**
```bash
python manage.py update_matches        # Sync match data from snooker.org
python manage.py update_rankings       # Sync rankings
python manage.py update_players        # Sync player data
python manage.py auto_live_monitor     # Live scores daemon (runs 24/7 on Railway)
python manage.py backfill_career_history  # Backfill player career stats
```

## Architecture

### Data Flow
```
snooker.org API (header: X-Requested-By: FahimaApp128)
      ↓
auto_live_monitor (Django daemon, runs 24/7 on Railway)
      ↓ saves to
PostgreSQL on Railway
      ↓ served by
Django REST API  ←→  React Native app
                           ↓
                   Firebase Cloud Messaging (push notifications)
```

### Deployment
- **Backend**: Auto-deploys to Railway on every `git push master`. Railway runs `migrate` + `collectstatic` + gunicorn on deploy (see `Procfile`).
- **Frontend JS changes**: `eas update` must be run manually — it is NOT triggered by git push.
- **Frontend native changes**: `eas build` must be run manually to produce a new APK/AAB.

### Railway processes (Procfile)
- `web` — Django API server
- `live_monitor` — `auto_live_monitor` daemon, polls snooker.org during live matches and sends FCM push notifications. Do not stop it during live tournaments.

### Frontend structure (FrontMaxBreak/)
- `app/` — Expo Router file-based routing. Each file = a screen/route.
  - `_layout.tsx` — Root layout: ThemeProvider, Header, BottomBar/SideNav, OTA update listener
  - `index.tsx` — Home screen
  - `tour/[eventId].tsx`, `match/[matchId].tsx`, `player/[id].tsx` — Detail pages
  - `compare/index.tsx`, `StatsScreen.tsx`, `NewsScreen.tsx` — Feature screens
  - `components/` — Shared UI components
  - `home/` — Home screen sub-components and hooks
  - `match/components/` — Match detail tab components
- `services/api.ts` — Axios instance with in-memory cache and retry logic; base URL from `EXPO_PUBLIC_API_BASE_URL`
- `services/` — Feature-specific API helpers (tourServices, highlightsService, newsService, favoritesService)
- `contexts/ThemeContext.tsx` — Dark mode only; use `colors.textPrimary/textSecondary/textMuted` (never `colors.text`)
- `hooks/useDeviceType.ts` — Returns `'phone' | 'tablet' | 'desktop'`; phones use BottomBar, tablets/desktops use SideNav
- `app.config.js` — Dynamic Expo config; reads `ANDROID_PACKAGE` env var to set package name (preview vs production)

### Backend structure (maxBreak/)
- `maxBreak/` — Django project root (settings.py, wsgi.py)
- `oneFourSeven/` — Main app
  - `models.py` — Event, Match, Player, Ranking, RoundDetails, UpcomingMatch, PlayerMatchHistory, H2HCache
  - `views.py` — DRF REST endpoints
  - `serializers.py` — DRF serializers
  - `data_savers.py` — `DatabaseSaver` class; handles writing snooker.org data to DB
  - `data_mappers.py` — `prepare_data_for_model()` strips primary keys — pass `ID=int(api_id)` explicitly for Ranking rows
  - `scraper.py` — Fetches from snooker.org API
  - `management/commands/` — Management commands (30+ commands for data sync, live monitoring, etc.)

### EAS build channels
| Channel | Package | Use |
|---|---|---|
| `preview` | `com.avielpahima.maxbreaksnooker.preview` | Internal test APK |
| `production` | `com.avielpahima.maxbreaksnooker` | Play Store |

## Claude Working Rules

1. **Plan first, code never** — never touch any code before the user explicitly approves the plan.
2. **Use low-token plan tools** — in plan mode, always use the tool that costs the fewest tokens (e.g. Glob/Grep over full file reads).
3. **Trust CLAUDE.md before reading files** — do not read source files to answer questions already covered in this file or MEMORY.md.
4. **Expensive explorations require discussion first** — if a task requires reading many files and will cost many tokens, stop and discuss the most efficient approach with the user before proceeding.
5. **Estimate session scope before starting** — before beginning any feature, confirm the work fits in one session (token budget). State the estimate explicitly.
6. **Preview before production always** — `eas update --channel preview` first, test on device, then `eas update --channel production`.
7. **One backend, two environments** — preview and production share the same Railway backend. Any backend change must be tested thoroughly. New features go in new functions/files wherever possible. If an existing function must change, audit every caller and all affected logic first.

## Critical Rules

- **Dark mode only** — all UI uses `colors` from `ThemeContext`. Use `colors.textPrimary` not `colors.text` (which doesn't exist).
- **snooker.org API header** — always `X-Requested-By: FahimaApp128`. Do not change it.
- **Ranking.ID** is `BigIntegerField(primary_key=True)`. `prepare_data_for_model` strips PKs, so pass `ID=int(api_id)` explicitly when creating Ranking rows.
- **`eas update` is not automatic** — must run manually for users to receive JS changes.
- **`git push master` auto-deploys the Django backend** to Railway — only push when the backend is ready.
- **Add specific files to git**, not `git add .` — avoid committing secret files.
- **Never commit** `google-services.json`, `google-services-preview.json`, `.env`, or any file with secrets.
- **Test on Preview APK before production** — always verify on a real device first.
- **Deployment requires explicit user approval** — never push or run `eas update` without user confirmation.
