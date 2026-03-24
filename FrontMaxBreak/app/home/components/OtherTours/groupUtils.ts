// groupUtils.ts — pure logic, no UI

export type TourFilter = 'all' | 'womens' | 'seniors' | 'qtour';
export type EventStatus = 'live' | 'upcoming' | 'recent' | 'earlier';

export interface OtherTourMatch {
    id: number;
    round: number;
    number: number;
    player1_name: string;
    player2_name: string;
    player1_nationality: string | null;
    player2_nationality: string | null;
    score1: number | null;
    score2: number | null;
    winner_id: number | null;
    status: number; // 0=scheduled, 1=live, 2=finished, 3=walkover
    scheduled_date: string | null;
}

export interface OtherTourEvent {
    event_id: number;
    event_name: string;
    tour: string;
    start_date: string | null;
    end_date: string | null;
    city: string | null;
    country: string | null;
    matches: OtherTourMatch[];
}

export interface GroupedEvent extends OtherTourEvent {
    groups?: OtherTourEvent[]; // group-stage sub-events folded under parent
}

const RECENT_DAYS = 45;
const GROUP_PATTERN = /\s*[-–]?\s*Group\s+[A-Z0-9]+\s*$/i;

function stripGroupSuffix(name: string): string {
    return name.replace(GROUP_PATTERN, '').trim();
}

export function isGroupStage(event: OtherTourEvent): boolean {
    return GROUP_PATTERN.test(event.event_name);
}

export function getEventStatus(event: OtherTourEvent): EventStatus {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - RECENT_DAYS);

    const hasLive = event.matches.some(m => m.status === 1);
    if (hasLive) return 'live';

    const start = event.start_date ? new Date(event.start_date) : null;
    const end = event.end_date ? new Date(event.end_date) : null;

    if (start && start > today) return 'upcoming';
    if (end && end >= cutoff) return 'recent';
    return 'earlier';
}

// Fold "British Women's Open Group A/B/C" under "British Women's Open"
export function foldGroupStages(events: OtherTourEvent[]): GroupedEvent[] {
    const parentMap = new Map<string, GroupedEvent>();
    const result: GroupedEvent[] = [];

    // First pass: identify parent events
    for (const event of events) {
        if (!isGroupStage(event)) {
            const grouped: GroupedEvent = { ...event, groups: [] };
            parentMap.set(event.event_name, grouped);
            result.push(grouped);
        }
    }

    // Second pass: attach group stages to parents
    for (const event of events) {
        if (!isGroupStage(event)) continue;
        const parentName = stripGroupSuffix(event.event_name);
        const parent = parentMap.get(parentName);
        if (parent) {
            parent.groups!.push(event);
        } else {
            // No parent found — show as standalone
            result.push({ ...event, groups: [] });
        }
    }

    return result;
}

export interface CategorizedEvents {
    live: GroupedEvent[];
    upcoming: GroupedEvent[];
    recent: GroupedEvent[];
    earlier: GroupedEvent[];
}

export function categorize(
    events: OtherTourEvent[],
    tour: TourFilter,
): CategorizedEvents {
    const filtered = tour === 'all' ? events : events.filter(e => e.tour === tour);
    const folded = foldGroupStages(filtered);

    const result: CategorizedEvents = { live: [], upcoming: [], recent: [], earlier: [] };

    for (const event of folded) {
        // Compute effective status — if groups have live, parent is live
        const allMatches = [
            ...event.matches,
            ...(event.groups ?? []).flatMap(g => g.matches),
        ];
        const effectiveEvent = { ...event, matches: allMatches };
        const status = getEventStatus(effectiveEvent);
        result[status].push(event);
    }

    // Sort each bucket: most recent first
    const byDate = (a: GroupedEvent, b: GroupedEvent) => {
        const da = a.start_date ?? '';
        const db = b.start_date ?? '';
        return db.localeCompare(da);
    };
    result.live.sort(byDate);
    result.upcoming.sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
    result.recent.sort(byDate);
    result.earlier.sort(byDate);

    return result;
}
