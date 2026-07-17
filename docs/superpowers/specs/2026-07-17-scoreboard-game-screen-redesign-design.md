# Scoreboard Game Screen Redesign — Design Spec

Date: 2026-07-17
Screen: `FrontMaxBreak/app/scoreboard/game.tsx` (+ `app/components/scoreboard/BallPad.tsx`, `PlayerCard.tsx`, `BreakChain.tsx`)
Status: approved via visual-companion mockups (v1 → v2 → v3, portrait + landscape)

## Background

Two things drove this:
1. A functional bug: the portrait screen was a fixed, non-scrollable flex column. Dynamic content (ad banner, snooker-needed banner) could push the ball-color row toward/off the bottom of the viewport, making it untappable. Fixed short-term by making the whole screen (header through ball pad) one `ScrollView` — shipped to preview only, not production.
2. A visual complaint: the screen "looks very bad", and landscape mode is unusable on average phone screens (cramped, elements don't fit).

This spec redesigns the visual language of the whole screen while keeping **every existing feature** — nothing is removed or hidden behind tabs. It also defines a real landscape layout to replace the currently-broken one.

## Scope

**In scope:** visual redesign of `game.tsx`'s portrait and landscape layouts, `PlayerCard`, `BallPad`, `BreakChain` visual treatment, `scoreboardTheme.ts` token additions.
**Out of scope (unchanged):** `FoulModal`, `FrameSummary`, `RespotBreakerModal`, `CenturyCelebration`, `rules.tsx`, `history.tsx`, `rivalry.tsx`, `index.tsx` (setup screen) — none of these were part of the complaint and are not touched by this spec. Game logic (`useSnookerGame.ts`) is untouched — this is visual/layout only.

## Design tokens

Extends `scoreboardTheme.ts`'s existing baize/brass identity — this was a deliberate prior restyle (see `docs/SCOREBOARD_RESTYLE_AND_INSIGHTS_PLAN.md`), not something to replace. Adjustments below are refinements within that identity, not a new palette.

| Token | Current | New | Why |
|---|---|---|---|
| `background` | `#0a2e21` flat | radial vignette `#0e3a29 → #0a3225 → #072317` | Depth instead of a flat fill |
| `textSecondary` | `#b9b0a0` (warm brown-gray) | `#8b978d` (cool sage) | Better contrast against green, reads less muddy |
| `textMuted` | `#877e70` | `#647069` | Same reasoning, one step darker |
| gold/`primary` usage | borders on nearly every panel | **restricted** to: active player highlight, badges, the snooker-needed ribbon, and the one primary CTA (Concede/End Frame) | Gold reads premium only as a controlled highlight, not decoration everywhere (color-research finding) |
| panel borders | solid `#2b5940` | translucent white ~8-9% opacity | Softer "glass" edge vs. a flat outline |
| score digits | Poppins (same as all UI text) | **Fraunces** (serif display face), restricted to score numbers and points-remaining only | One deliberate type-pairing moment, not applied everywhere |

New color additions go in `scoreboardTheme.ts` as new named fields (e.g. `textSage`, `borderGlass`) — existing fields are not renamed, so nothing else in the scoreboard screens breaks from this change (`PlayerCard`, `BallPad`, `rules.tsx` etc. keep using the current field names where unchanged).

**Font:** Fraunces is not currently loaded in the app (only Poppins variants are, via whatever mechanism the app already uses — needs a quick investigation at plan time, not a design blocker). Implementation plan must confirm how Poppins is loaded and replicate it for Fraunces, or fall back to a system serif if font loading turns out to be nontrivial for a single numeral treatment.

## Signature element

The score panel (points-remaining + both player cards, currently three separate blocks) becomes **one unified panel** styled like a physical brass-pinned nameplate: squared corners (breaking from the rounded language used everywhere else on the screen) with four small brass corner pins in the corners. This is the one deliberate, ownable visual detail for the screen — everything else stays quiet and disciplined around it.

## Layout — Portrait

Single continuous scroll (already shipped to preview as a plain fix; this redesign keeps that scroll behavior, restyled):

1. Header bar (back / frame+score / rules icon) — unchanged position, restyled text colors
2. Insight ticker — kept, restyled as a subtle chip (was a full-width banner)
3. Race tracker — kept, restyled as small pip dots instead of the current widget
4. **Unified score panel** (signature element) — replaces the current 3 separate blocks (points-remaining card + 2 player cards): both player scores + points-remaining in one bordered panel, active player gets a soft gold radial highlight + break badge
5. Break chain — kept, restyled as a row of small colored ball dots (was ball-value chips)
6. Win-probability + momentum — kept, merged into one compact "form" row (thin bar + small sparkline) instead of two separate blocks
7. Snooker-needed banner — kept, restyled as a left-accented ribbon (only renders when applicable, same condition as today)
8. Ad banner (`BannerAdSlot`) — kept, given its own quiet framed slot directly above the ball pad (was floating between stat blocks)
9. Ball pad (status text, ball buttons, action row) — kept, ball buttons get a radial gloss highlight per ball to read as a real sphere instead of a flat circle; action row buttons restyled (Concede uses the one primary-gold CTA treatment)

All 9 pieces are the same pieces that exist today — same data, same conditions for when each renders. Only the visual treatment and grouping (3 blocks → 1 panel, 2 blocks → 1 form row) changes.

## Layout — Landscape

Replaces the current broken two-column split (which doesn't fit average phone screens) with a deliberately re-sized two-column layout:

- **Left column**: header, insight ticker, race tracker, unified score panel, break chain, form row, snooker ribbon — same order as portrait, sized down for the shorter landscape height
- **Right column**: ball pad (status, ball buttons, action row) — fixed/always visible, never affected by how tall the left column's content gets
- **Ad banner**: kept in landscape (per your "keep them" decision) — lives in the left column
- **Scroll behavior**: left column scrolls independently if its content (ticker + ad + score panel + break chain + form row + ribbon, all at once) exceeds the available landscape height on a given device; the right column (ball pad) is always fully visible and never scrolls, so the controls can never be pushed off-screen — this directly fixes the original "landscape is unusable" complaint

## Responsive floor

Fluid layout (flex/percentages, no fixed pixel heights that assume a tall screen) with a tested floor around a small phone (~360×640 logical px). Scales up cleanly to large phones/tablets. No specific tablet-only layout is in scope — tablets get the same phone layout, just with more breathing room since flex sizing already accommodates it.

## Non-goals / explicitly not doing

- Not redesigning `FoulModal`, `FrameSummary`, `RespotBreakerModal`, or any screen outside `game.tsx`'s render tree
- Not changing game logic, state machine, or data flow — `useSnookerGame.ts` untouched
- Not hiding any current feature behind a tab, modal, or "show more" — everything visible today stays reachable without extra taps (scroll is fine, an extra tap is not)
- Not introducing a new color palette — refining the existing baize/brass one

## Testing expectations

This is a visual/layout change with no new game logic, so it doesn't get new `.mjs` assertion tests (matches the precedent set by the earlier scroll fix in this same file). Verification is manual: `npx expo start`, exercise both portrait and landscape on a small-phone-sized emulator/device, confirm every one of the 9 portrait pieces and both landscape columns render, confirm ball buttons are always reachable in both orientations, confirm existing conditional rendering (insight ticker only when there's an insight, snooker ribbon only when applicable, etc.) still behaves identically to before — this is a restyle, not a logic change, so before/after conditional behavior must match exactly.
