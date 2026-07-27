// app/match/utils/matchStatusLabel.ts
// Computes a human-readable match status label directly from status_code,
// using the SAME convention the rest of the app already relies on
// (0=Scheduled, 1=Live, 2=On Break, 3=Finished) — rather than trusting the
// backend's raw status_display string.
//
// Root cause: status_display (matches/<id>/ endpoint) is computed via
// Django's get_Status_display() against MatchesOfAnEvent.Status's own
// STATUS_CHOICES (0=Scheduled, 1=Running, 2=Finished, 3=Unknown) — a
// DIFFERENT 4-value convention than status_code, which the rest of the
// frontend (MatchItem, LiveIndicator, this screen's own matchStats) already
// interprets as 0=Scheduled/1=Live/2=OnBreak/3=Finished. When a match is on
// break, status_display can legitimately read "Finished" while status_code
// is 2 — this is a backend data-convention mismatch between two models, not
// a typo. See docs/OPEN_MISSIONS.md for the backend-side fix.
export function getMatchStatusLabel(statusCode: number | null | undefined): string {
    switch (statusCode) {
        case 0: return 'Scheduled';
        case 1: return 'Live';
        case 2: return 'On Break';
        case 3: return 'Finished';
        default: return 'Status Unknown';
    }
}
