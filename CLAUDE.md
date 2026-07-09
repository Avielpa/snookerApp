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
python manage.py update_matches           # Sync match data from snooker.org
python manage.py update_rankings          # Sync rankings
python manage.py update_players           # Sync player data
python manage.py auto_live_monitor        # Live scores daemon (runs 24/7 on Railway)
python manage.py backfill_career_history  # Backfill player career stats
python manage.py sync_career_history      # Sync career stats from CueTracker
python manage.py fetch_frame_scores       # Fetch per-frame scores for completed matches
python manage.py scrape_century_stats     # Scrape century break leaderboard
python manage.py sync_other_tours         # Sync Women's/Seniors/Q-Tour events
python manage.py send_test_notification   # Send push notification (--broadcast for all)
python manage.py rebuild_player_stats     # Recompute derived player stats
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
  - `tour/[eventId].tsx` — Tour detail with DrawTab
  - `match/[matchId].tsx` — Match detail (MatchEnhanced wrapper)
  - `player/[id].tsx` — Player profile: stats, form, favorites, signup nudge
  - `CalendarEnhanced.tsx` — Tournament calendar with search
  - `RankingEnhanced.tsx` — Rankings screen; multiple ranking types, nationality flags
  - `MatchEnhanced.tsx` — Match detail screen wrapper
  - `compare/index.tsx` — Side-by-side player comparison
  - `StatsScreen.tsx` — Century break leaderboard and tour winners
  - `NewsScreen.tsx` — Live news feed (BBC, WPBSA, SnookerHQ RSS)
  - `scoreboard/` — Full snooker scorekeeper (see `docs/SCOREBOARD.md`)
    - `index.tsx` — Setup screen + resume card
    - `game.tsx` — Main game screen (`GameScreenWrapper` loads draft, inner `GameScreen` holds all logic)
    - `history.tsx` — Rivalry cards (matches tab) + training sessions tab
    - `rivalry.tsx` — H2H detail: stats + session list + "New Session" button
    - `rules.tsx` — Rules reference page
  - `components/scoreboard/` — `PlayerCard`, `BallPad`, `FoulModal`, `FrameSummary`
  - `components/stats/` — `FormDots`, `WinStreak`, `RankingTrend` — shared stat widgets
  - `components/modern/` — `GlassCard`, `ModernGlassCard`, `LiveIndicator`, `ProgressBar`, `SearchBox`
  - `components/match/` — `BroadcastBadge`
  - `components/news/` — `NewsHeroCard`, `NewsCompactCard`, `HighlightCard`
  - `components/Header.tsx` — Persistent header; "← Home" inside `/scoreboard/*`, "▶ Play" elsewhere; opens AuthCard
  - `components/AuthCard.tsx` — Login/register/logout modal; calls `syncOnLogin` on success
  - `components/BottomBar.tsx` — Bottom nav (phones); Alert intercept when `isGameActive=true`
  - `components/SideNav.tsx` — Tablet/desktop nav; same Alert intercept as BottomBar
  - `home/components/` — `MatchItem`, `OtherLiveSection`, `OtherToursTab`, `StateComponents`, `StatusHeaderItem`, `RoundHeaderItem`
  - `home/components/OtherTours/` — `TourPills`, `EventSection`, `EventCard`, `MatchRow`, `index.tsx` — Women's/Seniors/Q-Tour tab
  - `home/hooks/` — `useHomeData`, `useHomeColors`, `useOtherLiveMatches`, `useLiveMatchDetection`
  - `match/components/` — `OverviewTab`, `FramesTab`, `StatsTab`, `H2HTab`, `CommentsTab`, `FrameScoreCard`, `PlayerScoreHeader`, `TabNavigation`
  - `tour/components/DrawTab.tsx`

