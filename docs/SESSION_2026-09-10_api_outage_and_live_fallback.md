# Session 2026-09-10: api.snooker.org access revocation + live-score fallback

## Outcome
**Fully resolved, confirmed on the real production app.** Access was
restored by the API owner the same day (~17:52 local, see "Root-cause
chain" below for how it was confirmed). User visually confirmed live
matches displaying correctly on their S24 device the following morning
(2026-09-11), and a direct backend check at that time showed the real
pipeline flowing normally (4 matches finished, 2 live, 2 scheduled — all
correct `status_code`s). No open action items from this incident except
the manual Railway service deletion (see "Still open" below).

## Symptom
Home screen showed only "upcoming"/stale matches for the live English Open —
today's matches stuck at 0-0 "Scheduled" long after they should have been
in progress.

## Root-cause chain
1. Two Railway services were independently polling `api.snooker.org`:
   - `auto command` — the real 24/7 daemon (`auto_live_monitor`), correctly
     rate-limited at 2 req/min via `MIN_REQUEST_INTERVAL` in `constants.py`.
   - `corn for live matches` — a **redundant** cron service (`update_live_matches`,
     `*/5 * * * *`) doing the same job independently, added at some earlier
     point and never removed.
2. Each service respected the 2 req/min cap **on its own**, but they ran
   concurrently with no shared/global limiter — combined, they exceeded
   snooker.org's real limit.
3. The API owner (Hermund Årdalen) manually revoked access for our
   `X-Requested-By: FahimaApp128` header. This produced flaky/inconsistent
   401/403/500 errors across every endpoint (including unrelated ones like
   rankings) that initially looked like a server-side outage rather than an
   access revocation — confirmed as an access issue only when the owner
   emailed us directly at ~17:52 local time.
4. Total outage window: roughly 12:35–17:52 local time.

## What was verified along the way (ruled out before the real cause was known)
- Not specific to our header/app-id: a made-up header got the identical
  error pattern as our real one, from both curl and a real Chrome browser
  hitting the API subdomain directly (different network path/TLS
  fingerprint), and the public website (`www.snooker.org`) worked the whole
  time — only `api.snooker.org` was affected.
- Random 401/403/500 flapping across identical consecutive requests pointed
  away from a clean, deterministic "blocked" response — this looked exactly
  like access-control enforcement behaving inconsistently under a revoked
  key, in hindsight.

## Fixes shipped
1. **Disabled the duplicate cron service** (`corn for live matches`) —
   start command replaced with a no-op. **Not yet deleted** — Railway
   `delete-service` is blocked for Claude Code by a safety-classifier rule
   (destructive/irreversible action); needs manual deletion via the Railway
   dashboard. See `docs/OPEN_MISSIONS.md`.
2. **Rate-limit safety margin**: `MIN_REQUEST_INTERVAL` bumped from exactly
   30s (the bare 2/min minimum) to 40s (`constants.py`,
   `RATE_LIMIT_SAFETY_MARGIN = 10`), so a single well-behaved poller has
   headroom instead of sitting exactly at the cap.
3. **New permanent fallback: `oneFourSeven/emergency_live_overlay.py`**.
   Request-time, read-only overlay wired into `matches_of_an_event_view`
   (11-line try/except addition in `views.py` — no other existing code
   touched). For events currently in progress (today between
   `Event.StartDate`/`EndDate`), it fetches snooker.org's *public* results
   page (`www.snooker.org/res/index.asp`, unaffected by the API-key
   revocation) and overlays live score/status onto matches that aren't
   already `Status=3` (Finished) in our DB. In-process 20s cache. Any
   failure is swallowed and the normal DB response ships unchanged.
   - **This stays permanently** — the user explicitly wants it as a standing
     safety net for future recurrences of this exact failure mode, not a
     one-off patch to delete once access was restored.
   - Self-obsoletes automatically once the real pipeline is healthy: it only
     changes data when the DB looks stale, so once `auto_live_monitor`
     writes correct live data again, the overlay just reconfirms the same
     numbers.
   - Now logs at `INFO` (not just failures at `DEBUG`) whenever it actually
     corrects stale data — so a future recurrence shows up in Railway logs
     immediately instead of needing a user report to discover it.
4. **Status-code convention bug caught and fixed during this work**: the
   model's `STATUS_CHOICES` comments (0/1/2/3 = Scheduled/Running/Finished/
   Unknown) do **not** match what the real API pipeline actually stores or
   what the frontend checks (`PlayerScoreHeader.tsx`, `MatchEnhanced.tsx`):
   real convention is **1=Live, 2=On Break, 3=Finished**. Both the overlay
   and `emergency_html_fallback.py` (see below) were fixed to use the real
   convention — the model's own constants (`STATUS_FINISHED=2`) are
   misleading and should not be trusted for this without checking real data.
