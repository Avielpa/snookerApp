# Home Screen Architecture

Reference doc for `app/index.tsx` and everything it renders. Read this before touching Home screen code or design — it exists so we don't have to re-open a dozen files every session to remember how the screen fits together.

**Scope**: the Home screen only (`app/index.tsx` + its `app/home/` subtree + the tabs it hosts: Draw, Other Tours). Not Calendar, Stats, Match detail, or Player profile — those would get their own doc if/when we do focused work there.

---

## 1. Screen shell (`app/index.tsx`)

Render order, top to bottom:

1. **Header** (`headerContainer`) — tournament name (`tourName`) centered, with a small `snooker.org` attribution badge on Android only, and a prize pill below (`tournamentPrize`, diamond icon) if prize data loaded.
2. **Filter tabs** — `DeviceAwareFilterScrollView`, horizontally scrollable. **Exactly 5 visible tabs**, in this order:
   | Label | `ActiveFilterType` value | Icon |
   |---|---|---|
   | Upcoming | `upcoming` | `ICONS.upcoming` |
   | Live | `livePlaying` | `ICONS.livePlaying` |
   | Results | `finished` | `ICONS.finished` |
   | Draw | `draw` | `git-branch-outline` |
   | Other Tours | `otherTours` | `trophy-outline` |

   Note: `ActiveFilterType` also includes `'all'` and `'onBreak'` as valid values, but **neither has a visible tab button** — `'all'` is reachable only if something programmatically sets it (nothing currently does; the default is `'upcoming'`), and `onBreak` matches are nested inside the Upcoming section (see §3), not their own tab. Don't reintroduce an "All" tab pill without checking whether the collapsible-section logic in `filteredListData` (§4) still makes sense for it.

3. **Other Tours chip toolbar** — conditional, only rendered when `activeOtherTours.length > 0`. Horizontal scroll of tour chips (e.g. other concurrently-running events); tapping one calls `handleOtherTourSelection` and reloads the whole screen scoped to that tournament (`selectedOtherTour`). This is **not** the same thing as the "Other Tours" filter tab — this toolbar picks which *tournament* feeds the main list; the "Other Tours" tab switches to a completely different view (§6).
4. **Search input** — plain `TextInput`, "Search Player", filters `displayData` client-side by player name substring (case-insensitive), applied after all other filtering.
5. **Content area** — exactly one of:
   - `LoadingComponent` (while `loading && filteredListData.length === 0`)
   - `ErrorComponent` (on `error`, with Retry button)
   - `DrawTab` (if `activeFilter === 'draw'`)
   - `OtherToursTab` (if `activeFilter === 'otherTours'`)
   - `FlatList` of `displayData` (all other filter values) — see §3/§4

### Visual anatomy — what's actually on screen per tab

Text/data structure alone doesn't show what a user sees. Rough wireframes, current real layout (not a redesign):

**Upcoming / Live / Results tabs** (all share the same `FlatList` renderer, just filtered to a different section):
```
┌──────────────────────────────┐
│      Tournament Name          │  ← header, centered
│      ◆ Winner: £10,000        │  ← prize pill, conditional
├──────────────────────────────┤
│ [Upcoming][Live][Results]      │  ← 5 tabs, horiz scroll
│ [Draw][Other Tours]            │
├──────────────────────────────┤
│ [Tour chip][Tour chip]...      │  ← ONLY if activeOtherTours.length>0
├──────────────────────────────┤
│ 🔍 Search Player               │  ← always present
├──────────────────────────────┤
│ ▎PLAYING NOW              (1) │  ← statusHeader (this tab's section only)
│  ─────── Round 19 ───────      │  ← roundHeader
│ ┌────────────────────────────┐│
│ │ Player A   3 — 1   Player B ││  ← MatchItem: glass card,
│ │ [LIVE]  📅 date        ☆    ││    score-centered row, footer
│ └────────────────────────────┘│
│ ┌────────────────────────────┐│
│ │ Player C   vs      Player D ││  ← next match, same round
│ └────────────────────────────┘│
│  ─────── Round 20 ───────      │  ← new round = new roundHeader
│ ┌────────────────────────────┐│
│ │ ...                         ││
│ └────────────────────────────┘│
├──────────────────────────────┤
│ ▎ALSO LIVE                     │  ← OtherLiveSection, FlatList footer
│  Q TOUR EVENT 7                │    (only on Live/onBreak/all tabs)
│ ┌────────────────────────────┐│
│ │ Player E   2 — 1   Player F ││
│ └────────────────────────────┘│
└──────────────────────────────┘
```
Every match card is a full `MatchItem` (§3.1) — same visual weight whether there are 2 matches or 40. This is the exact pain point behind the "cards too big" / "long scroll" feedback: nothing shrinks or collapses based on list length today.

