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

## 2026-09-11 — first read after Match Detail interstitial trigger (shipped 09-10)

- Firebase actives (30d/7d/1d): 124 / 50 / 14 (vs 09-09's 130/52/12) — roughly flat, 1d ticked
  up slightly. Project Overview "this week vs last week" widget: DAU 14 (-22.2%), Revenue
  **$0.29 (+128.7%)** — a big jump, first week to meaningfully include the new trigger's
  production traffic (shipped mid-day 09-10, so ~1 full day of live data in this "week").
- AdMob (last 7 days vs previous 7 days): estimated earnings **₪0.92 (+₪0.54, +140.16%)** —
  by far the strongest earnings week in the tracked period. Requests 1.06K (+68.46%),
  impressions 798 (+111.11%), match rate 90.97% (+15.03% rel). **eCPM ₪1.15 (+₪0.14,
  +13.76%) — the first positive eCPM week since tracking started** (was -44.95%/-54.39%/
  -51.35% on 09-07/08/09). Consistent with the volume-mix fix (more interstitial
  opportunities → higher blended eCPM) working as designed.
- Format breakdown (Ads Activity report, last 7 days): Android interstitial ₪0.39 earnings /
  ₪24.36 eCPM / 17 requests; Android banner ₪0.34 / ₪0.60 / 792 requests. iOS interstitial
  ₪0.11 / ₪36.21 eCPM / 3 requests; iOS banner ₪0.08 / ₪0.36 / 251 requests. Interstitial
  now earns **₪0.50 of ₪0.92 (54% of the week's revenue) from just 20 of 1,063 requests
  (~2%)** — up from 37%/2% the week before the fix. Caveat: interstitial *request volume*
  itself (20) barely moved vs the prior week's 19 — this week's data is still dominated by
  the 6 days *before* the fix shipped. Isolated "Yesterday" (Sep 10 only, the ship day):
  Android interstitial 3 requests / ₪0.05 / ₪17.11 eCPM out of 85 total impressions (~3.5%
  share, up from the long-run ~2% baseline) — a promising but single-day, small-sample
  signal, not yet proof of a durable share increase.
- GA4 Pages/screens (28 days): revenue by screen shows **AdActivity (the Android ad-render
  activity) at $0.39 of $0.96 total (40.6%)** and **RNSScreen (generic RN native-screen
  container, iOS+Android) at $0.27 (28.1%)** — both ad-serving container screens, not
  content screens, which is expected. **Gap found**: the app's screen_view events use
  default React Navigation/native container names (MainActivity, RNSScreen,
  UIViewController, GADFullScreenAdViewController, etc.), not per-route names — so GA4
  cannot isolate "Match Detail" specifically from other RNSScreen-classed routes. Content
  screens that *do* get real names (probably via explicit `logScreenView` calls) are the
  top-level tab routes: `/` (Home, 998 views/28d, 9m20s avg engagement), `/scoreboard` (119
  views, 39 users), `/CalendarEnhanced` (116), `/RankingEnhanced` (65), `/scoreboard/game`
  (64, 16m12s avg — by far the longest session length of any screen), `/NewsScreen` (60),
  `/StatsScreen` (43), `/tour/*` and `/player/*` detail routes (single digits to low tens).
  **Suggestion for next session**: add an explicit `logScreenView({screen_name:
  'MatchDetail', screen_class: 'MatchDetail'})` call (or equivalent) in `MatchEnhanced.tsx`
  so future analytics can actually attribute engagement/revenue to Match Detail by name,
  not lump it into the generic RNSScreen bucket.
- Context: no growth-push posting today; this was a pure analytics status check to read the
  effect of yesterday's `useMatchDetailInterstitial` production ship (commit `0ef29c00`).
- **Read**: strong first signal — eCPM flipped positive for the first time in five tracked
  weeks and total earnings roughly doubled week-over-week, both consistent with the
  volume-mix fix. But the encouraging weekly numbers are still mostly pre-fix data (the fix
  had ~1 day of live production traffic in this reading) and interstitial request-volume
  share hasn't visibly grown yet — reconvene in 2-3 more days once a full multi-day window
  post-fix has accumulated before calling this a confirmed win. Don't over-claim on one
  day's data.

## 2026-09-14 — status check (3 days after the 09-11 push, interstitial fix now 4 days live)

- Firebase actives (30d/7d/1d): 122 / 39 / 18 (vs 09-11's 124/50/14) — 7d dropped noticeably
  (-22%), 1d ticked up (+29%). Reads as normal noise at this volume, not a clear trend either
  way.
- AdMob (last 7 days vs previous 7 days): estimated earnings **₪0.94 (+₪0.38, +67.84%)**,
  requests 1.06K (+22.91%), impressions 780 (+37.81%), match rate 88.65% (+3.02% rel),
  **eCPM ₪1.20 (+₪0.22, +21.79%)** — second straight positive eCPM week (was ₪1.15/+13.76%
  on 09-11), now with a full window of post-interstitial-fix traffic. Confirms the volume-mix
  fix (shipped 09-10) is holding, not a one-day blip. This month so far ₪1.41 vs ₪3.05 last
  month (partial month, not comparable yet).
- Per-app split: Android ₪0.81 earnings (**+110.66%**) / 479 impressions (-3.04% — earnings up
  sharply on roughly flat volume, i.e. real eCPM gain, not more traffic); iOS ₪0.12 (-28.00%) /
  301 impressions (**+318.06%** — impression volume exploding but not converting to revenue,
  worth a look if it continues).
- **09-11 push engagement (checked via activity log + post permalink)**: the flagship Snooker
  227.8K group post ("English Open QF" schedule+results graphic) sits at **1 like, 0 comments,
  1 share** three days on — well below the 09-08 benchmark (8 likes/3 shares/3 comments on a
  live-score post) and the 09-07 schedule-graphic benchmark (11 likes/2 comments). Did not
  audit the other 8 destinations this session (time-boxed); worth a fuller pass next session.
  Also found: a **stale pending post from May 6** (old app-launch announcement) still sitting
  in the Snooker group's admin-approval queue, unrelated to the 09-11 push — harmless but
  worth deleting via "ניהול פוסטים" next time to avoid confusion when checking approval status.
- **MaxBreak147 Page: still 1 follower**, 10 days after launch (09-04) and 3 days after the
  09-11 cross-post — the zero-follower bootstrap plan (skill §3) has not moved the needle yet.
- Context: no new posting this session — pure status/analytics check requested by the user.
- **Read**: the interstitial revenue fix is the clear win of the week — 2 consecutive positive
  eCPM weeks, Android earnings +110% on flat volume. Social engagement on the heavy 09-11 push
  is weak on the one post checked; Page growth is flat at 1 follower. Actives are flat/noisy.
  Next session: audit the remaining 8 destinations from 09-11 for a fuller engagement read, and
  keep watching whether the eCPM gain holds into a 3rd week now that the fix has a full month
  to mature.

### 2026-09-14 follow-up — installs/events/attribution deep-dive (same day, second check)

- **Installs (28d, GA4 `first_open` event)**: 76 — matches the "New users" figure exactly, so
  this is the reliable cross-check number for installs going forward (Play Console's own
  Statistics install-count graph was not reachable this session — account picker + vitals nav
  both proved flaky, consistent with the known 09-08 note; **Play Console dashboard did surface
  a usable number instead**: 28d Installs 59 / Device first opens 14 (-33%) / Monthly active
  devices 50 (+9%) / Install base 66.3% — a *narrower* Play-specific window than GA4's 76, both
  numbers are legitimate but count slightly different things, don't mix them in one comparison).
- **Play Console install base**: 92 total installed-audience devices account-wide; production
  build 78 at 66.67% install-base share across 177 countries/regions (synced to open + internal
  testing tracks too).
- **GA4 User acquisition — first user channel group (28d)**: 76 new users total → Direct 51
  (67%), Organic Search 24 (32%), **Organic Social 1 (1.3%)**. By source/medium: `(direct)/(none)`
  67 total/51 new, `google-play/organic` 53 total/24 new, **`facebook/page_post` 1 total/1
  new (0.83%)** — unchanged from every prior check back to 09-08. **Zero users have ever been
  attributed to our own manual `comment`/`group_post` UTM tags**, despite dozens of tagged links
  posted since 09-03 including the 09-11 heavy push across 9 destinations. This is now a
  6-day-confirmed pattern, not noise — worth treating as a real open problem, not "too early to
  tell" anymore.
- **Top events (28d)**: screen_view 4,346 (117 users) · user_engagement 1,799 (106 users) ·
  ad_impression 1,795 (81 users, $1.02 rev) · session_start 720 (118 users) ·
  home_filter_select 567 (47 users) · notification_receive 480 (4 users) · tab_select 303
  (51 users) · match_card_open 152 (43 users) · notification_dismiss 140 (4 users) · first_open
  76 (76 users). Total event count 10,436 across 121 users.
- **Facebook sessions/traffic**: could not get a direct "FB→app session" count — GA4 doesn't
  surface it as its own metric, and the `facebook/page_post` row above (1 user, 53 events, 2m12s
  avg engagement) is the only FB-sourced slice GA4 can currently isolate. The 8 manually-tagged
  destinations from 09-11 remain invisible to GA4 entirely.
- **Edge-to-edge / Android 16 targetSdk compliance**: not re-checked live this session (Play
  Console's Android-vitals/technical-quality nav didn't resolve reliably, same flakiness noted
  before). Status per memory/OPEN_MISSIONS is unchanged from last known: **flagged, not yet
  actioned** — a real code change (`targetSdkVersion` bump + edge-to-edge layout adjustments)
  still needs its own plan + approval before touching. Don't assume it's done.
- **Suggestions surfaced by this pass**:
  1. Stop treating the UTM attribution gap as "not enough time yet" — 0 users across 9+
     manually-tagged posts over 6+ days is a real signal. Worth checking next session whether
     Facebook's own link-shortening (onelink.to auto-replies, the known gotcha in the skill) is
     silently stripping the referrer tag on some fraction of these before install, not just
     assuming users aren't clicking.
  2. The `page_post`-tagged click (1 user, 53 events) shows tagged traffic *can* convert and
     engage heavily when it's captured — reinforces it's a tracking/link-mechanics problem, not
     a "nobody clicks" problem.
  3. Play Console's own install/vitals UI keeps being unreliable for live checks (recurring
     across 09-09, 09-14) — GA4's `first_open` event count is the more dependable install proxy
     going forward; use it first.

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

## 2026-09-14 (session 3) — posting push resumed after the offline gap

- Context: user asked for a "massive" push after being offline since Friday, flagging low
  Page views but real traffic on posts (matches the 09-14 session-1/2 findings above: Page
  stuck at 1 follower/0 engagement, groups are where the real reach is). Today's live tour
  content was Qualifiers-only (no TV-stage names) — checked `calendar/?tab=recent` and found
  the English Open had just finished, so led with that verified real result instead.
- Posted (all with a real, ad-cropped device screenshot of live Northern Ireland Open
  Qualifiers scores + the Ali Carter 9-6 Mark J Williams English Open final result, both
  Play Store UTM link and iOS App Store link): Snooker (227.8K, went straight live, no
  approval gate), Legend Ronnie O'Sullivan Snooker (60.2K), MaxBreak147 Page (Promote-post
  toggle correctly turned off, "Talk to people directly" upsell declined). SNOOKER TODAY
  (27.3K) hit a new "pending content limit" error for this account — not attempted further
  this session.
- No Firebase/AdMob re-check this session (too soon after this morning's session-1/2 checks
  on the same day) — next session should look for any movement from today's posts once a
  day or two has accumulated, same as every prior push.

## 2026-09-15 — daily reply-check + light post (Northern Ireland Open Quali)

- Reply-check pass (per §0a step 1) on all three 2026-09-14 posts before posting anything new:
  Snooker 227.8K (3 likes, 0 comments), Legend Ronnie O'Sullivan Snooker (1 like, 0 comments),
  SNOOKER TODAY (still pending admin approval, never cleared — the "pending content limit"
  error from 09-14 evidently blocked it outright). Nothing to reply to. Page's own 09-14
  cross-post: still 0 likes/0 comments visible on the management panel.
- Today's tour content was thin — only Northern Ireland Open Qualifiers Round 1 live (lower-
  profile names: Mertens, Hill/Muir, Robertson/Burden, Davies/Zhengyi), no TV-stage names,
  English Open already covered yesterday. Per the cadence rule, capped this sitting at 1
  destination: posted a real, freshly captured S24 screenshot (ad banner cropped) of the live
  Round 1 scores to Snooker (227.8K) — both Play Store UTM link (`snooker_227k_daily_0915`
  campaign) and iOS App Store link included, plus a line asking readers to follow the Page
  (per the 09-14 bootstrap-gap finding). Went to admin approval, not instant this time.
- Firebase Acquisition (GA4, last 28 days, Aug 18–Sep 14): 75 new users total — Direct 50,
  Organic Search 24, **Organic Social 1**. The attribution gap flagged 09-14 is still
  unresolved: despite the 09-11 and 09-14 pushes (9+ posts across groups/Page), only 1 new
  user total shows as Organic Social in the last 28 days. Reinforces the 09-14 finding that
  either Facebook's link-handling is stripping the UTM referrer, or clicks simply aren't
  converting to installs — the self-hosted-redirect idea in the skill's Insights section is
  still the real fix, not yet built.
- AdMob not re-checked this session (light session, no reason to expect movement since the
  09-10 interstitial-fix check).

## 2026-09-15 (session 2) — AI-image brand-awareness push, video generation investigated

- Context: user asked to explore turning the earlier "personal-best" video concept brainstorm
  into real content ("create videos, create images whatever you want just promote it"). Spent
  significant effort trying Gemini's Veo video generator first — **confirmed broken this
  session**: 5/5 attempts failed identically (indefinite spin, no error, nothing ever saved
  to Library), including from a completely fresh tab/chat, ruling out stale-session causes.
  Pika (an alternative free video tool) requires creating a new third-party account — declined
  per standing account-creation rule, not attempted even under broad "do whatever"
  authorization.
- Pivoted to Gemini's **image** generator instead (confirmed working, ~10s to generate) —
  produced a real, high-quality illustration (2 men celebrating a break at a home snooker
  table) matching the "personal best" moment concept. Per the skill's AI-image ground rule,
  this is legitimate brand-awareness content (no live/specific data claimed in the image
  itself) — the caption ties it to the Personal Best + Challenge a Friend features, both
  genuinely shipped to production 2026-09-14, so no fabrication risk.
- Posted (2 destinations, per the skill's session cadence cap): **Snooker (227.8K)** — went
  live instantly; **Legend Ronnie O'Sullivan Snooker (60.2K)** — went to admin approval queue
  (normal for this group). Both posts: Play Store link tagged `pb_feature_brand_0915`
  campaign + iOS App Store link.
- Not re-checked this session: Firebase/AdMob (too soon after this morning's session-1 check
  same day) — next check should look for `pb_feature_brand_0915` as a new distinguishable UTM
  campaign once a few days of data accumulate.
