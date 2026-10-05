// Pure mapping helpers from Statuspage/incident.io status vocab to the four
// business tones used across the app (see composables/use-status-tone.js):
//   'wait' | 'ok-fast' | 'ok-slow' | 'fail'
//
// Framework-agnostic (no vue import) so it lives in utils/ and is unit-tested
// in tests/service-status-transform.test.js. Components feed these tones into
// useStatusTone()'s dotClass/textClass — never hand-rolling color classes.

// Per-provider overall `status.indicator` → tone.
//   none                     → ok-fast (all green)
//   minor / maintenance      → ok-slow (amber)
//   unknown (upstream down)  → wait    (sky, "can't tell")
//   major / critical         → fail    (red)
export function indicatorToTone(indicator) {
    switch (indicator) {
        case 'none':
            return 'ok-fast';
        case 'minor':
        case 'maintenance':
            return 'ok-slow';
        case 'major':
        case 'critical':
            return 'fail';
        default:
            return 'wait';
    }
}

// Per-component `status` → tone.
//   operational                          → ok-fast
//   degraded_performance / under_maintenance → ok-slow
//   partial_outage                       → ok-slow (amber, partial)
//   major_outage                         → fail
export function componentStatusToTone(status) {
    switch (status) {
        case 'operational':
            return 'ok-fast';
        case 'degraded_performance':
        case 'partial_outage':
        case 'under_maintenance':
            return 'ok-slow';
        case 'major_outage':
            return 'fail';
        default:
            return 'wait';
    }
}

// Incident severity (`impact`) → number of "!" marks to render. Severity is
// shown by icon count, not color (the color carries the lifecycle status, see
// incidentStatusTone), so this returns a count rather than a tone.
//   none → 0 · minor → 1 · major → 2 · critical → 3
export function impactLevel(impact) {
    switch (impact) {
        case 'minor':
            return 1;
        case 'major':
            return 2;
        case 'critical':
            return 3;
        default:
            return 0;
    }
}

// Incident lifecycle `status` → tone. Reflects where the incident is in its
// life, not how severe it was — so a resolved problem reads as "done" (green)
// regardless of past severity.
//   resolved / postmortem / completed                → ok-fast (green, done)
//   investigating                                     → fail    (red, acute / cause unknown)
//   identified / monitoring / in_progress / verifying → ok-slow (amber, being handled)
//   scheduled / other                                 → wait    (muted, upcoming / unknown)
export function incidentStatusTone(status) {
    switch (status) {
        case 'resolved':
        case 'postmortem':
        case 'completed':
            return 'ok-fast';
        case 'investigating':
            return 'fail';
        case 'identified':
        case 'monitoring':
        case 'in_progress':
        case 'verifying':
            return 'ok-slow';
        default:
            return 'wait';
    }
}
