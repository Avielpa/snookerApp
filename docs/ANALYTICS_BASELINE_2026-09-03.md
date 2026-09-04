# Analytics Baseline — 2026-09-03

Snapshot taken before the Sept 3 promo push (British Open FB graphic + UTM tracking rollout +
scoreboard ad fix) so future sessions can measure real before/after impact instead of guessing.

## Firebase Analytics (28 days, Aug 6 – Sep 2, 2026)

| Metric | Value |
|---|---|
| Active users — 30d / 7d / 1d | 112 / 46 / 8 |
| New installs (`first_open` event) | 66 |
| Crash-free users | 100% |
| Avg engagement per user | 18m 21s |
| Engaged sessions per user | 4.4 |
| Top countries (30d actives) | Israel 35, UK 13, US 10, Italy 8, China 3, India 3, Myanmar 3 |
| Acquisition channel breakdown | Organic Search > Direct — **no other channel visible** (pre-UTM-fix gap, see [[project_2026-09-03_growth_utm_tracking]]) |
| Ad revenue (28d, in-app) | $0.89 |
| Top screens by views | MainActivity 815, RNSScreen 432, UIViewController 244, /CalendarEnhanced 97, /scoreboard 93, AdActivity 85 |
| Top events | screen_view 3.3K, user_engagement 1.3K, ad_impression 1.1K, session_start 543, home_filter_select 431, tab_select 266, notification_receive 262 |

## AdMob (last 7 days vs previous 7 days, as of 2026-09-03)

| Metric | Value | WoW change |
|---|---|---|
| Estimated earnings | ₪0.41 | -52.40% |
| Ad requests | 612 | +15.25% |
| Impressions | 345 | -17.86% |
| Match rate | 74.51% | -23.77% |
| eCPM | ₪1.20 | -42.05% |
| Total earnings today / yesterday / this month / last month | ₪0.01 / ₪0.03 / ₪0.11 / ₪3.05 | — |
| Per-app: Android earnings/impressions | ₪0.29 / 275 impr | -5.82% impr |
| Per-app: iOS earnings/impressions | ₪0.12 / 70 impr | -45.31% impr |

Note: this AdMob window predates the scoreboard interstitial fix shipped 2026-09-03 (see
[[project scoreboard interstitial fix — pending doc]]) — the fix should push scoreboard ad
impressions up going forward; re-check AdMob in ~7 days to see if it moves.

## Play Console

| Metric | Value |
|---|---|
| Installed audience (current, Android) | 83–93 (fluctuates daily) |
| Ratings | 6 users rated, 4 with written reviews |
| Policy status | Clean (stale test-track flag resolved earlier same day, see [[project_2026-09-03_play_store_api36_compliance]]) |

## Total user count — reconciled

User's own estimate (100–150) was accurate. Real numbers:
- Android currently installed: ~83–93
- Cross-platform (Android+iOS) 30-day actives: 112
- No single "total users" number exists across both stores — this is the honest range.

## What changed same day, after this snapshot

1. UTM/referrer tagging scheme set up for all future outbound growth links — see `docs/GROWTH_UTM_TRACKING.md`. Nothing before this point is tagged; all installs to date are Organic/Direct in Firebase regardless of true source.
2. British Open Round 2 promo graphic (8 real matches, QR to **untagged** Play Store link) posted to Facebook "Snooker" group (227K members) — approved by admins, 3 likes as of first check.
3. Scoreboard interstitial ad bug found and fixed (was silently never firing for players who tap through frames at normal speed) — shipped to preview then production same day.

## How to use this doc

Next time analytics are pulled, repeat the same three checks (Firebase Analytics Dashboard,
AdMob Home, Play Console Statistics) with the same metrics above, and diff against this
snapshot. Once future FB/Reddit/IG posts use tagged links, the Firebase acquisition channel
table should start showing real per-channel numbers instead of collapsing into Organic/Direct.
