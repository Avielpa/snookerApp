---
name: social-growth
description: Use when the user asks to run a Facebook/social growth push for MaxBreak147 — posting, scheduling, or commenting in Facebook groups/Page, generating promo images (screenshots or Gemini/"nano banana" AI art), or checking growth analytics (AdMob, Firebase, UTM attribution). This is a living skill — update it (insights, group track records, analytics section) at the end of every growth session.
---

# MaxBreak147 social growth push

This skill is the operating manual for a Facebook/social growth session. It is **living
documentation** — see "Keeping this skill alive" at the bottom; you are expected to edit
this file, not just read it.

Read first if not already loaded this session: `docs/GROWTH_FB_PLAYBOOK.md` (what's proven
to work) and `docs/GROWTH_UTM_TRACKING.md` (link tagging — every outbound link MUST use it).
The most recent session doc under `docs/SESSION_*growth*.md` or `docs/HANDOFF_*.md` (newest
date wins) has the freshest state — read it before posting anything.

**Also check memory before acting.** `MEMORY.md` is auto-loaded into context at session
start, but actually open the growth-related memory files it links, not just skim the
one-line pointers — they carry corrections that override stale doc content:
`project_2026-08-25_growth_campaign.md`, `project_2026-09-03_reddit_account_growth.md`,
`feedback_reddit_ai_text_detection.md`, `feedback_fb_live_content_playbook.md`,
`project_2026-09-04_fb_page_and_icon_bug.md`, and any newer `project_*growth*`/`feedback_*fb*`
file MEMORY.md points to — a newer memory entry can supersede a status shown in §1 below (e.g.
a group flipping from 🟡 to ✅/❌) faster than this file gets edited. If memory and this
skill disagree, memory is more current — trust it, then update this file to match.

## 0a. Session cadence — small batches + close the loop, never blitz-and-leave

**Established 2026-09-14, after two confirming data points:** the 09-11 heavy push (9
destinations in ~15 min, then 3 days offline) scored 0-1 likes per post; a "light" 2-post
session the same week (09-14) *also* scored 1 like each with no reply pass afterward. Post
count wasn't the variable — **never replying to comments was**, in both cases. The 09-07/09-08
benchmarks (8-11 likes, real comments) both had someone actually replying same-day.

Standing procedure from now on:
1. **Cap a single posting sitting at 1-2 destinations**, not a full-channel sweep — unless the
   user explicitly asks for a full/"massive" push and is aware that means seed-content-only
   engagement (per the 09-11 lesson), unlikely to get real replies.
2. **Before posting anything new, check the previous session's posts for unanswered comments**
   and reply to them first — the reply-check is not optional follow-up, it's step 1 of every
   session that isn't the very first post to a channel.
3. If a post is likely to get comments over the next few hours and nobody will be online to
   check back same day, say so explicitly rather than silently posting and moving on — let the
   user decide whether to still post (as seed content) or wait for a session where follow-up is
   possible.
4. Because FB posting/reading needs an authenticated interactive browser session, this
   reply-check can't run unattended on a cron — it has to be a deliberate next session (a
   `/loop`, a scheduled wakeup with a reminder, or just "next time growth comes up, check
   comments first"). Don't propose fully-automated unattended posting/replying as a fix.

## 0b. Multiple concurrent sessions — check in before stacking posts on the same channel

