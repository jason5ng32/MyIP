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
//   { indicator: 'components' } card light from the selected rows, not the page's
//   { rename: { id: label } } display label by component id, after selection
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

    const rename = selector.rename;
    if (rename && typeof rename === 'object') {
        // Copies, so the upstream rows stay untouched.
        picked = picked.map((c) => (Object.hasOwn(rename, c?.id) ? { ...c, name: rename[c.id] } : c));
    }
    return picked;
}

// Severity order for "worst status"; an unknown string ranks below operational.
const STATUS_RANK = { operational: 0, under_maintenance: 1, degraded_performance: 2, partial_outage: 3, major_outage: 4 };

const worstStatus = (statuses) => statuses.reduce(
    (worst, s) => ((STATUS_RANK[s] ?? -1) > STATUS_RANK[worst] ? s : worst),
    'operational',
);

// Worst component status → page indicator, matching the frontend tone map.
export const indicatorFromComponents = (components) => {
    if (!Array.isArray(components) || !components.length) return 'unknown';
    switch (worstStatus(components.map((c) => c?.status))) {
        case 'major_outage':
            return 'major';
        case 'partial_outage':
        case 'degraded_performance':
            return 'minor';
        case 'under_maintenance':
            return 'maintenance';
        default:
            return 'none';
    }
};

// incident.io's native `/proxy/<host>` payload → Statuspage-style top-level rows
// `{ id, name, status }`; a group takes its worst visible child. Only
// non-operational components are listed in `affected_components`.
export const componentsFromStructure = (proxyJson) => {
    const items = proxyJson?.summary?.structure?.items;
    if (!Array.isArray(items)) return [];
    const affected = proxyJson.summary.affected_components;
    const statusById = new Map((Array.isArray(affected) ? affected : []).map((a) => [a?.component_id, a?.status]));
    const statusOf = (id) => statusById.get(id) || 'operational';

    return items.flatMap((item) => {
        if (item?.group) {
            const { id, name, hidden, components } = item.group;
            if (hidden) return [];
            const visible = (Array.isArray(components) ? components : []).filter((c) => c && !c.hidden);
            return [{ id, name, status: worstStatus(visible.map((c) => statusOf(c.component_id))) }];
        }
        const c = item?.component;
        if (!c || c.hidden) return [];
        return [{ id: c.component_id, name: c.name, status: statusOf(c.component_id) }];
    });
};

// Normalize a `/api/v2/summary.json` payload to
//   { indicator, components: [{ name, status }] }
// where indicator is 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | 'unknown'.
// `selector` chooses which components to keep (see selectComponents);
// `rawComponents` replaces `json.components` as the rows to select from.
export function normalizeSummary(json, selector = {}, rawComponents = null) {
    const raw = Array.isArray(rawComponents) ? rawComponents
        : Array.isArray(json?.components) ? json.components : [];
    const components = selectComponents(raw, selector)
        .slice(0, COMPONENT_LIMIT)
        .map((c) => ({ name: c?.name ?? '', status: c?.status ?? 'operational' }));

    return {
        indicator: selector?.indicator === 'components'
            ? indicatorFromComponents(components)
            : json?.status?.indicator || 'unknown',
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
// `structureJson` (incident.io `/proxy/<host>`) supplies the rows when it yields any.
export function assembleProvider(provider, summaryJson, incidentsJson, structureJson = null) {
    const rows = structureJson ? componentsFromStructure(structureJson) : [];
    const { indicator, components } = normalizeSummary(summaryJson, provider.components, rows.length ? rows : null);
    return {
        id: provider.id,
        name: provider.name,
        page: provider.page,
        indicator,
        components,
        incidents: normalizeIncidents(incidentsJson, { pageUrl: provider.page }),
    };
}
