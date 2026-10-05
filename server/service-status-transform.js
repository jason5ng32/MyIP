// Pure, network-free normalizers for the Statuspage / incident.io schema.
//
// Both `summary.json` and `incidents.json` share the same shape across every
// provider we track, so a single pair of transforms covers all of them. Kept
// dependency-free and side-effect-free so they're unit-testable with inline
// fixtures (tests/service-status-transform.test.js) — no live upstream calls.

// Safety cap on forwarded components — a guard against a pathological page
// bloating the payload. Selected lists are normally well under this.
const COMPONENT_LIMIT = 40;

// Pick which components a provider exposes (vendors structure pages too
// differently for one rule to fit all). Per-provider selector — see STATUS_PROVIDERS:
//   (default)            top-level rows: group headers + ungrouped components
//   { flatten: true }    every leaf, group headers dropped
//   { include: [names] } ordered whitelist by component name
//   { exclude: [id|name] } final filter on top of any mode (drops junk rows)
function selectComponents(raw, selector = {}) {
    let picked;
    if (Array.isArray(selector.include)) {
        const byName = new Map(raw.filter((c) => !c?.group).map((c) => [c?.name, c]));
        picked = selector.include.map((name) => byName.get(name)).filter(Boolean);
    } else if (selector.flatten) {
        picked = raw.filter((c) => !c?.group); // all leaves, drop group headers
    } else {
        picked = raw.filter((c) => !c?.group_id); // top-level rows
    }

    if (Array.isArray(selector.exclude) && selector.exclude.length) {
        const blocked = new Set(selector.exclude);
        picked = picked.filter((c) => !blocked.has(c?.id) && !blocked.has(c?.name));
    }
    return picked;
}

// Normalize a `/api/v2/summary.json` payload to
//   { indicator, components: [{ name, status }] }
// where indicator is 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | 'unknown'.
// `selector` chooses which components to keep (see selectComponents).
export function normalizeSummary(json, selector = {}) {
    const raw = Array.isArray(json?.components) ? json.components : [];
    const components = selectComponents(raw, selector)
        .slice(0, COMPONENT_LIMIT)
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
// the feed's `shortlink` because incident.io pages (ChatGPT(OpenAI), Notion) omit it —
// their feed otherwise points only at the page root, not the incident.
//
// Returns: [{ id, name, status, impact, startedAt, url }]
//
// Sorted newest-first by `startedAt` (the timestamp we display) before
// capping, NOT by upstream order: incident.io feeds (ChatGPT(OpenAI), Notion) leave
// `started_at` null and order by `updated_at`, so the `created_at` we fall
// back to would otherwise render out of chronological order in the UI.
export function normalizeIncidents(json, { limit = 10, pageUrl = '' } = {}) {
    const base = String(pageUrl).replace(/\/+$/, ''); // trim trailing slash(es)
    const incidents = Array.isArray(json?.incidents) ? json.incidents : [];
    return incidents
        .map((i) => {
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
        })
        .sort((a, b) => incidentTimestamp(b) - incidentTimestamp(a))
        .slice(0, limit);
}

// Parse an incident's display timestamp to a comparable number; missing /
// unparseable dates sort oldest (0) so they fall to the bottom of the list.
function incidentTimestamp(incident) {
    if (!incident.startedAt) return 0;
    const ms = Date.parse(incident.startedAt);
    return Number.isNaN(ms) ? 0 : ms;
}

// Combine one provider's config with its (possibly null) summary + incidents
// payloads into the shape the frontend consumes. Pure: a null payload (failed
// fetch) degrades gracefully — normalizeSummary(null) → indicator 'unknown'
// with no components, normalizeIncidents(null) → []. Keeps the poller's
// per-provider error handling free of shape-building logic.
export function assembleProvider(provider, summaryJson, incidentsJson) {
    const { indicator, components } = normalizeSummary(summaryJson, provider.components);
    return {
        id: provider.id,
        name: provider.name,
        page: provider.page,
        indicator,
        components,
        incidents: normalizeIncidents(incidentsJson, { pageUrl: provider.page }),
    };
}
