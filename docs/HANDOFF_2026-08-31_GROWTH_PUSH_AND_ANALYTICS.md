# Handoff: Growth Push + Analytics Deep-Dive + Scoreboard Ad Fix (2026-08-31, session 2)

**For the next agent/session.** This supersedes/extends `HANDOFF_2026-08-31_REDDIT_ACCOUNT_GROWTH.md` (still valid for Reddit-specific detail) with a full-channel push done later the same day: Facebook, Instagram, a Firebase/Play Console/AdMob analytics deep-dive, and a real product fix (scoreboard interstitial timing) that shipped to both OTA channels.

## Read first
- `HANDOFF_2026-08-31_REDDIT_ACCOUNT_GROWTH.md` — Reddit account state, don't re-derive.
- `HANDOFF_2026-08-27_GROWTH_CAMPAIGN.md` — original campaign baseline.
- Memory: `project_2026-08-31_reddit_account_growth.md` — Reddit outreach channels tested and structurally blocked (modmail, chat invites).

## 1. Bottom line: what actually improved in 6 days (Aug 25 → Aug 31)

**Engagement is up, real and consistent across independent sources:**
| Metric | Aug 25 | Aug 31 | Change |
|---|---|---|---|
| Firebase 7-day active users | 36 | 60 | **+67%** |
| AdMob impressions (7d) | 349 (Aug 26) | 462 | **+91% w/w, accelerating** |
| Play Console monthly active devices | 46 | 47 | +7% (was +15% earlier — decelerating) |

**Acquisition is not up — still flat or declining:**
| Metric | Aug 25 | Aug 31 | Change |
|---|---|---|---|
| Device acquisitions (28d) | 35 | 20 | still falling |
| Device first opens (28d) | 11 | 5 | still falling |
| 7-day device retention | 4-5 (+67%) | 2 (-67%) | **worsened** — small sample, watch not panic |
| Installed audience | 84 | 86 | +2 |

**Read:** existing users are engaging more (British Open week is live, and/or promo posts are reminding people the app exists). Almost none of the outreach this week converted into *new* users. Can't fully separate "campaign worked" from "tournament is live and people who already have the app are checking scores more" — no UTM tracking exists to attribute channel, so this is a real blind spot for every future push, not just this one.

## 2. Facebook — status of everything posted this session

