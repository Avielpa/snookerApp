# Session 2026-09-15 — Daily growth: reply-check + light post + analytics

## Symptom / trigger
Routine daily ask: "run daily social + analysis, s24 connect if screenshots needed." No bug,
pure growth-operations session per `.claude/skills/social-growth/SKILL.md`.

## What was done

1. **Reply-check pass (§0a step 1 — mandatory before any new posting).** Checked all three
   2026-09-14 posts via `facebook.com/<profile>/allactivity`:
   - Snooker (227.8K group): 3 likes, 0 comments.
   - Legend Ronnie O'Sullivan Snooker (60.2K group): 1 like, 0 comments.
   - SNOOKER TODAY (27.3K group): still showing "your post is pending admin approval" a full
     day later — the 09-14 "pending content limit" error apparently meant the post never
     actually queued, not just delayed. Worth retrying fresh next session, not chasing this one.
   - MaxBreak147 Page: its own 09-14 cross-post still 0 likes/0 comments.
   Nothing needed a reply. No skipped comments, no risk of the "post-and-leave" pattern that
   tanked the 09-11 push.

2. **Checked today's live tour data** via
   `GET /oneFourSeven/matches/today/` (header `X-Requested-By: FahimaApp128`): only Northern
   Ireland Open Qualifiers Round 1 live — lower-profile names (Mertens, Hill/Muir,
   Robertson/Burden, Davies/Zhengyi), no TV-stage names. English Open (the real headline) was
   already covered in yesterday's posts. Thin-content day, not a "massive push" day.

3. **Connected the S24** (`adb devices` → `RFCX11GB0MK`), woke and unlocked it, opened the app
   to the Live tab, captured a fresh screenshot of the actual live scores, cropped out the ad
   banner with PIL (`live_screenshot_cropped.png`, ad banner and bottom nav removed).

4. **Posted once** (capped at 1 destination per the §0a cadence rule, since there were no
   comments to reply to and only thin content to lead with): Snooker (227.8K group), real
   S24 screenshot, real verified live scores, UTM-tagged Play Store link
   (`utm_source=facebook&utm_medium=group_post&utm_campaign=snooker_227k_daily_0915`) + the
   iOS App Store link, plus (per the 09-14 finding that no post had ever actually linked to
   the Page) a line asking readers to follow the Page. Removed Facebook's auto-generated link
   preview card before publishing so the real screenshot is the only image. Went to admin
   approval this time (not instant, unlike 09-14's post to the same group).

5. **Analytics check** (Firebase Console → GA4 → Games reporting → Acquisition, last 28 days
   Aug 18–Sep 14): 75 new users — Direct 50, Organic Search 24, **Organic Social 1**. Confirms
   the attribution gap flagged 09-14 is not a one-off blip — two consecutive days of checking
   show the same near-zero Organic Social attribution despite real posting volume across
   09-11 and 09-14. AdMob not re-checked (no reason to expect movement since the 09-10 fix).

## Files touched
- `docs/GROWTH_ANALYTICS_LOG.md` — appended 2026-09-15 entry.
- `.claude/skills/social-growth/SKILL.md` — updated Snooker/SNOOKER TODAY channel rows +
  new dated Insights addendum.
- This session doc.
- No app code touched (pure marketing-ops session, per CLAUDE.md rule #7 boundaries).

## What was verified
- Live match data cross-checked against the API directly before posting (not from memory).
- Screenshot visually confirmed ad-free before upload.
- Post composer confirmed showing personal "Aviel Pahima" identity (not the Page) before
  typing, matching the pattern that's worked for this group historically.
- Post confirmed submitted (pending-approval toast shown), not just "clicked publish and
  assumed."

## What still needs follow-up (not done this session)
- SNOOKER TODAY's stuck pending post — try again fresh next session rather than nudging this one.
- The Organic Social attribution gap is now a 2-day-confirmed pattern, not a one-off. The
  self-hosted click-redirect fix proposed in the skill's Insights section (a small Railway
  route that 302s to the Play Store URL, logging clicks server-side) would settle whether
  Facebook's link handling is stripping the UTM referrer — this is a real (small) backend
  change and needs its own plan + approval before building, per CLAUDE.md rule #7.
- Today's post (Snooker group) needs the same reply-check treatment next session, per §0a.

## Lesson for future agents
When the day's tour content is thin, **don't force a "massive push"** — the skill's cadence
rule (§0a) exists precisely for this case. One well-verified post beats spreading the same
sparse Round-1-qualifier data across many channels. Also: always check `matches/today/`
directly rather than assuming yesterday's headline (English Open) is still the day's news.
