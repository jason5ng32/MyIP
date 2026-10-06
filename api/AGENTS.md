# api/AGENTS.md

Conventions for Express 5 handlers under `api/` and the back-end code under
`server/` and `common/`. Universal rules live in ../AGENTS.md.

## Overview

The Express app lives in `backend-server.js` at the repo root — every route
is wired there and delegated to one handler module under `api/`. Code the
handlers share is split by who imports it:

- **`server/`** — backend-only (guards, logger, upstream clients, service-status
  poller, …), flat; `server/datasets/` is the offline dataset engine and its
  readers (see "Offline datasets").
- **`common/`** — only what the frontend or the build imports too
  (`valid-ip.js`, `fetch-with-timeout.js`, `report-schema.js`, …); it never
  imports from `server/`. It also holds the dataset directories (`*-db/`),
  which self-hosting docs and Docker volumes mount — they stay put.

Roughly one handler file per route: IP-geolocation sources (`ipinfo-io` /
`ipapi-com` / `ipapi-is` / `ip2location-io` / `ip-sb` / `ipcheck-ing` /
`maxmind`), tool backends (`get-whois` / `dns-resolver` / `mac-checker` /
`cf-radar` / `asn-history` / `asn-connectivity` / `asn-profile` /
`ooni-blocking` / `globalping-probes` / `service-status` / `google-map` /
`github-stars` / `invisibility-test` / `dns-leak-test` / `persona` /
`ip-blocklist`), user
proxies (`get-user-info` / `update-user-achievement`), platform (`configs` /
`sentry-tunnel` / `share-report`). Each file's header comment states its route
and purpose — read those for specifics.

The exception to one-file-per-route is Cloudflare Radar: all Radar data rides
`/api/cfradar`, dispatched by `?view=` over `RADAR_VIEWS` in
`server/cf-radar.js`, where each view declares its guards, edge-cache TTL and
fetch function — new Radar data is a view function plus a registry row, never
a new route. `api/data/` holds contributor-editable static config consumed by
handlers — currently `dns-resolvers.js`, the country-annotated resolver list
behind `dns-resolver` (gated by `tests/dns-resolvers-data.test.js`).

### ASN data

- **`/api/asn-profile`** (`server/asn-profile.js`) runs each ASN source's core
  under a deadline above the upstream timeouts it wraps (`INNER_TIMEOUTS`); a
  failed or late one is just absent. Always 200 `{ asn, status, incomplete,
  …sections }` (`ok` / `empty` / `error` / `disabled`; an upstream fault is
  `error`, never `empty`; `incomplete` = `ok` but partial); 502 if all fail.
- **Relationship counts follow the graph:** `asn-connectivity` neighbour
  lists come from local CAIDA (`server/as-relationships.js`), dropping the
  providers the graph walk distrusts. The Radar `asn` view (ASN Info) carries
  no prefix or relationship counts — the ASN Profile has both.
- **`/api/whois` `?q=`:** IPs (RDAP, whoiser fallback), domains (whoiser, RDAP
  fallback), `AS<n>` (RDAP autnum); all carry a `__raw` block.
- **Offline datasets** (MaxMind, CAIDA, PeeringDB, IEEE MAC registries) are rows in
  `server/datasets/datasets.js`, run by one engine,
  `server/datasets/dataset-updater.js` (lock, atomic state, publish, boot download,
  daily schedule). A row holds only its own logic — find the newest remote
  version, fetch / distill it, validate, reload; a new dataset is a new row,
  never a new updater. Fetched at boot when its reader has nothing usable
  (missing, or a file it refuses) or a publish was cut short; refreshed daily at
  `DATASET_UPDATE_CRON` (default 04:30 local) unless `DATASET_AUTO_UPDATE=false`
  (a row's pre-engine flag, e.g. `CAIDA_AUTO_UPDATE`, still applies when that
  is unset), with a catch-up run at boot for a check a downtime skipped. Files
  changed on disk by anyone else (another process, a hand-placed `.mmdb`) are
  reloaded by the engine's watcher. MaxMind only with its credentials (City + ASN publish together);
  PeeringDB only with a Cloudflare key; its 116 MB dump is
  stream-distilled (never parsed whole) to a ~6 MB per-ASN index without
  contact data (`server/datasets/peeringdb-distill.js`). The IEEE row (MAC Lookup)
  needs no key: five registry CSVs published as downloaded, answered by the
  longest covering assignment (`server/datasets/oui-db.js`).

