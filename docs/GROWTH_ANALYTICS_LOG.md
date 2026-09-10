# Growth analytics log (running, append-only)

Purpose: a single place where each growth session's actual numbers get recorded, so
"what happened over time" is data future sessions can read back, not just prose scattered
across session docs. **Append a new dated entry at the end of every growth session** — don't
edit past entries (except to fix a factual error), and don't let this substitute for the
one-off baseline/handoff docs, which stay as narrative snapshots.

Pull the numbers from: Firebase Console → Analytics Dashboard (Acquisition report / GA4
Traffic acquisition — look for `facebook`/`comment`/`group_post`/`page` rows, not just
Organic Search/Direct totals), AdMob console (impressions/revenue trend), and Play Console
(install count if visible). See `docs/GROWTH_UTM_TRACKING.md` for how attribution is tagged
and `.claude/skills/social-growth/SKILL.md` §4 for the checking procedure.

## How to add an entry

```
## <date>
- Firebase 7-day actives: <value> (<+/-% vs last entry>)
- Acquisition — tagged rows visible: <e.g. facebook/group_post: N installs, or "none yet, too early">
- AdMob: <impressions/revenue trend if checked>
- Play Console installs (if visible): <value>
- Context: <what was posted that period, e.g. "3 live-score posts + 2 Page posts">
```

---

## 2026-09-03 (baseline, pre-UTM-fix)

Full detail: `docs/ANALYTICS_BASELINE_2026-09-03.md`. Taken immediately before the UTM
tracking fix shipped — acquisition still showed only Organic Search / Direct, no channel
attribution possible yet. This is the "before" point for every comparison going forward.

## 2026-09-04

- Context: MaxBreak147 Page launched (9 posts), 2 live-score group posts, 1 bracket
  graphic across 3 destinations, new group "World Snooker Live Stream" tested (pending
  approval at session end).
- Firebase/AdMob figures: not re-checked this session (too soon after the 09-03 baseline
  and the UTM fix for tagged traffic to accumulate) — next session should do the first
  real post-fix check here.
- Acquisition — tagged rows visible: not yet checked.

## 2026-09-07 (first real post-push check, vs 2026-09-03 baseline)

- Firebase actives: 30d 124 (was 112, +11%) / 7d 52 (was 46, +13%) / 1d 12 (was 8, +50%).
  Daily-active-users widget on Project Overview also independently showed "12 +50%" this
  week vs last week.
- Revenue (in-app, Project Overview "this week vs last week" widget): $0.15, -46.1% —
  noisy/small-sample, don't over-read a single week on a low-volume app.
- Day 1 retention widget: 0%, -100% this week vs last week — likely just small-sample
  noise (a handful of new installs), not a real trend; re-check next session before
  treating as a signal.
- Events dashboard (Aug 10–Sep 6, daily): clear visible spike in screen_view,
  user_engagement, ad_impression, session_start and home_filter_select starting ~Sep 3-4
  and staying elevated through Sep 6, consistent with the growth push dates. Did not pull
  exact per-day counts (table was below the fold and the embedded GA view wouldn't scroll
  in this session — try `View more in Google Analytics` link next time to open full GA4).
- Acquisition — tagged UTM rows: not checked this session (ran out of session budget after
  the embedded dashboard proved slow/unscrollable) — still the single most important open
  check, since it's the only way to prove which channel (FB group/Page vs organic) is
  driving the active-user increase above. Do this first next session.
- AdMob (last 7 days vs previous 7 days, checked 2026-09-07):
  - Estimated earnings ₪0.56 (-₪0.27, -32.56%) — down, but less steep than the -52.40%
    drop at the 09-03 baseline.
  - Requests 860 (+178, +26.10%) — accelerating (was +15.25% at baseline).
  - Impressions 566 (+104, +22.51%) — **flipped from -17.86% at baseline to positive** —
    this is the clearest volume win of the push.
  - Match rate 86.05% (+0.14%) — flipped from -23.77% at baseline to flat/slightly positive.
  - eCPM ₪0.99 (-₪0.81, -44.95%) — still falling, similar magnitude to baseline's -42.05%.
    This looks like a market/demand-side eCPM squeeze, not something the growth push
    controls — revenue-per-impression keeps softening even as volume improves.
  - Per-app split: Android ₪0.39 earnings (-0.85%) / 494 impressions (**+56.83%**) — the
    volume gain is almost entirely Android, which is exactly where the FB push points
    users. iOS ₪0.17 (-60.69%) / 72 impressions (-51.02%) — iOS declining on both fronts,
    consistent with growth effort being Android/Play-Store-focused.
- Play Console: not reachable this session (developer-account picker click didn't navigate
  through, didn't retry further — low priority since Firebase actives already cover the
  installed-base trend).
