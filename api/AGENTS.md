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
  (`valid-ip.js`, `fetch-with-timeout.js`, `report-schema.js`, the report's
  code lists in `codes/`, …); it imports nothing outside `common/`. It also
  holds the dataset directories (`*-db/`), which self-hosting docs and Docker
  volumes mount — they stay put.

Roughly one handler file per route: IP-geolocation sources (`ipinfo-io` /
`ipapi-com` / `ipapi-is` / `ip2location-io` / `ip-sb` / `ipcheck-ing` /
`maxmind`; their routes are mounted from `api/ip-sources.js`), tool backends
(`get-whois` / `dns-resolver` / `mac-checker` /
`cf-radar` / `asn-history` / `asn-connectivity` / `asn-profile` /
`ooni-blocking` / `globalping-probes` / `service-status` / `google-map` /
`github-stars` / `invisibility-test` / `dns-leak-test` / `persona` /
`ip-blocklist` / `bulk-lookup`), account data (`usage`, a proxy;
`achievements` / `sync` / `sync-settings`, from user storage), platform (`configs` /
`sentry-tunnel` / `share-report`). Each file's header comment states its route
and purpose — read those for specifics.

The exception to one-file-per-route is Cloudflare Radar: all Radar data rides
`/api/cfradar`, dispatched by `?view=` over `RADAR_VIEWS` in
`server/cf-radar.js`, where each view declares its guards, edge-cache TTL and
fetch function — new Radar data is a view function plus a registry row,
never a new route. `outages` is served from a 30-minute in-memory poll
(cold Radar queries outrun the request timeout), started at boot with a
Radar key, outside the boot window, and filled on demand by a request that
finds it empty; each source keeps its last good answer, partial until both
have answered once. `api/data/` holds contributor-editable static config
consumed by handlers — currently `dns-resolvers.js`, the country-annotated
resolver list behind `dns-resolver` (gated by
`tests/dns-resolvers-data.test.js`).

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
- **`/api/bulk-lookup`** (POST, ≤ 200 IPs, own 16 KB body limit) takes only a
  clean list of distinct public IPs — the page extracts, dedupes and splits a
  larger run into requests of that size (`common/bulk-lookup-limits.js`); one
  bad or repeated entry rejects the request, nothing is cleaned server-side. Local
  data only: the source is a `server/bulk-lookup-sources.js` row picked by
  `BULK_LOOKUP_SOURCE`, never a metered upstream.
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