- `services/api.ts` — Axios instance with in-memory cache and retry logic; base URL from `EXPO_PUBLIC_API_BASE_URL`
- `services/matchServices.ts` — Main API service: players, matches, rankings, H2H, calendar, upcoming
- `services/tourServices.ts` — Tournament/event API helpers
- `services/statsService.ts` — Century break leaderboard, tour winners, career stats
- `services/compareService.ts` — Player comparison: fetches and merges player, ranking, century, career data
- `services/commentService.ts` — Match comments: post, fetch, like/unlike, delete
- `services/highlightsService.ts` — Video highlights feed
- `services/newsService.ts` — BBC/WPBSA/SnookerHQ RSS parser; `openArticle()` with HEAD pre-check
- `services/favoritesService.ts` — Favorites sync with backend
- `services/scoreboardSyncService.ts` — `uploadMatch`, `downloadMatches`, `mergeServerMatchesLocally`, `syncOnLogin`
- `services/authService.ts` — JWT login/register/logout; tokens in SecureStore; auto-refresh 30s before expiry
- `services/gameStorage.ts` — AsyncStorage: match records (`sb_match_<id>`), draft (`sb_draft`), `groupByRivalry()`, `computePlayerStats()`
- `services/signupNudgeService.ts` — One-time signup nudge flag (`@maxbreak_signup_nudge_shown`)
- `services/snookerRules.ts` — Snooker rules reference content

- `contexts/ThemeContext.tsx` — Dark mode only; use `colors.textPrimary/textSecondary/textMuted` (never `colors.text`)
- `contexts/GameContext.tsx` — `isGameActive / setGameActive`; provider in `_layout.tsx`; drives nav intercept
- `contexts/AuthContext.tsx` — Global JWT auth state (`user`, `loggedIn`, `doLogin`, `doRegister`, `doLogout`)

- `hooks/useDeviceType.ts` — Returns `'phone' | 'tablet' | 'desktop'`; phones use BottomBar, tablets/desktops use SideNav
- `hooks/useSnookerGame.ts` — Pure state machine; all scoreboard game logic. Accepts `initialState?: GameState` for resume.

- `app.config.js` — Dynamic Expo config; reads `ANDROID_PACKAGE` env var to set package name (preview vs production)

### Backend structure (maxBreak/)
- `maxBreak/` — Django project root (settings.py, wsgi.py)
- `oneFourSeven/` — Main app
  - `models.py` — All Django models (see list below)
  - `views.py` — DRF REST endpoints
  - `serializers.py` — DRF serializers
  - `data_savers.py` — `DatabaseSaver` class; handles writing snooker.org data to DB
  - `data_mappers.py` — `prepare_data_for_model()` strips primary keys — pass `ID=int(api_id)` explicitly for Ranking rows
  - `scraper.py` — Fetches from snooker.org API
  - `management/commands/` — 35+ management commands for data sync, live monitoring, stats

**Django models (oneFourSeven/models.py):**
`Player`, `Ranking`, `Event` (tournaments), `MatchesOfAnEvent`, `RoundDetails`, `UpcomingMatch`, `PlayerMatchHistory`, `H2HCache`, `NewsArticle`, `OtherTourEvent`, `OtherTourPlayer`, `OtherTourMatch`, `CenturyRecord`, `PlayerCareerStats`, `DeviceToken`, `NotifDedup`, `UserFavorite`, `MatchPrediction`, `MatchComment`, `CommentLike`, `MatchFrameScore`, `ScoreboardMatch`

### EAS build channels
| Channel | Package | Use |
|---|---|---|
| `preview` | `com.avielpahima.maxbreaksnooker.preview` | Internal test APK |
| `production` | `com.avielpahima.maxbreaksnooker` | Play Store |

## Scoreboard Feature

Full snooker scorekeeper built into the app. Three modes: **Match** (best-of-N or single frame), **Unlimited** (no auto-end), **Train** (solo practice). Full reference: `docs/SCOREBOARD.md`.

Key files: `app/scoreboard/`, `app/components/scoreboard/`, `hooks/useSnookerGame.ts`, `contexts/GameContext.tsx`, `services/gameStorage.ts`, `services/scoreboardSyncService.ts`.

**Save & Resume**: Auto-saves draft to `sb_draft` on accidental navigation. Resume card on setup screen. BottomBar/SideNav Alert when game active. See `docs/SCOREBOARD.md` for full architecture.

