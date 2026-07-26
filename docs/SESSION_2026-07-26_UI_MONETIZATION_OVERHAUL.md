# Session 2026-07-26 — UI/UX + Monetization Overhaul

## Request

User asked for a broad "premium sports broadcasting" visual overhaul plus a monetization/UX fix, split into two phases (both approved and executed in this session):

1. AdMob: remove the app-launch interstitial, move it to the Media tab with a frequency cap, add a fixed banner above the bottom tab bar on Home.
2. Typography/spacing: bigger primary text (player names, tournament titles, list items), bigger/sleeker search bar, fix excess whitespace under headers.
3. Premium visual redesign: gradients + depth borders on cards/screens.
4. Header/logo redesign: drop the image icon, pure-typography "MaxBreak147" wordmark.
5. Play button upgrade + dark splash screen with proper ready-gating.

## Root causes found before changing anything

- **Ad annoyance**: `useInterstitialOnce()` fired ~5s after every cold start from `_layout.tsx`, regardless of what screen the user landed on.
- **Home banner overlap risk**: `BannerAdSlot` was rendered *inline inside the scrollable list content* (`app/index.tsx`), not fixed — moved it to render as a flex sibling *after* the list `View` (which is `flex: 1`), so it's structurally impossible for it to overlap list content (no absolute positioning, no manual padding hack needed).
- **Whitespace bug**: `Header.tsx` already adds `paddingTop: insets.top` itself (rendered once, globally, above the routed `Stack`). Several screens *also* wrapped their content in a plain `<SafeAreaView>` with no `edges` restriction, which re-applies `insets.top` (and `insets.bottom`, redundant with `BottomBar`'s own inset handling) a second time — the actual cause of the "massive blank space" under headers. Two screens (`player/[id].tsx`, `compare/index.tsx`) had already been fixed with `edges={['bottom','left','right']}` in earlier work; that same fix was missing from `index.tsx`, `CalendarEnhanced.tsx`, `RankingEnhanced.tsx`, `MatchEnhanced.tsx`, and 4 of 5 early-return branches in `tour/[eventId].tsx`.
- **Tiny/no-contrast search bar**: Home's search box was a raw inline `TextInput` with `fontSize: 7` (not a typo in this doc — that's what shipped) and no border. The reusable `SearchBox.tsx` component existed but Home didn't use it.
- **Splash flash**: no `SplashScreen.preventAutoHideAsync()`/`hideAsync()` calls existed anywhere — the native splash just auto-hid on first JS render. `expo-splash-screen`'s config plugin and `expo-linear-gradient` were already installed but unused for this purpose.
- **Fonts**: `fontFamily: 'PoppinsBold'` etc. are referenced everywhere in styles, but no font files, no `@expo-google-fonts` package, and no `useFonts`/`Font.loadAsync` call exist anywhere in the project — these names silently fall back to the system default font on both platforms. **Pre-existing, out of scope for this session** (not something this task's "increase font size" ask covers) — logged as a new open mission below rather than fixed as a silent drive-by.
- **Premium look partially already existed**: `ModernGlassCard` (obsidian → dark-emerald gradient card, green-accent border, shadow) was already built and already used by Home's `MatchItem` — it just wasn't applied elsewhere, and the main screen backgrounds were flat colors, not gradients.

## What changed, file by file

### Phase A — Ads, header, splash
- `FrontMaxBreak/services/adsService.ts` — removed `useInterstitialOnce` (app-launch trigger); added `isMediaInterstitialCooldownElapsed()` (pure, unit-tested) and `useMediaTabInterstitial()` (AsyncStorage-persisted 4h cooldown, shares the existing session-wide "only one interstitial per session" gate with the untouched `useScoreboardEntryInterstitial`).
- `FrontMaxBreak/app/_layout.tsx` — removed the app-launch interstitial call; added `SplashScreen.preventAutoHideAsync()` (module scope) + `hideAsync()` gated on `AuthContext`'s `loading` flag (the one real async readiness signal this app has before first paint — theme is synchronous, no font-loading pipeline exists to gate on).
- `FrontMaxBreak/app/NewsScreen.tsx` — calls `useMediaTabInterstitial()` (this screen *is* the "Media" tab, routed from `BottomBar`).
- `FrontMaxBreak/app/index.tsx` — moved `<BannerAdSlot />` out of scroll content to a fixed sibling above where `BottomBar` renders.
- `FrontMaxBreak/app/components/Header.tsx` — removed the `<Image>` icon; wordmark is now plain `Text` ("MaxBreak" white + "147" `#FFD700` gold, bold). Play button rebuilt as a gradient pill (`LinearGradient`, `borderRadius: 20`, gold/amber for "Play", neutral for the in-scoreboard "Home" state) with a small Ionicons play/arrow-back icon.
- `FrontMaxBreak/app.json` — both the legacy `splash` key and the `expo-splash-screen` plugin now point to the new full-bleed `./assets/images/splash.png` (1346×2427, replacing the old small `splash-icon.png`), `resizeMode: "cover"` (was `"contain"`, and the plugin's `imageWidth: 200` icon-sizing cap was removed — that setting was tuned for the old small icon and would have shrunk the new hero image to a postage stamp), `backgroundColor: "#080808"`. **Requires a new native build (`eas build`) to actually change on-device — `eas update` alone will not pick up this native asset change.**
- `FrontMaxBreak/app/components/Header.tsx` — follow-up from the user after this session's first pass: replaced the pure-typography "MaxBreak"+"147" wordmark with a single premium image logo (`assets/images/header-logo.png`, 677×166), centered in the header's middle flex slot via `resizeMode="contain"` + fixed `height: 36` (width auto-derives from aspect ratio, shrinks further on narrow phones without distortion or overflow). Pure JS/asset change — ships via `eas update`, no native rebuild needed (unlike the splash image, which is baked into native launch-screen resources by the config plugin).
- `docs/ADMOB.md` — updated to describe the new Media-tab trigger + cooldown and the new fixed banner position, and the manual verification checklist rewritten to match.

### Phase B — Typography, whitespace, search, gradients/depth
- `FrontMaxBreak/constants/typography.ts` (new) — `FONT_SIZE_PRIMARY` (17) and `FONT_SIZE_TITLE` (18), shared across screens instead of one-off numbers.
- Bumped to `FONT_SIZE_PRIMARY`/`FONT_SIZE_TITLE` (all guarded by existing `numberOfLines` or `flex: 1` containers, verified per-file before editing — none of these can overflow into a neighboring column):
  - `app/home/styles/modernMatchStyles.ts` (`playerName` 11→17, `liveRowPlayer` 11→13 — kept lower deliberately, this row is explicitly documented as a dense "single line" compact layout)
  - `app/home/styles/layoutStyles.ts` (`tourTitle` 15→18, Medium→SemiBold)
  - `app/RankingEnhanced.tsx` (`playerName` 12→17)
  - `app/CalendarEnhanced.tsx` (`name` 12.5→17, `heroName` 15→18)
  - `app/components/news/NewsCompactCard.tsx`, `HighlightCard.tsx` (`title` 14→17)
  - `app/StatsScreen.tsx` (`leaderName` 12→17, both `colName` cells 12/13→17, `titleStyles.name` 14→17; `champStyles.eventName`/`winner` bumped more modestly, 13→14/15, since that row has no `numberOfLines` guard and is a dense many-row list)
  - `app/tour/[eventId].tsx` (`playerName` 13→17)
  - `app/match/styles-modern.ts` (`playerName` in the match score header — the two names shown at the top of `MatchEnhanced` — 10→17; this was the smallest one found)
  - `app/player/styles-modern.ts`'s `heroTitle` (18, bold) was already correct — left untouched.
- SafeAreaView double-inset fix — added `edges={['bottom', 'left', 'right']}` (dropping `top`, since `Header` already owns it) to every remaining screen missing it: `index.tsx` (×2), `CalendarEnhanced.tsx` (×3), `RankingEnhanced.tsx` (×3), `MatchEnhanced.tsx` (×4), `tour/[eventId].tsx`'s 4 early-return branches (main branch already had the fix).
- `app/components/modern/SearchBox.tsx` — static `#1A1A1A` background (was a translucent animated white overlay), border now animates a subtle `rgba(255,255,255,0.14)` → amber-on-focus instead of the old dim default, `fontSize` 16→17, placeholder color switched from a hardcoded gray to `colors.textSecondary` (lighter, better contrast).
- `app/index.tsx`'s raw inline search `TextInput` — was `fontSize: 7`, no border; now matches the `SearchBox` treatment (17px, `#1A1A1A`, subtle border, `colors.textSecondary` placeholder).
- `app/CalendarEnhanced.tsx` / `app/StatsScreen.tsx` search inputs — font size and placeholder contrast brought in line (14→16, 13→16); left their existing container/row structure alone since those are legitimately different collapsible-row patterns, not the same component.
- `contexts/ThemeContext.tsx` — `cardBorder` changed from `rgba(255,255,255,0.16)` to solid `#2A2A2A` (the exact color the request specified). This is a single shared token consumed by 25 files, so it cascades the "depth border" ask across nearly every card/list item/header/nav in the app in one change, rather than touching each file individually.
- `app/index.tsx` — main background swapped from a flat `#0D1A0F` `View` to a real `LinearGradient` (`#0A0F0A` → `#0D1F14`, obsidian → dark emerald) on both the loading-state and main-state render branches.
- Other screens' card-level gradient treatment: **already existed and already wired up** via `ModernGlassCard` (used by Home's `MatchItem`) — not duplicated elsewhere in this pass; extending the same gradient-card treatment to Calendar/Ranking/Stats card components was **not done** and is listed as a follow-up below, to keep this session's diff reviewable.

## New open mission logged

Added to `docs/OPEN_MISSIONS.md`: the app references `PoppinsBold`/`PoppinsSemiBold`/`PoppinsMedium`/`PoppinsRegular` everywhere but no such fonts are actually loaded anywhere (no font files, no `@expo-google-fonts` dependency, no `useFonts`/`Font.loadAsync` call) — text is silently rendering in the system default font. Pre-existing, unrelated to this session's font-*size* changes, deliberately not fixed here.

## Tests

- `FrontMaxBreak/ads_cooldown_test.mjs` (new, 18 assertions) — covers `isMediaInterstitialCooldownElapsed`: never-shown case, exact boundary (inclusive), just-under/just-over boundary, custom cooldown windows, zero-length cooldown, clock-skew (negative elapsed) safety, determinism, and the exported constant value.
- Full existing suite re-run after both phases: `game_test.mjs` (328), `train_test.mjs` (51), `mega_test.mjs` (470), `freeball_test.mjs` (121), `stats_test.mjs` (48), `offseason_tab_test.mjs` (42) — all still pass. Combined with the new file: **1078 assertions, 0 failures**.
- `npx tsc --noEmit` run after each task group touching TypeScript files — zero new type errors introduced.
- No automated UI/visual tests exist in this project (none did before this session either) — the typography/spacing/gradient/search-bar changes are visual-only and were verified by reading each affected component's JSX to confirm `numberOfLines`/`flex` truncation guards before bumping any font size (documented per-file above), not by rendering the app. **A real device/simulator check is still needed** — see checklist below.

## What still needs a real device/build to confirm

- [ ] Cold start: no interstitial on launch; first Media-tab visit shows one; repeat Media-tab visits within 4h show none; after 4h+ (or clearing app storage), one shows again.
- [ ] Home screen: banner sits above the bottom tab bar, doesn't cover the last list row, list still scrolls fully.
- [ ] Header: gold "147", white "MaxBreak", no image icon; Play pill renders as a visible gradient CTA with the play icon; in the scoreboard section it correctly shows the neutral "Home" pill instead.
- [ ] Splash: **requires a new `eas build`** (preview first) — the `app.json` background-color change is a native asset, `eas update` will not surface it. JS-side `preventAutoHideAsync`/`hideAsync` gating *will* reach devices via `eas update` since it's pure JS, but has nothing new to show until the native splash asset itself is rebuilt.
- [ ] Whitespace: visually confirm Home/Calendar/Rankings/Match/Tour no longer show a double gap under the header, and that removing the top inset didn't clip anything under a notch/Dynamic Island on a real device.
- [ ] Search bars: legible placeholder, larger tap target, no clipped text at the new font sizes on a narrow (SE-sized) screen.
- [ ] Long player names / long tournament names at the new larger sizes: confirm the `numberOfLines` truncation looks acceptable (ellipsis, not visual overflow) on Rankings, Calendar, Home, tour draw list, and the match score header.

## Follow-ups (not done in this pass — do not silently fold into future unrelated work)

- Extend `ModernGlassCard`'s gradient-card treatment to Calendar's tournament cards, Ranking rows, and Stats leaderboard rows (currently only Home's `MatchItem` uses it) — this pass changed the *border* token globally (`cardBorder` → `#2A2A2A`) but did not add the full gradient-card background to those other screens, to keep the diff scoped and reviewable.
- Missing Poppins font loading (see Open Missions) — separate task, not a quick fix (needs font files sourced/licensed and either a config-plugin `fonts` array or a `useFonts` + splash-gating addition).