**Draw tab**:
```
┌──────────────────────────────┐
│      Tournament Name          │  ← same header/tabs/search as above
│ [Upcoming][Live][Results]      │
│ [Draw ●][Other Tours]          │
├──────────────────────────────┤
│   (bracket/draw visualization) │  ← DrawTab component, own internal
│   fed by rawMatches (raw,       │    layout — not the FlatList/
│   undeduplicated)               │    MatchItem system at all
└──────────────────────────────┘
```

**Other Tours tab** — completely different data source and card style (§6), not `MatchItem`:
```
┌──────────────────────────────┐
│      Tournament Name          │  ← same header/tabs (search still
│ [Upcoming][Live][Results]      │    renders but has no effect here —
│ [Draw][Other Tours ●]          │    OtherToursTab has its own state)
├──────────────────────────────┤
│┌────────────────────────────┐ │
││▎Women's World Ch.  [2 LIVE]│ │  ← EventCard: colored left border
││ Sheffield, England      ▾  │ │    per tour type, expand chevron
││ Player A    1–0    Player B│ │  ← MatchRow: compact single line,
││ Player C    vs     Player D│ │    small live dot, no card chrome
│└────────────────────────────┘ │
│┌────────────────────────────┐ │
││▎Q Tour: NZ Open             │ │  ← next event, same pattern
││ ...                          │ │
│└────────────────────────────┘ │
└──────────────────────────────┘
```
Notably: `OtherToursTab`'s `MatchRow` is already the compact, single-line-per-match style — proof that a denser card isn't unprecedented in this codebase, just not used on the main list yet.

### Full-screen redirect states (replace the whole screen, no tabs shown)

- **Media redirect**: if `shouldRedirectToMedia(processedListData)` is true (nothing decided to show — empty, or every match is TBD-vs-TBD) and neither Live nor Results auto-switch already fired, the screen shows a loading spinner + explanatory text for 2 seconds, then `router.replace('/NewsScreen')`. One-shot per session (`hasAutoSwitchedToMedia` ref).
- Plain loading spinner while `loading && processedListData.length === 0` and not yet decided whether to redirect.

### Auto-switch behaviors (fire at most once per session each, priority order)

1. **Live** — if any match has `matchCategory === 'livePlaying'`, force `activeFilter = 'livePlaying'`. Highest priority.
2. **Results** (off-season fallback) — only if Live didn't already fire, and there's no live/onBreak/upcoming match anywhere but there IS a finished one, force `activeFilter = 'finished'`.
3. **Media redirect** — only if neither above fired — see above.

The user can freely change tabs after any auto-switch; it only overrides the *initial* tab choice.

### Section collapse (`'all'` view only)

`collapsedSections` (a `Set<string>` of section keys like `'finished'`) auto-resets whenever `processedListData` changes: collapses `'finished'` if there's any live/onBreak/upcoming match, otherwise expands everything (off-season, nothing to hide). Manual toggling via `StatusHeaderItem`'s chevron only has a visible effect in `'all'` mode — specific-filter views always show every item in that section.

### Focus refresh

`useFocusEffect` force-refreshes tournament data 100ms after the screen regains focus (e.g. returning from a match detail page), clearing the API cache first. This is why scores update promptly when you back out of a match.

---

## 2. Data pipeline (`useHomeData` hook → `processMatchesForList`)

### Tournament resolution (3-tier fallback, in `useHomeData.loadTournamentInfo`)

1. **Priority 1 — Active tournament with matches**: `getActiveTournamentId()` (now server-resolved first, see backend doc — picks the right event even among many simultaneously-"active" Championship League groups) → fetch its details + matches. If it has ≥1 match, use it.
2. **Priority 2 — Upcoming fallback**: if priority 1 yielded 0 matches, `getUpcomingMatchesFallback('main', 7)` — next 7 days of scheduled main-tour matches, tour name shown as "Upcoming Matches".
3. **Priority 3 — Recent fallback**: if priority 2 also empty, `getRecentMatches(15)` — last 15 finished matches from the most recently completed tournament, tour name shown as "Recent: {event}".

If all three yield nothing, `processedListData` is `[]`, which is what makes `shouldRedirectToMedia` fire (§1).

### List construction (`app/home/utils/matchProcessing.ts` → `processMatchesForList`)

