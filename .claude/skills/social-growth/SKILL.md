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

## 0. Ground rules (non-negotiable, established over multiple sessions)

- **Never fabricate content.** Every score, stat, headline, or "who's playing" claim must
  come from the real backend API (`https://snookerapp.up.railway.app/oneFourSeven/...`),
  checked fresh each time — not memory, not the previous post. Two false "X is playing
  tonight" comments were caught and rewritten this way; always cross-check
  `matches/today/` before claiming anyone is live.
- **Crop out ad banners from every device screenshot before posting**, no exceptions —
  this is an explicit standing user instruction.
- **Every outbound link is UTM-tagged** per `docs/GROWTH_UTM_TRACKING.md` — never post the
  bare Play Store URL. Use the `link()`/QR helper pattern in that doc.
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
| Snooker | FB group | 227.6K | ✅ proven, fast-approve | `groups/769585246708073` — **two groups share this exact name in the joined list, the other is only 28K (`groups/498611593874694`) — verify member count before posting.** The single best-performing channel to date. Images go through quick admin approval (confirmed 2026-09-07 toast), not instant. Post real-time live-score graphics here first. |
| Legend Ronnie O'Sullivan Snooker | FB group | 60.2K | ✅ proven, fast-approve | `groups/287612679061624`. Posts go to admin approval (confirmed via toast 2026-09-07), usually clears quickly. Good for comments on active threads too. |
| World Snooker Live Stream | FB group | 56.0K | 🟡 posts do clear, but still piracy-linked — avoid | `groups/WorldSnookerLiveStream`. Its own About section links an illegal streaming site — same category as groups skipped for that reason elsewhere. 2026-09-08: a user-posted schedule graphic here actually went live (not stuck pending) and got 8 likes/0 comments in 3h, so it's not purely a dead/slow channel — but the piracy-link concern stands. Don't proactively choose this group; if content ends up here, don't repeat. |
| EURO SNOOKER | FB group | — | ❌ declines standalone posts | Workaround: comment on an existing relevant post/thread instead of posting standalone — this has worked. |
| Snooker TV | FB group | — | ❌ declines standalone posts | Same workaround as EURO SNOOKER. Reconfirmed 2026-09-08: a posted schedule graphic never rendered on its permalink (redirects to the group's general feed instead) — treat any post here as silently dropped, don't assume it went live without checking the permalink directly. |
| "Snooker" (28K duplicate) | FB group | 28.0K | 🟡 untested for value | `groups/498611593874694` — the wrong/smaller duplicate of the 227K "Snooker" name (see gotcha below). Got a post 2026-09-08 (posted alongside the real 227K group by mistake-prone naming), only 1 like/0 comments in 3h. Not worth targeting deliberately — always double-check you're on `769585246708073`. |
| Golden ball snooker club | FB group | — (new, untested size) | 🟡 promising, new 2026-09-08 | `groups/2512402948994428`. First post here 2026-09-08 (schedule graphic) cleared and got 2 likes + 1 genuine reply-comment in 3h — solid early signal for a brand-new group. Worth continuing to test. |
| Snooker Fans & Players Hub | FB group (private) | — (new, untested size) | 🟡 low engagement so far | `groups/1655995331639369`. First post 2026-09-08 cleared but got 0 likes/0 comments in 3h. Too early to write off after one post, but no signal yet. |
| MaxBreak147 Page | FB Page | 0 followers (new, launched 2026-09-04) | ✅ active | `facebook.com/profile.php?id=61594074930801`. **Only Pages support native post scheduling** (composer → Timing options). Brand-new — needs steady posting to build compounding reach, don't let it go quiet. See strategy note in Insights. Fed again same day (session 2): a real-data QF graphic + a real S24 live-score screenshot, ~20 min apart — worked fine as two distinct updates, not duplicates. 2026-09-08: fed a Gemini AI-generated brand poster (no live data, pure brand awareness) — published clean after the recurring Promote-post-toggle and "Talk to people directly" upsells were handled per the gotchas below. |
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

**Biggest untapped opportunity (assistant's own read, 2026-09-04):** creator/influencer
outreach. Current channels (Reddit/FB groups/IG comments) are structurally capped at modest
reach per post — none of them scale past a ceiling. A single creator with an existing
audience sharing/mentioning the app is the one lever that could produce a step-change rather
than incremental growth. Two outreach emails are drafted and ready to send pending approval;
prioritize getting those out and 2-3 more candidates identified (avoiding contact forms
behind a CAPTCHA — that's a hard no per the no-CAPTCHA-solving rule, find a direct email or
socials DM instead).

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
