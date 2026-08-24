# Session: Tour Round-Labeling & Bracket-Chain Fix — 2026-08-17

## Symptom

User-reported, seen via Calendar → Tour → Results/Draw (the tour was no
longer live so it wasn't reachable from Home anymore, which is how the
user first noticed it):

- **Results tab**: the "Final" header appeared **twice**, with the first
  one containing the wrong matches.
- **Draw tab**: the bracket looked "very messy" — wrong matches showing
  under the wrong stage.

The user initially suspected a recent UI redesign had broken something
that used to work ("it was ok before those changes").

## Investigation — two rounds

### Round 1: data-gap theory (partially right, but not the reported bug)

A background investigation (bug-fix-expert style, read-only) found that
`RoundDetails` (the backend's authoritative round-name table) was **empty**
for China Open in the production DB, and traced why: `auto_live_monitor.py`'s
daily `update_round_details` job selects events via
`Event.objects.filter(Season=season).order_by('-StartDate')[:limit=10]`.
Since a snooker "Season" spans two calendar years, `-StartDate` ordering
surfaces events furthest in the *future* first (World Championship 2027,
etc.), so an event near "today" like China Open (index 36 of 86 rows) never
gets reached. This is real and is logged as **Open Mission #8** — but the
user redirected: *"leave it now, this is not the root cause, this bug
appears only after new UI design."*

### Round 2: git archaeology for a "recent UI regression" (found none)

Checked every commit touching `app/tour/[eventId].tsx`,
`app/tour/components/DrawTab.tsx`, `app/home/utils/roundNaming.ts`, and
`config/deviceTabConfig.ts` since these features were first built in March
2026. The two candidate "recent redesign" commits (`e29b4873` UI/UX
overhaul, `b67f50a0` Calendar redesign) only touched typography/SafeAreaView
edges and connector-line color/thickness — **zero logic changes**. The
actual buggy logic (`if (round >= 15) return "Final"` and the round-number-
scanning bracket-chain builder) was written in March 2026 and never changed
since. Reported this to the user with the evidence rather than forcing a
"recent regression" narrative that the data didn't support — user accepted
this and asked to fix the underlying (older) bug directly, "start with
clean display."

### Live reproduction, not just code tracing

Before writing the fix plan, launched the actual Android emulator
(`Pixel_4a_API_36_2`), installed/ran the real preview APK, and navigated
to China Open's Results and Draw tabs via `adb`/`uiautomator dump` (screen
capture itself was broken in this sandboxed emulator — blank PNGs despite
real content, a GPU/compositing quirk, not an app bug — so all evidence is
from the accessibility-tree text dump, which is sufficient ground truth).
Confirmed exactly the reported symptom for real:
- Two consecutive `"Final"` headers in Results — the first one was the
  Wild Card Round (Wu 0–6 McGill, Liu 0–6 Vafaei, both dated 8 Aug, the
  *first* day of the tournament), the second was the real Final (Selby
  10–6 Saengkham, 16 Aug).
- Draw tab's bracket ended at a `"Semi-Finals"` column mixing the real SF
  (Robertson 1–6 Selby) with the Wild Card Round's Liu/Vafaei match — the
  real Final never appeared in the bracket at all.

## Root cause

`RoundDetails` being empty forces both frontend surfaces onto their
fallback guesses, and those guesses assume **API round number ≈ bracket
depth** — which breaks the instant a tournament has an extra round
numbered *outside* the normal knockout sequence. China Open's Wild Card
Round is round **16**, numerically above the real Final (round **15**),
despite being chronologically and structurally *before* the main draw.

Two independent, disagreeing guesses were live at once:
1. `getRoundName()` (in `[eventId].tsx`, and a near-duplicate in
   `home/utils/roundNaming.ts`): `if (round >= 15) return "Final"` — catches
   both round 16 and round 15.
2. `computeBracketRounds()` (in `DrawTab.tsx`): scanned rounds **by round
   number descending**, anchoring the bracket-chain walk on the first round
   with ≤32 matches — grabbed round 16 (2 matches) before ever considering
   round 15 (1 match), so the real SF/Final got walked right past.

## The fix

New shared file `FrontMaxBreak/app/tour/utils/bracketChain.ts`:

