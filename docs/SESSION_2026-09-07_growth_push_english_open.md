# Session 2026-09-07 — English Open Round 1 growth push

Short, focused growth session per the social-growth skill. No app code touched.

## What was done

Built a real-data promo graphic (`build_promo_eo.py`, dark baize/gold theme, same pattern as
prior sessions' `build_promo4.py`/`build_promo5.py`) from live `matches/today/` API data for
English Open Round 1:
- **LIVE NOW**: Si Jiahui vs Robbie Williams, Ding Junhui vs Michael Holt (both 0-0 at post time)
- **COMING UP TODAY**: Neil Robertson, Kyren Wilson, Mark Allen, and headline match new World
  No.1 Zhao Xintong vs Oliver Lines
- QR code encoding a UTM-tagged link (`utm_source=facebook&utm_medium=group_post&utm_campaign=english_open_r1`)

Posted the same graphic + caption to all three regular channels:
1. **Snooker group (227.6K)** — sent for image approval (per the group's admin-approval-on-images
   setting; confirmed via in-app toast "an admin approved your image").
2. **Legend Ronnie O'Sullivan Snooker (60.2K)** — sent to group admins for approval (toast
   confirmed).
3. **MaxBreak147 Page** — published live immediately (Pages don't need approval). The "Promote
   post" toggle defaulted ON again as expected (see skill §1 gotcha) — toggled off, confirmed
   grey via `find()` element state before publishing. A new upsell dialog appeared this time
   ("Talk to people directly" / add a Contact-now button) — declined with "Not now."

## Important correction this session

**There are two different Facebook groups both named "Snooker" in the joined-groups list**:
- `groups/498611593874694` — only 28.0K members (the one auto-selected by clicking the first
  "Snooker" card in the groups grid — wrong one, do NOT post here for the "227K" channel)
- `groups/769585246708073` — the correct 227.6K group referenced everywhere in prior session
  docs and the skill's channel table.

Caught before posting (user confirmed "there is a Snooker page with 227k" when the wrong 28K
group was open). **Added to skill gotchas below** — always verify the member count in the group
header before posting, don't trust the group name alone when there are near-duplicate names in
the joined list.

## New gotcha found

The Page composer's post-settings step now also shows a **second, separate upsell dialog**
("לדבר עם אנשים ישירות" — talk to people directly / add a Contact-now button) after clicking
publish, in addition to the already-known Promote-post toggle. Declined via "לא עכשיו" (Not
now). Didn't block the post — it still published successfully once dismissed.

## Not done this session (deferred, by user's own scoping choice)

- World Snooker Live Stream group approval check (still 🟡 unresolved since 2026-09-04)
- Creator outreach follow-up (Shaun Murphy email reply status, Snooker Legends contact)
- Icon bug decision

## Follow-up post (same session, user feedback)

User pointed out the first post's graphic was a PIL-generated composite, not a real app
screenshot — fair catch, it does read as "edited" rather than authentic. Pulled a real
screenshot from the connected S24 (`RFCX11GB0MK`) via `adb shell screencap`, cropped out the
empty ad-slot box + bottom nav with PIL (standing rule), and posted it as a genuine follow-up
to all three channels with a caption that asks a real question ("who do you think turns it
around?") to prompt replies — user explicitly asked for a question/engagement trigger.

Real scores at that point: Michael Holt 1-0 Ding Junhui, Robbie Williams 1-0 Si Jiahui (moved
from 0-0 in the first post — genuinely new information, not a near-duplicate).

- Snooker group (227.6K) — posted, pending admin image approval (same as first post)
- Legend Ronnie group (60.2K) — posted, pending admin approval; confirmed live moments later
- MaxBreak147 Page — published live; promote-toggle-off dance needed **two clicks** this time
  (first click via `find()`-then-coordinate didn't register — visually still ON after a zoom
  check; a second click via the element `ref` directly worked). Always re-verify the toggle
  state visually right before clicking Publish, don't trust one click.

**Lesson for the skill**: prefer real device screenshots as the default for live-score posts
going forward — a generated graphic can pack more info into one frame, but a real screenshot
reads as authentic and that matters more than density. Save the generated-graphic approach for
cases a screenshot genuinely can't cover (e.g. a bracket the app doesn't render).

## Live status at session end (before round 3/4)

Michael Holt 1-0 Ding Junhui, Robbie Williams 1-0 Si Jiahui (both matches, after the follow-up
post). A future session/continuation should re-check `matches/today/` before posting again
rather than assuming these numbers hold.

## Round 3 — combined Live+Upcoming real screenshot (same session)

User asked for two real device screenshots (Live tab + Upcoming tab) stitched into one combo
image with a short caption, rather than another generated graphic. Re-launched the app fresh
(explicit `monkey` launch, not just screencap of whatever was open — user had flagged that the
earlier screenshot showed no visible device movement, which was correct: that one just
captured whatever was already on screen). Cropped both raw screenshots (remove status bar, ad
slot, bottom nav) and stacked them with a thin gold divider — real Live tab (M. Holt 2-3 D.
Junhui, Ding fighting back from behind) on top, real Upcoming tab (4 matches at 15:00/17:00 UK)
below. Posted to Snooker (227.6K), Legend Ronnie (60.2K), and MaxBreak147 Page — all three
succeeded (2 pending approval, Page live immediately, promote-toggle-off dance needed **two
clicks** this round, see skill update).

## Round 4 — Gemini AI background + real full-day data overlay (same session)

User then asked specifically: catch **all** of today's matches (not a partial scroll), edit,
generate an AI "good look" image via Gemini, post it. Approach used (see updated skill §2 —
this is now the documented pattern for this kind of request):
1. Pulled the complete `matches/today/` list fresh — 15 matches total (1 finished, 1 live, 13
   scheduled across 12:00/14:00/18:00/20:00 UK slots).
2. Generated a **text-free background/theme image** via Gemini web app (gemini.google.com) —
   prompt explicitly requested no text/numbers/logos, dark green baize + gold vignette + blurred
   balls in corners, empty upper/center area reserved for overlay. This sidesteps the real risk
   that AI image generation garbles multi-line score text (never verified as accurate — would
   violate the "never fabricate content" rule if posted with real match data baked in wrong by
   the model).
3. Downloaded the Gemini image from `~/Downloads` (Gemini's in-page download button saves there,
   not to the session scratchpad — copy it over manually) and composited **all 15 real matches**
   onto it with PIL (accurate text, AI-quality background).
4. Posted to all three channels with a short caption. All three succeeded.

**New gotcha**: switching identity via the top-left avatar dropdown before navigating to a group
sometimes doesn't take effect until you actually re-navigate to the target URL — checked the
Snooker group screenshot once and it was still showing the Page identity ("Join the group"
prompt = Page isn't a group member) even though the identity switch had been clicked. Re-clicking
the switch and re-navigating fixed it. Always screenshot to confirm identity **after** landing on
the target page, not just after clicking the switch.

**Reinforced gotcha**: the tag-suggestion autocomplete dropdown (triggered by typing text that
happens to match a Page/person name, e.g. "MaxBreak147" in the caption) appeared multiple times
this round. Dismiss by clicking elsewhere in the dialog (e.g. the dialog title) — **do not press
Escape**, which closes the entire composer and loses unsaved image attachments (recoverable via
the auto-saved draft shown on the profile timeline, but adds a wasted round-trip).

## Round 5 — engagement audit, comment reply, afternoon live post, growth strategy (same session)

User asked for a full engagement table across all 15 of today's posts. Built it via
`facebook.com/me/allactivity` (chronological log of every post, with a "Show" button that jumps
straight to the permalink) for the 10 personal-profile group posts, and via Meta Business Suite's
content table (`business.facebook.com/latest/posts`, with a custom column set including "Likes
and reactions"/"Comments"/"Shares") for the 5 Page posts. **Full-day schedule post in Snooker
(227.6K) was the clear winner: 11 likes, 2 comments** — everything else was 0-5 likes, 0 comments.
Page posts got 0 engagement across the board (0 followers, expected).

**Real comment handled**: Lin Woodward asked on the winning schedule post "Is it on terrestrial
tv, please?" Replied with a cropped single-match-card screenshot (real device data) showing the
actual broadcaster field ("HBO Max +2") and an honest "not terrestrial" answer — no fabrication,
used the real in-app data rather than guessing.

**Growth strategy discussion**: user wants 1,000 Play Store downloads (~12x from current ~82
installs) and asked how to go viral. Gave an honest assessment — organic FB group posting has a
structural reach ceiling per this skill's own findings, so "more posts" alone won't 12x anything.
Ranked levers: (1) creator outreach — user explicitly deferred this until the app reaches ~10K
users ("no one will want it" below that), so **do not restart creator outreach before then**;
(2) icon fix — approved and executed this session, see below; (3) expand posting to more
scouted groups — done this round; (4) paid spend — user's total available budget is **$20 max**,
explicitly wants to hold it until the app earns some revenue to reinvest, not spend it now.

**New group tested and rejected**: World Snooker Live Stream (56.0K, `groups/WorldSnookerLiveStream`)
— its own About section reads "Watch World Snooker Live Stream Online, live here >>
https://watch-live.net/s/world-snooker" — a piracy streaming site. Did not post. Same category
as a group skipped back on 2026-08-25 for the same reason. Also has a 6-post approval backlog
including this app's untouched Sept 4 test post, so it's slow-moving regardless. Flipped to ❌ in
the skill's channel table.

**Afternoon live post**: built a second real-data graphic (Williams and Ding both through,
4 fresh live matches — Yuan Sijun, Neil Robertson, Zhang Anda, Ali Carter). Per user's explicit
ask, used a **real device screenshot** (fresh app launch, not a generated graphic) with the ad
carousel cropped out, plus a composited QR-code footer (UTM-tagged link) since a raw screenshot
has no such reference. Posted to Snooker group only — skipped Legend Ronnie/Page this round since
they'd already had 5 zero-engagement posts today each; avoided further diminishing returns.

**Icon bug fix — executed this session** (was open since 2026-09-04): copied the user-approved
`maxbreak_store_icon_512_v2_gemini.png` (plain red+white ball pair, no text, 512x512) into
`FrontMaxBreak/assets/images/icon_v2.png`, updated all three `app.json` references (`icon`,
`android.adaptiveIcon.foregroundImage`, `expo-notifications` plugin icon) from the broken
`icon.jpeg` to the new file. Kicked off `eas build --profile preview --platform android` in the
background — **still need to**: verify the build succeeds, get the user to test the APK on their
device, then run the production build, then the user manually uploads the same 512x512 image to
the Play Store listing icon field (Play Console's uploader can't be automated). `icon.jpeg` and
the old unused `icon.png` were left in place, just no longer referenced — safe to delete later
once the new icon is confirmed working, not done this session.
