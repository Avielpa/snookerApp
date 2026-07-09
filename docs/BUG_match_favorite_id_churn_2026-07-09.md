# Bug: match favorites/notifications break when snooker.org changes a match's `api_match_id`

**Reported**: 2026-07-09, live-tested by user during Championship League play.
**Status**: Root cause hypothesis identified, NOT yet verified end-to-end, NOT fixed. No code changed for this bug.
**For**: `bug-fix-expert` agent (`.claude/agents/bug-fix-expert.md`) — follow its 20-rule workflow (plan first, full connection map, user approval before any Edit/Write).

## User's real-world test (the actual repro)

1. User favorited a Championship League match scheduled to start at **20:00 Israel time**, specifically to test whether match-start push notifications work.
2. Checked back ~30 minutes after the scheduled start. **No notification was received.**
3. In the app, the match had correctly moved from the "Upcoming" tab to the "Live" tab — so live-score tracking itself worked (see below on why: two unrelated fixes shipped earlier today made this correct again).
4. But the match's **favorite star/mark was gone** — not shown as favorited, even though the user is confident they favorited it correctly beforehand.
5. User immediately favorited a second match (scheduled ~21:30 Israel time) to re-test, but a session reset happened before that second result was observed. **Whoever picks this up should check whether that second test also failed, and treat it as an additional data point — it might not repeat if that particular match's ID happened to stay stable, so don't over-index on either single outcome.**

## User's own hypothesis (stated before any code was shown to them)

snooker.org sometimes reassigns a match's `api_match_id` when its status changes. The user had independently observed this exact phenomenon earlier in the same session: **the same logical match** (same players, same round, same match number, within the same event) showed under **three different `api_match_id` values across a few hours**:

```
10220801 → 10232815 → 10232821
```
(all three referring to the same Championship League match — confirmed via repeated `GET /events/2833/matches/` calls made directly against production during this session, spaced ~10-40 minutes apart, while diagnosing a separate live-score bug)

User's theory: the favorite gets stored under the OLD `api_match_id`. By the time the match goes live, snooker.org (and therefore our DB) has moved it to a NEW `api_match_id`. The notification-sending code and the "is this match favorited" UI check both look up by the CURRENT id, which no longer matches what was stored — so the favorite silently "disappears" and no notification fires, even though nothing about the user's action was wrong.

## Prior-session investigation (leads only — NOT verified, NOT a conclusion)

A previous Claude instance in this same conversation did a first-pass code read (grep + read, no DB queries, no full connection map, no user approval sought) and found:

1. **`maxBreak/oneFourSeven/push_notifications.py:20-36`**, function `get_tokens_for_match(match_id)`:
   ```python
   def get_tokens_for_match(match_id):
       from oneFourSeven.models import DeviceToken
       uuid_tokens = set(
           DeviceToken.objects.filter(favorite_match_ids__contains=[match_id])
           .exclude(push_token='').values_list('push_token', flat=True)
       )
       user_tokens = set(
           DeviceToken.objects.filter(
               user__favorites__favorite_match_ids__contains=[match_id]
           ).exclude(push_token='').values_list('push_token', flat=True)
       )
       return list(uuid_tokens | user_tokens)
   ```
   Looks up devices whose `favorite_match_ids` array contains exactly `match_id` — no fallback, no fuzzy match.

2. **`maxBreak/oneFourSeven/management/commands/auto_live_monitor.py`**, inside `_send_match_notifications`, the "match just went live" block:
   ```python
   live_matches = MatchesOfAnEvent.objects.filter(Status=1, StartDate__gte=recently_started)
   for match in live_matches:
       mid = match.api_match_id   # <-- current/live value from the DB row
       ...
       match_tokens = get_tokens_for_match(mid)
   ```
   Uses the match's **current** `api_match_id` at notification time — if this has changed since the user favorited it, the lookup misses.

3. **Contrast**: the SAME file, a bit further down, has a "match resumed from break" notification block that explicitly does NOT use `api_match_id` for tracking — it tracks by `MatchesOfAnEvent.pk` (the stable Django row ID) instead, specifically because `api_match_id` can change. There's an existing code comment there explaining why:
   > "Track by DB pk (never changes) so api_match_id changes from snooker.org don't break resume detection"

   This is the same failure class, already solved once in this codebase for a different feature, but not applied to match favorites/notifications.

## What is NOT yet confirmed (this is the actual investigation work needed)

- **Frontend**: which ID does `services/favoritesService.ts` (or wherever match-favoriting lives) actually send/store when a user favorites a match? Is it `api_match_id`? Where does the "is this match favorited" star-display check read from — same ID?
- **Backend models**: exact shape of `DeviceToken.favorite_match_ids` and `UserFavorite` — are they *only* ever populated with `api_match_id`, or is there already some stable-ID handling that just isn't being used correctly?
- **Root cause of the churn itself**: WHY does `api_match_id` change for the same logical match? This needs tracing into `data_savers.py`'s `save_matches_of_an_event` / `DatabaseSaver` — specifically: when snooker.org sends match data for an event, how does the save logic decide "this incoming match IS an existing DB row" vs "this is a new match"? Is it matching by `(Event, Round, Number)` (the model's own stated "logical key" per its docstring) and just overwriting `api_match_id` on match when that changes upstream? Or is it inserting a whole new row and orphaning the old one? This distinguishes between "an easy id-remap fix" and "a data-integrity/orphaned-row problem."
- **Frequency/scope**: does this only happen for Championship League specifically (which has an unusual ~40-parallel-sub-event structure already implicated in two other bugs fixed today), or for all tours? Does it only happen while a match is "Scheduled" (pre-live), or can it also happen mid-match?
- **Real production evidence**: pull actual `DeviceToken.favorite_match_ids` rows and compare against current `MatchesOfAnEvent.api_match_id` for matches the user favorited today, rather than reasoning from code alone.

## Relevant session context (unrelated bugs, but useful background)

Earlier today, in the same session, two other Championship-League-specific bugs were found and fixed (both deployed to production):

1. `auto_live_monitor.py` ran a ~60-minute blocking startup sync before ever checking for live matches — fixed by running one live-check immediately on boot.
2. `update_live_matches.py` picked live-match-check candidates via `.order_by('StartDate')[:max_events]`, but Championship League's ~40 parallel sub-events all share one identical event-level `StartDate`/`EndDate`, so the same fixed first-N events got checked every cycle forever, starving the rest — fixed by prioritizing events with actually-overdue matches.

Those fixes are why live-score tracking (the match correctly appearing under "Live") now works again. This favorites/notification bug is a **separate, still-open** issue uncovered by the user's own live test immediately after those fixes went out.

## Workflow reminder for whoever picks this up

Per `.claude/agents/bug-fix-expert.md`:
- Invoke `superpowers:systematic-debugging` first.
- Build the full connection map (every caller/consumer, frontend + backend + device/account/backend sync layers) with real evidence (console/DB queries), not assumption.
- State the root cause as a causal chain, not "probably because."
- Get explicit user approval on a written plan before any Edit/Write.
- Enumerate edge cases exhaustively (old favorites created before any fix, logged-in vs logged-out, ID changes while match is live vs pre-live, etc.) and ask the user for domain edge cases you can't infer from code.
- Never deploy/push as part of the fix — ends at "ready to test," preview before production.
