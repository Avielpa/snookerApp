# Session 2026-07-26 — App-wide Design Standardization Pass

Follow-on from the same day's UI/monetization overhaul (`docs/SESSION_2026-07-26_UI_MONETIZATION_OVERHAUL.md`) — this pass standardizes screen headers and rebuilds Home's match cards into a single, cohesive "Premium Broadcast" system across live/upcoming/finished states, plus removes a messy background image from Rankings.

## What changed

### 1. Standardized screen headers (`app/components/ScreenHeader.tsx`, new)
Before: Calendar (19px, left), Rankings (20px, **centered** — the outlier), Stats (22px, left) — three different treatments, none matching the requested 28-32px/heavy-weight spec. New shared component: 30px, `fontFamily: 'PoppinsBold'` + explicit `fontWeight: '800'` (added the numeric weight deliberately — see the Poppins-fonts open mission from the earlier session; a numeric `fontWeight` still renders bold on the system-fallback font even though the named font isn't actually loaded, so this is a real visible fix, not just a cosmetic label), left-aligned, consistent padding, with a `children` slot for each screen's existing right-side accessory (Calendar's search toggle, Stats' `SeasonPicker`). Applied to `CalendarEnhanced.tsx`, `RankingEnhanced.tsx`, `StatsScreen.tsx`. Home is deliberately excluded (its logo + tournament hero serve this role); Media/News has no title at all today, so nothing to standardize there.

### 2. Home tournament title → premium hero (`app/index.tsx`, `app/home/styles/layoutStyles.ts`)
The `tourTitle`/`headerContainer` block (already relocated to the match list's `ListHeaderComponent` in the prior session) is now a dark translucent rounded card (`rgba(0,0,0,0.35)`, 16px radius) with a 2px amber-glow bottom border as the "separator" establishing hierarchy above the match list, and the title itself bumped to 24px bold white with a soft gold `textShadow` glow (radius 10, no offset — an even halo rather than a drop shadow).

### 3-5. Match cards unified (`app/home/components/MatchItem.tsx`, `app/home/styles/modernMatchStyles.ts`, `app/components/modern/ModernGlassCard.tsx`)
Biggest structural change: **removed the compact single-line `liveRow` early-return** that only "livePlaying" matches used (a denser layout, per a comment, for long concurrent-live lists) and unified all four match states (`livePlaying`, `onBreak`, `upcoming`, `finished`) onto one full-card layout. This was a deliberate trade-off the user explicitly signed off on (see `AskUserQuestion` in-conversation) — live lists now take more vertical space per match when several matches are live at once, in exchange for the requested "Premium Broadcast" look and fixing a pre-existing inconsistency where `onBreak` already used the full card while `livePlaying` didn't.

- `ModernGlassCard` (confirmed via grep to be used **only** by `MatchItem.tsx`, so free to change without affecting other screens) extended with `accentSide?: 'top'|'left'` (default `'top'`, so its one other-purpose... actually zero other current call sites — `GlassCard`, a separate unrelated component, is what player profile/state components use) and `glow?: boolean` (colored shadow matching `accentColor`). Its dark-mode gradient changed from a green-tinted `rgba(15,25,20,..)` to true obsidian/charcoal `rgba(28,28,30,0.85)→rgba(14,14,16,0.7)`, and its default border color now reads from `colors.cardBorder` (`#2A2A2A`, the same global token set earlier this session) instead of a hardcoded green.
- **Live** (`livePlaying`): neon green (`#22C55E`) left border (`accentSide="left"`, width 4) + `glow`, existing `LiveIndicator` component (already built, already used on the match-detail screen — reused here rather than building a new pulsing-dot animation) shown as a "LIVE" micro-badge top-right of the card. Score numbers bumped 15px→24px, `fontWeight: '800'` added (already gold `#FFB74D`, just needed to be louder).
- **Upcoming**: silver-gray (`#9CA3AF`) left border, no glow. The center "vs" placeholder is replaced with the match's scheduled time/date (already available via `formatDate`), split across two stacked lines ("Jul 28" / "14:30") in a muted `textSecondary` color — visually present but clearly secondary to the live cards' gold score.
- **Finished**: `opacity: 0.6` applied to the whole `ModernGlassCard` (via its `style` prop, so gradient + border + content all dim together as one unit), a new small "FT" badge in the footer, `BroadcastBadge` now conditionally hidden (`!isMatchFinished && ...`) since a broadcaster link is meaningless after the fact, and a new `loserText` style (`opacity: 0.5`) applied to whichever player didn't win — stacking with the card's own 0.6 opacity, so the loser reads as noticeably fainter than the bolded/gold winner. Confirmed the "Results" tab label was already correct (`app/index.tsx`'s `filterButtons`) — no change needed there.
- `onBreak`'s old inline footer "TBC" chip was removed in favor of the same `LiveIndicator` badge (which already renders "BREAK" text + amber background for that state) — one badge mechanism instead of two.

### 6. Rankings background (`app/RankingEnhanced.tsx`)
Removed `<ImageBackground source={require('../assets/snooker_background.jpg')}>` + its dark scrim `overlay` View entirely, replaced with the same `<LinearGradient colors={['#0A0F0A', '#0D1F14']}>` used on Home, for visual consistency across the app's main screens. The unused `ImageBackground` import and `overlay` style were removed; the now-unreferenced `snooker_background.jpg` asset was left in place (unreferenced assets aren't bundled by Metro, so no cleanup needed there).

## Tests / verification

- `npx tsc --noEmit`: zero errors, run after every file group touched.
- Full existing suite re-run after all changes: 1078 assertions across 7 files, 0 failures (unchanged from before this pass — none of this session's logic like game/scoreboard rules were touched, this was UI-only).
- No new automated tests added — this pass is entirely visual/layout, same as the earlier session's Phase B. No real-device check has been done yet for this specific pass (unlike the earlier session, which already went through one round of real-device QA).

## What to verify on a real device before shipping

- [ ] Live cards: neon border + glow visible and not overdone; "LIVE"/"BREAK" badge doesn't collide with anything at the top of the card.
- [ ] Upcoming cards: two-line time/date doesn't look cramped or misaligned vertically against the taller live-card score numbers in the same list.
- [ ] Finished cards: 0.6 opacity + loser dimming doesn't make text illegible on smaller/older screens; FT badge doesn't overlap the date on narrow phones.
- [ ] Rankings screen: gradient background matches Home's tone under real ambient/screen brightness (no banding).
- [ ] ScreenHeader: 30px title doesn't clip or wrap awkwardly on the smallest supported phone width, especially on Stats where it shares a row with `SeasonPicker`.
- [ ] Confirm the live-list density trade-off (full cards instead of the old compact row) is acceptable in practice during a real multi-match-live event (e.g. several concurrent Q Tour matches).

## Follow-ups (not done in this pass)

- Extending `ModernGlassCard`'s gradient-card treatment to Calendar/Ranking/Stats' own row/card components — still only Home's `MatchItem` uses it (this was already an open follow-up from the earlier session, still open).
- The Poppins font-loading gap (open mission from the earlier session) remains unfixed — `ScreenHeader`'s `fontWeight: '800'` addition works around it for this one component, but every other `fontFamily: 'PoppinsBold'`-style reference in the app is still silently rendering in the system default font at default weight.