- **Handler shape.** The default export is the route's handler, `async
  (req, res) => …` (a file serving a second route exports that one by name):
  read `req.query` / `req.body`, call upstream, write one response.
- **Every upstream call uses `fetchUpstream`** (`common/fetch-with-timeout.js`,
  8s timeout — Radar's client raises it to 12 s, `RADAR_TIMEOUT_MS`; its own
  timeout is an `AbortError` reading `Timed out after
  <ms>ms: <host>`, host only — keys ride paths and queries), never a bare
  `fetch()` / `https.get()` — a hanging provider must
  time out. It injects a default `User-Agent` `MyIP/v<version>/<VITE_SITE_URL>`
  (`server/upstream-ua.js`; some WAFs block undici's `node` UA); caller-supplied
  ones win, incl. the visitor's `user-agent` forwarded to the IPCheck.ing API
  (the ASN reputation request carries the default).
- **Error shape.** `res.status(500).json({ error: error.message })` on upstream
  failure, `400` on bad input. Terse — the frontend doesn't show them verbatim.
  The four deep-tool routes (`invisibility-test`, `dns-leak-test`, `persona`,
  `ip-blocklist`) answer sign-in and quota failures as `{ error, code,
  reason? }` with the codes from `common/codes/service-errors.js`, keeping the
  upstream status.
- **Response shape.** IP-geolocation handlers normalize to the canonical
  frontend shape (`ip` / `country_code` / `latitude` / `asn` / `org` / …);
  `timezone` is the exception (see "Response enrichment"). Any source may add
  an optional `extended` block and fill any part of it — line type,
  anonymizer and abuse verdicts, its own `metrics`, yes / no `flags` from a
  fixed vocabulary (contract and validator: `common/ip-extended.js`);
  `ipcheck-ing` builds its block in `server/ipcheck-ing-extended.js`.
- **Adding an IP source.** One handler over `makeGeoHandler`
  (`server/geo-handler.js`) that normalizes to that shape, one row in
  `api/ip-sources.js` (`key`, `handler`, edge TTL, readiness `gates`, and an
  `isConfigured` exported by the adapter when it needs a key) — the route,
  its daily-limit key and its `/api/configs` flag derive from it — and its
  row in `frontend/data/ip-databases.js` (`tests/ip-sources.test.js` checks
  the two match). The `extended` block goes through
  `server/source-extended.js`, whose `buildExtended` drops a block that does
  not validate, so the base answer never depends on it. The adapter sends
  only what the card's grid shows, computed from what the upstream states:
  line type onto `IP_TYPE_CODES`, checked data centre → mobile → the
  provider's company / usage type, left out when nothing matches; anonymizer
  and abuse as a plain yes / no (`detected` / `none`, never a kind or a
  frequency); the source's own indicators as `metrics`, never as `score`.
  Its spec uses invented fixtures in the upstream's real shape: full, minimal
  and all-empty answers.
- **`?lang` is never validated in a handler.** Pass the raw tag through:
  `lookupMaxMind` normalizes it onto the languages its data carries
  (`SUPPORTED_LANGS` in `server/datasets/maxmind-service.js`); the IPCheck.ing API proxies
  forward it for the upstream's own resolution. No allow-lists; `/api/map`'s
  `language` only gets a tag-shape check, as each value is a year-cached
  Static Maps call.
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

- `requireReferer` — global on `/api/*` (ALLOWED_DOMAINS + localhost). For
  self-hosters it logs the allowlist (and entries that can never match) at
  boot, and the first rejection per Referer host at info — below the Sentry
  mirror, capped at 50 hosts.
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
- `requireValidSyncCollection()` — `/api/sync/:collection` route param: a
  `common/sync-collections.js` id, else 404; the row lands on
  `res.locals.syncCollection`.
- `optionalUser()` / `requireUser()` — sign-in, verified here
  (`server/sign-in-token.js`: the `authorization` Bearer token checked
  against Google's public certificates, RS256 only, the project from
  `VITE_FIREBASE_PROJECT_ID`; without it every request is signed out).
  A verified user id lands on `res.locals.userId`. `requireUser()` refuses
  a signed-out caller and both refuse a token that fails: 403 `{ error,
  code: 'auth', reason }` (`common/codes/service-errors.js`); a certificate
  outage is 503, uncoded. Verdicts are cached per token for 5 minutes,
  never past its `exp`. Optional on `/api/ipchecking` (its
  `api/ip-sources.js` row's `gates`) and `/api/ipblocklist`; required on
  the other IPCheck.ing API routes, so an invalid token never goes upstream.
- `sourceDailyLimit('<key>')` (`server/source-daily-limits.js`, not a guard
  here) — the geo routes' daily ceiling from `IP_SOURCE_DAILY_LIMITS`
  (`<key>=<n>`, key = the route's last segment, as listed by
  `initSourceDailyLimits(IP_SOURCE_KEYS)`; 0 / unset = unlimited). After
  the route's guards and readiness gate, before `withTimeZone()`: a slot is
  held on admission and given back on a status ≥ 400 or an aborted
  connection; a used-up day answers 429 `{ error, code: 'source_daily_limit' }`
  (never cached). Counts reset on the server-local day, persist to
  `common/source-limits-db/` every few seconds, and are per process.
- `requireUserStorage()` — user storage configured and ready, else 503
  `{ error }` (uncoded); a not-ready storage is re-checked here after a
  cooldown. See "User storage".

New param shape → new guard there, attached in `backend-server.js`.
Rewrites go through `setQueryParam()` there: Express 5's `req.query` re-parses
on every read, so a direct write is lost.

### Response enrichment lives in middleware too

`withTimeZone()` (`server/ip-timezone.js`), on every geo route, derives
`timezone` (IANA name) from the `latitude` / `longitude` the handler returned
(2xx only, the `cacheable` hook); no handler computes or forwards one. Own
coordinates keep the zone consistent with the city beside it; only the name
ships — the frontend renders the offset, as a 24h-cached offset breaks at every
DST switch. `backend-server.js` adds it to every `api/ip-sources.js` row.

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
The Radar outage poll stays out of that window (it would stretch the ASN
Profile's no-degraded-caching span); a request that finds it empty fills it
on demand.

### IPCheck.ing API requests go through one helper with a header list

Handlers proxying the IPCheck.ing API (`ipcheck-ing`,
`invisibility-test`, `usage`,
`dns-leak-test`, `persona`, `ip-blocklist`, and `asn-profile`'s reputation via
`server/asn-reputation.js`) send their requests through
`server/ipcheck-ing-api.js`. It forwards a fixed list of the caller's headers
(`accept-language`, `user-agent`, `cf-connecting-ip`, `x-forwarded-for`;
`FORWARDED_HEADERS` — never `authorization`), sends `res.locals.userId` as
`x-end-user-id` when the handler passes it (`endUserId`; an opaque end-user
identifier to the API, absent for a guest) and sets `content-type` itself for
JSON bodies; handlers never pass headers of their own. The ASN reputation
request carries no caller headers. `ipCheckingApiErrorBody` codes 401 / 403
as `auth` and a 429 as `quota`, except a 429 whose upstream `code` is
`service_limit` (the deployment's key at its limit): that one carries no code,
so no feature is marked used up. Third-party upstreams get only what's
explicitly needed.

Usage reaches MyIP two ways: that `quota`-coded answer (the front end marks the
feature used up) and the `/api/usage` summary, relayed as `{ userLevel,
quota }` and held in memory only (`store.remoteUserInfo`; MyIP reads its
`quota.features`). Each quota has exactly one meter — the IPCheck.ing API; the
lifetime counts in user storage (`feature_uses`) feed achievements only, never
a quota. Pinned by `tests/usage-contract.test.js`.

### Firebase Auth handler proxy

`frontend-server.js` (production) and `vite.config.js` (dev) reverse-proxy
`/__/auth/*` to `<projectId>.firebaseapp.com` (`common/firebase-auth-proxy.js`)
when `VITE_FIREBASE_PROJECT_ID` is set, so `VITE_FIREBASE_AUTH_DOMAIN` can be
the deployment's own host and the sign-in handler runs first-party — inside
the installed PWA's webview and Safari's storage partition, where
`getRedirectResult` finds the result. Every OAuth provider must accept
`https://<host>/__/auth/handler` per environment. Not an `/api` route: no
guards, caching or per-request logs.

### User storage

Optional Postgres through the plain `pg` driver (connection, pool and
readiness: `server/db/user-storage.js`; repositories beside it). No
`DATABASE_URL` → `pg` is never loaded: only `server/db/` names it, through
dynamic `import()` alone, and no ORM rides the manifests
(`tests/pg-boundary.test.js`). Repositories get a narrow handle — `query(text,
params)` and `transaction(fn)`, never the pool — and pass every value as a
`$n` parameter, never interpolated into SQL.

Migrations are append-only, numbered plain SQL files
(`server/db/migrations/NNNN_name.sql`); a published one is never edited — a
change is a new file. Behind the listener, the boot run
(`server/db/migrate.js`) applies the pending ones under a Postgres advisory
lock on one dedicated connection (several processes may boot together), each
file in its own transaction with its `myip_migrations` row. A recorded name
missing on disk only warns; a failure rolls that file back and stops. Never
fatal: until a run succeeds, the `requireUserStorage()` guard answers 503 and
re-runs it after a cooldown, and a query that loses its connection sends it
back there. `/api/configs` `userStorage` = configured (the answer is
edge-cached), not ready. Specs drive the runner and repositories with fakes;
`DATABASE_URL_TEST` runs the optional real-database spec. Data minimisation:
store only what a feature needs keyed by the opaque user id — no e-mail,
name, IP, user agent, last-seen time or test result. Synced content is
preferences and Connectivity lists only (the lists hold the sites a user
added themselves).

Tables: `users` (id, created), `achievements` (user, name, unlock time; one
row per unlocked name), `feature_uses` (user, feature, lifetime count) —
nothing about a use but the count: no target, IP or time — and
`synced_items` (user, collection, schema version, item id, the device's edit
time `updated_at` in epoch ms, `deleted`, `data` jsonb, `seq`; one row per
item, a delete kept as a tombstone with `data` NULL) and `sync_settings`
(user, the enabled collection ids as `text[]`, updated time; a row means the
user decided, an empty list = sync nothing). `seq` comes from
`synced_items_seq`, a new value on every insert or update.

- **Achievements** (`api/achievements.js`, behind `requireUser()` +
  `requireUserStorage()`, no-store, the users row ensured on first contact):
  `GET /api/achievements` → `{ achievements: { <Name>: { achieved: true,
  achievedTime } }, totalUses }` (epoch ms; unlocked names only; `totalUses` =
  the user's summed `feature_uses`); `PUT /api/achievements` `{ name }` (own
  1 KB body limit) → `{ name, achievedTime }`, 400 for a name outside
  `common/codes/achievements.js` — the one name list, which the front end
  reads too. A repeat unlock keeps the first time.
- **Sync settings** (`api/sync-settings.js`, `server/db/sync-settings.js`,
  behind `requireUser()` + `requireUserStorage()`, no-store, users row
  ensured, own 1 KB body limit): the account, not the device, chooses what
  syncs. `GET /api/sync` → `{ decided, collections }` (no row → `{ decided:
  false, collections: [] }`; ids the registry no longer has are left out).
  `PUT /api/sync` `{ collections }` (an array of distinct registry ids, else
  400) → `{ decided: true, collections }` in registry order. One transaction
  under the user's `users` row lock: the row upserted, then every
  `synced_items` row of the user whose collection is left out deleted — all
  versions, tombstones too — in one `DELETE … WHERE user_id = $1 AND
  collection <> ALL($2)`, bounded by the primary key's `user_id` prefix.
- **Sync items** (`api/sync.js`, behind `requireValidSyncCollection()` +
  `requireUser()` + `requireUserStorage()`, no-store, users row ensured, own
  `SYNC_MAX_BODY_BYTES` (320 KB) PUT body limit, mounted before the settings'
  1 KB one). Collections: `common/sync-collections.js`, one frozen registry
  (`preferences` · `connectivity`), each with its schema `version`, item id
  and value checks, `maxItems` (live rows per user and version),
  `maxItemBytes`, `allowDelete` and `pageSize`; `connectivity` (v2, deletes
  on) holds one `list:<list id>` item per list (`{ name, members }`,
  `isValidConnectivityList`), the lists' `order` and `defaultListId`, checked
  in `common/preferences-schema.js`; its `maxItems` is the list cap plus those
  two. A collection the user has not enabled
  in `sync_settings` → 409 `{ error, code: 'sync_off' }` (`SYNC_OFF_CODE`),
  nothing read or written; for a PUT the check runs inside the write
  transaction, after the lock, so a write racing a disable leaves nothing.
  `GET /api/sync/:collection?v=&since=` →
  `{ cursor, more, items: [{ id, updatedAt, deleted, value? }] }`: that
  version's rows with `seq > since`, in `seq` order, one page; any `v` is
  served. `PUT` `{ version, items }` → `{ base, cursor, conflicts, refused }`;
  a `version` other than the registry's, or a malformed body (≤ 500 items,
  valid ids, positive integer `updatedAt`, no repeats) → 400, nothing
  written. Per item (`planSyncWrite`, `server/db/synced-items.js`): a bad
  value, an oversized one, a delete where deletes are off or a new live row
  past `maxItems` is refused (`invalid` / `too_large` / `no_delete` /
  `full`); `updatedAt` is clamped to now; no row → insert, a stored
  `updated_at` as new or newer stays and comes back in `conflicts`, else
  replaced (a delete too, as a tombstone). One transaction: the user's
  `users` row locked first (so a user's `seq` commit in order and a cursor
  never skips one), the enabled check, the collection's tombstones older
  than 90 days removed, every write in one `INSERT … SELECT` over a jsonb
  parameter. `base` / `cursor` = the version's highest `seq` before / after;
  a device whose cursor was `base` may take `cursor` without a GET. Rows of
  other versions are never touched.
- **Use counting** (`server/count-feature-use.js`): `countFeatureUse(<id>)`,
  attached in `backend-server.js` to the five IPCheck.ing-API-backed routes
  (`/api/ipchecking` via its `api/ip-sources.js` row's `featureUse`), adds
  one for a signed-in caller once the route answered below 400. It watches
  the response's `finish`, never delays or fails it, skips guests and a
  storage that is off or not ready, and a failed write only warns. The ids
  (`FEATURE_USES`, `server/db/feature-uses.js`) are MyIP's own `<kind>:<name>`
  (`ipdb:ipchecking`, `tool:persona`), never the upstream's metered names.

## Edge caching

Every `/api/*` response defaults to `Cache-Control: no-store`; slowly-changing
public routes opt in via `cacheable(maxAge)` (`server/cache-control.js`) in
`backend-server.js` (geo routes: their row's `cacheSeconds`), e.g.
`cacheable(24 * 60 * 60)` (TTLs written that way, not raw seconds). `maxAge` may be a `(req) => seconds` resolver (cfradar: its view's
TTL; falsy = no-store). `{ cacheIf }` vetoes the full TTL for a 2xx body,
`{ degradedMaxAge }` gives a vetoed one a shorter TTL instead of no-store:
`/api/asn-profile` caches a complete answer (no section `error` / `incomplete`;
reputation is not per-user) for 7 days and a degraded one for 1 day — some
upstreams fail for some ASes every time — except inside the boot window
(`isOfflineBootstrapping`); cfradar caches no partial view answer
(`isCompleteRadarAnswer`). The ASN family (profile, Radar `asn` /
`bgp-prefixes`) shares 7 days. Only status < 400 is cached; handlers
never touch `Cache-Control`, except `google-map`'s image stream, which
bypasses the JSON hook and applies the stashed `res.locals.cacheControl`.
**Auth'd / per-user endpoints must not be wrapped** — their caching belongs
to the upstream owning the auth context.

## Testing

- Handlers get smoke tests in `tests/api-handlers.test.js` (method gating, param
  branches, "API key missing" early returns); a new or touched handler ships its
  block in the same change. A `req.method !== 'GET'` branch the route already
  gates stays when a test asserts on it.
- Never hit real upstreams: assert before the first `fetchUpstream`, or stub
  `globalThis.fetch` (restored in the shared `afterEach`).
- Middleware is covered by `tests/guards.test.js` (don't duplicate per handler);
  fetch timeout / abort by `tests/fetch-with-timeout.test.js`.