## Conventions

- **Handler shape.** Single default export `async (req, res) => …`: read
  `req.query` / `req.body`, call upstream, write one response.
- **Every upstream call uses `fetchUpstream`** (`common/fetch-with-timeout.js`,
  8s timeout), never a bare `fetch()` / `https.get()` — a hanging provider must
  time out. It injects a default `User-Agent` `MyIP/v<version>/<VITE_SITE_URL>`
  (`server/upstream-ua.js`; some WAFs block undici's `node` UA); caller-supplied
  ones, incl. the private-API `{ ...req.headers }` pass-through, win.
- **Error shape.** `res.status(500).json({ error: error.message })` on upstream
  failure, `400` on bad input. Terse — the frontend doesn't show them verbatim.
- **Response shape.** IP-geolocation handlers normalize to the canonical
  frontend shape (`ip` / `country_code` / `latitude` / `asn` / `org` / …); new
  sources match it. `timezone` is the exception (see "Response enrichment").
- **`?lang` is never validated in a handler.** Pass the raw tag through:
  `lookupMaxMind` normalizes it onto the languages its data carries
  (`SUPPORTED_LANGS` in `server/datasets/maxmind-service.js`); the private-API proxies
  forward it for the upstream's own resolution. No allow-lists.
- **Logging.** Shared logger only, `logger.error({ err, ...ctx }, 'msg')`; no
  `console.*`, no "received request" lines (`pino-http` covers those).
- **Error monitoring (Sentry) is env-gated and invisible to handlers.**
  `sentry-instrument.js` (via `node --import`, *before* express, for ESM
  auto-instrumentation) inits; `backend-server.js` adds
  `setupExpressErrorHandler` after the routes. No `SENTRY_DSN_BACKEND` → never
  loaded; `SENTRY_ENVIRONMENT=development` skips the init. Handlers never import
  Sentry: throws and 5xx traces are automatic; caught failures stay on the
  logger (its hook mirrors warn+ to Sentry Logs, error+ to Issues). Periodic
  jobs wrap their tick in `server/sentry-cron.js`; `key` / `token` query params
  are redacted (`server/sentry-scrub.js`).

## Security & Boundaries

### Guards live in middleware, not handlers

`server/guards.js`, attached in `backend-server.js`; handlers never repeat them:

- `requireReferer` — global on `/api/*` (ALLOWED_DOMAINS + localhost).
- `requirePublicIP()` — per-route `?ip=`: well-formed and publicly routable;
  reserved space (RFC 1918, loopback, CGNAT, link-local, documentation, …) never
  reaches a geo source. `isUsablePublicIP` (`common/valid-ip.js`) is the one
  definition, shared with the front-end IP forms.
- `requireValidDomain()` — `?domain=`, lowercased in place (one cache key); a
  leading `_` is allowed below the TLD (RFC 8552 `_dmarc.…`).
- `requireValidPrefix()` — `?prefix=` (CIDR); the frontend quantizes to the BGP
  DFZ floor (/24 v4, /48 v6) for edge-cache reuse.
- `requireValidASN()` — `?asn=` in AS1…AS4294967295, rewritten as bare digits.
  `normalizeAsnQuery()` — `/api/whois` `?q=`: `AS<n>` (prefix required) is
  canonicalized; anything else passes through. Both use `common/asn-input.js`.
- `requireValidCountry()` — `?country=` (alpha-2), uppercased, syntactic only.
  `requireValidProviderId()` — `?id=` ∈ service-status slugs.
- `requireValidRecordType()` — whitelists and uppercases `?type=` against
  `DNS_RECORD_TYPES` (`common/dns-record-types.js`), the list the DnsResolver
  picker and `resolveDns` also read; otherwise the DoH branch would forward any
  string to four third-party endpoints.
- `requireValidReportId()` — `/api/report/:id` route param (22-char base64url).

New param shape → new guard there, attached in `backend-server.js`.

### Response enrichment lives in middleware too

`withTimeZone()` (`server/ip-timezone.js`), on all seven geo routes, derives
`timezone` (IANA name) from the `latitude` / `longitude` the handler returned
(2xx only, the `cacheable` hook); no handler computes or forwards one. Own
coordinates keep the zone consistent with the city beside it; only the name
ships — the frontend renders the offset, as a 24h-cached offset breaks at every
DST switch. A new geo source adds the middleware.

### Offline data gates boot, not the listener

The backend listens before any missing offline dataset or the service-status
snapshot is fetched; snapshots already on disk load first, so only a first
boot waits on downloads. During that window `requireOfflineData([...probes])`
(`server/offline-data.js`) answers 503 on a route whose data is still missing
— never edge-cached — and is a no-op after boot, when a missing dataset means
a failed download served degraded. A route reading local data declares its
probes (`isMaxMindReady`, `isAsRelLoaded`, …) in `backend-server.js`. Answers
assembled from parts don't gate: an ASN Profile section whose data is still
loading (`isStillLoading`) answers `error`, leaving the others to answer.

### Private-API header pass-through (intentional exception)

Handlers proxying our private IPCheck.ing API (`ipcheck-ing`,
`invisibility-test`, `update-user-achievement`, `get-user-info`,
`dns-leak-test`, `persona`, `ip-blocklist`, and `asn-profile`'s reputation via
`server/asn-reputation.js`) forward the caller's headers upstream (`headers: {
...req.headers }`) — the upstream needs caller context (Accept-Language, auth
tokens). `persona` strips the framing headers (`host` / `content-length` / …)
first, as it re-serializes the body. Do **not** replicate for third-party
upstreams; those get only what's explicitly needed.

### Firebase Auth handler proxy

`frontend-server.js` (production) and `vite.config.js` (dev) reverse-proxy
`/__/auth/*` to `<projectId>.firebaseapp.com` (`common/firebase-auth-proxy.js`)
when `VITE_FIREBASE_PROJECT_ID` is set, so `VITE_FIREBASE_AUTH_DOMAIN` can be
the deployment's own host and the sign-in handler runs first-party — inside
the installed PWA's webview and Safari's storage partition, where
`getRedirectResult` finds the result. Every OAuth provider must accept
`https://<host>/__/auth/handler` per environment. Not an `/api` route: no
guards, caching or per-request logs.

## Edge caching

Every `/api/*` response defaults to `Cache-Control: no-store`; slowly-changing
public routes opt in via `cacheable(maxAge)` (`server/cache-control.js`) in
`backend-server.js`, e.g. `cacheable(24 * 60 * 60)` (TTLs written that way, not
raw seconds). `maxAge` may be a `(req) => seconds` resolver (cfradar: its view's
TTL; falsy = no-store). `{ cacheIf }` vetoes the full TTL for a 2xx body,
`{ degradedMaxAge }` gives a vetoed one a shorter TTL instead of no-store:
`/api/asn-profile` caches a complete answer (no section `error` / `incomplete`;
reputation is not per-user) for 7 days and a degraded one for 1 day — some
upstreams fail for some ASes every time — except inside the boot window
(`isOfflineBootstrapping`); cfradar caches no partial view answer
(`isCompleteRadarAnswer`). The ASN family (profile, Radar `asn` /
`bgp-prefixes`) shares 7 days. Only status < 400 is cached; handlers
never touch `Cache-Control`. **Auth'd / per-user endpoints must not be
wrapped** — their caching belongs to the upstream owning the auth context.

## Testing

- Handlers get smoke tests in `tests/api-handlers.test.js` (method gating, param
  branches, "API key missing" early returns); a new or touched handler ships its
  block in the same change. A `req.method !== 'GET'` branch the route already
  gates stays when a test asserts on it.
- Never hit real upstreams: assert before the first `fetchUpstream`, or stub
  `globalThis.fetch` (restored in the shared `afterEach`).
- Middleware is covered by `tests/guards.test.js` (don't duplicate per handler);
  fetch timeout / abort by `tests/fetch-with-timeout.test.js`.