- **Read**: ad *volume* (requests/impressions/match rate) clearly improved and the
  improvement is concentrated on Android — consistent with the FB group/Page push working
  as intended. Ad *revenue* (eCPM) is still soft, but that's a demand-side/eCPM-market
  factor separate from the growth push, not evidence the push isn't working. Firebase
  actives (7d +13%, 1d +50%) point the same direction. Can't yet attribute the increase to
  a specific channel (FB vs organic) without the UTM acquisition check — that's the
  priority for next session.

## 2026-09-08

- Firebase actives (28d/7d/1d): 126 / 49 / 12 (vs 09-07's 124 / 52 / 12) — roughly flat
  since yesterday, no dramatic move either direction. Normal day-to-day noise at this
  volume.
- **UTM acquisition check (first real one since the fix)**: GA4 → User acquisition: First
  user medium now shows a **distinct `page_post` row** for the last 28 days — 1 total user
  (0.79% of 127), 1 new user, 53 events, 100% key-event rate, first appearing on the trend
  chart ~Sep 3-4 and holding a flat non-zero line since. This is the first direct proof the
  UTM tagging → Play referrer → Firebase pipeline actually works end-to-end, not just
  theoretically. Volume is still tiny (1 user) — too early to read as a channel comparison,
  but the plumbing is confirmed working. Re-check with more accumulated days before drawing
  conclusions about channel effectiveness. Note: the medium label is `page_post`, not one of
  our own `utm_medium` values (`comment`/`group_post`/`page`) — looks like Meta's own
  automatic UTM tagging on Page-post link clicks, separate from our manual tags; worth
  understanding better next session rather than assuming which link drove it.
- AdMob (last 7 days vs previous 7 days, checked 2026-09-08):
  - Estimated earnings ₪0.54 (-₪0.35, -39.15%) — still declining, similar range to 09-07
    (-32.56%).
  - Requests 957 (+184, +23.80%) — continued growth, consistent with 09-07's +26.10%.
  - Impressions 683 (+171, +33.40%) — accelerating further from 09-07's +22.51%.
  - Match rate 89.97% (+7.04%, +8.50% rel) — continued improvement from 09-07's 86.05%.
  - eCPM ₪0.80 (-₪0.95, -54.39%) — worse than 09-07's -44.95%, the demand-side eCPM squeeze
    is deepening even as volume keeps growing.
  - Per-app split: Android 471 impressions (+29.75%) / ₪0.33 earnings (-27.57%); iOS 212
    impressions (**+42.28%**, a new positive — iOS was declining as of 09-07) / ₪0.22
    (-51.01%). Both platforms now gaining impression volume, not just Android.
- Context: this morning's user-run schedule post to 8 groups (2 declined/pending: Snooker TV
  appears removed, World Snooker Live Stream stuck in approval-queue history but this one
  cleared and got 8 likes); 1 Gemini AI-generated brand poster to the Page; 1 real-screenshot
  live+upcoming update (with the Ronnie O'Sullivan withdrawal hook) cross-posted to Snooker
  (227K) and Legend Ronnie (60.2K) groups, plus a data-verified reply to a fan comment.
- **Read**: volume metrics (requests/impressions/match rate) keep improving on both
  platforms — the growth push is still translating into more ad traffic. Revenue-per-
  impression (eCPM) keeps softening, now more steeply than last week; this looks like a
  continuing market-wide eCPM trend rather than anything the push can fix. The UTM pipeline
  is now confirmed working end-to-end with real (if tiny) data — next session should let
  more days accumulate then re-check for a real channel-comparison read.

## 2026-09-09

- Firebase actives (30d/7d/1d, Android app, project overview vs Analytics Dashboard both
  checked): 130 / 52 / 12 (vs 09-08's 126(28d)/49/12) — small continued uptick, still normal
  noise range at this volume, not a step-change.
- Project Overview widgets (this week vs last week): DAU 12 (+9.1%), Day 1 retention 100%
  (+400% — small-sample, likely just one or two new installs both retaining), Revenue $0.17
  (-4.6%, roughly flat).
- **GA4 User acquisition: First user medium (last 28 days, Aug 12–Sep 8)**: Total 125 users,
  79 new. `(none)` 71 total/54 new (68.35% of new users) — direct/organic-app installs with
  no medium tag. `organic` 53 total/24 new (30.38%). `page_post` (Meta's own auto-tag on Page
  link clicks) still just **1 total user / 1 new user (1.27%)** — identical to the 09-08
  reading, no growth in tagged attribution in the last day. No `comment`/`group_post` rows
  (our manual UTM tags) have appeared yet at all — either no one has actually tapped a
  manually-tagged link and installed since, or volume is too low to register. This remains
  the weak link: acquisition is still overwhelmingly unattributed (`none`) or plain organic,
  not traceable to any specific FB group/comment push.
- AdMob (last 7 days vs previous 7 days, checked 2026-09-09):
  - Estimated earnings ₪0.59 (-₪0.02, -3.90%) — roughly flat, much less steep than 09-08's
    -39.15%.
  - Requests 1.04K (+359, +52.87%) — accelerating further from 09-08's +23.80%.
  - Impressions 798 (+394, +97.52%) — nearly doubled, a big jump from 09-08's +33.40%.
  - Match rate 93.06% (+16.04%, +20.82% rel) — continued strong improvement from 09-08's
    89.97%.
  - eCPM ₪0.74 (-₪0.78, -51.35%) — still falling, similar magnitude to recent weeks; the
    demand-side eCPM squeeze persists regardless of the volume gains.
  - Per-app split: Android (MaxBreak: Live Snooker) ₪0.36 earnings (-9.49%) / 572 impressions
    (+73.33%); iOS (MaxBreak) ₪0.23 earnings (**+6.49%, first earnings gain in weeks**) / 226
    impressions (+205.41%, the biggest single jump of the tracked period). iOS had been
    declining on both fronts through 09-07/09-08 — this is a reversal worth watching, not
    yet explained by any iOS-specific push activity this week.
- Context: no new posting activity today prior to this check — this is a pure analytics
  status pull, reflecting the cumulative effect of the 09-07/09-08 growth pushes (English
  Open R1, Ronnie withdrawal post, schedule graphics across 8 groups).
- **Read**: ad volume (requests/impressions/match rate) is accelerating hard on both
  platforms — impressions nearly doubled week-over-week, and iOS in particular flipped from
  multi-week decline to its strongest growth yet. Firebase actives are flat/slightly up, not
  matching the ad-volume acceleration 1:1 — plausible explanation is existing users opening
  the app more (more sessions/ad requests per user) rather than a wave of brand-new users,
  which fits the GA4 read below. eCPM keeps softening regardless — a market-wide trend, not
  a push problem. **Attribution is still the open gap**: 28-day GA4 acquisition shows only 1
  user ever tagged to `page_post` and zero to any of our manual `comment`/`group_post` UTM
  tags — the growth push's effect is visible in aggregate (actives, ad volume) but still not
  attributable to a specific channel. Next session: consider whether tagged links are
  actually being clicked at all (check group-post click patterns) before assuming the UTM
  pipeline itself is the bottleneck — it was confirmed technically working on 09-08.

### 2026-09-09 addendum — eCPM root cause found (format mix, not market squeeze)

Follow-up dig (AdMob eCPM Trends peer-benchmark report + Ads Activity report broken down by
Format, last 7 days) to answer "why won't eCPM/earnings improve":

- **Blended eCPM vs. peers (11,783 similar Action-games Android apps): ₪0.86 vs. ₪6.68 — we
  sit at ~13% of peer average.** But broken out by format the picture flips:
  - **Banner**: ours ₪0.55 vs. peer ₪0.85 — only mildly behind (~65% of peer).
  - **Interstitial**: ours ₪8.94 (14-day) vs. peer ₪8.17 — **we are at or above peer eCPM**
    on this format. Confirmed again on the 7-day Ads Activity breakdown: Android interstitial
    ₪6.68 eCPM, iOS interstitial **₪24.39 eCPM**.
  - **Root cause**: it's a volume-mix problem, not a pricing/demand problem. Of 1,038 total ad
    requests this week, only **19 were interstitial (12 Android + 7 iOS) vs. 1,019 banner
    (98% of all requests)**. Interstitial earned ₪0.22 of the week's ₪0.59 total (37%) from
    just 2% of requests — banner earned the rest from the other 98%. The blended average is
    being dragged down by sheer banner volume even though banner itself isn't badly priced.
  - This lines up with the known config: interstitial fires once per session after the first
    frame (`config/ads.ts`, session-wide cap, per MEMORY.md) — by design, users see many more
    banner impressions than interstitial ones per session.
- **Implication**: the fastest lever for revenue right now is **increasing interstitial (and/or
  rewarded) impression share**, not chasing banner eCPM or blaming the market. Any format-mix
  or frequency-cap change is a real code change to `config/ads.ts` — needs its own plan +
  approval per CLAUDE.md before touching it, and must weigh revenue against UX/retention
  (the session-wide cap exists for a UX reason, not by accident).
- New-user/growth check same session: Firebase actives ticked up intraday (1d: 12→13,
  Realtime showed 1 active user in Italy — a country outside the FB-push geo mix, notable but
  single data point). GA4's 28-day acquisition table had not reprocessed past Sep 8 yet
  (standard 24-48h GA4 processing lag) — same 125 total/79 new/1 page_post numbers as
  yesterday's read, not evidence of stagnation, just not-yet-available data. No dramatic
  installs spike either way as of this check.
