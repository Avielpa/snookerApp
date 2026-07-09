// Groups "Championship League Stage X Group Y" sub-events into a single
// collapsible card so the Calendar list isn't flooded with ~40 entries.

export interface GroupableTournament {
  ID: number | string;
  Name: string;
  StartDate: string | null;
  EndDate: string | null;
  status?: 'active' | 'upcoming' | 'past';
  isLive?: boolean;
  [key: string]: any;
}

export const CHAMPIONSHIP_LEAGUE_GROUP_ID = 'championship-league-group';
const CL_PREFIX = 'championship league';

function isChampionshipLeagueSubEvent(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  return lower.startsWith(CL_PREFIX) && lower.length > CL_PREFIX.length;
}

function isChampionshipLeagueRelated(name: string | undefined | null): boolean {
  if (!name) return false;
  return name.toLowerCase().trim().startsWith(CL_PREFIX);
}

// Championship League is played in several separate multi-day blocks spread
// across a season (e.g. late June, then again in December/January) — it is
// NOT one continuous event. Grouping every sub-event under one card's raw
// min/max date span would make it look like a single ~7-month tournament.
// Instead, sub-events are clustered into "legs" (runs of dates with no gap
// longer than LEG_GAP_DAYS between them), and the card displays only the
// leg that's actually relevant right now (live, else soonest upcoming, else
// most recent past) — not the full multi-leg span.
const LEG_GAP_DAYS = 21;

function clusterIntoLegs<T extends GroupableTournament>(sorted: T[]): T[][] {
  const legs: T[][] = [];
  let current: T[] = [];
  let lastEnd: number | null = null;

  for (const item of sorted) {
    const start = item.StartDate ? new Date(item.StartDate).getTime() : null;
    const end = item.EndDate ? new Date(item.EndDate).getTime() : start;
    if (start === null) continue;
    if (lastEnd !== null && (start - lastEnd) / (1000 * 60 * 60 * 24) > LEG_GAP_DAYS) {
      legs.push(current);
      current = [];
    }
    current.push(item);
    lastEnd = lastEnd === null ? end : Math.max(lastEnd, end ?? start);
  }
  if (current.length) legs.push(current);
  return legs;
}

function legDateRange<T extends GroupableTournament>(leg: T[]): { start: string | null; end: string | null } {
  const starts = leg.map(t => t.StartDate).filter(Boolean) as string[];
  const ends = leg.map(t => t.EndDate).filter(Boolean) as string[];
  return {
    start: starts.length ? starts.reduce((a, b) => (new Date(a) < new Date(b) ? a : b)) : null,
    end: ends.length ? ends.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : null,
  };
}

// Replaces all Championship League sub-events in `tournaments` with a single
// synthetic group card carrying the sub-events in `children` (sorted by
// start date). The bare "Championship League" parent event, if present, is
// folded into the group too rather than shown as a separate duplicate card.
// Leaves the list untouched if there's 0 or 1 matching sub-events.
export function groupChampionshipLeague<T extends GroupableTournament>(
  tournaments: T[]
): (T | (GroupableTournament & { isGroup: true; children: T[]; legCount: number })) [] {
  const clItems = tournaments.filter(t => isChampionshipLeagueSubEvent(t.Name));
  if (clItems.length <= 1) return tournaments;

  const others = tournaments.filter(t => !isChampionshipLeagueRelated(t.Name));

  const children = [...clItems].sort((a, b) => {
    const da = a.StartDate ? new Date(a.StartDate).getTime() : 0;
    const db = b.StartDate ? new Date(b.StartDate).getTime() : 0;
    if (da !== db) return da - db;
    return (a.Name || '').localeCompare(b.Name || '');
  });

  const legs = clusterIntoLegs(children);

  // Pick the leg to represent on the card: active > soonest upcoming > most recent past.
  const activeLeg = legs.find(leg => leg.some(t => t.status === 'active'));
  const upcomingLeg = legs.find(leg => leg.some(t => t.status === 'upcoming'));
  const relevantLeg = activeLeg || upcomingLeg || legs[legs.length - 1] || children;

  const { start: legStart, end: legEnd } = legDateRange(relevantLeg);

  const status: 'active' | 'upcoming' | 'past' = children.some(t => t.status === 'active')
    ? 'active'
    : children.some(t => t.status === 'upcoming')
    ? 'upcoming'
    : 'past';

  const groupCard = {
    ID: CHAMPIONSHIP_LEAGUE_GROUP_ID,
    Name: 'Championship League',
    StartDate: legStart,
    EndDate: legEnd,
    status,
    isLive: status === 'active',
    isGroup: true as const,
    children,
    legCount: legs.length,
  };

  return [...others, groupCard];
}