1. **Dedup** matches by `live_url` → `details_url` → `api_match_id` → internal `id` (first non-empty wins as the key). On collision, keeps the match with higher status priority (live=4 > break=3 > upcoming=2 > finished=1) or, if same round, the more "advanced" one.
2. **Categorize** by `status_code`: `0`→`upcoming`, `1`→`livePlaying`, `2`→`onBreak`, `3`→`finished`.
3. **Sort**: live/onBreak/upcoming sorted by round then scheduled date ascending; finished sorted by round descending then end date descending (most recent result first).
4. **Build sectioned list**, in this fixed order — `categoryOrder = ['livePlaying', 'upcoming', 'finished']`:
   - If any live matches: `statusHeader-livePlaying` ("Playing Now") → round headers → live matches.
   - **Upcoming section is special** — merges `onBreak` + `upcoming` under one `statusHeader-upcoming` ("Upcoming") header:
     - if there are break matches: a `"To Be Continued"` round-header divider, then those matches;
     - if there are also upcoming matches AND break matches exist: an `"Upcoming"` round-header divider before them;
     - then the upcoming matches (with their own per-round headers).
     - Section is entirely skipped if both break and upcoming are empty.
   - If any finished matches: `statusHeader-finished` ("Results") → round headers → finished matches.

This three-section fixed order (Live → Upcoming[+Break] → Results) is what both the `'all'` view and the tab-filtering logic in `index.tsx` key off of (`statusHeader-${activeFilter}` string matching) — **don't rename these IDs** without updating `filteredListData` in `index.tsx` too.

---

## 3. List item components

| Item type | Component | Renders |
|---|---|---|
| `statusHeader` | `StatusHeaderItem` | Icon + uppercase title + count badge + (in `'all'` view only) collapse chevron |
| `roundHeader` | `RoundHeaderItem` | Centered `─── ROUND NAME ───` divider, optional `Losers: £X` subtext (from `roundPrizesLoser`) |
| `match` | `MatchItem` | The match card — see §3.1 |

### 3.1 `MatchItem` — the match card

Wrapped in `ModernGlassCard` (glassmorphism: gradient fill, 1px border, rounded corners, optional colored top border via `accentColor` prop).

- `accentColor`: `'#22C55E'` (green) if `matchCategory === 'livePlaying'`, `'#F59E0B'` (amber) if `'onBreak'`, else none.
- **Score-centered row**: `player1Name | score1 — score2 | player2Name`, names truncate with ellipsis, tappable (navigates to player profile, disabled for unknown/TBD player id 376).
- **Winner highlight**: only after `status_code === 3`; winner's name + score both go amber (`#FFB74D`, `winnerText`/`winnerScore` styles). Winner determined by `winner_id` first, falls back to score comparison.
- **Broadcast badges** (`BroadcastBadge`): tappable pills per broadcaster, brand-colored (Eurosport blue, BBC red, DAZN yellow, etc. — see `BRAND_COLORS` map, these are fixed brand colors, not theme-driven).
- **Note line**: italic, for walkovers/withdrawals etc.
- **Footer** (`detailsRow`): `LIVE` badge (green pill) if live, `TBC` badge (amber pill) if on break, calendar icon + formatted scheduled date, star/favorite toggle (amber when starred) — star only shown for non-finished matches.
- Tapping the card navigates to `/match/{api_match_id}` (disabled if no valid id). 5 rapid taps force-clears that match's cache (debug feature).

### 3.2 `OtherLiveSection` — FlatList footer

Rendered as the `ListFooterComponent` of the main FlatList — **only** when `activeFilter` is `'all'`, `'livePlaying'`, or `'onBreak'`. Shows live/on-break matches from OTHER tournaments (not the one currently loaded), grouped by event name, under an "Also Live" (green) or "Also on Break" (amber) header. Uses the same `MatchItem` component. Empty → renders nothing.

---

## 4. Tab filtering logic (`index.tsx` → `filteredListData`)

- `activeFilter === 'all'`: show everything (all 3 sections), then hide the *contents* (not the header) of any section whose key is in `collapsedSections`.
- Any other filter value (`upcoming` / `livePlaying` / `finished`): walk `processedListData`, keep only the block starting at `statusHeader-${activeFilter}` up to (not including) the next `statusHeader`. This is a **substring match on the section ID**, so it only works because section IDs are exactly `statusHeader-livePlaying`, `statusHeader-upcoming`, `statusHeader-finished`.
- `draw` / `otherTours`: never reach this logic — `index.tsx` swaps the entire content area for `DrawTab` / `OtherToursTab` instead (§1 step 5).
- Search query (if non-empty) is applied last, filtering by player name substring, only affecting `match` type items (headers always pass through).

---

## 5. Draw tab (`activeFilter === 'draw'`)

`DrawTab` (`app/tour/components/DrawTab.tsx`, 422 lines) — bracket-style view of `rawMatches` (the *unprocessed* match list straight from `useHomeData`, no dedup/categorization applied). Takes `roundNames`, `roundFormats`, `roundPrizesLoser` for labeling. Not detailed further here — read that file directly if working on it specifically.

