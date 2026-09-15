# Session 2026-09-11 — Heavy growth push: English Open QF day

## Context

User is offline for 3 days starting today (no posting possible), so this was a deliberate
"heavy session" to cover as many channels as possible before the gap, timed to the English
Open Quarter-Finals (real tournament day, verified via the live backend API).

## What was built

Two branded graphics, both built from data verified fresh against
`https://snookerapp.up.railway.app/oneFourSeven/...` moments before use (never fabricated):

1. **`today_schedule.png`** — generated (PIL) card-list graphic: today's 4 QF matchups
   (Ding Junhui vs Kyren Wilson, Zhou Yuelong vs Ali Carter, Judd Trump vs Shaun Murphy,
   Mark J Williams vs Liam Davies), UK kickoff times (13:00 / 19:00 — converted from the
   API's UTC scheduled_date), nationality tags. User approved after one revision (Israel
   time → UK time per user request).
2. **`yesterday_results.png`** — **real S24 device screenshots** (not generated), stitched
   from the app's Results tab (Round 3 / Last-16), showing all 8 real results including
   the Selby 3-4 Wilson upset, with a light branded header/footer added around the
   authentic in-app UI. User specifically asked for this to replace an earlier attempt at
   a generated "bracket" graphic that didn't match the real in-app look — see lesson below.

## Where posted (2026-09-11, both images + one caption, UTM-tagged Play Store link)

Standalone posts (7 groups):
- Snooker (227.8K), Legend Ronnie O'Sullivan Snooker (60.2K), SNOOKER TODAY (27.3K),
  JUST SNOOKER (10.5K), Snooker Ronnie O'Sullivan 147 Fans (20.7K), Golden ball snooker
  club (16.2K — grown from ~0 three days ago), Snooker Fans & Players Hub (2.9K).

Comment workaround (groups that decline standalone posts):
- EURO SNOOKER (144.7K) and Snooker TV (10.1K) — commented with real-data text
  (Selby/Wilson upset + today's UK-time schedule) tying back to the app.

Page:
- MaxBreak147 Page — same post, cross-posted. Publishing required navigating the
  Page-management "New post" wizard fully to completion (see lesson below).

Comment sweep on high-traffic official content:
- **WST (World Snooker Tour)**, verified, 4.6M followers — commented on a same-day Shaun
  Murphy clip (412 likes) tying in his real QF opponent/time. Genuine, specific, not
  generic.
- Checked "TNT Sports Snooker" — determined it's very likely a **fake/spam page**
  (0 followers, 7 days old, contact email on the disposable-email domain `dayrep.com`) and
  skipped it rather than engage. Did not find a snooker-specific post on the real verified
  TNT Sports Page (14M, general sports) in the time available.

## Lessons for next agent

1. **The in-app Draw tab still cannot render the QF-stage bracket** — even though it now
   has a genuine bracket-tree renderer with connector lines (`DrawTab.tsx`, much improved
   since the 2026-09-04 note that it "only shows R1-R3"), it still stops at Round 3
   (Last-16) because of a round-number gap (round 13/QF is not contiguous with round 9/R16
   in the backend's round numbering, which breaks `computeKnockoutChain`'s chain-detection).
   **Don't spend time trying to screenshot a QF bracket from the app** — it isn't there.
   Worth flagging as a real product gap (see `docs/OPEN_MISSIONS.md` candidate) but out of
   scope for a growth session.
2. **When a real screenshot is wanted but the exact target view doesn't exist**, the
   pragmatic fallback that worked well here: use the **Results tab** (Round 3 = the most
   recent completed round) — it's real, complete, and needs no bracket UI at all. The user
   suggested this pivot mid-session ("maybe leave the bracket... take yesterday results")
   and it was the right call.
3. **Stitching multiple device screenshots into one composite is error-prone on pixel
   guesses** — cost several retries here (missed rows, duplicate rows, a cut-off card).
   Fix that worked: crop each source screenshot to a **disjoint, non-overlapping** set of
   rows (verified by directly re-reading each raw screenshot's content, not by estimating
   display-vs-original coordinate math), rather than assuming two screenshots at different
   scroll offsets share a coordinate space.
4. **The Page's "New post" flow (Business-Suite-style dashboard) is a multi-step wizard**,
   different from the group composer's single-click publish — see the updated Page row in
   the skill's channel table (§1) for the exact click sequence, including the recurring
   Promote-post-toggle-defaults-ON gotcha.
5. **A group's "Join" button showing (not "Joined")** does not necessarily block posting —
   JUST SNOOKER accepted a post while still showing as not-joined, since the group is
   public. Don't assume you need to join first.
6. **Always verify a small/new outreach target before engaging** — "TNT Sports Snooker"
   looked plausible from its name and cover art but had classic fake-listing signals
   (disposable email domain, 0 followers, week-old). Two minutes of verification avoided
   commenting on what's likely a scam/spam page.

## Verified, not deployed

Nothing here touched app code — this was a pure content/growth session. No build, no
deploy, no backend change.

## Next session

- Check `docs/GROWTH_ANALYTICS_LOG.md` in ~3 days when the user is back online for the
  actual engagement numbers across all 9 destinations from this push (likes/comments/
  shares) and the interstitial-trigger AdMob follow-up already queued from 2026-09-10.
- Consider whether the QF-bracket round-number-gap issue (lesson 1) is worth a real fix —
  it would let future growth sessions use a genuine in-app bracket screenshot for TV-stage
  rounds instead of falling back to the Results tab.