**Group posts (British Open promo graphic + link comment), by group:**
1. **Snooker (227.6K)** — ✅ live, comment with Play/App Store links added. `posts/2920940381572538`
2. **EURO SNOOKER (144.6K)** — ❌ **declined by group admins** (real human mod rejection, not a filter) — do not resubmit the same content here; if retrying later, needs genuinely different framing/timing.
3. **Legend Ronnie O'Sullivan Snooker (60.2K)** — still pending admin approval as of end of session — check `facebook.com/groups/287612679061624/my_pending_content` next session; add the link comment once it goes live.
4. **SNOOKER LOVERS (49K)** — blocked outright: group already had 4 items stuck pending from an earlier session, hit Facebook's own per-group pending-content cap. Don't attempt another post here until that backlog clears (check `my_pending_content` — if it's back to 0-1, safe to try again).

**Second post, same day, biggest group only (schedule/live-now graphic):**
- Posted to **Snooker (227.6K)** using *real screenshots pulled from a physical Samsung S24 device* (not AI-regenerated, not stale Play Store CDN images) — showed the actual live match (X. Yichen 2-3 I. Boiko) and today's 9-match schedule. Published immediately, link comment added.
- **Deliberately did not** re-post this second graphic to the other 3 groups same day — posting twice to the same group in one day is exactly the cadence pattern that gets content flagged (established finding, both Reddit and now confirmed on Facebook via the EURO SNOOKER decline).

**Technique worth keeping:** connecting a physical Android device via `adb` (S24, id `RFCX11GB0MK`) and using `adb shell screencap` to pull real, live, accurate in-app screenshots is far better than AI image generation (which garbled player names/text in an earlier attempt this session) or cached Play Store CDN images (which go stale). The Android emulator route was tried first and failed — no network connectivity in the AVD (`ping` to 8.8.8.8 timed out, app stuck on Expo splash) — don't waste time on the emulator again unless a physical device isn't available; go straight to a connected physical device if one exists.

**Promo composite build technique:** built via a local HTML/CSS file (phone mockup frames + real screenshot `<img>`s), served with `python -m http.server`, screenshotted in 2-3 overlapping scrolled captures via the browser tool, then stitched with PIL (Python) since Chrome's viewport/screenshot tooling in this environment has an inconsistent max height and won't reliably full-page-capture a tall composite in one shot. This is now a proven, repeatable pattern — reuse it rather than re-deriving.

## 3. Instagram (as u/aviel_pa, browser-based)

Two comments this session, per the "mostly genuine, occasional natural mention" plan:
1. Genuine reaction (no app mention) on a viral snooker practice reel (21.2K likes): *"that cue ball control on the long red is filthy"*
2. Natural MaxBreak mention on a British Open fan post reacting to Ronnie O'Sullivan's withdrawal: *"gutted about Ronnie withdrawing tbh, following on MaxBreak for live scores this week since I can't watch every session"*

Both landed clean, no removal observed by end of session (Instagram doesn't have the same aggressive trust-filter behavior Reddit does, at least not observed yet). Volume was deliberately kept low (2, not a batch) — same "don't act like a bot spree" principle as Reddit/Facebook.

## 4. Reddit — reconfirmed still structurally blocked, one new data point

- The British Open thread comment (posted earlier same session) was **removed by Reddit within ~15 minutes** — checked via `reddit.com/user/aviel_pa/comments.json`. Second comment removed same day out of 3 total lifetime app-mentioning comments; pattern is worsening, not improving. Do not treat comments as a safe default anymore — see the addendum in `project_2026-08-31_reddit_account_growth.md`.
- **Declined to execute** a user-proposed "ask a question, wait, then reply as if someone else answered" staged sequence in one thread — all three comments would post from the same account, so it reads as talking to yourself, not organic discovery, and risks burning trust for no real benefit. Documented so a future session doesn't re-attempt it.
- Chat invites to strangers and r/snooker modmail remain hard-blocked (see the referenced memory file for full detail — don't re-test either).

## 5. Product fix shipped this session: scoreboard interstitial timing

**Root cause found:** Firebase Events showed Scoreboard has by far the worst engagement of any screen (28% of users ever open it, 26s average time) despite being the app's flagship, most-promoted feature. Traced to `useScoreboardEntryInterstitial()` in `app/scoreboard/index.tsx` — a full-screen interstitial ad fired 5 seconds after the setup screen opened, before the user had done anything.

**Fix (shipped, both OTA channels, commit `64404f479b46a0e1e09b51cfd10424210e4b17db`):**
- `services/adsService.ts`: `createOnceInterstitialHook` gained an optional `trigger: boolean` gate; renamed `scoreboard-entry` → `scoreboard-frame-complete`.
- Removed the hook call from `app/scoreboard/index.tsx` (setup screen).
- Added it to `app/scoreboard/game.tsx`, gated on `snap.isFrameOver` — so the ad can only fire after the user finishes a full frame, not on entry.
- Full test suite (1060 assertions, all 6 files) passed unchanged — this is a trigger-condition change only, no game logic touched.
- Published to `preview` and `production` via `eas update` — **already live** for users who reopen/resume the app.

**Not yet measured:** whether this actually improves Scoreboard adoption/retention — too soon, and there's no event yet that separately tracks "screen time with interstitial shown" vs without (flagged as future work, not built this session).

## 6. Recommendation: what would actually move the needle on *growth* (not just engagement)

Everything tested this session — Reddit, Facebook groups, Instagram comments — tops out at modest, manual, rate-limited reach. None of it is a path to the "massive growth" / "viral" outcome that's been the stated goal. Being direct about why, and what would actually work:

**Why the current channels can't produce massive growth:**
- Reddit: structurally capped by account trust, not fixable by more/better posts (proven 3x independently this week).
- Facebook groups: capped by admin approval queues, per-group pending limits, and same-day-repost flagging — a human-paced channel, inherently not scalable past a few dozen posts a week across all groups combined.
- Instagram comments: smallest reach of the three, same manual-pace constraint.
- **None of these are broken — they're just the wrong tool for "massive."** They're good for slow trust-building and modest engagement, which is exactly what the 6-day data shows they delivered.

**What would actually produce a step-change, ranked by leverage:**

1. **Creator/influencer outreach (highest leverage, still mostly untouched).** One established snooker YouTuber or TikTok creator mentioning MaxBreak reaches more real, targeted snooker fans in one post than months of manual comments — and it doesn't trip any spam filter because it's not your account. The original campaign doc (`HANDOFF_2026-08-27_GROWTH_CAMPAIGN.md`) already has a researched creator/YouTube list with a draft outreach email template, unsent, needing real contact addresses. **This is the single most neglected high-value lever from the whole campaign — do this next.**
2. **Paid user acquisition, now justifiable by data.** Week 1 explicitly ruled this out to see organic results first. You now have retention data (people who install do come back and engage — 7-day actives climbing) suggesting the app holds attention once installed, which lowers the risk of paid spend. A small, bounded test (e.g. a fixed ₪200-500 budget on Google UAC or Meta ads targeting snooker-interest audiences) would give a real CAC number to decide whether to scale — something no organic channel can currently supply.
3. **A real in-product viral loop.** Nothing tested this session is a growth *mechanism* — it's all outbound marketing effort that doesn't compound. A shareable artifact from inside the app (e.g. auto-generated "century break" or "match result" share cards, sharable to WhatsApp/Instagram Stories, ideally with a install link/QR baked in) turns existing engaged users into a distribution channel automatically, with zero ongoing manual effort per share. This is a product feature, not a marketing task — worth scoping as its own mission if the goal is genuinely "massive" rather than incremental.
4. **Keep the current channels running, but recalibrate expectations.** Comments/posts should continue at the slow, human pace already established — they're real (Reddit trust does build over months; Facebook groups are free reach once approved) — but stop expecting them to produce a breakout. Track them as steady background growth, not the growth strategy.

**If forced to pick one next action:** creator outreach (#1). It's free, it's already 80% researched from an earlier session, and it's the only untried channel with genuine viral-scale potential that doesn't depend on an algorithm's trust score or a mod's approval queue.

## 7. Open items carried forward
- [ ] Add UTM-tagged links to future Reddit/Facebook shares so GA4 can actually attribute installs to a channel — currently everything lands as "Direct," making every future "did it work" question unanswerable with confidence.
- [ ] Send the creator outreach emails — list and draft exist, just need real addresses (see original campaign doc).
- [ ] Check EURO SNOOKER and Legend Ronnie O'Sullivan group post approval status; add link comments once live.
- [ ] Re-check SNOOKER LOVERS pending queue before attempting another post there.
- [ ] Consider adding a Firebase event that distinguishes Scoreboard sessions with vs. without the interstitial shown, to actually measure whether today's fix helped (not built this session).
- [ ] Small bounded paid-UA test (#2 above) — needs explicit user go-ahead and a budget number before starting, per no-paid-spend-without-approval norm from the original campaign.
- [ ] In-app share-card feature (#3 above) — worth its own brainstorm/plan session if pursued, not a small change.

## 8. Key docs/memory to read next
- `HANDOFF_2026-08-31_REDDIT_ACCOUNT_GROWTH.md`, `HANDOFF_2026-08-27_GROWTH_CAMPAIGN.md` — prior context.
- Memory: `project_2026-08-31_reddit_account_growth.md` — Reddit channel dead-ends, keep current.
- `docs/growth_metrics_tracker.csv` — append new pulls here going forward (last entry Aug 27; this session's numbers should be appended too — not yet done, do at start of next session using the figures in section 1 above).
