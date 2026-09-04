# Growth analytics log (running, append-only)

Purpose: a single place where each growth session's actual numbers get recorded, so
"what happened over time" is data future sessions can read back, not just prose scattered
across session docs. **Append a new dated entry at the end of every growth session** — don't
edit past entries (except to fix a factual error), and don't let this substitute for the
one-off baseline/handoff docs, which stay as narrative snapshots.

Pull the numbers from: Firebase Console → Analytics Dashboard (Acquisition report / GA4
Traffic acquisition — look for `facebook`/`comment`/`group_post`/`page` rows, not just
Organic Search/Direct totals), AdMob console (impressions/revenue trend), and Play Console
(install count if visible). See `docs/GROWTH_UTM_TRACKING.md` for how attribution is tagged
and `.claude/skills/social-growth/SKILL.md` §4 for the checking procedure.

## How to add an entry

```
## <date>
- Firebase 7-day actives: <value> (<+/-% vs last entry>)
- Acquisition — tagged rows visible: <e.g. facebook/group_post: N installs, or "none yet, too early">
- AdMob: <impressions/revenue trend if checked>
- Play Console installs (if visible): <value>
- Context: <what was posted that period, e.g. "3 live-score posts + 2 Page posts">
```

---

## 2026-09-03 (baseline, pre-UTM-fix)

Full detail: `docs/ANALYTICS_BASELINE_2026-09-03.md`. Taken immediately before the UTM
tracking fix shipped — acquisition still showed only Organic Search / Direct, no channel
attribution possible yet. This is the "before" point for every comparison going forward.

## 2026-09-04

- Context: MaxBreak147 Page launched (9 posts), 2 live-score group posts, 1 bracket
  graphic across 3 destinations, new group "World Snooker Live Stream" tested (pending
  approval at session end).
- Firebase/AdMob figures: not re-checked this session (too soon after the 09-03 baseline
  and the UTM fix for tagged traffic to accumulate) — next session should do the first
  real post-fix check here.
- Acquisition — tagged rows visible: not yet checked.
