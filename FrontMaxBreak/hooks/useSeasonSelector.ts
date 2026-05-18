import { useState } from 'react';

// Snooker season boundary: May 1st (JS month index 4).
// If startDate month >= 4 (May or later) → season year = that year (e.g. Aug 2025 → 2025/26)
// If startDate month <  4 (Jan–Apr)       → season year = year - 1  (e.g. Feb 2026 → 2025/26)
export function dateToSeasonYear(isoDate: string | null | undefined): number {
  const fallback = getCurrentSeasonYear();
  if (!isoDate) return fallback;
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return fallback;
  const month = d.getMonth(); // 0-indexed
  const year = d.getFullYear();
  return month >= 4 ? year : year - 1;
}

// Returns the start year of the snooker season that contains today.
export function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 4 ? year : year - 1;
}

// Display label for a season: 2025 → "2025/26"
export function seasonDisplayLabel(year: number): string {
  return `${year}/${String(year + 1).slice(2)}`;
}

// Century leaderboard API parameter: 2025 → "2025-26"
export function centuriesSeasonParam(year: number): string {
  return `${year}-${String(year + 1).slice(2)}`;
}

// Tour winners / title leaders API parameter: integer year as-is.
export function statsSeasonParam(year: number): number {
  return year;
}

// Hook: manages selected season state.
// Defaults to getCurrentSeasonYear(); if that year is absent from availableSeasons,
// falls back to availableSeasons[0] (assumed newest first).
export function useSeasonSelector(availableSeasons: number[]) {
  const current = getCurrentSeasonYear();

  const initialSeason = (): number => {
    if (availableSeasons.length === 0) return current;
    if (availableSeasons.includes(current)) return current;
    return availableSeasons[0];
  };

  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);

  return { selectedSeason, setSelectedSeason };
}
