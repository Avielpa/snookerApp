# Session 2026-09-08 — Growth push: live scores, Ronnie withdrawal, Gemini promo, analytics

## Context
User had already posted a morning schedule graphic to 8 Facebook groups before this session
started. Session tasks: (1) check status of those posts, (2) post live-score + upcoming
updates using the connected S24 device, (3) generate an AI promo image via Gemini, (4) check
growth analytics, (5) free hand on Facebook otherwise. Full instructions and playbook: skill
`social-growth` (`.claude/skills/social-growth/SKILL.md`), read at session start.

## 1. Status of this morning's 8-group post
Checked every permalink individually (get_page_text / screenshot per post). Results:

| Group | Likes | Comments | Shares | Notes |
|---|---|---|---|---|
| Snooker (227.6K, correct group `769585246708073`) | 13 | 2 | 2 | Best performer, as expected |
| World Snooker Live Stream (piracy-linked, flagged ❌ in skill) | 8 | 0 | — | Actually went live despite skill's "stuck pending" note — flagged in skill as outdated |
| Legend Ronnie O'Sullivan Snooker | 0 | 0 | 0 | No numeric counts shown, flat |
| Golden ball snooker club (new) | 2 | 1 | — | Promising first showing for a new group |
| Snooker (28K wrong duplicate `498611593874694`) | 1 | 0 | — | Confirms the known name-collision gotcha — user's morning batch hit both "Snooker" groups |
| LIVE 🔴► 2022 World Snooker Championship | 0 | 0 | — | Flat |
| Snooker Fans & Players Hub (private, new) | 0 | 0 | — | Flat |
| Snooker TV | — | — | — | Post never rendered on its permalink — falls back to the group's general feed. Confirms skill's "declines standalone posts" status; treat as silently dropped |

Replied to a real fan comment on the 227K Snooker post (Donal McCarron, asking about
Zhao Xintong/Neil Robertson's exits) after verifying both results against the live API
(`/oneFourSeven/events/2546/matches/`) — Zhao lost 2-4 to Oliver Lines, Robertson lost 3-4 to
Luo Zetao, both 2026-09-07.

## 2. Live-scores + upcoming post
Checked `/oneFourSeven/matches/today/` for the English Open. Found: two live matches
(R. Muir v X. Guodong, W. Xinbo v T. Un-Nooh, both 0-0/early), and — critically — **Ronnie
O'Sullivan had withdrawn** (`note: "O'Sullivan pulled out."`, Liam Davies through by walkover).
This was caught before posting, avoiding a false "Ronnie plays today" claim. User then
suggested leading with the withdrawal as a hook, which was used.

Took two real S24 screenshots (Live tab, Upcoming tab) via adb, cropped the Upcoming one to
remove an ad banner (Live tab screenshot had no ad loaded, no crop needed). Posted the
same real-screenshot pair with a Ronnie-withdrawal-led caption to:
- Snooker (227.6K) — went to admin approval, approved within seconds (toast notification seen)
- Legend Ronnie O'Sullivan Snooker (60.2K) — published, tailored caption ("not the news Ronnie
  fans wanted... hope he's OK")

Per explicit user correction mid-session: **live/schedule posts use real device screenshots
only** — AI-generated images are reserved for the Gemini brand-awareness lane. Followed this
for both live posts (real screenshots) and the Gemini image (brand poster, no data).

## 3. Gemini AI promo image
Generated via gemini.google.com ("nano banana" image model): dark baize background, gold
lighting, red/black/white balls mid-break, glowing scoreboard silhouette in the corner, no
text, bottom third left empty. Downloaded full-res, published to the MaxBreak147 Page as a
standalone brand-awareness post (not tied to any live match data) with a UTM-tagged Play
Store link (`utm_source=facebook&utm_medium=page&utm_campaign=promo_poster_sep8`).

Hit two known gotchas during publish, both handled per the skill's documented mechanics:
- The "פרסם" (Publish) top-nav button on a Page profile routes into the ad-center flow, not
  the normal composer — backed out without entering any payment info, used the in-feed
  "מה בא לך לשתף?" composer instead.
- The Promote-post toggle defaulted ON again (recurring across sessions) — switched off and
  visually re-verified before publishing.
- Post-publish "Talk to people directly" upsell dialog — declined with "לא עכשיו", post was
  already live underneath it.

## 4. Analytics check
- **Firebase actives**: 28d 126 / 7d 49 / 1d 12 (vs 09-07's 124/52/12) — flat, no dramatic
  move since yesterday's check.
- **UTM acquisition — first real signal**: GA4 User acquisition report now shows a distinct
  `page_post` first-user-medium row (1 user, 1 new user, 53 events, 100% key-event rate,
  first appearing ~Sep 3-4). This is the first direct proof the UTM-tag → Play referrer →
  Firebase pipeline works end-to-end. Volume is still too small to compare channels, and the
  `page_post` label doesn't match our manual `utm_medium` convention — looks like it may be
  Meta's own auto-tagging on Page-post link clicks rather than one of our tagged links;
  flagged as a follow-up to understand, not yet resolved.
- **AdMob** (7d vs prior 7d): earnings ₪0.54 (-39.15%, still soft), requests 957 (+23.80%),
  impressions 683 (+33.40%, accelerating), match rate 89.97% (+8.50%), eCPM ₪0.80 (-54.39%,
  deepening). Both Android (+29.75% impressions) and iOS (+42.28% impressions, a new
  positive) gained volume this week, not just Android as in prior checks.

Full numbers appended to `docs/GROWTH_ANALYTICS_LOG.md` (2026-09-08 entry).

## 5. Skill file updates
Updated `.claude/skills/social-growth/SKILL.md`:
- Channel table: added the two new groups tested today (Golden ball snooker club, promising;
  Snooker Fans & Players Hub, flat so far), corrected World Snooker Live Stream's status (it
  did go live with real engagement this time, despite past "stuck pending" notes — softened
  the claim rather than fully reversing it), reconfirmed Snooker TV silently drops posts, and
  noted the 28K wrong-duplicate "Snooker" group's weak performance.
- Ground rules: added the AI-image-only-for-Gemini-lane rule per the user's explicit
  mid-session correction.
- Insights: added the verified-breaking-news-hook pattern (Ronnie withdrawal) as a repeatable
  tactic, and reinforced the verify-before-replying pattern.

## What still needs doing / open threads
- The `page_post` UTM medium mismatch — worth digging into next session (check whether it's
  Meta's own auto-UTM on Page links vs one of our manually tagged links actually converting).
- Keep letting UTM data accumulate before drawing real channel-comparison conclusions.
- Two new groups (Golden ball snooker club, Snooker Fans & Players Hub) only have one data
  point each — need 2-3 more posts before their track record is trustworthy.
- Nothing broken/blocking found in the app itself this session — pure growth/marketing work,
  no code touched.

## Verification
No code changes this session (pure Facebook/analytics/marketing work). Posts verified live by
re-navigating to each permalink and reading like/comment counts directly, not just assuming
"Publish" succeeded. Analytics numbers read directly off Firebase/GA4/AdMob consoles via
screenshot, not estimated.
