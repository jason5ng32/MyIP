# api/AGENTS.md

Conventions for Express 5 handlers under `api/` and shared back-end code
under `common/`. Universal rules live in ../AGENTS.md.

## Overview

The Express app lives in `backend-server.js` at the repo root — every route
is wired there and delegated to one handler module under `api/`. `common/`
holds shared back-end code (guards, logger, fetch helper, MaxMind / CAIDA
services, service-status poller), parts of which the frontend also imports
(`valid-ip.js`, `fetch-with-timeout.js`).

Roughly one handler file per route: IP-geolocation sources (`ipinfo-io` /
`ipapi-com` / `ipapi-is` / `ip2location-io` / `ip-sb` / `ipcheck-ing` /
`maxmind`), tool backends (`get-whois` / `dns-resolver` / `mac-checker` /
`cf-radar` / `asn-history` / `asn-connectivity` / `ooni-blocking` /
`globalping-probes` / `service-status` / `google-map` / `github-stars` /
`invisibility-test` / `dns-leak-test`), user
proxies (`get-user-info` / `update-user-achievement`), platform
(`configs` / `sentry-tunnel` / `share-report`). Each file's header comment
states its route and purpose — read those for specifics.

## Conventions

- **Handler shape.** Single default export `async (req, res) => …`: read
  `req.query` / `req.body`, call upstream, write one response.
- **Every upstream call uses `fetchUpstream`** from
  `common/fetch-with-timeout.js` (8s timeout). Never a bare `fetch()` /
  `https.get()` — a hanging provider must time out, not pin the connection.
  It also injects a default `User-Agent` of `MyIP/v<version>/<VITE_SITE_URL>`
  (registered at boot by `common/upstream-ua.js` — some upstream WAFs block
  undici's default `node` UA); caller-supplied `User-Agent` headers, including
  the private-API `{ ...req.headers }` pass-through, always win.
- **Error shape.** `res.status(500).json({ error: error.message })` on
  upstream failure, `400` on bad input. Terse — the frontend doesn't display
  these verbatim.
- **Response shape.** IP-geolocation handlers normalize to the canonical
  frontend shape (`ip` / `country_code` / `latitude` / `asn` / `org` / …);
  new sources match it.
- **Logging.** Shared logger only, `logger.error({ err, ...ctx }, 'msg')`;
  no `console.*`, no "received request" lines (`pino-http` covers those when
  enabled).
- **Error monitoring (Sentry) is env-gated and invisible to handlers.**
  Root-level `sentry-instrument.js` (loaded via `node --import` *before*
  express, so ESM loader hooks can auto-instrument route tracing) does the
  init; `backend-server.js` attaches `setupExpressErrorHandler` after the
  routes. No `SENTRY_DSN_BACKEND` → `@sentry/node` never loads. Handlers
  never import Sentry or capture manually: uncaught throws and 5xx traces
  are automatic; caught failures stay on the logger — a hook in
  `common/logger.js` mirrors warn+ to Sentry Logs and elevates error+ to
  grouped, alertable Issues. Periodic jobs wrap their tick in
  `common/sentry-cron.js` for Crons check-ins. API-key query params
  (`key` / `token` / …) are redacted from telemetry URLs
  (`common/sentry-scrub.js`, wired as `beforeBreadcrumb` / `beforeSendSpan`
  / `beforeSend` hooks).

## Security & Boundaries

### Guards live in middleware, not handlers

`common/guards.js`, attached in `backend-server.js` — handlers never repeat
these checks:

- `requireReferer` — global on `/api/*` (ALLOWED_DOMAINS + localhost).
- `requireValidIP()` — per-route for `?ip=`; handler sees a well-formed IP.
- `requireValidDomain()` — `?domain=`, lowercases in place so the edge cache
  sees one canonical key.
- `requireValidPrefix()` — `?prefix=` (CIDR); lets the frontend quantize to
  the BGP DFZ floor (/24 v4, /48 v6) for maximal CF edge-cache reuse.
- `requireValidASN()` — `?asn=`, strips `AS`, rewrites to numeric
  (`cf-radar` predates it and still validates inline).
- `requireValidProviderId()` — whitelists `?id=` against service-status slugs.
- `requireValidReportId()` — `/api/report/:id` route param (22-char base64url).

New param shape → new guard in `common/guards.js`, attached in
`backend-server.js`; never open-coded in the handler.

### Private-API header pass-through (intentional exception)

Handlers proxying our private IPCheck.ing API (`ipcheck-ing`,
`invisibility-test`, `update-user-achievement`, `get-user-info`,
`dns-leak-test`) forward the caller's headers upstream
(`headers: { ...req.headers }`) — the upstream needs caller context
(Accept-Language, auth tokens). Do **not** replicate for third-party
upstreams; those get only what's explicitly needed.

### Defensive method gates

Some handlers keep a `req.method !== 'GET'` branch although the route
already gates the method — smoke tests assert on that branch directly.
Leave the gate in place when a test covers it.

## Edge caching

Every `/api/*` response defaults to `Cache-Control: no-store`; slowly-changing
public routes opt in via the `cacheable(maxAgeSeconds)` middleware in
`backend-server.js` — e.g. `app.get('/api/cfradar', cacheable(60 * 60), …)`.
Write TTLs as multiplied expressions (`24 * 60 * 60`), not raw seconds.
The middleware only sets `public, max-age=N` on status < 400, so CF never
caches error pages; handlers themselves never touch `Cache-Control`.
**Auth'd / per-user endpoints must not be wrapped** — their caching belongs
to the upstream that owns the auth context.

## Testing

- Every handler has smoke tests in `tests/api-handlers.test.js`: method
  gating, param branches, "API key missing" early returns.
- Never hit real upstreams — assert only on branches that return before the
  first `fetchUpstream`.
- Middleware is covered by `tests/guards.test.js`; don't duplicate its
  assertions per-handler. Fetch timeout/abort behavior:
  `tests/fetch-with-timeout.test.js`.
