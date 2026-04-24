# api/AGENTS.md

Conventions for Express 5 back-end handlers under `api/` and the shared back-end
code under `common/`. See ../AGENTS.md for universal project rules
(language, commits, testing expectations).

## Overview

The Express app is defined in `backend-server.js` at the repo root. Every route
is wired there and delegated to a handler module under `api/`. Shared code
(referer check, IP validator, fetch helper, Express middleware, MaxMind service)
lives under `common/` and is also consumed by the frontend where it makes sense
(e.g. `valid-ip.js`, `fetch-with-timeout.js`).

## Project layout

```
api/
├── configs.js                   ← /api/configs — reports which env-gated features are on
├── google-map.js                ← /api/map — Google Static Maps image proxy (binary stream)
├── ipinfo-io.js, ipapi-com.js, ipapi-is.js, ip2location-io.js, ip-sb.js,
│   ipcheck-ing.js, maxmind.js   ← IP geolocation source handlers (route per source)
├── invisibility-test.js         ← /api/invisibility — proxy to private IPCheck.ing endpoint
├── mac-checker.js               ← /api/macchecker — MAC vendor lookup
├── get-whois.js                 ← /api/whois — whoiser primary + RDAP fallback for new gTLDs
├── cf-radar.js                  ← /api/cfradar — ASN details via Cloudflare Radar
├── dns-resolver.js              ← /api/dnsresolver — DNS + DoH parallel query
├── dns-leak-test.js             ← /api/dnsleaktest/session/:token — proxy to private
│                                  IPCheck.ing endpoint (Firebase-gated) that drives the
│                                  in-depth DNS Leak Test advanced tool
├── get-user-info.js             ← /api/getuserinfo — user-profile proxy
└── update-user-achievement.js   ← /api/updateuserachievement — user-achievement proxy

common/
├── fetch-with-timeout.js        ← fetchWithTimeout (5s default) + fetchUpstream (8s preset)
├── guards.js                    ← requireReferer + requireValidIP Express middleware
├── logger.js                    ← shared pino logger (pretty in dev, JSON in prod)
├── referer-check.js             ← low-level referer allow-list check
├── valid-ip.js                  ← IPv4 / IPv6 validator (also re-exported from frontend)
├── rdap.js                      ← RDAP client (domain fallback when whoiser returns no __raw)
├── maxmind-service.js           ← mmdb reader + lookup
├── maxmind-updater.js           ← mmdb bootstrap download at boot +
│                                  scheduled auto-update
└── maxmind-db/                  ← GeoLite2-ASN.mmdb + GeoLite2-City.mmdb
```

## Conventions

- **Handler shape.** Each handler is a single default export, `async (req, res) => …`. It reads from `req.query` / `req.body`, calls upstream, and writes one response.
- **Every upstream HTTP call uses `fetchUpstream`** from `common/fetch-with-timeout.js`:

  ```js
  import { fetchUpstream } from '../common/fetch-with-timeout.js';

  const apiRes = await fetchUpstream(url);
  const json = await apiRes.json();
  res.json(transform(json));
  ```

  Default timeout is 8s. Never add a bare `fetch()` or `https.get()` — if a provider hangs, the Express connection should time out, not pin indefinitely.
- **Error shape.** `res.status(500).json({ error: error.message })` on upstream failures; `res.status(400).json({ error: '…' })` on bad input. Be terse — the frontend doesn't display these error strings verbatim.
- **Response shape.** IP-geolocation handlers normalize their upstream's response into the canonical shape consumed by the frontend (`ip` / `country` / `country_name` / `country_code` / `latitude` / `longitude` / `asn` / `org` / …). If you add a new source, match the existing shape.
- **Logging.** `import logger from '../common/logger.js'` and use `logger.error({ err: error, ...context }, 'short message')` on upstream failures, never bare `console.*` (banned project-wide for backend code — see root AGENTS.md "Logging"). The `pino-http` middleware mounted on `/api` already records the request line + status + response time, so handlers should only log domain-specific events / errors, not "received request" lines.

## Security & Boundaries

### Guards live in middleware, not in handlers

- `requireReferer` is mounted globally on `/api/*` in `backend-server.js`. It rejects any request whose `Referer` header isn't on the `ALLOWED_DOMAINS` list (plus `localhost` always). **Handlers must not repeat the referer check.**
- `requireValidIP()` is attached per-route to every handler that takes `?ip=`. It rejects missing or malformed IPs before the handler runs. **Handlers must not repeat the IP check** — inside the handler body, `req.query.ip` is already known to be a well-formed string.
- If you add a new handler that needs a different-shape param guard, add the guard to `common/guards.js` and attach it in `backend-server.js` rather than open-coding the check in the handler.

### Private-API header pass-through (intentional exception)

Handlers that call our own private IPCheck.ing API (`ipcheck-ing.js`, `invisibility-test.js`, `update-user-achievement.js`, `get-user-info.js`, `dns-leak-test.js`) forward the caller's request headers to the upstream:

```js
const apiResponse = await fetchUpstream(url, { headers: { ...req.headers } });
```

This is deliberate — the upstream expects caller context (Accept-Language, auth tokens, etc.). Do **not** replicate this pattern for third-party upstreams; third-party handlers should send only what's explicitly needed.

### Defensive method gates

Some handlers keep a `req.method !== 'GET'` (or `PUT`) branch even though Express routes already gate the method. These exist because dedicated smoke tests assert on that branch directly against the handler. If you add or copy a handler, leave the defensive gate in place if a test covers it.

## Testing

- Smoke tests for every handler live in `tests/api-handlers.test.js`. They cover method gating, param presence / validity (beyond what middleware handles), and the "API key missing" early-return branches.
- Never hit real upstream APIs in tests — assert on branches that `return` before the first `fetchUpstream`.
- Middleware itself is covered by `tests/guards.test.js` (referer + IP validation). Don't duplicate those assertions at the handler level.
- `fetchUpstream` / `fetchWithTimeout` timing + abort behavior is covered by `tests/fetch-with-timeout.test.js`.
