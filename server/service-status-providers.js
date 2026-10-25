// Upstream source-of-truth for the "Service Status" advanced tool page.
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
// `components` — optional row selector (include / exclude / flatten / rename /
//                indicator); see selectComponents in service-status-transform.js.
// `platform` — 'incident.io': components come from the native `/proxy/<host>`
//              structure, since the compat summary flattens groups away.
//
// This list lives backend-side: the poller (server/service-status-store.js)
// walks it on a fixed schedule and caches the result in memory, so the
// upstream origins never reach the shipped frontend bundle.

export const STATUS_PROVIDERS = [
    { id: 'claude', name: 'Claude', api: 'https://status.claude.com', page: 'https://status.claude.com' },
    { id: 'chatgpt', name: 'ChatGPT', api: 'https://status.openai.com', page: 'https://status.openai.com', platform: 'incident.io' },
    { id: 'cursor', name: 'Cursor', api: 'https://status.cursor.com', page: 'https://status.cursor.com' },
    // exclude: drop GitHub's "Visit … for more information" placeholder row.
    { id: 'github', name: 'GitHub', api: 'https://www.githubstatus.com', page: 'https://www.githubstatus.com', components: { exclude: ['0l2p9nhqnxpd'] } },
    { id: 'elevenlabs', name: 'ElevenLabs', api: 'https://status.elevenlabs.io', page: 'https://status.elevenlabs.io', platform: 'incident.io' },
    // The continent groups roll up every re-routed PoP, so CF's page indicator
    // is permanently major: list products instead and light the card from them.
    {
        id: 'cloudflare', name: 'Cloudflare', api: 'https://www.cloudflarestatus.com', page: 'https://www.cloudflarestatus.com',
        components: {
            include: [
                'CDN/Cache', 'Authoritative DNS', 'Recursive DNS', 'Network',
                'SSL Certificate Provisioning', 'Argo Smart Routing',
                'Load Balancing and Monitoring', 'Spectrum', 'Magic Transit', 'Firewall',
                'Bot Management', 'Challenge Platform', 'Turnstile', 'Waiting Room',
                'Dashboard', 'API', 'Registrar', 'Zero Trust', 'Access', 'Gateway',
                'Tunnel', 'WARP', 'Workers', 'Workers KV', 'Workers AI', 'AI Gateway',
                'Pages', 'R2', 'D1', 'Durable Objects', 'Queues', 'Stream', 'Images',
                'Email Routing', 'Radar',
            ],
            indicator: 'components',
        },
    },
    { id: 'groq', name: 'Groq', api: 'https://groqstatus.com', page: 'https://groqstatus.com', platform: 'incident.io' },
    { id: 'notion', name: 'Notion', api: 'https://www.notion-status.com', page: 'https://www.notion-status.com', platform: 'incident.io' },
    { id: 'vercel', name: 'Vercel', api: 'https://www.vercel-status.com', page: 'https://www.vercel-status.com' },
    { id: 'netlify', name: 'Netlify', api: 'https://www.netlifystatus.com', page: 'https://www.netlifystatus.com' },
    { id: 'render', name: 'Render', api: 'https://status.render.com', page: 'https://status.render.com' },
    { id: 'supabase', name: 'Supabase', api: 'https://status.supabase.com', page: 'https://status.supabase.com', platform: 'incident.io' },
    { id: 'discord', name: 'Discord', api: 'https://discordstatus.com', page: 'https://discordstatus.com' },
    { id: 'figma', name: 'Figma', api: 'https://status.figma.com', page: 'https://status.figma.com' },
    { id: 'linear', name: 'Linear', api: 'https://linearstatus.com', page: 'https://linearstatus.com', platform: 'incident.io' },
    // Stripe's customer-facing status.stripe.com is a homegrown page with a
    // non-Statuspage schema; www.stripestatus.com is its Statuspage mirror,
    // which exposes the /api/v2 endpoints this poller needs.
    { id: 'stripe', name: 'Stripe', api: 'https://www.stripestatus.com', page: 'https://www.stripestatus.com' },
    // rename: "www.npmjs.com website" repeats the domain inside the npm card.
    {
        id: 'npm', name: 'npm', api: 'https://status.npmjs.org', page: 'https://status.npmjs.org',
        components: { rename: { mvm98gtxvb9b: 'Official Website' } },
    },
    { id: 'perplexity', name: 'Perplexity', api: 'https://status.perplexity.com', page: 'https://status.perplexity.com', platform: 'incident.io' },
    { id: 'canva', name: 'Canva', api: 'https://www.canvastatus.com', page: 'https://www.canvastatus.com' },
    { id: 'docker', name: 'Docker', api: 'https://www.dockerstatus.com', page: 'https://www.dockerstatus.com', platform: 'incident.io' },
    { id: 'bitbucket', name: 'Bitbucket', api: 'https://bitbucket.status.atlassian.com', page: 'https://bitbucket.status.atlassian.com' },
    { id: 'digitalocean', name: 'DigitalOcean', api: 'https://status.digitalocean.com', page: 'https://status.digitalocean.com' },
    { id: 'reddit', name: 'Reddit', api: 'https://www.redditstatus.com', page: 'https://www.redditstatus.com' },
];

// Whitelist used by requireValidProviderId() — the per-provider detail
// endpoints (components / incidents) take an `id` query param.
export const STATUS_PROVIDER_IDS = new Set(STATUS_PROVIDERS.map((p) => p.id));
