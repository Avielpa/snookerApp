# Session 2026-09-04 — Facebook growth push, MaxBreak147 Page launch, app-icon bug found

**Read `docs/HANDOFF_2026-08-31_GROWTH_PUSH_AND_ANALYTICS.md` and `docs/GROWTH_FB_PLAYBOOK.md` first** — this session continues that work. No app code was changed today; this was a pure browser-automation marketing session, except for one real bug discovered (see below).

## TL;DR for next agent
1. **A real app-icon bug was found and needs your action**: the file actually wired into the build (`assets/images/icon.jpeg`, referenced from `app.json`) is a cramped, text-heavy, wrong-game (8-ball/pool, not snooker) icon that gets clipped by Android's adaptive-icon mask. This is NOT the same file as `assets/images/icon.png` (which is clean — that one is unused by the real config, a leftover/decoy). See "Icon bug" section below for the full fix path and two ready replacement images.
2. **A Facebook Page now exists**: `facebook.com/profile.php?id=61594074930801`, name "MaxBreak147". It has 9 posts (intro + 8 feature/live posts). Treat this as the new primary distribution channel going forward per the reach-math discussion below — don't let it go stale.
3. **Personal-profile posting continues to work** (Aviel Pahima account) — 227K "Snooker" group and 60K "Legend Ronnie O'Sullivan Snooker" group both fast-approve posts and are the two reliable channels. A new group was added today: **"World Snooker Live Stream" (55.9K, id 356147414907007)** — untested track record, first post pending mod approval as of session end.

## What was done, in order

