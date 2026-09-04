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
- **Deployment rules from CLAUDE.md still apply** even inside a marketing session: never
  edit app code, `app.json`, or ship a build without its own plan + approval. If a real bug
  surfaces mid-session (e.g. the icon bug, 2026-09-04), log it to `docs/OPEN_MISSIONS.md`
  and memory — do not silently fix it as a drive-by.

## 1. Channels — groups, Page, and their track records

Keep this table current — update after every session with new groups tried and outcomes.

| Channel | Type | Size | Status | Notes |
|---|---|---|---|---|
| Snooker | FB group | 227K | ✅ proven, fast-approve | The single best-performing channel to date. Post real-time live-score graphics here first. |
| Legend Ronnie O'Sullivan Snooker | FB group | 60K | ✅ proven, fast-approve | Second reliable channel. Good for comments on active threads too. |
| World Snooker Live Stream | FB group | 55.9K | 🟡 untested | Added 2026-09-04 (`groups/356147414907007`). First post went to mod approval — check outcome next session and move to ✅/❌ here. |
| EURO SNOOKER | FB group | — | ❌ declines standalone posts | Workaround: comment on an existing relevant post/thread instead of posting standalone — this has worked. |
| Snooker TV | FB group | — | ❌ declines standalone posts | Same workaround as EURO SNOOKER. |
| MaxBreak147 Page | FB Page | 0 followers (new, launched 2026-09-04) | ✅ active | `facebook.com/profile.php?id=61594074930801`. **Only Pages support native post scheduling** (composer → Timing options). Brand-new — needs steady posting to build compounding reach, don't let it go quiet. See strategy note in Insights. |
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
- **Scheduling is Page-only.** Composer → "Timing options" (Hebrew UI: "אפשרויות תזמון") →
  pick date/time → button changes from "Publish"/"פרסום" to "Schedule"/"תזמון". Confirmed
  NOT available on personal-profile or group posts.
- **A tab can render broken** (viewport reports abnormally small, clicks land wrong, typed
  text vanishes). Fix: close it, open a fresh tab, navigate again — don't fight it.
- Google Play Console's asset uploader has **no automatable file input** (dynamically
  created, immediately opens the native OS picker) — any Play Store graphic/icon upload must
  be handed to the user with exact manual steps, never attempted via browser automation.

## 2. Generating promo images

Three approaches, pick based on what the post needs:

**A. Real device screenshots (preferred for feature posts)** — via `adb` against the
connected device (S24 confirmed as `RFCX11GB0MK` in past sessions; check with
`adb devices`). Navigate the app to the real screen, `adb shell screencap`, pull it, then
**always crop out the ad banner** with PIL before using it. This is the strongest content —
real app, real data, no fabrication risk.

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
