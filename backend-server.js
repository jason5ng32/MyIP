import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import pinoHttp from 'pino-http';
import logger from './server/logger.js';
import { requireReferer, requirePublicIP, requireValidPrefix, requireValidASN, requireValidDomain, requireValidProviderId,
    requireValidRecordType, requireValidReportId, requireValidSyncCollection, normalizeAsnQuery, requireUser, optionalUser,
    requireUserStorage } from './server/guards.js';
import { countFeatureUse } from './server/count-feature-use.js';
import { FEATURE_USES } from './server/db/feature-uses.js';
import { withTimeZone } from './server/ip-timezone.js';
import { initSourceDailyLimits, sourceDailyLimit } from './server/source-daily-limits.js';
import { inspectAllowedDomains } from './server/referer-check.js';

// Backend APIs
import mapHandler from './api/google-map.js';
// IP Info
import { IP_SOURCES, IP_SOURCE_KEYS } from './api/ip-sources.js';
// Others
import cfRadarHandler from './api/cf-radar.js';
import { RADAR_VIEWS, isCompleteRadarAnswer, hasRadarApiKey, startOutagePolling } from './server/cf-radar.js';
import asnHistoryHandler from './api/asn-history.js';
import asnConnectivityHandler from './api/asn-connectivity.js';
import ooniBlockingHandler from './api/ooni-blocking.js';
import globalpingProbesHandler from './api/globalping-probes.js';
import dnsResolver from './api/dns-resolver.js';
import serviceStatusHandler, {
    detailHandler as serviceStatusDetailHandler,
} from './api/service-status.js';
import { getSessionResult as dnsLeakGetResult } from './api/dns-leak-test.js';
import getWhois from './api/get-whois.js';
import sentryTunnelHandler from './api/sentry-tunnel.js';
import createReportHandler, { getReport as getReportHandler } from './api/share-report.js';
import invisibilitytestHandler from './api/invisibility-test.js';
import ipBlocklistHandler from './api/ip-blocklist.js';
import macChecker from './api/mac-checker.js';
import githubStarsHandler from './api/github-stars.js';
import personaEvaluateHandler from './api/persona.js';
import asnProfileHandler from './api/asn-profile.js';
import { isCompleteProfile } from './server/asn-profile.js';
// User
import validateConfigs from './api/configs.js';
import bulkLookupHandler from './api/bulk-lookup.js';
import { bulkLookupSource } from './server/bulk-lookup-sources.js';
import getUserinfo from './api/get-user-info.js';
import listAchievementsHandler, { unlockAchievement as unlockAchievementHandler } from './api/achievements.js';
import readSyncHandler, { writeSyncedItems as writeSyncHandler } from './api/sync.js';
import readSyncSettingsHandler, { writeSyncSettings as writeSyncSettingsHandler } from './api/sync-settings.js';
import { SYNC_MAX_BODY_BYTES } from './common/sync-collections.js';
import { reloadMaxMindDatabases, isMaxMindReady, getMaxMindDbPaths } from './server/datasets/maxmind-service.js';
import { bootstrapDatasets, startDatasetScheduler, watchDatasets } from './server/datasets/dataset-updater.js';
import { datasets } from './server/datasets/datasets.js';
import {
    bootstrapServiceStatus, startServiceStatusPolling, isServiceStatusPrimed,
} from './server/service-status-store.js';
import { isAsRelLoaded } from './server/datasets/as-rel-db.js';
import { isAsOrgLoaded } from './server/datasets/as-org-db.js';
import { isOuiLoaded } from './server/datasets/oui-db.js';
import { runOfflineBootstrap, requireOfflineData, isOfflineBootstrapping } from './server/offline-data.js';
import { userStorage, accountSetupGap } from './server/db/user-storage.js';
import { cacheable } from './server/cache-control.js';
import { initUpstreamUserAgent } from './server/upstream-ua.js';
import { createListenCallback } from './server/listen-callback.js';

initUpstreamUserAgent();

const app = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);