### 1. Daily-activity engagement table (start of session)
User wanted a table of every post/comment made that day (Sept 4) with **own** engagement only (never the host post's total). Delivered. Finding: one real graphic post (schedule + QR) on the 227K Snooker group carried nearly all the engagement (7 likes/7 comments/5 shares); ~9 other comments/replies that day got 0/0. This reinforced the existing playbook: volume of near-identical comments doesn't convert, one well-targeted real-data post does.

### 2. Strategic reset — "make me viral" conversation
User pushed back hard: felt the session was "just automating ideas" with no real strategic value, and asked for genuine analysis, not more execution. Investigated two real viral posts on their behalf:
- **Cue Nation 2** (AI-labeled account, Snooker group, 75 likes): worked because of information density — one image with ALL round results, not one match.
- **Totally Snookered** (media page, 1.3K likes/224 comments): worked because it's an established **page** with its own following (not a group-post lottery), used a real editorial headline/storyline format ("TEENAGER DEFEATS LEGEND"), a real photo, and a genuine open question.

Conclusion given to user: personal-profile posts into groups have a low reach ceiling regardless of content quality — a **Page** compounds distribution over time and was worth building. User agreed → built the Page (see below).

### 3. MaxBreak147 Facebook Page — created and populated
`facebook.com/profile.php?id=61594074930801`. Category "Sports & Leisure". Cover photo = the Gemini hero image from a prior session. Website field = UTM-tagged Play Store link (`utm_source=facebook&utm_medium=page&utm_campaign=page_website`).

Posts made (all real screenshots or real data, no filler):
1. Intro post — full feature list (live scores, draws/calendar, rankings, comparison, scoreboard)
2. Scoreboard in action — real 38-break tracked ball-by-ball (device screenshot)
3. Foul-handling complexity — real screenshot, 7pts black + 2 reds accidentally potted scenario
4. Free ball rule — real screenshot of the free-ball-active state (all balls selectable)
5. Rivalry/H2H tracker — real screenshot, full head-to-head stats + "New Session" resume button
6. Rules of Snooker — real screenshot of the in-app searchable rules reference
7. Compare feature — 2 real screenshots, Neil Robertson vs Zhao Xintong (5 career 147s vs 1, but Zhao outscoring him this season 82-58 centuries)
8. Season Stats / Centuries Race leaderboard — real screenshot
9. Live Rankings — real screenshot, Zhao Xintong new World No.1
10. Calendar feature — **scheduled** for tomorrow 09:00 UK via Facebook's native Page scheduler (confirmed working, shows "in 17 hours" in feed) — then the user said to skip worrying about it, it's still queued and will fire on its own, no action needed.
11. Live-score screenshot (Selby 2-0, Highfield/Moody 1-1) with real-time caption
12. Live-score screenshot v2 (Selby 4-0, Highfield/Moody 3-2)
13. Bracket "Path to the Final" graphic (see below)

**Confirmed working: Facebook Pages support native post scheduling** (composer → "אפשרויות תזמון" / Timing options → pick date+time → "תזמון" instead of "פרסום"). Personal-profile posts and group posts (even as admin... untested) do **not** get this option in the composer — Pages only. Use this for routine content going forward instead of live-posting everything.

**A stuck browser tab**: clicking "Publish" on a Page post sometimes routes into Facebook's paid ad-boost flow (`/ad_center/create/boostpost/...`) instead of just publishing. The post itself DOES publish first — the boost screen is a separate upsell after. Never fill in payment info there; navigate away / open a new tab instead of fighting the "unsaved changes" dialog it throws up.

### 4. Live-score group posts (personal profile, real API data each time)
Two rounds of "LIVE right now" combined graphics (built via `build_promo4.py`, real scores pulled from `matches/today/` API) posted to the Snooker group as scores updated: 2-0/1-1, then 4-0/3-2 (Selby finished 5-0 shortly after session end).

### 5. New group found and tested: "World Snooker Live Stream"
`facebook.com/groups/356147414907007/`, 55.9K members. User supplied the link. Posted a real-stat H2H question (Trump/Zhao 6-6 all-time, Zhao won last meeting 10-3) — went to admin approval, not yet confirmed live at session end. Also left a genuine comment (Ronnie O'Sullivan answer) on an active "favorite pool player" thread there.

### 6. Bracket / "Path to the Final" graphic
User asked for a Draw-tab bracket screenshot showing QF→SF→Final. **The app's in-device Draw tab only shows early qualifying rounds (Round 1/2/3, round-of-32 down), not the TV-stage bracket** — the live QF matches (Selby, Highfield, Hill, Trump) aren't represented there at all. Rather than fight mobile scroll navigation, built a clean bracket graphic directly from the real-time API data instead (`build_bracket.py` in scratchpad) — QF cards with live scores, SF slots labeled "Winner: X/Y", a final "CHAMPION" trophy box, all connected with proper bracket lines. Posted to: Snooker group, Legend Ronnie group, MaxBreak147 Page. This is a repeatable script — rerun with updated match data for future rounds/tournaments.

### 7. Icon bug — found, root-caused, fix prepared but NOT applied
User complained the on-device app icon looks "cut and ugly." Investigated:
- `assets/images/icon.png` (1024×1024) — clean, padded, "MAX BREAK" text safely inside the icon's rounded-square, looks correct. **This file is a decoy / unused** — nothing in `app.json` references it.
- **The real file is `assets/images/icon.jpeg`**, referenced three times in `app.json` (`icon`, `android.adaptiveIcon.foregroundImage`, and inside the `ios` block too). This file has: a full snooker-ball rack graphic, an **8-ball** (pool, not snooker — wrong game entirely), and "MaxBreak147 / SNOOKER" text crammed right at the bottom edge. This is exactly what gets clipped into "XBREAK1" by Android's adaptive-icon circular/squircle mask — confirmed by comparing against the actual home-screen icon on the connected S24 device.
- **The Play Store *listing* icon** (separate asset, uploaded directly in Play Console, unrelated to the APK's baked-in icon) is the *exact same* cropped photo-realistic design — so the bug is visible in both places from the same root file.

**What's ready, not yet applied:**
- `C:\Users\Aviel\OneDrive\Desktop\maxbreak_store_icon_512.png` — 512×512, built from the (unused, but clean) `icon.png`. Safe drop-in for the Play Store listing icon field only (no rebuild needed — Play Console listing icon updates instantly).
- `C:\Users\Aviel\OneDrive\Desktop\maxbreak_store_icon_512_v2_gemini.png` — 512×512, freshly Gemini-generated (prompt: dark green baize, red+white ball pair only, no text, 70%-safe-zone padding, flat illustration style). Cleaner, more icon-like than v1. Also drop-in ready for the Play Store listing only.
- Neither has been uploaded to Play Console — **Play Console's asset uploader creates its file-input dynamically on click and opens the native OS file picker, which this session's browser-automation tools cannot drive** (confirmed: `read_page` finds no `type="file"` element anywhere in the DOM before or after clicking "Add assets"). This has to be done by the user manually: Play Console → this app → Grow users → Store presence → Store listings → Graphics → App icon → Add assets → pick one of the two files above → Save.
- **The actual in-app/installed icon** (`icon.jpeg` → `app.json`) was deliberately **not touched**. Per CLAUDE.md ("Plan first, code never," "Deployment requires explicit user approval"), swapping the real icon asset + updating `app.json` + shipping a new native build (`eas build`, since icon changes aren't OTA-updatable) is a bigger action that needs its own explicit go-ahead and a session budgeted for it, not something to fold into a marketing session. **Flag this to the user next session if not already discussed**: which of the two candidate icons (or the existing `icon.png`) to actually adopt, then a plan for the `app.json` edit + native build + Play Store listing update together.

### 8. Comments made today (personal profile, all genuine, no scripted spam)
- Reply on "favorite pool player" thread (Snooker group) — Ronnie O'Sullivan pick, tied to today's live matches, accurate (didn't falsely claim Ronnie was playing today — he wasn't in today's lineup).
- Reply on a John Higgins reel (Legend Ronnie group) — genuine comment about his safety game, again tied accurately to today's real live scores, not overclaiming who's playing.

**Established rule reinforced this session**: before posting anything that references "who's playing" or "watching X live," check the actual `matches/today/` data first. Caught and corrected two draft comments this session that would have made false claims (Ronnie "playing tonight" when he wasn't in the lineup; Higgins "playing tonight" same issue).

## Browser-automation notes for next agent
- **Multiple Facebook identities in the same browser session**: switching between "Aviel Pahima" (personal) and "MaxBreak147" (Page) requires clicking the profile-switcher (top-left avatar dropdown) and picking the other identity — and it must be done **per tab**; a tab doesn't inherit an identity switch made in another tab. Always screenshot after switching to confirm which identity's avatar is showing in the composer before typing/posting.
- **Composer text can get "stuck" from a previous attempt and duplicate** if you close a dialog without clearing it first and reopen — always click into the text field and `Ctrl+A` before typing fresh text, don't assume an empty box.
- **A rendering-broken tab happened once** (viewport reported oddly small, coordinates all landed wrong, typed text vanished/went to the wrong element). Fix: close that tab, open a fresh one, navigate again — don't keep fighting a broken tab.
- File uploads into Facebook's post composer: **do not click the visible "Photo/Video" button directly** — it opens a native OS file dialog that hangs the CDP screenshot call. Instead use `read_page` (filter `all`) to find the sibling `button [ref_X] type="file"` element and use the `file_upload` tool directly on that ref. This pattern worked reliably ~15 times this session.
- Google Play Console's graphics uploader has **no discoverable file input** via `read_page` — it's created dynamically and immediately triggers the native dialog. Any future Play Store asset upload needs to be done by the user, not automated.

## Files left in scratchpad (session-local, not committed)
- `build_promo4.py`, `build_bracket.py` — reusable generators for live-score and bracket graphics from real API data. Worth promoting into the repo (e.g. `docs/growth-tools/`) if this becomes a recurring need, so a future session doesn't have to reconstruct them from scratch.
- `live_home*.png`, `bracket_path_to_final.png`, `gemini_icon_v1.jpg`, `store_icon_512*.png` — today's captured/generated assets.

## Open items for the user / next session
1. Decide which icon to actually ship (existing `icon.png`, or one of the two new candidates) and approve the `app.json` + native-build + Play-Store-listing update as its own planned task.
2. Manually upload the chosen 512×512 icon to the Play Store listing (Play Console blocks automation there) — both candidates are sitting on the Desktop ready to go.
3. Check whether the "World Snooker Live Stream" group post got approved, and whether it's worth keeping as a third regular posting target alongside Snooker (227K) and Legend Ronnie (60K).
4. Keep the MaxBreak147 Page fed — it's brand new (0 followers) and needs consistent posting to build the compounding-reach effect discussed in the strategy conversation; don't let it go quiet after this session's initial burst.
