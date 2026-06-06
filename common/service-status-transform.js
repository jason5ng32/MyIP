// Pure, network-free normalizers for the Statuspage / incident.io schema.
//
// Both `summary.json` and `incidents.json` share the same shape across every
// provider we track, so a single pair of transforms covers all of them. Kept
// dependency-free and side-effect-free so they're unit-testable with inline
// fixtures (tests/service-status-transform.test.js) — no live upstream calls.

// Safety cap on forwarded components. First-level lists are short, so this is
// just a guard against a pathological page bloating the payload.
const DEFAULT_COMPONENT_LIMIT = 40;

// Normalize a `/api/v2/summary.json` payload to
//   { indicator, components: [{ name, status }] }
// where indicator is 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | 'unknown'.
//
// Keeps only the *first level* of components — rows with no parent group
// (`group_id` absent). For pages that nest (Discord, Cloudflare) this keeps the
// category headers, which carry a rolled-up status, and drops their nested
// children; deeper detail belongs on the provider's own status page. Flat pages
// (Claude, GitHub, …) have no groups, so every row is kept.
export function normalizeSummary(json, limit = DEFAULT_COMPONENT_LIMIT) {
    const rawComponents = Array.isArray(json?.components) ? json.components : [];
    const components = rawComponents
        .filter((c) => !c?.group_id)
        .slice(0, limit)
        .map((c) => ({ name: c?.name ?? '', status: c?.status ?? 'operational' }));

    return {
        indicator: json?.status?.indicator || 'unknown',
        components,
    };
}

// Normalize a `/api/v2/incidents.json` payload to the most recent `limit`
// incidents. Upstream already returns them newest-first.
//
// `pageUrl` is the provider's status-page origin; each incident's detail link
// is built as `${pageUrl}/incidents/${id}`. We construct it rather than trust
// the feed's `shortlink` because incident.io pages (OpenAI, Notion) omit it —
// their feed otherwise points only at the page root, not the incident.
//
// Returns: [{ id, name, status, impact, startedAt, url }]
export function normalizeIncidents(json, { limit = 10, pageUrl = '' } = {}) {
    const base = String(pageUrl).replace(/\/+$/, ''); // trim trailing slash(es)
    const incidents = Array.isArray(json?.incidents) ? json.incidents : [];
    return incidents.slice(0, limit).map((i) => {
        const id = i?.id ?? null;
        return {
            id,
            name: i?.name ?? '',
            status: i?.status ?? null,
            impact: i?.impact ?? 'none',
            // `started_at` is the canonical start; fall back to created_at.
            startedAt: i?.started_at ?? i?.created_at ?? null,
            url: id && base ? `${base}/incidents/${id}` : (base || null),
        };
    });
}

// Combine one provider's config with its (possibly null) summary + incidents
// payloads into the shape the frontend consumes. Pure: a null payload (failed
// fetch) degrades gracefully — normalizeSummary(null) → indicator 'unknown'
// with no components, normalizeIncidents(null) → []. Keeps the poller's
// per-provider error handling free of shape-building logic.
export function assembleProvider(provider, summaryJson, incidentsJson) {
    const { indicator, components } = normalizeSummary(summaryJson);
    return {
        id: provider.id,
        name: provider.name,
        page: provider.page,
        indicator,
        components,
        incidents: normalizeIncidents(incidentsJson, { pageUrl: provider.page }),
    };
}
