# Session 2026-09-15 — AI video investigation + image-based promo push

## Context

Follow-up to the previous day's video-concept brainstorm (4 short video ideas for promoting
the app, tied to real scoreboard features). User asked to try producing one via a free AI
video tool and get it ready to post, then more broadly to "create videos, create images
whatever you want just promote it."

## What was tried — video generation

Attempted Gemini's Veo-based "Create videos" flow (`gemini.google.com/videos`, free on this
account's existing Pro plan — no new signup needed) for video concept #4 (a player beating
their own break record, celebrating, challenging a friend — rewritten earlier in the
brainstorm to match the real, already-shipped Personal Best + Challenge-a-Friend features).

**5 consecutive attempts, all failed the same way**: prompt submitted successfully, generation
spinner ran for 2–8 minutes, no error ever surfaced, and nothing was ever saved to the
account's Video Library. Systematically ruled out the obvious causes:
- Tried both a detailed cinematic prompt and a short one-sentence prompt — no difference.
- Tried both Landscape and Portrait aspect ratios — no difference.
- Tried reusing the same browser tab/chat across retries, then explicitly **closed the tab,
  opened a completely fresh one, and started a genuinely new chat** — same failure pattern
  even from a clean state, ruling out stale session/cache/websocket issues.
- Checked the Library directly after every attempt (not just trusting the composer UI) —
  confirmed empty every time.

**Conclusion**: this is a Google-side Veo capacity/backend issue today, not anything fixable
from this session. Documented in the social-growth skill (§2, new "Approach E") so future
sessions test with one quick generation before committing time to a video-first plan, rather
than rediscovering this from scratch.

**Pika (pika.art)** was considered as a fallback free video tool but requires creating a new
account there. Declined — account creation is a hard line regardless of how broadly authorized
("do whatever you want") the request is; that's a decision for the user to make explicitly if
video generation is a hard requirement, not something to route around unilaterally.

## What was delivered — image generation + real post

Pivoted to Gemini's **image** generator (same account, no video-specific issue — generated a
usable image in ~10 seconds on the first try). Produced a real, high-quality illustration:
two men celebrating a snooker shot at a home table (fist pump, genuine excitement), matching
the emotional beat of the original video concept without needing video at all.

Per the skill's existing ground rule (AI images are for the brand-awareness lane only, never
for live-data claims), the caption doesn't cite any live match data — it describes the real,
shipped Personal Best tracking + Challenge-a-Friend features (both in production since
2026-09-14), so there's no fabrication risk despite the image itself being illustrative.

**Posted to 2 destinations** (per the skill's own session-cadence cap):
- **Snooker (227.8K)** — went live instantly.
- **Legend Ronnie O'Sullivan Snooker (60.2K)** — went to admin approval queue (normal for
  this group, not an error).

Both posts include the tagged Play Store link (`utm_campaign=pb_feature_brand_0915`) and the
iOS App Store link, from the start (no edit-after-publish needed this time).

## Files

- `~/Downloads/Gemini_Generated_Image_k558k0k558k0k558.jpg` (original, 2816×1536, 3.1MB) — the
  posted image.

## Verified, not deployed

Pure content/growth session — no app code touched, no build, no backend change.

## Next session

- Check `docs/GROWTH_ANALYTICS_LOG.md` in a few days for the `pb_feature_brand_0915` UTM
  campaign as a distinguishable row, alongside the still-open attribution-gap investigation.
- If video content is wanted again, **test Veo with one quick generation first** before
  committing significant time — check whether Google's backend issue from today has cleared,
  rather than assuming it's still broken or retrying blind.
- If video remains broken and the user wants to explore Pika or another free tool that
  requires a new account, that's a decision to raise with the user directly, not decide alone.