---

## 6. Other Tours tab (`activeFilter === 'otherTours'`)

`OtherToursTab` (`app/home/components/OtherToursTab.tsx`) — **completely separate data source**: fetches `GET /other-tours/` directly (not `useHomeData`'s tournament data at all). Shows Women's/Seniors/Q-Tour/Other events as expandable `EventCard`s:

- Left border + label colored per tour: Women's `#E91E63` (pink), Seniors `#FF9800` (orange), Q Tour `#2196F3` (blue), Other `#9E9E9E` (gray).
- Card header: event name, `{city}, {country}`, live-match count badge (green, `"{n} LIVE"`) if any, expand/collapse chevron (default expanded).
- Expanded: `MatchRow` per match — compact single line, small green dot if live, score or "vs", nationality flags.
- Own loading/error/empty/pull-to-refresh states, independent of the main screen's.

This tab is unrelated to the "Other Tours" chip toolbar in §1 step 3 (same phrase, two different UI features — the toolbar switches the *main tournament*, this tab shows a *different screen entirely*).

---

## 7. Color system currently in use

**Important**: the app already has a partially-established snooker identity, not a blank slate — several colors are hardcoded directly in component files (not all theme-driven) and encode specific meaning. Any style pass must preserve these *mappings*, even if the exact hex values change:

| Color | Hex | Meaning | Where hardcoded |
|---|---|---|---|
| App background | `#0D1A0F` | Base screen background (already a dark green-black, not neutral gray) | `layoutStyles.backgroundImage` |
| Snooker green | `#1A733A` / `rgba(26,115,58,*)` | Structural accents — status header left-border, round-header divider lines, card border tint | `modernMatchStyles`, `ModernGlassCard` |
| Live green | `#22C55E` | **Live/Playing Now** — card accent border, LIVE badge, "Also Live" section, OtherToursTab live count badge | `MatchItem`, `OtherLiveSection`, `OtherToursTab` |
| Break amber | `#F59E0B` | **On Break / TBC** — card accent border, TBC badge, "Also on Break" section, starred-favorite icon | `MatchItem`, `OtherLiveSection` |
| Brand amber | `#FFB74D` / `#FFA726` | Winner highlight, score numbers, primary theme accent (`ThemeContext.primary`) | `modernMatchStyles`, `ThemeContext` |
| Tour colors (Other Tours tab only) | Pink `#E91E63`, Orange `#FF9800`, Blue `#2196F3`, Gray `#9E9E9E` | Women's / Seniors / Q Tour / Other | `OtherToursTab.TOUR_COLOR` |
| Broadcaster brand colors | Various | Fixed brand colors per broadcaster, not app theme | `BroadcastBadge.BRAND_COLORS` — **do not touch**, these are external brand identities |

Theme-driven colors (`ThemeContext` → `useHomeColors`) — `background`, `cardBackground`, `cardBorder`, `textHeader/Primary/Secondary/Muted`, `primary`/`secondary` (→ `score`/`accent`/`accentLight`), `live`, `onBreak`, `error`, `white`/`black`, `filterButton*`. Dark mode only (see `CLAUDE.md`) — `ThemeContext.primary = '#FFB74D'`, `background = '#121212'` at the token level (note: Home screen's own `backgroundImage` style overrides this with `#0D1A0F` directly, not via the token).

**Any redesign should work within this existing green=live / amber=break+winner logic, not invent a conflicting scheme** (e.g. don't make live red — that fights `MatchItem`'s `accentColor`, the LIVE badge, and `OtherLiveSection`'s "Also Live" styling, all of which independently hardcode green for the same semantic state).

---

## 8. Style-only vs. logic-touching — a quick test

Before changing anything here, ask: *does this change what data loads, which section a match ends up in, which tab is selected, or when a component renders vs. doesn't?* If yes, it's logic. If it only changes a `StyleSheet` value, a hardcoded hex, spacing, font, border-radius, or shadow — it's style, safe to touch without discussion.

Genuinely ambiguous cases worth flagging before touching:
- Anything in `matchProcessing.ts` (`processMatchesForList`) — this file *is* the logic, not styling, even though it also decides section *titles* (which look like copy/style).
- The 5 filter tab labels/order in `index.tsx` (`filterButtons` array) — changing icons is style; changing labels, order, or adding/removing tabs is a logic-adjacent decision (affects `ActiveFilterType` handling elsewhere).
- Section ID strings (`statusHeader-${key}`) — purely internal, changing them requires updating the substring-match filter logic in the same file.
