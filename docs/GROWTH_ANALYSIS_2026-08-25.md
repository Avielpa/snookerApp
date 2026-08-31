# Growth Analysis — 2026-08-25 Baseline

## The honest headline number

**~124 monthly active users, combined Android + iOS** (Firebase Analytics, single GA4 property spanning both platforms — this is a real usage count, not a store's rounded "100+" badge). 36 weekly active, 10 daily active. Revenue is currently negligible: ₪3.27 last month, ₪2.34 this month so far (AdMob) — confirms the growth work matters more than any monetization tuning right now; there's not enough volume yet for ad revenue to be meaningful.

Full raw numbers, sourced and dated: `docs/growth_metrics_tracker.csv` — append new pulls to this file each check-in so it becomes a real time series instead of a single snapshot.

## Pre-campaign baseline (before today's ASO + Facebook push)

| Signal | Value | Trend |
|---|---|---|
| Android Monthly Active Devices (28d) | 46 | **+24%** (already growing before today) |
| Android Device acquisitions (28d) | 35 | **-5%** (flat/declining — the actual problem) |
| iOS downloads (30d) | 12 | — |
| iOS product page → download conversion | 12/53 ≈ **23%** | — |

**Read on this:** retention/engagement was already trending up (+24% MAD) — people who find the app are sticking with it. The bottleneck was pure discovery: new-install acquisition was flat-to-down. That's exactly what today's work (ASO rewrite + Facebook posts + genuine comments on 4.5M/14M-follower pages) targets — it's an acquisition push, not a retention fix, and the data says that was the right lever to pull.

## Why I can't yet tell you if today's actions worked

**Play Console and App Store Connect both lag 2–3 days** — their charts only go through Aug 22–23 right now. Today's ASO changes and 5 Facebook group posts (published this afternoon, Aug 25) won't show up in install data until **~Aug 27–28 at the earliest**. Firebase's real-time view shows current activity (1 active user right now, UK) but the daily/weekly aggregate numbers above still reflect the pre-campaign period.

**Bigger gap: no attribution.** None of today's Facebook links carry tracking parameters, so even once installs move, Play Console will show it as a lump "organic" number — it won't tell us *which* group or post drove it. I flagged this and you asked me to prioritize the Firebase/Excel analysis first; UTM-tagging future links is still the right next move so the *next* check-in can actually say "the 227K group worked, the 50K one didn't" instead of guessing.

## What to check, and when

- **Tomorrow (Aug 26):** first partial signal in Firebase real-time/DAU (updates faster than the store consoles). Won't be conclusive on its own — one day of noise.
- **Aug 27–28:** Play Console "Device acquisitions" and App Store Connect "Total Downloads" charts will include the campaign period. Compare against the 35 (Android) / 12 (iOS) pre-campaign 28/30-day baselines above.
- **End of week (per your 1K target):** re-pull the same metrics into `growth_metrics_tracker.csv`, diff against this baseline row.

## Recommended next actions to maximize effect (ranked)

1. **Add UTM-style tags to every future store link** (`?utm_source=fb_snookerlovers` etc.) — zero app-code cost, turns the next check-in from "did anything happen" into "what worked." Only reason this wasn't done today: you redirected me to this analysis first.
2. **Post in the remaining ~40 groups** you're a member of (5 done, real audience, all screened for piracy-adjacent content first) — acquisition is the proven bottleneck, and this is the same playbook that's already producing rich-preview posts with real screenshots.
3. **Hold paid spend** until the Aug 27–28 check-in — no point buying installs before we know whether the free channel is converting; per your own instruction to see week-1 results before budget decisions.
4. **Fix the Apple Keywords field** (still missing `scoreboard`/`rankings`/`rules`/`referee`) — small, real, still open from earlier in the session.
