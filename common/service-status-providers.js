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
    { id: 'chatgpt', name: 'ChatGPT', api: 'https://status.openai.com', page: 'https://status.openai.com' },
    { id: 'cursor', name: 'Cursor', api: 'https://status.cursor.com', page: 'https://status.cursor.com' },
    // exclude: drop GitHub's "Visit … for more information" placeholder row.
    { id: 'github', name: 'GitHub', api: 'https://www.githubstatus.com', page: 'https://www.githubstatus.com', components: { exclude: ['0l2p9nhqnxpd'] } },
    { id: 'elevenlabs', name: 'ElevenLabs', api: 'https://status.elevenlabs.io', page: 'https://status.elevenlabs.io' },
    // Default top-level: summary.json flattens away CF's mid-level product
    // categories, leaving one "Cloudflare Sites and Services" rollup + 7
    // continents — which keeps the card light consistent with this list.
    { id: 'cloudflare', name: 'Cloudflare', api: 'https://new.cloudflarestatus.com', page: 'https://new.cloudflarestatus.com' },
    // LangSmith is the status page for the LangChain platform.
    { id: 'langchain', name: 'LangChain', api: 'https://status.smith.langchain.com', page: 'https://status.smith.langchain.com' },
    { id: 'notion', name: 'Notion', api: 'https://www.notion-status.com', page: 'https://www.notion-status.com' },
    { id: 'vercel', name: 'Vercel', api: 'https://www.vercel-status.com', page: 'https://www.vercel-status.com' },
    { id: 'netlify', name: 'Netlify', api: 'https://www.netlifystatus.com', page: 'https://www.netlifystatus.com' },
    { id: 'render', name: 'Render', api: 'https://status.render.com', page: 'https://status.render.com' },
    { id: 'supabase', name: 'Supabase', api: 'https://status.supabase.com', page: 'https://status.supabase.com' },
    { id: 'replicate', name: 'Replicate', api: 'https://replicatestatus.com', page: 'https://replicatestatus.com' },
    { id: 'figma', name: 'Figma', api: 'https://status.figma.com', page: 'https://status.figma.com' },
    { id: 'linear', name: 'Linear', api: 'https://linearstatus.com', page: 'https://linearstatus.com' },
    // Stripe's customer-facing status.stripe.com is a homegrown page with a
    // non-Statuspage schema; www.stripestatus.com is its Statuspage mirror,
    // which exposes the /api/v2 endpoints this poller needs.
    { id: 'stripe', name: 'Stripe', api: 'https://www.stripestatus.com', page: 'https://www.stripestatus.com' },
];

// Whitelist used by requireValidProviderId() — the per-provider detail
// endpoints (components / incidents) take an `id` query param.
export const STATUS_PROVIDER_IDS = new Set(STATUS_PROVIDERS.map((p) => p.id));