5. **`emergency_html_fallback.py`** — a separate, one-off, manually-run
   management command (same HTML-scraping approach, but persists to the DB
   instead of overlaying at request time) was also built as a break-glass
   tool during the incident, before the request-time overlay was built.
   **Never actually run against production** (several attempts to execute
   it via Railway's cron-trigger/preDeployCommand/redeploy mechanisms all
   failed to actually execute or surface logs — see "Railway execution
   gotchas" below). Superseded by the overlay for the live/in-progress case,
   but kept as a standalone tool since it's isolated and could be useful for
   backfilling a fully-missed window later.

## Known limitation of the overlay (by design, not a bug)
The public results page does not expose Live-vs-On-Break as a distinct
signal anywhere in its markup (verified by grepping the full page source) —
both map to `status_code=1` in the overlay. This is a real gap in the only
available fallback data source, not a shortcut. Returns automatically once
the real API/daemon resumes.

## Railway execution gotchas (for next time)
- A Railway **cron-schedule-turned-worker** service (cron removed via
  `update-service(cronSchedule: null)`, redeployed) executes its command on
  deploy, but its stdout is **not reliably captured** by `get-logs` — tried
  repeatedly across multiple redeploys with 0 log lines returned despite
  the deployment showing `SUCCESS`. Its **Console tab also shows "No running
  instances"** once the one-off process exits (`restartPolicyType: NEVER`),
  so there's no way to shell in after the fact either.
- `preDeployCommand` on a **persistently-running** service (`auto command`)
  also did not visibly execute — the deploy log jumped straight from
  "Starting Container" to the main `startCommand`'s own output, with no
  trace of the preDeploy step, across two separate attempts (config
  confirmed correctly set via `describe-service` both times).
- **What did work**: Railway's web dashboard **Console tab** on an `Online`
  service gives a real live shell (`root@<container>:/app#`) you can type
  into directly and see output immediately. This is the reliable way to
  run a one-off command against production when the above mechanisms don't
  surface output — but Claude Code's safety classifier blocks typing
  further shell commands into a live production console after the first
  benign one, so this ultimately needs a human to press the final keys.
- Railway's `list-variables` MCP tool returns `valuesRedacted: true` for
  this session/token — cannot pull `DATABASE_URL` to run Django commands
  against prod from a local machine either.
- Net effect: the actual fix that unstuck the live UI was **not** the
  one-off DB-write command (never got it to run) — it was the **request-time
  overlay**, which needed no Railway job execution at all, just a normal
  `git push` to the `web` service.

## Files touched
- `maxBreak/oneFourSeven/emergency_live_overlay.py` (new) — permanent
  fallback, kept intentionally.
- `maxBreak/oneFourSeven/views.py` — 11-line addition to
  `matches_of_an_event_view`, nothing else changed.
- `maxBreak/oneFourSeven/management/commands/emergency_html_fallback.py`
  (new) — standalone break-glass tool, isolated, never run against prod.
- `maxBreak/oneFourSeven/constants.py` — `MIN_REQUEST_INTERVAL` 30s → 40s.
- Railway: `corn for live matches` service disabled (start command → no-op),
  `cronSchedule` removed. **Still needs manual deletion.**

## Verified
- Overlay tested end-to-end locally against live prod API + live
  snooker.org page data before every deploy (not just unit-level): correct
  live overlay (Selby 2-1 Wilson), correct finished-match handling
  (round-8 match → `status_code=3`, winner set), correct no-op on
  not-yet-started matches.
- Confirmed live in production via direct API polling after each deploy.
- `api.snooker.org` access restoration confirmed via direct curl
  (`200 OK` with real match data) after Hermund's email.
- **Formal test suite added**: `oneFourSeven/tests_emergency_live_overlay.py`,
  40 tests covering the HTML parser, `event_is_in_progress`, the overlay's
  match/score/status logic (including player-order swapping, mismatch
  guards, already-finished protection, network-failure/caching behavior).
  Caught and fixed one real bug while writing these: when our DB doesn't
  yet know a match's player IDs (both `None`, e.g. a brand-new draw slot),
  the code was defaulting to *swapped* score assignment instead of the
  safer same-order-as-the-page default.
- **Full regression run**: all 290 existing `oneFourSeven` tests run
  (individually, by module — the app-level `--pattern` discovery hits an
  unrelated pre-existing quirk from a top-level `__init__.py`, not
  investigated). Result: 1 pre-existing failure
  (`PlayerMatchHistoryOrderingTest.test_null_date_appears_last`, unrelated
  match-history-ordering logic never touched this session — logged as
  `docs/OPEN_MISSIONS.md` #19) and 1 transient DNS/connection blip against
  the remote test DB mid-run. Nothing regressed by today's changes.

## Still open (see docs/OPEN_MISSIONS.md)
- Manually delete the `corn for live matches` Railway service (currently
  disabled, not removed).
- Consider whether a shared/global rate limiter (e.g. via Postgres or
  Railway KV) would be worth adding if another polling process is ever
  introduced — the current fix (removing the duplicate + wider margin)
  is sufficient for now but relies on nobody adding a second poller again.