// HTTP request logging on /api/* — off by default to keep pm2 logs lean.
// Set LOG_HTTP=true in .env to enable.
if (process.env.LOG_HTTP === 'true') {
    app.use('/api', pinoHttp({
        logger,
        customLogLevel: (req, res, err) => {
            if (err || res.statusCode >= 500) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} → ${res.statusCode}`,
        customErrorMessage: (req, res, err) => `${req.method} ${req.url} → ${res.statusCode}: ${err.message}`,
        serializers: {
            req: (req) => ({ method: req.method, url: req.url }),
            res: (res) => ({ statusCode: res.statusCode }),
        },
    }));
    logger.info('📝 HTTP request logging enabled (LOG_HTTP=true)');
}

// 500kb instead of the 100kb default: shared diagnostic reports (POST
// /api/report) legitimately reach ~100KB; the report handler enforces its
// own tighter cap (REPORT_MAX_BYTES) after schema validation.
// Must stay above REPORT_MAX_BYTES (common/report-schema.js) or report
// uploads die here with a raw 413 before the handler's own size check.
// Bulk lookup carries at most 200 IPs (~10KB as the longest IPv6 text forms):
// its own tight parser runs first, and the global one skips a body that is
// already parsed.
app.use('/api/bulk-lookup', express.json({ limit: '16kb' }));
// An achievement unlock is one short name.
app.use('/api/achievements', express.json({ limit: '1kb' }));
// A sync item write: one collection's items, the Connectivity lists the largest.
// It runs before the settings parser below, which then skips the parsed body.
app.use('/api/sync/:collection', express.json({ limit: SYNC_MAX_BODY_BYTES }));
// The sync settings: a few collection ids.
app.use('/api/sync', express.json({ limit: '1kb' }));
app.use(express.json({ limit: '500kb' }));

// Default every /api/* response to no-store. Routes that want edge caching
// declare it explicitly via `cacheable(maxAge)` (server/cache-control.js).
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Global referer gate for all /api/* routes. Handlers no longer repeat this
// check individually — see server/guards.js.
app.use('/api', requireReferer);

// The allowlist at startup, so a self-hoster sees why every request 403s.
const allowlist = inspectAllowedDomains(process.env.ALLOWED_DOMAINS);
if (allowlist.domains.length) {
    logger.info(`🛡️  API referer allowlist: localhost, ${allowlist.domains.join(', ')}`);
} else {
    logger.info('⚠️  ALLOWED_DOMAINS not set — only localhost may call the API; any other host gets 403');
}
for (const { entry, reason } of allowlist.problems) {
    logger.warn(`⚠️  ALLOWED_DOMAINS entry "${entry}" can never match: ${reason}`);
}

const removedSecurityVars = [
    'SECURITY_RATE_LIMIT',
    'SECURITY_DELAY_AFTER',
    'SECURITY_BLACKLIST_LOG_FILE_PATH',
].filter((key) => process.env[key] && process.env[key] !== '0');
if (removedSecurityVars.length) {
    logger.warn(`⚠️  These variables no longer have any effect (built-in rate limiting was removed; enforce limits at your reverse proxy or WAF): ${removedSecurityVars.join(', ')}`);
}

// Readiness gates for routes reading local data (server/offline-data.js):
// 503 while that data is still downloading at boot, a no-op afterwards.
const needsMaxMind = requireOfflineData([isMaxMindReady]);
const needsAsGraph = requireOfflineData([isAsRelLoaded, isAsOrgLoaded]);
const needsOui = requireOfflineData([isOuiLoaded]);
const needsServiceStatus = requireOfflineData([isServiceStatusPrimed]);

// Daily ceiling per IP source (IP_SOURCE_DAILY_LIMITS): on each geo route
// (mounted below from api/ip-sources.js) after its validation and readiness
// gates, so a refused request never holds a slot, and before the answer
// chain, so a 429 is never cached.
initSourceDailyLimits(IP_SOURCE_KEYS);

const FIVE_MIN_CACHE = 5 * 60;
const ONE_HOUR_CACHE = 60 * 60;
const ONE_DAY_CACHE = 24 * 60 * 60;
const SEVEN_DAYS_CACHE = 7 * 24 * 60 * 60;
const THIRTY_DAYS_CACHE = 30 * 24 * 60 * 60;
const ONE_YEAR_CACHE = 365 * 24 * 60 * 60;

// Cacheable routes — TTLs picked against each upstream's natural refresh cadence.
// Short Cache
app.get('/api/service-status', needsServiceStatus, cacheable(FIVE_MIN_CACHE), serviceStatusHandler);
app.get('/api/service-status/detail', requireValidProviderId(), needsServiceStatus, cacheable(FIVE_MIN_CACHE), serviceStatusDetailHandler);
// IP-geolocation sources, one route per api/ip-sources.js row; edge-cached
// for the row's cacheSeconds, no-store without it.
for (const source of IP_SOURCES) {
    app.get(`/api/${source.key}`,
        requirePublicIP(),
        ...(source.gates ?? []),
        sourceDailyLimit(source.key),
        ...(source.featureUse ? [countFeatureUse(source.featureUse)] : []),
        withTimeZone(),
        ...(source.cacheSeconds ? [cacheable(source.cacheSeconds)] : []),
        source.handler);
}
// Cache for 1 day
app.get('/api/whois', normalizeAsnQuery(), cacheable(ONE_DAY_CACHE), getWhois);
app.get('/api/github-stars', cacheable(ONE_DAY_CACHE), githubStarsHandler);
// Feature flags derived from env vars — they only change on a redeploy, so
// an hour of caching is safe.
app.get('/api/configs', cacheable(ONE_HOUR_CACHE), validateConfigs);
// OONI aggregates cover a 30-day window aligned to UTC days — the payload
// only drifts as new measurements land, so 1 day of edge cache keeps us polite
// to OONI's free API without the view going meaningfully stale.
app.get('/api/ooni-blocking', requireValidDomain(), cacheable(ONE_DAY_CACHE), ooniBlockingHandler);
// Which countries have online Globalping probes — coverage changes slowly,
// and the pickers fail open anyway, so a week of edge cache is fine.
app.get('/api/globalping-probes', cacheable(SEVEN_DAYS_CACHE), globalpingProbesHandler);
// ASN Profile aggregate: every source in one answer; reputation inside it is
// not per-user. A complete answer is cached for a week; a degraded one (a
// section in error or incomplete) for a day — an upstream that fails for
// some ASes every time would otherwise send every visit back to all sources.
// Not boot-gated: a section whose local data is still downloading answers
// 'error' on its own (api/asn-profile.js), and nothing degraded is cached
// during that window.
app.get('/api/asn-profile', requireValidASN(), cacheable(SEVEN_DAYS_CACHE, {
    cacheIf: isCompleteProfile,
    degradedMaxAge: () => (isOfflineBootstrapping() ? 0 : ONE_DAY_CACHE),
}), asnProfileHandler);
// All Cloudflare Radar data rides one route; `?view=` picks the dataset and
// the TTL comes from that view's registry entry (server/cf-radar.js) — 7d
// for the ASN summary and prefix list (same as /api/asn-profile), 30d for
// country traffic, 15min for the outage feed (served from memory, see
// startOutagePolling below). A partial answer (some upstream calls failed,
// or prefix countries MaxMind couldn't fully work out) is served but not
// cached.
app.get('/api/cfradar', cacheable((req) => RADAR_VIEWS[req.query.view]?.ttl, { cacheIf: isCompleteRadarAnswer }), cfRadarHandler);
// Cache for 30 days — registry / historical data that changes on a monthly
// (or slower) cadence: IEEE OUI assignments, ASN metadata, ASN interconnection,
// and append-only BGP routing history.
app.get('/api/asn-history', requireValidPrefix(), cacheable(THIRTY_DAYS_CACHE), asnHistoryHandler);
app.get('/api/asn-connectivity', requireValidASN(), needsAsGraph, cacheable(THIRTY_DAYS_CACHE), asnConnectivityHandler);
app.get('/api/macchecker', needsOui, cacheable(THIRTY_DAYS_CACHE), macChecker);
// Long Cache
app.get('/api/map', cacheable(ONE_YEAR_CACHE), mapHandler);
// Non-cacheable routes — auth-context, debug tools, or per-request lookups.
app.get('/api/dnsresolver', requireValidDomain('hostname'), requireValidRecordType(), dnsResolver);
// Sign-in is verified here (server/guards.js): requireUser() refuses a
// signed-out or invalid caller, optionalUser() lets a signed-out one through.
// countFeatureUse() adds one to a signed-in caller's lifetime count after an
// answer below 400 (user storage, for achievements; never a quota).
app.get('/api/dnsleaktest/session/:token', requireUser(), countFeatureUse(FEATURE_USES.dnsleaktest), dnsLeakGetResult);
app.get('/api/invisibility', requireUser(), countFeatureUse(FEATURE_USES.invisibility), invisibilitytestHandler);
app.get('/api/ipblocklist', requirePublicIP(), optionalUser(), countFeatureUse(FEATURE_USES.ipblocklist), ipBlocklistHandler);
app.get('/api/getuserinfo', requireUser(), getUserinfo);
// Achievements and synced items live in user storage: 503 without it.
app.get('/api/achievements', requireUser(), requireUserStorage(), listAchievementsHandler);
app.put('/api/achievements', requireUser(), requireUserStorage(), unlockAchievementHandler);
app.get('/api/sync', requireUser(), requireUserStorage(), readSyncSettingsHandler);
app.put('/api/sync', requireUser(), requireUserStorage(), writeSyncSettingsHandler);
app.get('/api/sync/:collection', requireValidSyncCollection(), requireUser(), requireUserStorage(), readSyncHandler);
app.put('/api/sync/:collection', requireValidSyncCollection(), requireUser(), requireUserStorage(), writeSyncHandler);
// Shared reports stay no-store: an edge cache could serve a report past its
// KV expiry, and private diagnostic data doesn't belong in a public cache.
app.get('/api/report/:id', requireValidReportId(), getReportHandler);
app.post('/api/report', createReportHandler);
// One observation in, one graded report out — per-visitor by definition.
app.post('/api/persona/evaluate', requireUser(), countFeatureUse(FEATURE_USES.persona), personaEvaluateHandler);
// Bulk IP Lookup: local data only. Resolved here so a bad BULK_LOOKUP_SOURCE
// warns at boot rather than on the first request.
bulkLookupSource();
app.post('/api/bulk-lookup', needsMaxMind, bulkLookupHandler);

// Sentry tunnel — first-party relay for the frontend SDK's envelopes
// Mounted only when this deployment actually built the frontend with a DSN.
//
// `type` must be a catch-all FUNCTION: Replay envelopes are binary
// (deflate-compressed recording) and fetch sends those with NO Content-Type
// header at all — a '*/*' string matcher skips such requests and req.body
// would never be populated.
if (process.env.VITE_SENTRY_DSN_FRONTEND) {
    app.post('/api/monitoring', express.raw({ type: () => true, limit: '10mb' }), sentryTunnelHandler);
}

// Set static file server
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));

// Sentry error capture — the SDK itself is initialized (or not) by
// sentry-instrument.js via `node --import`; this attaches the Express error
// handler only when a DSN made that init happen. Must come after every route.
if (process.env.SENTRY_DSN_BACKEND) {
    const Sentry = await import('@sentry/node');
    Sentry.setupExpressErrorHandler(app);
    logger.info('🛰️  Sentry backend monitoring enabled');
}


// Boot sequence. Snapshots already on disk are in memory before the listener
// opens (CAIDA / PeeringDB / IEEE load at import, MaxMind just below), so a
// restart serves at once. Missing ones download behind the listener:
// meanwhile only the routes reading them answer 503 (requireOfflineData
// above). A failed download stays non-fatal — that route then serves degraded
// (MaxMind / IEEE → 503; CAIDA → empty graph, RIPEstat fallback or no
// peering section).
const bootBackend = async () => {
    const { cityDbPath, asnDbPath } = getMaxMindDbPaths();
    if (fs.existsSync(cityDbPath) && fs.existsSync(asnDbPath)) {
        await reloadMaxMindDatabases('startup').catch(() => {});
    }

    // A failed bind (port in use, …) exits non-zero rather than draining.
    app.listen(backEndPort, createListenCallback({ port: backEndPort, logger }));

    // Watching from before the downloads: a dataset another process
    // publishes (or someone places by hand) while a boot step is still
    // running is reloaded, not taken as the watcher's baseline.
    watchDatasets(datasets);

    // The Radar outage feed fills on its own, outside the boot window
    // (asn-profile's degraded caching keys on it); a request that finds it
    // still empty fills it on demand.
    if (hasRadarApiKey()) startOutagePolling();

    // Optional user storage: migrated behind the listener, never fatal; a
    // storage that is not ready is re-checked on a later request.
    const missingAccountSetup = accountSetupGap();
    if (missingAccountSetup) {
        logger.warn(`⚠️  ${missingAccountSetup} is not set: sign-in and user storage need each other, account data features stay off`);
    }
    userStorage.bootCheck();

    await runOfflineBootstrap([
        async () => {
            await bootstrapDatasets(datasets);
            if (isMaxMindReady()) return;
            await reloadMaxMindDatabases('startup').catch(() => {
                logger.error('❌ MaxMind API will return 503 until databases are available: set MAXMIND_ACCOUNT_ID + '
                    + 'MAXMIND_LICENSE_KEY, or drop GeoLite2-City.mmdb + GeoLite2-ASN.mmdb into common/maxmind-db/');
            });
        },
        bootstrapServiceStatus,
    ]);

    startDatasetScheduler(datasets);
    startServiceStatusPolling();
};

bootBackend();
