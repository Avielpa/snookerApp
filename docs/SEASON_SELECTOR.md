# Season Selector Feature

## Summary

Adds a reusable season dropdown to the Calendar and Stats screens so users can browse data from any snooker season. Defaults to the current season automatically.

## Files Added / Changed

| File | Change |
|------|--------|
| `FrontMaxBreak/hooks/useSeasonSelector.ts` | New hook + pure helper functions |
| `FrontMaxBreak/components/SeasonPicker.tsx` | New reusable dropdown component |
| `FrontMaxBreak/app/CalendarEnhanced.tsx` | Season filter + SeasonPicker UI |
| `FrontMaxBreak/app/StatsScreen.tsx` | Dynamic season params + SeasonPicker UI |
| `FrontMaxBreak/season_selector_test.mjs` | 121 assertions covering all logic |

## Architecture

### Season Boundary Rule
Snooker season starts on **May 1**. All events are bucketed by `StartDate` only:
- `StartDate` month ≥ May → season year = that year (e.g. Aug 2025 → season 2025/26)
- `StartDate` month < May → season year = year − 1 (e.g. Jan 2026 → still season 2025/26)

This correctly handles all tour types:
- World Championship (starts late April) → previous season ✓
- Q-School (starts June) → new season ✓
- Women's events (Oct/Nov) → new season ✓

### `useSeasonSelector` hook (`hooks/useSeasonSelector.ts`)
Thin hook + pure exported helpers (testable without React):

```ts
dateToSeasonYear(isoDate)      // ISO string → season start year
getCurrentSeasonYear()          // today → current season start year
seasonDisplayLabel(year)        // 2025 → "2025/26"
centuriesSeasonParam(year)      // 2025 → "2025-26" (centuries API format)
statsSeasonParam(year)          // 2025 → 2025 (tour winners/leaders API format)
useSeasonSelector(seasons[])    // { selectedSeason, setSelectedSeason }
```

Default selection: `getCurrentSeasonYear()`. If current year not in list, falls back to `seasons[0]` (newest).

### `SeasonPicker` component (`components/SeasonPicker.tsx`)
- Pressable chip showing selected season + ▾
- Opens a `Modal` with `ScrollView` list, newest season first
- Selected season has ✓ checkmark + accent highlight
- Guard: if `seasons.length === 0`, chip is shown but cannot be opened (no empty modal crash)
- Dark mode only, uses `colors` from ThemeContext

### Calendar integration (`app/CalendarEnhanced.tsx`)
- `availableSeasons` derived from loaded events via `useMemo` — no extra API call
- Season filter applied before status + search filters
- Events with `null StartDate` always pass through (never hidden)
- `SeasonPicker` rendered above the All/Live/Upcoming/Past pills
- Season persists when switching Main Tours ↔ Others tabs
- Empty state: "No tournaments found for 2024/25. Try selecting a different season."

### Stats integration (`app/StatsScreen.tsx`)
- `STATS_SEASONS`: list from 2019 to current season (newest first) — API already supports all years
- `loadAll` depends on `selectedSeason` → re-fetches when season changes
- `SeasonPicker` replaces the static "2025-26 season" subtitle
- `allEmpty` guard: shows "No data available for YYYY/YY" when all three endpoints return count 0
- No backend changes required

## Edge Cases Handled
- Null/malformed `StartDate` → fallback, never crashes
- Empty `availableSeasons` → picker shows current season label, cannot open (safe)
- Season change mid-fetch → last setState wins, no crash
- API returns empty for old season → existing empty-state + friendly message
- Network error → existing error banner; season selector stays visible

## Tests
Run: `node FrontMaxBreak/season_selector_test.mjs`
Expected: `✅ All 121 assertions passed`

Covers: date boundary logic, all tour types, null/malformed inputs, filter pipeline, empty states, stats season list generation, cross-tour bucketing, SeasonPicker display logic.
