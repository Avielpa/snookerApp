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

// Replaces all Championship League sub-events in `tournaments` with a single
// synthetic group card carrying the sub-events in `children` (sorted by
// start date). The bare "Championship League" parent event, if present, is
// folded into the group too rather than shown as a separate duplicate card.
// Leaves the list untouched if there's 0 or 1 matching sub-events.
export function groupChampionshipLeague<T extends GroupableTournament>(
  tournaments: T[]
): (T | (GroupableTournament & { isGroup: true; children: T[] }))[] {
  const clItems = tournaments.filter(t => isChampionshipLeagueSubEvent(t.Name));
  if (clItems.length <= 1) return tournaments;

  const others = tournaments.filter(t => !isChampionshipLeagueRelated(t.Name));

  const children = [...clItems].sort((a, b) => {
    const da = a.StartDate ? new Date(a.StartDate).getTime() : 0;
    const db = b.StartDate ? new Date(b.StartDate).getTime() : 0;
    if (da !== db) return da - db;
    return (a.Name || '').localeCompare(b.Name || '');
  });

  const starts = children.map(t => t.StartDate).filter(Boolean) as string[];
  const ends = children.map(t => t.EndDate).filter(Boolean) as string[];
  const minStart = starts.length
    ? starts.reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
    : null;
  const maxEnd = ends.length
    ? ends.reduce((a, b) => (new Date(a) > new Date(b) ? a : b))
    : null;

  const status: 'active' | 'upcoming' | 'past' = children.some(t => t.status === 'active')
    ? 'active'
    : children.some(t => t.status === 'upcoming')
    ? 'upcoming'
    : 'past';

  const groupCard = {
    ID: CHAMPIONSHIP_LEAGUE_GROUP_ID,
    Name: 'Championship League',
    StartDate: minStart,
    EndDate: maxEnd,
    status,
    isLive: status === 'active',
    isGroup: true as const,
    children,
  };

  return [...others, groupCard];
}
