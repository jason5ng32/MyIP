// Upstream source-of-truth for the "Service Status" homepage section.
//
// Each provider exposes a status page that is API-compatible with the Atlassian
// Statuspage / incident.io schema — both expose the same
// `/api/v2/summary.json` + `/api/v2/incidents.json` endpoints. Cloudflare
// self-hosts a page that mirrors the same shape.
//
// `id`   — stable slug
// `name` — display name
// `api`  — origin we hit `${api}/api/v2/{summary,incidents}.json` against
// `page` — public status page; also the base for incident detail links
//          (`${page}/incidents/${incidentId}`), since incident.io's feed omits
//          a usable shortlink.
//
// This list lives backend-side: the poller (common/service-status-store.js)
// walks it on a fixed schedule and caches the result in memory, so the
// upstream origins never reach the shipped frontend bundle.

export const STATUS_PROVIDERS = [
    { id: 'claude', name: 'Claude', api: 'https://status.claude.com', page: 'https://status.claude.com' },
    { id: 'openai', name: 'OpenAI', api: 'https://status.openai.com', page: 'https://status.openai.com' },
    { id: 'cursor', name: 'Cursor', api: 'https://status.cursor.com', page: 'https://status.cursor.com' },
    { id: 'github', name: 'GitHub', api: 'https://www.githubstatus.com', page: 'https://www.githubstatus.com' },
    { id: 'discord', name: 'Discord', api: 'https://discordstatus.com', page: 'https://discordstatus.com' },
    { id: 'cloudflare', name: 'Cloudflare', api: 'https://new.cloudflarestatus.com', page: 'https://new.cloudflarestatus.com' },
    { id: 'reddit', name: 'Reddit', api: 'https://www.redditstatus.com', page: 'https://www.redditstatus.com' },
    { id: 'notion', name: 'Notion', api: 'https://www.notion-status.com', page: 'https://www.notion-status.com' },
];

// Whitelist used by requireValidProviderId() — the per-provider detail
// endpoints (components / incidents) take an `id` query param.
export const STATUS_PROVIDER_IDS = new Set(STATUS_PROVIDERS.map((p) => p.id));