- `computeKnockoutChain(matches)` — infers the real bracket depth from
  match **count** (each real knockout round has exactly double the
  matches of the round after it) plus **chronology** (a real knockout
  round is adjacent in time to its neighbours), never from raw round
  number. Anchors on the round with the fewest matches (ties broken by
  latest date), walks backward requiring exact doubling, preferring the
  chronologically-closest-preceding candidate on a count tie (this is
  exactly what disambiguates China Open's real Semi-Final, 2 matches,
  from the Wild Card Round, also 2 matches). A round that never joins the
  chain (extra/qualifying/wildcard rounds) is simply absent from the
  result — callers must not force a label onto it.
- `computeKnockoutChainsByEvent(matches)` — same, but groups by
  `event_id` first, for match lists that can span more than one
  concurrent tournament (Home's combined feed).
- `inferRoundNameFromCount(count)` — moved here from `DrawTab.tsx`
  (single source of truth now).

Wired into all three places that previously disagreed:
- `DrawTab.tsx`'s `computeBracketRounds()` — now only ever renders the
  confirmed knockout chain (Wild Card Round matches are cleanly omitted
  from the bracket, per the user's "clean display first" direction).
- `[eventId].tsx`'s `processMatchesForList()` — a round in the chain gets
  the backend name (if present) or the count-inferred name; a round
  *outside* the chain gets an honest `Round N` label, never a guessed
  stage name. Also fixed the Results sort comparator: two chain rounds
  still sort by round number (safe — real knockout round numbers are
  correctly depth-ordered), but if either round is outside the chain,
  sort by chronology instead, so an extra round like Wild Card lands near
  its true position instead of floating above the Final purely because
  its number is numerically higher.
- `home/utils/matchProcessing.ts` (Home's own Results list) — same fix,
  using the by-event variant since Home's feed can span multiple
  concurrent tournaments. `home/utils/roundNaming.ts` was simplified to
  just the null-round and generic-`Round N` cases (the `round >= 15`
  heuristic is gone).
- Removed now-fully-dead `inferRoundName()` from `DrawTab.tsx`.

## A real bug caught mid-test-writing

While writing `bracket_chain_test.mjs`, found that the anchor-selection
logic had no upper bound on match count — a single round with 40 matches
and no valid neighbor would have been wrongly treated as a 1-round
"chain" instead of correctly yielding nothing. Added back the `≤32`
anchor guard the old round-number-scanning algorithm had (it only ever
gated the *starting point*, not later chain members) before shipping.
This is exactly the kind of gap the "write tests before shipping" step of
the engineering-workflow skill exists to catch — flagging it because
future agents should trust that gate, not treat it as ceremony.

## Files touched

- `FrontMaxBreak/app/tour/utils/bracketChain.ts` (new)
- `FrontMaxBreak/app/tour/components/DrawTab.tsx`
- `FrontMaxBreak/app/tour/[eventId].tsx`
- `FrontMaxBreak/app/home/utils/matchProcessing.ts`
- `FrontMaxBreak/app/home/utils/roundNaming.ts`
- `FrontMaxBreak/bracket_chain_test.mjs` (new, 37 assertions)
- `FrontMaxBreak/home_drawtab_test.mjs` (updated: removed dead
  `inferRoundName` mirror/assertions, updated the mirrored
  `computeBracketRounds` to delegate to the new chain logic, updated one
  assertion's expected behavior — see below)

## Intentional behavior changes (not regressions — verified deliberate)

- A match with **no `round` field at all** used to be bucketed into a
  fake "round 0" and still shown in the bracket. It's now excluded from
  the bracket entirely, since the chain builder can't place a round it
  doesn't understand. Old test (`home_drawtab_test.mjs`) updated to match.
- Results-tab sort order for rounds *outside* the knockout chain now
  follows chronology instead of raw round number (see above) — a
  deliberate improvement bundled into this fix, not just a labeling
  change.

## What was verified (and how)

- **Unit tests**: 37 new assertions in `bracket_chain_test.mjs` covering:
  the exact China Open shape (proven against the real production data
  gathered during investigation), a standard tournament with no extra
  rounds (regression check), a live/ongoing tournament with unplayed
  Final/SF placeholders, no round having exactly 1 match yet (very early
  tournament), a bye (broken doubling count), missing/null dates on some
  matches, a round-robin/group-stage shape (no valid chain), the 7-round
  depth cap, two 1-match rounds tied for anchor (date tiebreak), and
  `computeKnockoutChainsByEvent`'s cross-event collision safety (proven
  with deliberately different-shaped concurrent events, not just
  same-shaped ones).
- **Full existing suite**: all 8 test files, **1160/1160 assertions
  pass**, zero regressions (`game_test.mjs` 328, `train_test.mjs` 51,
  `mega_test.mjs` 470, `freeball_test.mjs` 121 — grew since CLAUDE.md's
  documented 100, unrelated to this session — `stats_test.mjs` 48,
  `offseason_tab_test.mjs` 42, `home_drawtab_test.mjs` 63,
  `bracket_chain_test.mjs` 37).
- **Typecheck**: `npx tsc --noEmit` clean.
- **Live device verification** (Android emulator, `adb`/`uiautomator
  dump`, both BEFORE the fix shipped and AFTER, on the real preview APK
  after the OTA landed):
  - **China Open** (the exact reported bug): confirmed fixed — single
    correct "Final" header (Selby 10–6 Saengkham), Wild Card Round now
    shown honestly as a `"Round 16"` header at the bottom of Results
    (sorted there by chronology, as designed) instead of a duplicate
    "Final". Draw tab: QF(4)→SF(2)→Final(1) all correct, Wild Card Round
    fully excluded from the bracket.
  - **Shanghai Masters** (standard 24-player invitational, no extra
    rounds): zero regression — Final/SF correct in both tabs.
  - **English Open Qualifiers** (single 32-match qualifying round, no
    deeper rounds yet): renders as its own bracket stage cleanly, no
    crash.
  - No FATAL/crash/error log lines across the whole session's logcat.

## Deployed

- `eas update --channel preview` — published, verified live on device
  (confirmed the OTA fetch→auto-reload cycle itself worked end-to-end,
  `restartCount=1` in `dev.expo.updates` logs).
- `eas update --channel production` — published after device verification
  passed, per explicit user approval ("it ok on preview after your
  verification you can push to prod"). Both channels share
  `runtimeVersion 2.0.0`.
- `git push origin master` — commit `a49407b2` (the fix) plus a merge
  commit `8b64bf5b` (two unrelated remote commits: iOS ATT compliance,
  preview build autoIncrement — disjoint files, no real conflict) and a
  trivial `8a07dd21` resolving a `.claude/settings.local.json` permission-
  allowlist merge conflict (both sides purely additive).

## What was NOT done (deliberately deferred)

- **Open Mission #8**: the backend `RoundDetails`-empty data gap itself
  (why China Open and several other current-season events never got their
  authoritative round names fetched) — user explicitly said to leave this
  alone this session. Root cause already identified (see mission entry),
  not yet fixed.
- **Open Mission #9**: no display treatment for extra rounds (Wild Card
  Round etc.) in the Draw tab — currently cleanly omitted rather than
  shown with any special styling, per the user's "clean display first"
  instruction. A real product/design decision for a future session, not
  a bug.

## Lessons for the next agent touching this area

- **Round number is not bracket depth.** Any future round-labeling or
  bracket code must derive depth from match count + chronology, never
  from the raw API round number — snooker.org assigns extra rounds
  (Wild Card, some qualifying stages) numbers outside the normal
  sequence.
- **`bracketChain.ts` is now the single source of truth** for this
  inference — don't reintroduce a fourth parallel guess in a new
  component; import from here.
- **Screenshots are unreliable in this sandboxed Android emulator**
  (`adb shell screencap` returns blank PNGs even when the app is
  genuinely rendering content) — use `uiautomator dump` (accessibility
  tree text) for verification instead; it's real evidence, just not
  pixels.
- A user's belief that "it was ok before" is worth checking against real
  git history before agreeing with it — in this case the bug was ~5
  months old and dormant, not a recent regression, and saying so plainly
  (backed by the actual commit diffs) was the right call rather than
  chasing a UI-redesign theory the evidence didn't support.
