# Home Screen Redesign — Mockup Iteration Notes

Design exploration session, 2026-07-09. **Nothing in this doc is implemented in real code yet** — this was mockup-only work in a Claude Artifact (HTML/CSS simulation), per explicit instruction to keep it style-discussion-only until a direction is agreed. Read `HOME_SCREEN_ARCHITECTURE.md` first for what the real screen actually does — this doc is the design decisions layered on top of that, not a replacement for it.

**Artifact URL** (updated in place across all rounds, same URL): `https://claude.ai/code/artifact/cda86863-34e1-42a4-89c9-30ff71f24c03` — last published state is v6.

## Why this doc exists

The first mockup attempt was built without fully reading the real screen's architecture first and got corrected hard (missing tabs, wrong color semantics, invented a bar that didn't need to exist). `HOME_SCREEN_ARCHITECTURE.md` was written specifically to prevent that class of mistake going forward — read it before designing, not after being corrected.

## Agreed design direction (stable since round 2)

- **Keep the existing color system**, don't invent a new one: green (`#22C55E`-ish) = live, amber (`#F59E0B`/`#FFB74D`-ish) = on-break/winner/brand accent. The app already has this partially established in code (`MatchItem`, `OtherLiveSection`, `ModernGlassCard`'s green-tinted gradient, `#0D1A0F` background) — a style pass should deepen/refine these tones, not replace them with something unrelated (an earlier draft used red=live, which was wrong and got corrected).
- **Draw tab keeps its real dark/amber colors** (`#252525` cards, `#FFA726` accent) — explicitly do NOT apply the green baize palette there. It's a structurally different UI (2D bracket, not a list) and already fairly dense; only spacing/pill polish is in scope, not a repaint.
- **Other Tours tab** already had a compact single-line `MatchRow` — didn't need density work, only re-theming to match whatever the final palette is.

## Iteration history — what each round of feedback fixed

| Round | Feedback | Fix |
|---|---|---|
| v1 | Didn't reflect real screen at all (missing tabs) | Wrote `HOME_SCREEN_ARCHITECTURE.md` before continuing |
| v2 | Corrected against the doc | All 5 real tabs, real order, existing green/amber colors |
| v3 | Didn't like the other-tours chip bar; asked for long-list handling ideas | Proposed dropdown-on-tour-name instead of a permanent bar; proposed collapsed-older-rounds for long results |
| v4 | Cards "way way way too big" for 15+ matches; bar still there; asked to confirm search exists | Compact 2-line row per match (~4× smaller); confirmed search already exists in real app (`index.tsx` §1.4) |
| v5 | Bar somehow still perceived as present; "upcoming missing" (no Upcoming-tab mockup shown); wanted to see Draw tab handled; asked for true familiarity with all 5 tabs | Read `DrawTab.tsx` in full, documented its real bracket-chain-inference logic in the architecture doc; showed all 5 tabs across 4 phone mockups; true single-line rows (~6×) |
| v6 | Draw looked bad (was accidentally given the green palette — should look like current app, only polished); bar still perceived; Upcoming tab literally missing from the previous round's mockup; live card showed time only, no date | Draw reverted to real dark/amber colors; added the missing Upcoming tab mockup; fixed live card to show full `Jul 9, 18:31` format matching real `formatDate()`; re-verified and explicitly called out that zero secondary bar exists in the mockup (search bar is the only thing below tabs) |

## Open questions — not yet resolved, need a decision before implementing

1. **Search field scope**: current real search only filters players *within the currently-loaded tournament*. User asked "maybe we can add search field" — unclear if this means (a) they hadn't noticed the existing one and it's already covered, or (b) they want cross-tournament search (a genuine new data-fetching feature, logic-level, needs separate scoping). **Not answered yet.**
2. **Tour-switcher interaction**: mockup proposes replacing the other-tours chip bar with a tap-to-open dropdown/popover on the tour name. Never explicitly confirmed as the final direction — it solved "get rid of the bar" but wasn't separately validated as the right *replacement* UX.
3. **Collapsed-older-rounds behavior**: mockup shows older rounds collapsing to a single tappable row with a match count. Not yet confirmed as wanted vs. just illustrative of "how would long lists work."
4. **"Best of X" badge**: added using `roundFormats[round]` (already-fetched, currently-unused data) — well-received in round 3 discussion but not explicitly re-confirmed since.

## Deliberately rejected / avoided ideas

- **Live "current break" number** on the match card — checked real match payloads from production during this session; `frame_scores` is usually empty in practice, so a stat that's blank most of the time would be worse than not showing it. Skip this unless the backend starts reliably populating that field.
- **Red for live** — contradicts the app's existing green=live convention baked into multiple components; corrected after v1.

## Next steps when resuming

1. Confirm the 4 open questions above with the user before writing any real component code.
2. If proceeding: this is a **style-only** pass per explicit instruction — implementation should touch `StyleSheet` objects, hardcoded hex values, spacing, and the `MatchItem`/`StatusHeaderItem`/`RoundHeaderItem` render output density, **not** `matchProcessing.ts`, `useHomeData.tsx`, filter logic, or any data-fetching. See `HOME_SCREEN_ARCHITECTURE.md` §8 ("Style-only vs. logic-touching — a quick test") for the exact boundary.
3. Given the real screen has ~10 style files across `app/home/styles/` and multiple components, plan for a genuine multi-file implementation pass, not a single-file change — the mockup's "compact row" treatment specifically maps to a new/modified style block in `modernMatchStyles.ts` and a restructured `MatchItem.tsx` render (still same props/logic, different JSX layout).