## Test Suite

Five test files at `FrontMaxBreak/` root — run with Node.js, no React needed:

```bash
node game_test.mjs           # 328 assertions — full match mode + game logic (29 sections)
node train_test.mjs          # 51 assertions  — train mode + computeTrainingStats
node mega_test.mjs           # 470 assertions — edge cases train+match, all formulas
node freeball_test.mjs       # 100 assertions — free ball in all situations
node stats_test.mjs          # 48 assertions  — avgPointsPerFrame in groupByRivalry
node offseason_tab_test.mjs  # 42 assertions  — off-season Results tab auto-switch logic
```

**Run all:**
```bash
node game_test.mjs && node train_test.mjs && node mega_test.mjs && node freeball_test.mjs && node stats_test.mjs && node offseason_tab_test.mjs
```

Expected: `✅ All N assertions passed` for each file — **1039 total**. Fix any failures before deploying.

## Claude Working Rules

1. **Plan first, code never** — never touch any code before the user explicitly approves the plan.
2. **Use low-token plan tools** — in plan mode, always use the tool that costs the fewest tokens (e.g. Glob/Grep over full file reads).
3. **Trust CLAUDE.md before reading files** — do not read source files to answer questions already covered in this file or MEMORY.md.
4. **Expensive explorations require discussion first** — if a task requires reading many files and will cost many tokens, stop and discuss the most efficient approach with the user before proceeding.
5. **Estimate session scope before starting** — before beginning any feature, confirm the work fits in one session (token budget). State the estimate explicitly.
6. **Preview before production always** — `eas update --channel preview` first, test on device, then `eas update --channel production`.
7. **One backend, two environments** — preview and production share the same Railway backend. Any backend change must be tested thoroughly. New features go in new functions/files wherever possible. If an existing function must change, audit every caller and all affected logic first.
8. **Create tests for new feature** — For every feature created, create an MD file summarising what was done + at least 100 tests before updating preview and pushing to git.
9. **Any time we write new code, ensure nothing breaks with old data** — investigate which functions and files will be affected and let the user know.
10. **New code → new file/function/component** — build new sections or features modularly in new functions or files for easy debugging and review.
11. **Check `docs/OPEN_MISSIONS.md` at the start of any bug investigation or feature work**, and add new items there whenever work surfaces something out-of-scope that shouldn't be forgotten (deferred fixes, pre-existing test failures, follow-ups scoped out of the current task). Never fix an open-mission item as a silent drive-by inside unrelated work — pull it out as its own task first.
12. **Any bug investigation or fix uses the `bug-fix-expert` persona** (`.claude/agents/bug-fix-expert.md`, 20-rule workflow: systematic-debugging first, full connection map, root-cause causal chain, exhaustive edge cases, explicit plan approval before any Edit/Write, never deploy). This environment's `Agent` tool does not auto-register `.claude/agents/*.md` as a selectable `subagent_type` — invoke it by reading the file and passing its full contents into a `general-purpose` agent's prompt, not by naming it directly as `subagent_type`.

## Critical Rules

- **Dark mode only** — all UI uses `colors` from `ThemeContext`. Use `colors.textPrimary` not `colors.text` (which doesn't exist).
- **snooker.org API header** — always `X-Requested-By: FahimaApp128`. Do not change it.
- **Ranking.ID** is `BigIntegerField(primary_key=True)`. `prepare_data_for_model` strips PKs, so pass `ID=int(api_id)` explicitly when creating Ranking rows.
- **`eas update` is not automatic** — must run manually for users to receive JS changes.
- **`git push master` auto-deploys the Django backend** to Railway — only push when the backend is ready and only if user approves it.
- **Add specific files to git**, not `git add .` — avoid committing secret files.
- **Never commit** `google-services.json`, `google-services-preview.json`, `.env`, or any file with secrets.
- **Test on Preview APK before production** — always verify on a real device first.
- **Deployment requires explicit user approval** — never push or run `eas update` without user confirmation.
