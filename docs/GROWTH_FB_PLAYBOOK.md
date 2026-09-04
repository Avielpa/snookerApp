# Facebook Growth Playbook (established 2026-09-03)

## What actually worked

The British Open "LIVE Now" scores post to the Snooker group (227K members) outperformed
everything else posted the same day: **8 likes, 3 shares, 3 real comments** within a couple
hours, vs. 0-2 likes and zero comments on the other posts.

Comparison:

| Factor | Worked | Didn't work as well |
|---|---|---|
| Content | Real-time **live** scores (in-progress drama) | Static "upcoming schedule" graphic |
| Follow-up | Replied to a fan's question with specific, accurate info (Selby's actual results, next match time) | No reply, or nothing to reply to |
| Group | Fast-approving 227K group | Groups that declined the post outright (EURO SNOOKER, Snooker TV as standalone) |

**Conclusion: live content + genuinely answering people (not just posting and leaving) is what
converts a passive scroll-past into likes/shares/comments.** The graphic earns the glance; the
reply earns the trust.

## The cadence (decided 2026-09-03)

- **Once per tournament day**, timed to when several matches are actually live (not a fixed
  clock time — check what's live first).
- Build the graphic from real API data (`events/{id}/matches/`, filter `status_code == 1` for
  live, `status_code == 0` for upcoming) — never hand-type scores.
- Always use a UTM-tagged QR/link — see `docs/GROWTH_UTM_TRACKING.md`.
- Post to the Snooker (227K) group primarily — it approves fast and is the proven performer.
  Other groups are secondary/opportunistic (see below).

## Comment monitoring

No real-time notification exists for new Facebook comments — check back when the user prompts,
or when the user flags something specific (as with the Selby comment). Don't poll proactively.

## For other groups (declined-post workaround)

Standalone posts get declined in some groups (EURO SNOOKER, Snooker TV). **Commenting on an
existing relevant post in those same groups works** — e.g. commenting with the graphic + link
under another page's British Open results post, or in an official live-broadcast video's comment
section (Cue Nation live stream, 2026-09-03) — both landed without issue. Prefer this over
retrying a declined standalone-post group.

## Next check

Once a few days of tagged-link traffic accumulates, check Firebase Analytics Dashboard →
Acquisition channel table — `facebook` / `comment` or `group_post` should start appearing as
real rows instead of collapsing into Organic/Direct. That's the actual measure of whether this
is converting to installs, not just likes.