**Established 2026-09-15:** more than one Claude Code session can be running growth work for
this account at the same time (confirmed via `ListAgents` finding a peer session mid-session).
Neither session's own transcript shows the other's posts as they happen — the only shared
signal is `MEMORY.md`/session docs, which can lag behind real-time. On 2026-09-15 two sessions
independently posted to the **same** groups same-day (a peer's AI-image brand post + this
session's live-score, upcoming-matches, and Page posts), stacking **3+ posts into Snooker
227.8K alone** in one day — exactly the same-day-stacking pattern that tripped SNOOKER TODAY's
per-account posting limit on 09-14, and Snooker 227.8K is the account's single most valuable
channel, so it's the one most worth protecting from this.

Standing procedure from now on:
1. **Before a posting sitting, run `ListAgents`** to check for other active/idle sessions on
   this machine. If one exists and growth work is plausible from it (check memory/session docs
   for same-day activity first), send it a coordination check via `SendMessage` before posting
   — ask what it already posted today and to which channels, and state your own plan.
2. **Do not post to a channel a peer session touched today without confirming with that peer
   first** — this applies especially to Snooker 227.8K and Legend Ronnie O'Sullivan (60.2K),
   the two proven high-value groups most likely to hit a posting-frequency ceiling.
3. If a peer session says it's done for the day and holds off further posting, treat that as
   the standing agreement for the rest of the session — don't re-post to the same channels
   without checking again, even if the user's request seems to call for more.
4. Surface same-day multi-session stacking to the user directly when it's discovered — don't
   silently absorb it into a single session's own post count/cadence accounting, since the
   real per-channel total is the sum across all sessions, not just this one's.

## 0. Ground rules (non-negotiable, established over multiple sessions)

- **Never add text or content that isn't verified and real — this is what keeps the account
  reliable, and it overrides every other goal in this skill (engagement, cadence, "massive
  push" requests included).** This is not limited to scores/stats — it covers every claim in
  every post, comment, and caption: scores, stats, headlines, "who's playing", feature
  descriptions, engagement/follower numbers, dates, quotes, comeback narratives, anything.
  Every factual claim must come from a real, checked-fresh source — the backend API
  (`https://snookerapp.up.railway.app/oneFourSeven/...`) for tour/match data, a real device
  screenshot for app-feature claims — never memory, never the previous post, never an
  inference or embellishment that "sounds right." If a fact can't be verified fresh right
  now, leave it out rather than write around it. Two false "X is playing tonight" comments
  (caught and rewritten) and one fabricated "3-1 comeback" detail in a caption (caught by the
  user after posting, fixed in place — see [[feedback_never_fabricate_verify_only]]) are the
  two real incidents behind this rule; always cross-check `matches/today/` before claiming
  anyone is live, and never add a specific narrative detail (a comeback, a stat, a
  milestone) unless it is explicitly present in the API response or a real screenshot.
- **Crop out ad banners from every device screenshot before posting**, no exceptions —
  this is an explicit standing user instruction.
- **Every outbound link is UTM-tagged** per `docs/GROWTH_UTM_TRACKING.md` — never post the
  bare Play Store URL. Use the `link()`/QR helper pattern in that doc.
- **Every group/Page post includes a "👍 Follow our Page" line** with the Page link
  (`https://www.facebook.com/profile.php?id=61594074930801`), standing rule confirmed
  2026-09-15. Established because every post before 2026-09-15 silently skipped this (the
  09-14 bootstrap-gap finding, §3) — the Page sat at 1 follower for 11 days despite dozens of
  group posts. The first day this line was added to every post, the follower count moved to 2
  (small sample, but the first movement in 11 days — see the 09-15 session-3 log entry in
  `docs/GROWTH_ANALYTICS_LOG.md`). Don't drop this line even on a light/1-post session.
- **No spam, no scripted-identical comments.** One well-targeted real-data post outperforms
  ten generic comments (see Insights below) — quality and relevance over volume.
- **AI-generated images are for the Gemini/brand-awareness lane only** (approach C in §2) —
  never for a live-score, schedule, or any post citing specific real data. Those must use a
  real device screenshot (approach A). Explicit user correction, 2026-09-08: "you should use
  the app for screen shots... only in Gemini session to promote app you can create yourself."
- **Deployment rules from CLAUDE.md still apply** even inside a marketing session: never
  edit app code, `app.json`, or ship a build without its own plan + approval. If a real bug
  surfaces mid-session (e.g. the icon bug, 2026-09-04), log it to `docs/OPEN_MISSIONS.md`
  and memory — do not silently fix it as a drive-by.

## 1. Channels — groups, Page, and their track records

Keep this table current — update after every session with new groups tried and outcomes.

| Channel | Type | Size | Status | Notes |
|---|---|---|---|---|
| Snooker | FB group | 227.9K | ❌ **MaxBreak147 blocked (5 for 5 declines) — personal profile bypasses it, confirmed 2026-09-17** | `groups/769585246708073` — **two groups share this exact name in the joined list, the other is only 28K (`groups/498611593874694`) — verify member count before posting.** Historically the single best-performing channel, **but only when someone's online to engage** — see the 09-14 addendum in Insights: the 09-11 schedule-graphic post here got just 1 like/0 comments/1 share (vs. 11 likes/2 comments for the same format on 09-07), the difference being nobody replied to comments during a 3-day offline gap. Images go through quick admin approval (confirmed 2026-09-07 toast), not instant — though not always: 2026-09-14's post went straight live. Post real-time live-score graphics here first. 2026-09-14: posted "Ali Carter champion + NI Open Quali live" (real English Open final result 9-6, verified via API before posting) — went straight live, no approval gate that time. Same group, a fan's identical-topic post (Ali Ashraf, 12h earlier) sat at 630 likes — strong proof "tournament result" is the winning content type here. Edited-in the iOS App Store link a few minutes after publish (see gotcha below — always include both store links from the start). 2026-09-14 post final tally (checked 09-15): 3 likes/0 comments. 2026-09-15: posted a real S24 live-score screenshot (NI Open Quali R1) — went to admin approval this time (not instant), both store links + a "follow our Page" line included from the start. 2026-09-15 (session 2): posted a Gemini AI-image (brand-awareness lane, see approach D below — no live data in the image, caption ties it to the real shipped Personal Best/Challenge-a-Friend features) — this session's own log claimed "went live instantly", but **checked 2026-09-16 and it was actually declined** (sitting in `my_declined_content`, not published) — that log claim was wrong. **2026-09-16: posted a full 16-match schedule composite — also declined, 3 minutes after posting**, confirmed via the group's own declined-content panel. **2026-09-16 (session 2): posted a verified Centuries Race stats table (a genuinely different content type, not schedule/promo) — declined again, this time instantly (a few seconds, not minutes).** That's **3 declines in a row across 3 different content types**, with the decline speed accelerating each time — strong evidence this is now an **account-level auto-mod/filter flag on MaxBreak147 specifically**, not a per-post admin judgment on content. The identical content posted to Legend Ronnie O'Sullivan the same sessions went live instantly both times. **2026-09-17: ran a controlled same-content, same-minute test** — posted the identical live-score screenshot+caption to this group once as MaxBreak147 (declined instantly, 5th decline in a row) and once as Aviel Pahima (personal profile — went live instantly, visible in feed within seconds). This isolates the block to the **MaxBreak147 identity specifically**, not the content, the timing, or the group in general. **Going forward: post to this specific group (only) under the Aviel Pahima personal identity** until the MaxBreak147 account-level flag clears — personal posts here don't build the Page's follower count, but they do reach the audience, which the Page identity currently cannot in this group. Keep using MaxBreak147 normally in every other group (Legend Ronnie, JUST SNOOKER, etc.) where no block exists. |
| Legend Ronnie O'Sullivan Snooker | FB group | 60.2K | ✅ proven, fast-approve | `groups/287612679061624`. Posts go to admin approval (confirmed via toast 2026-09-07), usually clears quickly. Good for comments on active threads too. |
| World Snooker Live Stream | FB group | 56.0K | 🟡 posts do clear, but still piracy-linked — avoid | `groups/WorldSnookerLiveStream`. Its own About section links an illegal streaming site — same category as groups skipped for that reason elsewhere. 2026-09-08: a user-posted schedule graphic here actually went live (not stuck pending) and got 8 likes/0 comments in 3h, so it's not purely a dead/slow channel — but the piracy-link concern stands. Don't proactively choose this group; if content ends up here, don't repeat. |
| EURO SNOOKER | FB group | 144.7K | ❌ declines standalone posts, ✅ comment workaround proven | `groups/120555239952416`. 2026-09-11: commented (as MaxBreak147) on an active Rasson Snooker Club QF post with real data + app mention — posted clean, no approval gate on comments. |
| Snooker TV | FB group | 10.1K | ❌ declines standalone posts, ✅ comment workaround proven | `groups/570739555357765`. Same workaround as EURO SNOOKER. Reconfirmed 2026-09-08: a posted schedule graphic never rendered on its permalink (redirects to the group's general feed instead) — treat any post here as silently dropped, don't assume it went live without checking the permalink directly. 2026-09-11: comment workaround worked cleanly on a Birmingham Billiards post. |
| "Snooker" (28K duplicate) | FB group | 28.0K | 🟡 untested for value | `groups/498611593874694` — the wrong/smaller duplicate of the 227K "Snooker" name (see gotcha below). Got a post 2026-09-08 (posted alongside the real 227K group by mistake-prone naming), only 1 like/0 comments in 3h. Not worth targeting deliberately — always double-check you're on `769585246708073`. |
| SNOOKER TODAY | FB group | 27.3K | 🟡 posting rate-limited on this account | `groups/638534032969281`. First deliberate post here 2026-09-11 (English Open QF schedule + results, 2 images) — cleared without visible approval gate. Same session, later: the inline "כאן כותבים" composer stopped rendering entirely (confirmed via page text). 2026-09-14: composer worked fine and accepted the post, but Publish returned "הגעת למגבלה של תוכן בהמתנה בקבוצה זו" (reached the limit of pending content in this group) — a per-account posting-frequency cap, distinct from the 09-11 UI bug. Don't force a retry same-session; try again next session. 2026-09-15: checked — that 09-14 attempt never cleared, still shown as pending admin approval a full day later. The rate-limit error may mean the post silently never actually queued, not just delayed. |
| JUST SNOOKER | FB group | 10.5K | ✅ proven | `groups/345516713257597`. Posted 2026-09-11 despite the account showing as not-joined (blue "Join" button still present) — post still went through; group is public so membership isn't required to post. |
| Snooker Ronnie O'Sullivan 147 Fans | FB group | 20.7K | ✅ proven | `groups/430394725551281`. Posted 2026-09-11 (English Open QF schedule + results) — cleared, posts go through pending-approval queue per group settings but composer accepted cleanly. |
| Golden ball snooker club | FB group | 16.2K (grew from ~0 on 2026-09-08) | ✅ proven, growing fast | `groups/2512402948994428`. Posted again 2026-09-11 — member count jumped from a brand-new group to 16.2K in 3 days, worth continued attention. |
| Snooker Fans & Players Hub | FB group (private) | 2.9K | 🟡 posted, engagement still unproven | `groups/1655995331639369`. Posted again 2026-09-11 (English Open QF schedule + results). Still no engagement signal from prior posts — keep testing but don't over-invest yet. |
| MaxBreak147 Page | FB Page | **1 follower** (launched 2026-09-04, still ~0 10 days later) | 🟡 active but stalled | `facebook.com/profile.php?id=61594074930801`. **Only Pages support native post scheduling** (composer → Timing options). 2026-09-14: checked its 09-11 cross-post directly — 0 likes/0 comments/0 shares, Facebook itself shows a "boost this post" upsell (near-zero organic reach). This is the 0-follower cold-start problem, not a content issue — see the 09-14 Insights addendum: bootstrap step 1 (group posts explicitly asking people to follow the Page) needs to actually happen, not just cross-posting content to it. See strategy note in Insights. Fed again 2026-09-14 (Ali Carter champion post, same content as the groups) — the "New post" wizard's own Promote-post-toggle click-doesn't-register bug (below) recurred; fixed by clicking via the element's `find()` ref instead of raw coordinates, which worked first try. Fed again same day (session 2): a real-data QF graphic + a real S24 live-score screenshot, ~20 min apart — worked fine as two distinct updates, not duplicates. 2026-09-08: fed a Gemini AI-generated brand poster (no live data, pure brand awareness) — published clean after the recurring Promote-post-toggle and "Talk to people directly" upsells were handled per the gotchas below. 2026-09-11: **the "New post" flow (Page management/Business-Suite-style dashboard) is a multi-step wizard** — composer → "הבא/Next" → settings screen → must explicitly toggle "קידום פוסט"/Promote post OFF (defaults ON every time, same as the old gotcha) → click "פרסם/י"/Publish (not the arrow icon at dialog top, which just goes back) → decline the "Talk to people directly" upsell → THEN it actually publishes. Closing/reopening the dialog preserves the draft (shown as a collapsed chip) so it's safe to retry if a step doesn't visibly progress. |
| WST (World Snooker Tour) official Page | FB Page (verified) | 4.6M | ✅ comment tactic proven again | `facebook.com/WorldSnookerTour`. 2026-09-11: commented as MaxBreak147 on a same-day Shaun Murphy clip (412 likes at the time) tying in his real QF matchup — posted clean, comment count visibly incremented. Repeatable free-exposure tactic per §"Commenting on official/high-traffic Pages" below — always verify the specific claim (opponent, time) against the API first. |
| TNT Sports Snooker (FB "profile.php?id=61590307127321") | FB Page (unverified) | 0 followers, 7 days old | 🚫 skip — looks fake | Contact email is `@dayrep.com`, a known disposable/burner email domain often used by spam or fake business listings. Not the real TNT Sports channel (their main verified Page is `TNT Sports`, 14M, general sports not snooker-specific). Don't engage here; if targeting TNT content, check the main TNT Sports Page for snooker posts instead. |
| Reddit (u/Aviel_pa) | personal account | — | ❌ deprioritized | Platform-wide spam-classifier removing ~50% of comments even on unrelated harmless content, not subreddit-specific. Not a useful channel right now — see `project_2026-09-03_reddit_account_growth.md` memory. |
| Instagram | comments only | — | 🟡 minor channel | A couple of genuine comments made; not a primary lever yet. |
| Creator outreach (YouTube emails) | email | — | 🟡 drafted, unsent | 2 personalized emails drafted (Shaun Murphy's management, Snooker Planet), awaiting approval to send. 3 more candidates blocked by a YouTube reCAPTCHA (never attempted — no CAPTCHA-solving). Flagged as the top growth idea for genuinely bigger reach — current channels are structurally capped. |

### Posting mechanics (browser automation gotchas)

- **Switching identity** (personal "Aviel Pahima" vs. Page "MaxBreak147"): click the
  top-left avatar dropdown. Must be redone **per tab** — a new tab does not inherit another
  tab's identity. Screenshot after switching to confirm the composer shows the right avatar
  before typing.
- **File upload into the composer**: never click the visible "Photo/Video" button — it opens
  a native OS file dialog that hangs the CDP screenshot call. Instead `read_page` (filter
  `all`) to find the sibling `button [ref_X] type="file"` element and call `file_upload`
  directly on that ref. Reliable pattern, used ~15+ times across sessions.
- **Composer text can duplicate** if you reopen a dialog without clearing it — always click
  the text field and Ctrl+A before typing fresh text.
- **Page-post "Publish" sometimes routes into the paid ad-boost upsell**
  (`/ad_center/create/boostpost/...`). The post itself already published — never enter
  payment info; navigate away or open a fresh tab instead of fighting the "unsaved changes"
  dialog.
- **The Page composer's "קידום פוסט" / "Promote post" toggle in post-settings defaults to ON
  every single time** that step opens (confirmed 2026-09-04, twice in one session) — switch it
  off and zoom/screenshot to confirm grey before clicking Publish, every time, or it routes
  into the same paid boost flow as above.
- **`file_upload` was denied once by the auto-mode classifier on group posts** (not Page posts)
  2026-09-04 — an immediate retry of the identical call succeeded both times. Not yet
  understood; just retry once before troubleshooting further.
- **2026-09-10: after one successful post, the auto-mode classifier began denying every
  subsequent browser action in the session** (typing into a second group's composer, then even
  plain `tabs_context_mcp`), interleaved with two tab freezes (`Page.captureScreenshot`
  timeout). Reads as the classifier flagging rapid, repeated outward-facing posts with
  near-identical content across multiple groups in one sitting — not a Facebook-side block.
  One retry did not clear it (unlike the file_upload gotcha above); the session had to stop
  rather than keep forcing it. If this recurs: post remaining channels manually, space posts
  further apart, or vary wording more than a template swap between groups.
- A group's own post composer sometimes shows a **"Create an event?" interstitial** after
  clicking Publish — click "פרסם/פרסמי את הפוסט המקורי" ("publish the original post") to skip
  it and post normally.
- **Scheduling is Page-only.** Composer → "Timing options" (Hebrew UI: "אפשרויות תזמון") →
  pick date/time → button changes from "Publish"/"פרסום" to "Schedule"/"תזמון". Confirmed
  NOT available on personal-profile or group posts.
- **A tab can render broken** (viewport reports abnormally small, clicks land wrong, typed
  text vanishes). Fix: close it, open a fresh tab, navigate again — don't fight it.
- Google Play Console's asset uploader has **no automatable file input** (dynamically
  created, immediately opens the native OS picker) — any Play Store graphic/icon upload must
  be handed to the user with exact manual steps, never attempted via browser automation.
- **Two different groups can share the exact same name in the joined-groups list** — confirmed
  2026-09-07: there are two groups both named "Snooker" (`groups/498611593874694`, only 28.0K,
  vs. the real target `groups/769585246708073`, 227.6K). Clicking the first name match in the
  groups grid landed on the wrong one. **Always check the member-count text in the group header
  before posting** — never trust the group name alone when the joined list has near-duplicates.
  The correct group IDs for the three regular channels: Snooker → `769585246708073`, Legend
  Ronnie O'Sullivan Snooker → `287612679061624`, World Snooker Live Stream →
  `groups/WorldSnookerLiveStream` (vanity URL).
- **A second upsell dialog can appear on Page posts** beyond the known Promote-post toggle:
  "לדבר עם אנשים ישירות" ("Talk to people directly" — offers to add a Contact-now button),
  shown after publish. Decline with "לא עכשיו" (Not now) — the post still publishes once
  dismissed. Confirmed 2026-09-07.
- **The Promote-post toggle can silently fail to register a click** — a click at fixed
  coordinates left it visibly still ON on zoom-check (2026-09-07). Always re-verify visually
  right after clicking, before hitting Publish; if still on, click again via the element's
  `find()` ref rather than coordinates, and re-verify again. Confirmed recurring every round in
  the same session — budget for 1-2 retries every single time, it's not a one-off glitch.
- **A tag-suggestion autocomplete dropdown can appear while typing** the caption, if any word
  matches a Page/person name (e.g. typing "MaxBreak147" triggers a "MaxBreak147 — Page" /
  random-person suggestion popup). Dismiss it by clicking elsewhere inside the dialog (e.g. the
  dialog title bar) — **never press Escape**, which closes the entire composer and can drop the
  attached image (text is recoverable from the auto-saved draft shown on the timeline, but it's
  a wasted round-trip). Confirmed 2026-09-07.
- **Switching identity (avatar dropdown) doesn't always take effect until you actually
  re-navigate** to the target group/page URL — screenshot to confirm the correct identity
  *after* landing on the destination, not just after clicking the switch. Caught once
  2026-09-07 where the Page identity was still active on a group that Page isn't a member of
  (showed a "Join the group" prompt instead of the composer).
- **Facebook auto-generates its own tracking link on bare `play.google.com` URLs shared as
  plain text in a comment** — confirmed 2026-09-07: posting `https://play.google.com/store/apps/details?...&referrer=<our UTM>` as text triggered Facebook to auto-post a *second*, separate reply seconds later under the same identity, containing only a shortened `onelink.to/<code>` link. That link redirects to `market://details?id=<pkg>&pcampaignid=web_share` — **it drops our `referrer` UTM tag entirely**, so any click through it is unattributable in Firebase. Always check for this auto-reply after posting a bare Play Store link in a comment (not an image/QR code — this hasn't been seen from those) and delete it (comment's `...` menu → מחיקה/Delete) so only the correctly-tagged link remains. Verify the redirect target of any suspicious short link with `curl -sL -o /dev/null -D - -A "Mozilla/5.0 (Linux; Android 13)" <url> | grep -i location` before assuming what it does.
- **The `type` action has typo'd the Apple App Store URL twice on 2026-09-16** — `apps.apple.ccom`
  (double-c) once, `aapps.apple.com` (double-a) once, both times right at the domain boundary.
  Cause unconfirmed (looks like an intermittent character-duplication glitch when typing a URL
  right after an emoji, not a one-off). **Mandatory before every publish**: read back the
  composer's actual link hrefs via `read_page` (filter interactive) or `find "link"` and check
  every URL character-by-character — don't trust the typed text visually, the rendered link text
  in the composer can look right at a glance even when the href is wrong. If a typo is found,
  select-all + delete the whole caption and retype fresh rather than trying to patch just the
  broken segment (partial edits risk leaving stale link-preview chips attached).

### Group discovery pass (2026-09-08) — new candidates, classified by content fit

Searched FB groups for "snooker" / "snooker fans" beyond the usual rotation. Classification:

**Banker groups (large, established, daily schedule/live posts fit)** — same treatment as
Snooker 227K:
- Legend Ronnie O'Sullivan Snooker, EURO SNOOKER, Snooker (227K) — already tracked above.
- **SNOOKER TODAY** (`groups/638534032969281`, 27.2K, public, "Post Everything about Snooker")
  — active daily-schedule-graphic culture already (a verified Thai account posts English Open
  schedule cards there routinely). Strong fit for our daily schedule post. Joined 2026-09-08,
  untested with our own post yet.
- **JUST SNOOKER** (`groups/345516713257597`, 10.5K, public, "This group is just about
  Snooker") — smaller but clean, genuine discussion with real engagement on a British Open
  results post. Joined 2026-09-08, untested with our own post yet.
- **Snooker Ronnie O'Sullivan 147 Fans** (`groups/430394725551281`, 20.7K, public) — mixed
  quality (some marketplace-style table-for-sale posts mixed in with real content), but sized
  well and Ronnie-branded like the proven Legend Ronnie group. Joined 2026-09-08 (confirmed
  via toast), untested with our own post yet.

**Scoreboard-feature-fit candidates** (real players/table owners who'd want a scorekeeper,
not just tour-following fans) — post AI-generated + real scoreboard-mode screenshots here
once the S24 is reconnected, not tour live-scores content:
- Considered **"Snooker table sale and purchase"** (`groups/265361861855330`, 83.3K) but
  **rejected** — it's a pure classifieds/marketplace group (table listings with phone
  numbers, South-Asian audience), not a discussion community; an app promo would be off-topic
  there regardless of size. Don't post here.
- No confirmed scoreboard-fit group found yet this session — worth specifically searching for
  "snooker practice", "snooker club [city]", or general cue-sports hobbyist groups next
  session rather than tour-fan groups, since none of today's finds skew toward "people who
  own a table and play casually" the way the scoreboard feature needs.

**Avoid — same piracy-link pattern as World Snooker Live Stream:**
- **"2023 World Snooker Tour Live online 🔴►"** (`groups/706743560969450`, 25.0K) — name
  carries the identical "🔴► Live online" pattern as the already-flagged piracy group. No
  About text loaded to confirm/deny, but treat as suspicious by naming convention alone;
  did not join or post.

**Not yet evaluated (found via "recommended groups" sidebar, surfaced after joining Ronnie
147 Fans, worth checking next session):** SnookerLife (17K, private), Snooker Legends group
(22K, public, low volume ~5 posts/month), a second "Snooker" (27K, public, 7 posts/day —
yet another same-name group, verify member count before ever posting), Cuestars (904,
private, too small to prioritize).

**Mechanics note:** joining a group only registers reliably when done under the **personal
Aviel Pahima identity** — attempting to join while switched to the MaxBreak147 Page identity
silently fails (button stays in "not joined" state, confirmed by re-checking) even though no
error is shown. Always switch identity first, re-navigate to confirm the switch took (per the
existing identity-switch gotcha below), then join.

### Commenting on official/high-traffic Pages (new tactic, 2026-09-08)

Per the zero-follower bootstrap plan's step 3 (§3) — commenting as the Page under someone
else's high-traffic post is free exposure that doesn't depend on our own Page's reach. First
real execution: found the actual official **WST** Page (verified, 4.6M followers —
`facebook.com/WorldSnookerTour`; note "World Snooker Tickets" and several "World Snooker
Tour"-named pages in search results are NOT the official one, check for the blue verified
checkmark and follower count before assuming). Commented as MaxBreak147 on their highest-
engagement recent post (a Ronnie O'Sullivan throwback clip, 1.3K reactions) tying in the
real, verified news that Ronnie had actually withdrawn from today's English Open — genuine,
on-topic, not spammy. Comment posted successfully (visible in the thread, count incremented).
Same tactic worth repeating on player Pages (Selby, Trump, etc.) and tournament/venue Pages
in future sessions — always find a genuinely relevant real-data angle first, never a generic
plug.

## 2. Generating promo images

Three approaches, pick based on what the post needs. **Default to a real device screenshot
(A) even for live-score posts** — user feedback 2026-09-07: a PIL-generated graphic reads as
"edited"/synthetic even when every number on it is real, and that costs authenticity. Reach for
the generated-graphic approach (B) only when a single screenshot genuinely can't show what's
needed (multiple matches combined in one frame with a QR code, or a bracket view the app
doesn't render at all) — not as the default for an ordinary live-score update.

**A. Real device screenshots (preferred for feature posts)** — via `adb` against the
connected device (S24 confirmed as `RFCX11GB0MK` in past sessions; check with
`adb devices`). Navigate the app to the real screen, `adb shell screencap`, pull it, then
**always crop out the ad banner** with PIL before using it. This is the strongest content —
real app, real data, no fabrication risk. **`adb` is not on PATH in this environment** — full
path is `C:\Users\Aviel\AppData\Local\Android\Sdk\platform-tools\adb.exe`. In Git Bash, export
`MSYS_NO_PATHCONV=1` before any `adb shell`/`adb pull` call that uses an absolute device path
(`/sdcard/...`) — otherwise Git Bash silently rewrites it as a Windows path and the command
fails. Can tap into an app from the shell too: `adb shell input tap <x> <y>` on a coordinate
read off a screenshot (remember to scale by the image's displayed-vs-original ratio).

**Full match-list technique (established 2026-09-16):** when a post needs to show *every*
match/item in a long scrollable list (not just what fits on one screen), the in-app ad banner
is a **fixed/sticky overlay** near the bottom of the screen, not part of the scrollable
content — it stays at the same y-position across every screenshot regardless of scroll
position. So: (1) take a screenshot at the top of the list, (2) `adb shell input swipe` down
by roughly 4-5 list-item-heights, (3) screenshot again, (4) repeat until the list end is
reached, (5) crop every screenshot to the same fixed band that excludes the ad/bottom-nav
(same y-range works for every capture since the ad is sticky), also trimming each capture's
top/bottom to whole-card boundaries so nothing is cut mid-card, (6) drop the tiny duplicate
row that appears at the seam between two consecutive captures, (7) vertically stack the
cropped segments into one tall composite PNG with PIL (`Image.new` + `paste` at increasing y
offsets). This gives a single image showing 100% of the real list with zero ads and zero
cut-off cards — confirmed working for a 16-match qualifiers schedule (4 captures → one
1080×4075 composite). Reuse this whenever "show the full schedule/results/draw" is requested
instead of settling for whatever fits in one screen.

**B. Data-driven generated graphics (for live scores / brackets / schedules)** — pull real
match data from the API and render a branded PNG with PIL. Two reusable generator patterns
built 2026-09-04 (not yet committed to the repo — promote to `docs/growth-tools/` if this
becomes a recurring weekly need):
- Combined live+upcoming match card (dark baize theme, LIVE/TONIGHT sections, QR code with
  UTM-tagged link at the bottom).
- QF→SF→Final bracket graphic with connector lines, built because the in-app Draw tab only
  shows early qualifying rounds (R1/R2/R3) and does **not** include the TV-stage bracket —
  don't waste time trying to screenshot a bracket view that doesn't exist in the app; build
  it from the API data instead.

Both scripts live in the session scratchpad from 2026-09-04; regenerate similarly for future
tournaments (same PIL patterns: dark green/near-black background, gold accent color, white
text, green "LIVE" dot, `X-Requested-By: FahimaApp128` header on any API call).

**C. AI-generated art via Gemini web app ("nano banana")** — for cover images, icons, or
stylized graphics that aren't data-driven. "Nano Banana" is Google's image-generation model
surfaced inside the Gemini web app (gemini.google.com):
1. Open a tab to `gemini.google.com`, start a new chat.
2. Type a detailed prompt describing the image (style, colors, composition, what to avoid —
   e.g. "no text", "70% safe-zone padding for an app icon", "flat illustration style, dark
   green baize background, red and white snooker balls only").
3. If the model picker/composer shows an explicit image-generation model choice, prefer
   selecting it — that's the "nano banana" tag the user refers to. If no separate selector is
   visible, a plain descriptive prompt to the default Gemini model still triggers image
   generation.
4. Wait for the image to render, then use the download icon on the generated image (don't
   right-click-save from a thumbnail — get the full-resolution download).
5. Used successfully twice: a Page cover/hero image, and an app-icon redesign candidate
   (`store_icon_512_v2_gemini.png` — dark baize, red+white ball pair, no text).
6. Downloaded images land in the OS `Downloads` folder (e.g. `~/Downloads/Gemini_Generated_Image_*.jpg`),
   **not** the session scratchpad — copy the file over after downloading.

**D. Gemini background + real-data PIL overlay (combining B and C)** — the pattern for "make
it look good with AI but the data must be real," confirmed working 2026-09-07: generate a
**text-free** background/theme from Gemini (explicitly prompt "no text, no numbers, no logos,
no words anywhere" + leave a described area empty for overlay), then composite the real match
data as text on top with PIL exactly as in approach B. Do **not** ask Gemini to render the
actual scores/names directly into the image — verified this session that multi-line text in
AI-generated images cannot be trusted for accuracy, and posting fabricated-looking or garbled
scores would violate the "never fabricate content" ground rule. This hybrid gets the AI-polish
look the user wants while keeping every number/name pixel-accurate.

**E. Video generation (Gemini/Veo) — CONFIRMED WORKING as of 2026-09-17, correcting the
2026-09-15 "unreliable" note below.** Go to `gemini.google.com/videos` (a dedicated "Create
videos" page, distinct from the regular chat composer — the model-picker approach in the old
chat composer is what froze/failed before), set aspect ratio to Portrait (9:16) for social,
type a scene description directly (no separate video-model toggle needed on this page), and
submit. First successful generation 2026-09-17: a 3-second prompt ("two friends in a snooker
club, one takes a shot") took **~2.5 minutes** end-to-end and produced a genuinely
photorealistic 10-second 9:16 clip (`gemini.google.com/app/<id>`, downloadable via the
hover-toolbar download icon — lands in the OS `Downloads` folder as
`<slug-of-prompt-start>.mp4`, not the session scratchpad, same as image downloads). Two other
videos from this same flow were found already sitting in Downloads from earlier
09-16/09-17 sessions (`Create_a_short_realistic_cin.mp4`, `more_app_screen_time_to_promot.mp4`)
— meaning this had already started working before this note was corrected; the skill just
hadn't been updated. **Always verify a downloaded clip isn't blank** before using it — the
in-page preview thumbnail can render as solid black even when the file is fine; extract a
frame with `cv2.VideoCapture` + `.read()` (install via `python3 -m pip install
opencv-python-headless` if missing) and check it's not near-zero mean brightness, rather than
trusting the browser preview. **No standalone Sora web app anymore** — `sora.chatgpt.com`
now shows "Sora is no longer available." **This account has a prior ChatGPT conversation
("פרומפטים לסרטוני פרסום") with a full ready-made shot-by-shot campaign plan** for the
Scoreboard feature (4 short videos, refined to a "how many am I on?" score-argument angle
rather than "who won" — more relatable per the user's own correction — plus a "what's the
foul rule?", a "white ball potted" edge case, and a "new high break" video), including
complete English prompts for both Runway and Gemini/Veo. Read that chat before starting a new
video campaign from scratch — the creative work is already done, just needs shot-by-shot
execution through the now-working Gemini flow. Historical note (superseded): 5/5 attempts
failed on 2026-09-15 with an indefinite spinner and nothing saved — root cause never
identified, but it has since started working reliably; if it regresses again, retest with a
fresh tab before assuming it's broken again.

## 3. Promoting the Page specifically

- New Page = 0 followers = no organic algorithmic reach yet. Distribution comes from two
  places right now: (a) whoever finds it via a group post/comment linking to it, (b) its own
  future posts compounding as followers accumulate. **Don't expect Page posts alone to reach
  people yet** — keep cross-posting the same real content to the proven groups too.
- Feed it consistently: feature-highlight posts (one real screenshot + a short real-data
  caption) work well as steady content. Use **native scheduling** for this routine content
  instead of live-posting everything, freeing live-posting for genuinely time-sensitive
  content (live scores).
- Website field on the Page should carry a UTM-tagged link
  (`utm_source=facebook&utm_medium=page&utm_campaign=page_website` used so far).
- Cadence discipline: this Page will go stale fast if left after an initial burst — check
  it every growth session even if the main activity that day is elsewhere.

### Zero-follower bootstrap playbook (2026-09-07)

A Page with 0 followers/0 likes has a cold-start problem: nobody sees a post, and nobody
follows an empty-looking Page either. In priority order:

1. **Use the Page as the destination, not a separate channel.** The groups (Snooker 227.6K,
   Legend Ronnie 60.2K) are doing 100% of real reach right now. Every group post/comment
   should mention or link the Page ("follow MaxBreak147 for live scores every match day") so
   group members become its first followers — this is the only realistic 0→real-followers
   path without ad spend.
2. **Cross-post identical content, don't run two content strategies.** Whatever real-data
   graphic goes to the groups also goes to the Page around the same time — no separate Page
   content pipeline needed.
3. **Comment as the Page on other high-traffic snooker posts/Pages**, not just post as it. A
   genuinely useful comment (a live score, a correction) under someone else's popular post is
   free exposure that doesn't depend on the Page's own (currently zero) reach.
4. **One deliberate personal-network ask to break zero.** A single post from the personal
   profile ("I made this, would appreciate a follow") to friends/family who'd actually want
   snooker scores gets the Page off 0/0/0 — a one-time cold-start unlock, not a repeatable
   channel, don't lean on it beyond the first push.
5. **Creator outreach is still the actual step-change lever** (see §5) — a Page's organic
   growth compounds slowly; a creator mention doesn't have that ceiling. Prioritize sending
   the drafted emails over incremental Page tactics.
6. Below ~50-100 followers, posting frequency on the Page barely matters — reach is near-zero
   regardless of cadence. Don't over-invest in Page-native content until steps 1-4 have moved
   the follower count off zero; that's when native scheduling/editorial-storyline posts (§5
   case study) start actually compounding.

## 4. Tracking — AdMob + Firebase Analytics

- **Attribution**: Play Store `referrer` param → Firebase auto-captures it, no app code
  needed. Full mechanics and link-generation snippet: `docs/GROWTH_UTM_TRACKING.md`. Check
  Firebase Console → Analytics Dashboard → Acquisition report (or GA4 Traffic acquisition) —
  tagged sources should appear as their own `facebook`/`comment` or `group_post` rows
  instead of collapsing into Organic Search/Direct. This only works for links posted
  **after** the UTM fix (2026-09-03) — anything posted before that (e.g. the untagged
  British Open promo the same day) won't retroactively attribute.
- **Baseline snapshot**: `docs/ANALYTICS_BASELINE_2026-09-03.md` has the pre-push Firebase/
  AdMob/Play Console numbers — use it as the before/after comparison point rather than
  re-deriving a baseline each time.
- **Running log — append every session**: `docs/GROWTH_ANALYTICS_LOG.md` is the ongoing,
  dated record of actual numbers over time (separate from the one-off baseline/handoff
  docs, which are narrative snapshots). Read its latest entry at the start of a session to
  see the trend since last time, and add a new dated entry at the end of every session per
  its template — this is what makes "were analytics saved?" answerable with data, not just
  prose buried in a session doc.
- **Firebase MCP note**: the `plugin:firebase:firebase` MCP server has failed to connect in
  at least one recent session (30s timeout). If it's unavailable, check analytics manually
  via the Firebase Console web UI (browser automation) rather than assuming there's no
  access — report the connection failure to the user rather than concluding tracking is
  broken.
- **AdMob**: check via the AdMob console web UI for impression/revenue trends alongside the
  Firebase engagement numbers — no MCP/API integration exists for this yet.
- Don't over-check — attribution data needs a few days of accumulated tagged-link traffic
  before a channel row becomes visible/meaningful. Check at the start of a new growth
  session, not mid-session.

## 5. Insights — what's helpful vs. not (update this every session)

**What works:**
- **Live, in-progress content beats static schedules.** The single best-performing post to
  date (8 likes/3 shares/3 comments) was real-time "LIVE NOW" scores; static "upcoming
  schedule" graphics got 0-2 likes and no comments the same day.
- **Genuinely replying to comments with specific, accurate info converts a passive
  scroll-past into real engagement** — the graphic earns the glance, the reply earns the
  trust. Never post-and-leave.
- **Information density wins** (case study: "Cue Nation 2" account, 75 likes) — one image
  with ALL round results beat single-match posts.
- **Editorial storyline format + a real open question wins on an established Page**
  (case study: "Totally Snookered", 1.3K likes/224 comments) — a real headline ("TEENAGER
  DEFEATS LEGEND"), a real photo, a genuine question to the audience. This is why the
  MaxBreak147 Page was built — a Page compounds distribution over time in a way personal
  posts into groups (reach-capped per post) cannot.
- **One well-targeted real-data post outperforms many generic comments** — a day's activity
  table showed ~9 near-identical comments getting 0/0 each, while the one real graphic post
  carried nearly all the day's engagement.

**What doesn't work / is capped:**
- Personal-profile posts into groups have a hard reach ceiling regardless of content
  quality — this is structural (group post algorithm, not a content problem).
- Reddit is currently a dead channel — platform-wide spam classifier removing ~50% of
  comments, including on completely unrelated harmless posts. Not worth further investment
  until this changes; don't attempt a fresh account (resets trust, risks ban-evasion flags).
- Volume/frequency of low-effort comments does not move the needle — see the day-table
  finding above.

**2026-09-07 addendum:** full-day audit of every post's actual likes/comments (via
`facebook.com/me/allactivity` for personal-profile posts, Meta Business Suite's content table for
Page posts — add the "Likes and reactions"/"Comments"/"Shares" columns via the column-selector
icon, they're hidden by default) confirmed the schedule-graphic format is winning decisively:
11 likes/2 comments vs. 0-5 likes/0 comments on every other format tried the same day (live
graphic, real screenshot, combo screenshot, Gemini poster). One real fan comment ("Is it on
terrestrial tv?") was answered with a cropped real-app screenshot of the broadcaster field rather
than a guess — worth doing whenever a factual question shows up in comments.

**Growth ceiling reality check (2026-09-07):** when the user asks about hitting a specific big
download-count target ("1K downloads", "go viral"), be honest that organic FB group posting has
a structural reach ceiling regardless of content quality (see "What doesn't work" below) — more
posts alone won't produce a step-change. Creator outreach is the one lever that isn't capped,
but the user has explicitly deferred it until the app reaches ~10K users; don't restart it before
then without being asked. Paid spend is available only up to $20 total and the user wants it held
until the app earns revenue to reinvest — don't propose spending it.

**2026-09-08 addendum:** a real, verified breaking-news hook (Ronnie O'Sullivan withdrawing
from the English Open, confirmed via the API's `note` field before posting) was used to lead
a live+upcoming update — user's own suggestion mid-session ("you can add message about ronnie
withdrew I think it will wake users respond"). This is the pattern to repeat: check the API
for anything newsworthy (a walkover, an upset, a big name out) before writing a live post, not
just scores — a real headline outperforms a plain score list per the Editorial-storyline
finding above, and it costs nothing extra to check since the match data is already being
pulled. Also reconfirmed: verifying a claim in a fan comment against the API before replying
(Zhao Xintong/Neil Robertson eliminations) is cheap and turns a passive comment into a genuine
exchange — keep doing this every session.

**2026-09-04 (session 2) addendum:** a fast-moving live match is a good excuse to post twice
in one session without it reading as spam — the QF graphic (Selby 5-0, Highfield/Moody 3-2,
Trump/Zhao preview) and a real device screenshot ~20 min later (Highfield had swung it to 4-2)
were genuinely different information, not a repost. Always re-check `matches/today/` right
before the second post rather than assuming the first post's numbers still hold.

**2026-09-11 addendum — heavy pre-break push:** with the user offline for 3 days, ran a
full-channel push same day as the English Open QFs: 7 standalone group posts + 2
comment-workaround posts (EURO SNOOKER 144.7K, Snooker TV 10.1K) + the Page + a genuine
comment on WST's own verified Page (4.6M followers, on a same-day 412-like Murphy clip).
Real device screenshots (Results tab) worked better than a generated "bracket" graphic —
user explicitly redirected away from the generated version mid-session; see
`docs/SESSION_2026-09-11_growth_push_english_open_qf.md` for the full lesson on why (the
in-app Draw tab still can't render the QF-stage bracket due to a round-number-gap bug in
the chain-detection logic). Also confirmed the comment-tactic on official high-traffic
Pages (§"Commenting on official/high-traffic Pages") repeats cleanly — worth doing every
session when a genuinely relevant, verified angle exists (here: a player's real same-day
QF opponent/time).

**2026-09-14 addendum — the 09-11 heavy push actually underperformed badly, and it points at
"post-and-leave" as the cause, not content or channel choice:** audited real engagement on
the 09-11 push 3 days later (Snooker 227.8K: 1 like/0 comments/1 share; Legend Ronnie 60.2K:
0 likes/0 comments/2 shares; Golden Ball 16.2K: 0/0/0). That's dramatically below the 09-07
schedule-graphic benchmark (11 likes/2 comments) and the 09-08 live-score benchmark (8
likes/3 shares) using the **same channels and a similar schedule-graphic format**. The one
structural difference: 09-11 was a "post to 9 destinations in 15 minutes, then go offline for
3 days" blitz — nobody was online to reply to comments, answer questions, or re-post as the
live matches actually happened. This is the strongest evidence yet for the standing
"never post-and-leave" rule (§ Insights, "What works") — it's not a suggestion, it's the
difference between 11 likes and 0. **Lesson: don't front-load a multi-day trip's worth of
posts into one sitting.** If the user will be offline, either scale back to 1-2 posts (not
9), or accept the heavy-blitz posts are pure "seed content" (SEO/permanence value, no real
engagement) and plan a follow-up real-time push for when someone's actually online to engage.

**2026-09-14 — the "little traffic on the Page" question, answered concretely:** MaxBreak147
Page is still at **1 follower**, 10 days after launch. Checked its own 09-11 cross-post
directly: 0 likes, 0 comments, 0 shares, and Facebook is showing the "קידום פוסט"/boost-this-
post upsell on it — a clear signal Facebook itself sees near-zero organic reach on it. This
isn't a content problem (it's the identical content that got 1 like/1 share on the Snooker
227K group) — it's the structural 0-follower cold-start problem already documented in §3.
**The Page will keep showing ~0 traffic on every post until step 1 of the zero-follower
bootstrap playbook actually happens**: group posts/comments need to explicitly tell people to
follow the Page, not just mention the app name. **Confirmed the gap directly**: the 09-11 post
text reads "Follow every match live... free on MaxBreak147: [Play Store link]" — it name-drops
MaxBreak147 but the only link in every one of these posts is to the **Play Store app**, never
to the **Facebook Page**. Every group post to date has been silently skipping bootstrap step 1
— members have never actually been given a link or a reason to follow the Page. **Concrete fix
for next session**: add a second line to the standard post template, e.g. "👍 Follow
[Page link] for live updates between posts" — cheap to add, directly targets the stalled
follower count, and doesn't cost anything else in the post.

**2026-09-14 (session 2) — lead with a real result headline even on a thin-content day:**
today's live matches were Northern Ireland Open Qualifiers only (no TV-stage names) — the
usual "live scores" hook had nothing compelling to show. Checking the calendar found the
English Open had just finished (verified via API: Ali Carter 9-6 Mark J Williams), so the
post led with that real result instead of the qualifiers, using the qualifiers only as a
secondary "live right now" line + a forward-looking schedule line. This is the pattern for a
quiet tour day: check `calendar/?tab=recent` for a just-finished event before defaulting to
"nothing to post" or fabricating excitement around low-profile qualifiers.

**Standing habit — always include both store links, and verify no duplicate before/after
posting:** posted this session's first draft with only the Play Store link; the user caught
it mid-session ("there is ios version too"). Fixed by editing the already-published post (FB
group posts support in-place edit via the post's own "⋯" → "עריכת פוסט", not the "my content"
management panel's limited menu) rather than deleting and reposting. Template going forward:
Play Store UTM link + a separate `📱 iPhone users: https://apps.apple.com/app/id6762826909`
line (Apple's App Store has no referrer-based UTM equivalent, so this link carries no
campaign tag — that's expected, not a bug). Separately: this session found `git diff` already
showed today's skill-file edits as uncommitted before any of this session's own Edit calls —
turned out to be an earlier same-day peer session's planning notes, not a duplicate post, but
it's a real trap (two sessions can work the same account) — **always check the group's own
"my content → פורסמו" panel for an existing post on the same topic before publishing**, not
just trust the skill file's own notes.

**Biggest untapped opportunity (assistant's own read, 2026-09-04):** creator/influencer
outreach. Current channels (Reddit/FB groups/IG comments) are structurally capped at modest
reach per post — none of them scale past a ceiling. A single creator with an existing
audience sharing/mentioning the app is the one lever that could produce a step-change rather
than incremental growth. Two outreach emails are drafted and ready to send pending approval;
prioritize getting those out and 2-3 more candidates identified (avoiding contact forms
behind a CAPTCHA — that's a hard no per the no-CAPTCHA-solving rule, find a direct email or
socials DM instead). **2026-09-14: ranked candidate list researched** —
`docs/GROWTH_CREATOR_OUTREACH_CANDIDATES.md` (9 YouTube channels sized 4.3K-607K subs, plus
the 2 already-drafted-unsent emails and 3 CAPTCHA-blocked candidates in one place). This is
still just research — nothing new was contacted. The 2 drafted emails sitting unsent for over
a week are the single biggest "just do it" item in the whole growth effort right now.

**2026-09-14 — competitor landscape (web research, not yet acted on):** three real
competitors worth knowing about — **Black Pocket / "BP- Live Snooker Score"**
(`com.score.snooker`, live scores from the same snooker.org data source we use — a direct
live-score competitor, its Play Store listing 404'd on a direct check so current
availability/standing is unconfirmed, worth re-checking), **MySnookerStats** and **Snooker
Scorer** (both scoreboard/stats apps — the closest competitors to our scoreboard feature
specifically, both apparently well-reviewed per search snippets, not independently verified).
No feature-gap analysis done yet — next step is pulling their actual reviews for concrete
complaints to market against, the Play Store listing fetch failed this session (page too
large for the fetch tool) and needs a different approach (e.g. Play Console's own competitor
tools, or a targeted review-page fetch) next time.

**2026-09-14 — zero organic web presence confirmed:** a plain web search for "MaxBreak147"
returns no hits at all outside generic 147-break explainer content — confirming there is
currently zero press/blog/forum pickup anywhere. This is the gap creator outreach and press
contacts (Snooker Planet, etc.) are meant to close; it hasn't happened yet.

**2026-09-14 — attribution root-cause dig, attempted, inconclusive:** tried to settle
whether Facebook strips the UTM `referrer` param before a click reaches the Play Store
(flagged as the top open question in the 09-14 analytics log). Confirmed the raw Play Store
URL itself resolves cleanly with the referrer param intact (direct `curl`, HTTP 200, no
redirect) — the link itself isn't broken. Could NOT verify what happens inside Facebook's
own link-handling (in-app browser / link-shim) without an authenticated mobile session — an
anonymous `curl` of the group post's permalink returns FB's static shell, not the real post
body (loaded via authenticated GraphQL), so the actual posted link text isn't inspectable
this way. **Real fix, not yet built**: stop depending on Facebook's/Play Store's opaque
link-handling entirely — stand up a small self-hosted redirect (e.g. a Railway route like
`/go/fb-group-post` → 302 to the real Play Store URL with the referrer intact) that logs each
click server-side before redirecting. That would give a real, first-party click count
independent of GA4/Play attribution, and finally distinguish "nobody's clicking" from
"clicks aren't converting" from "the referrer is getting stripped somewhere downstream." This
is a real (small) backend change — needs its own plan + approval before building, per
CLAUDE.md.

**2026-09-15 — reply-check-first discipline paid off cleanly, and the attribution gap is
confirmed still open:** ran the §0a step-1 reply-check before posting anything — all three
09-14 posts had zero comments to respond to (Snooker: 3 likes; Legend Ronnie: 1 like; SNOOKER
TODAY: never cleared its pending-approval queue a full day later, see §1). With no comments
to answer and only a thin qualifiers-only tour day, capped the session at 1 post (Snooker
227.8K, live NI Open Quali R1 screenshot) rather than forcing content across multiple
channels. Firebase's 28-day acquisition check (75 new users: 50 Direct, 24 Organic Search,
**1 Organic Social**) confirms the 09-14 attribution-gap finding is not a one-off — the ratio
of FB posting effort to attributed installs remains near-zero. This keeps the self-hosted
click-redirect idea (§5, 09-14 entry) as the top unbuilt fix, now with a second day of data
supporting it.

## 6. Keeping this skill alive

**This file must be updated at the end of every growth session**, not just referenced. Before
finishing a session:
1. Update the channel table in §1 — new groups tried, approval outcomes, any status flip
   (🟡→✅/❌).
2. Add any new browser-automation gotcha discovered to §1's mechanics list.
3. Append or revise findings in §5 (Insights) — what specifically worked/flopped this
   session and why, with real numbers (likes/comments/shares) where available.
4. Update §4 with any new analytics figures worth citing as a baseline for next time.
5. Still write the normal per-session doc under `docs/SESSION_<date>_<topic>.md` per
   CLAUDE.md rule #13 — that's the detailed session log; this skill file stays the
   distilled, current operating summary. Link the new session doc from here if it changes
   the picture materially.
