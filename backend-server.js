import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { slowDown } from 'express-slow-down'
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './common/logger.js';
import { requireReferer, requireValidIP, requireValidPrefix, requireValidASN, requireValidDomain, requireValidProviderId, requireValidReportId } from './common/guards.js';

// Backend APIs
import mapHandler from './api/google-map.js';
// IP Info
import ipinfoHandler from './api/ipinfo-io.js';
import ipapicomHandler from './api/ipapi-com.js';
import ipCheckingHandler from './api/ipcheck-ing.js';
import ipapiisHandler from './api/ipapi-is.js';
import ip2locationHandler from './api/ip2location-io.js';
import ipsbHandler from './api/ip-sb.js';
import maxmindHandler from './api/maxmind.js';
// Others
import cfHander from './api/cf-radar.js';
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
import macChecker from './api/mac-checker.js';
import githubStarsHandler from './api/github-stars.js';
// User
import validateConfigs from './api/configs.js';
import getUserinfo from './api/get-user-info.js';
import updateUserAchievement from './api/update-user-achievement.js';
import { reloadMaxMindDatabases, startMaxMindFileWatcher } from './common/maxmind-service.js';
import { startMaxMindAutoUpdate, bootstrapMaxMindIfMissing } from './common/maxmind-updater.js';
import { startCaidaAutoUpdate, bootstrapCaidaIfMissing } from './common/caida-updater.js';
import { bootstrapServiceStatus, startServiceStatusPolling } from './common/service-status-store.js';
import { initUpstreamUserAgent } from './common/upstream-ua.js';

dotenv.config({ quiet: true });
initUpstreamUserAgent();

const app = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
// Local rate-limit ledger file — opt-in: empty means no file is written.
// The logger.warn in the limiter handler always fires regardless (and flows
// to Sentry Logs when a backend DSN is configured), so the file only adds a
// permanent on-disk record for deployments that want one (e.g. Sentry-less
// self-hosts, or feeding a firewall script).
const blackListIPLogFilePath = process.env.SECURITY_BLACKLIST_LOG_FILE_PATH || '';
const rateLimitSet = parseInt(process.env.SECURITY_RATE_LIMIT || 0, 10);
const speedLimitSet = parseInt(process.env.SECURITY_DELAY_AFTER || 0, 10);

app.set('trust proxy', 1);

// HTTP request logging on /api/* — off by default to keep pm2 logs lean.
// Set LOG_HTTP=true in .env to enable. Mounted before the rate limiter
// so 429s are also logged when enabled.
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

function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip'];
    const forwardedIps = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null;
    const cfIpV6 = req.headers['cf-connecting-ipv6'];
    return cfIp || forwardedIps || cfIpV6 || req.ip;
}

// Host-local time with an explicit UTC offset ("2026-07-14 10:23:45 +0800"),
// matching the pretty-log timestamp style — ledger entries stay unambiguous
// whatever timezone the deployment runs in.
const formatDate = (timestamp) => {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const offsetMin = -d.getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const abs = Math.abs(offsetMin);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
        + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} `
        + `${sign}${pad(Math.floor(abs / 60))}${pad(abs % 60)}`;
};

// Append-or-update one line in the rate-limit log, keeping the original
// timestamp on repeat offenders so we can see when an IP *first* showed up.
function logLimitedIP(ip) {
    const logPath = path.join(__dirname, blackListIPLogFilePath);

    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        logger.info({ logDir }, 'Created log directory');
    }

    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            logger.error({ err }, 'Error reading the log file');
            return;
        }

        const now = Date.now();
        let newCount = 1;
        let logExists = false;
        let updatedData = '';

        if (data) {
            const lines = data.split('\n');
            updatedData = lines.map(line => {
                const [currentIp, count, timestamp] = line.split(',');
                if (currentIp === ip) {
                    newCount = parseInt(count, 10) + 1;
                    logExists = true;
                    return `${ip},${newCount},${timestamp}`;
                }
                return line;
            }).join('\n');
        }

        if (!logExists) {
            const newLine = `${ip},${newCount},${formatDate(now)}`;
            updatedData += (updatedData ? '\n' : '') + newLine;
        }

        fs.writeFile(logPath, updatedData, 'utf8', err => {
            if (err) {
                logger.error({ err }, 'Failed to write to log file');
            }
        });
    });
}

const rateLimiter = rateLimit({
    windowMs: 20 * 60 * 1000,
    max: rateLimitSet,
    message: 'Too Many Requests',
    // The Sentry tunnel is exempted — it has its own limiter at the route.
    // Telemetry sharing the app quota is how reporting silently dies: one
    // 429 and the browser SDK drops every event for the next minute.
    skip: (req) => req.path === '/monitoring',
    handler: (req, res, next) => {
        const ip = getClientIp(req);
        // Log on the exact transition into rate-limited state — not every
        // blocked request — to avoid log flooding when an abusive client
        // keeps hammering after being limited. The warn line is the primary
        // record (mirrored to Sentry Logs when configured); the on-disk
        // ledger is the opt-in extra.
        if (req.rateLimit.current === req.rateLimit.limit + 1) {
            logger.warn({ ip }, 'IP rate-limited');
            if (blackListIPLogFilePath) {
                logLimitedIP(ip);
            }
        }
        res.status(429).json({ message: 'Too Many Requests' });
    }
});

const speedLimiter = slowDown({
    windowMs: 60 * 60 * 1000,
    delayAfter: speedLimitSet,
    delayMs: (hits) => hits * 400,
    skip: (req) => req.path === '/monitoring',
})

if (rateLimitSet !== 0) {
    app.use('/api', rateLimiter);
    logger.info(`🛡️  Rate limiter enabled — ${rateLimitSet} requests per 60 minutes`);
}

if (speedLimitSet !== 0) {
    app.use('/api', speedLimiter);
    logger.info(`🐢 Speed limiter enabled — slow down after ${speedLimitSet} requests`);
}

// 500kb instead of the 100kb default: shared diagnostic reports (POST
// /api/report) legitimately reach ~100KB; the report handler enforces its
// own tighter cap (REPORT_MAX_BYTES) after schema validation.
// Must stay above REPORT_MAX_BYTES (common/report-schema.js) or report
// uploads die here with a raw 413 before the handler's own size check.
app.use(express.json({ limit: '500kb' }));

// Default every /api/* response to no-store. Routes that want edge caching
// declare it explicitly via the `cacheable(maxAge)` middleware below.
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Cache-Control middleware factory. Hooks res.json so the header is only
// attached on 2xx — CF must not cache 4xx/5xx error pages. The intended cache
// value is also stashed on res.locals.cacheControl so binary-stream handlers
// (which bypass res.json) can apply it themselves on their own 2xx path.
const cacheable = (maxAgeSeconds) => (req, res, next) => {
    res.locals.cacheControl = `public, max-age=${maxAgeSeconds}`;
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (res.statusCode < 400) {
            res.setHeader('Cache-Control', res.locals.cacheControl);
        }
        return originalJson(body);
    };
    next();
};

// Global referer gate for all /api/* routes. Handlers no longer repeat this
// check individually — see common/guards.js.
app.use('/api', requireReferer);

const FIVE_MIN_CACHE = 5 * 60;
const ONE_HOUR_CACHE = 60 * 60;
const ONE_DAY_CACHE = 24 * 60 * 60;
const SEVEN_DAYS_CACHE = 7 * 24 * 60 * 60;
const THIRTY_DAYS_CACHE = 30 * 24 * 60 * 60;
const ONE_YEAR_CACHE = 365 * 24 * 60 * 60;

// Cacheable routes — TTLs picked against each upstream's natural refresh cadence.
// Short Cache
app.get('/api/service-status', cacheable(FIVE_MIN_CACHE), serviceStatusHandler);
app.get('/api/service-status/detail', requireValidProviderId(), cacheable(FIVE_MIN_CACHE), serviceStatusDetailHandler);
// Cache for 1 day
app.get('/api/ipinfo', requireValidIP(), cacheable(ONE_DAY_CACHE), ipinfoHandler);
app.get('/api/ipapicom', requireValidIP(), cacheable(ONE_DAY_CACHE), ipapicomHandler);
app.get('/api/ipsb', requireValidIP(), cacheable(ONE_DAY_CACHE), ipsbHandler);
app.get('/api/ipapiis', requireValidIP(), cacheable(ONE_DAY_CACHE), ipapiisHandler);
app.get('/api/ip2location', requireValidIP(), cacheable(ONE_DAY_CACHE), ip2locationHandler);
app.get('/api/maxmind', requireValidIP(), cacheable(ONE_DAY_CACHE), maxmindHandler);
app.get('/api/whois', cacheable(ONE_DAY_CACHE), getWhois);
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
// Cache for 30 days — registry / historical data that changes on a monthly
// (or slower) cadence: IEEE OUI assignments, ASN metadata, ASN interconnection,
// and append-only BGP routing history.
app.get('/api/cfradar', cacheable(THIRTY_DAYS_CACHE), cfHander);
app.get('/api/asn-history', requireValidPrefix(), cacheable(THIRTY_DAYS_CACHE), asnHistoryHandler);
app.get('/api/asn-connectivity', requireValidASN(), cacheable(THIRTY_DAYS_CACHE), asnConnectivityHandler);
app.get('/api/macchecker', cacheable(THIRTY_DAYS_CACHE), macChecker);
// Long Cache
app.get('/api/map', cacheable(ONE_YEAR_CACHE), mapHandler);
// Non-cacheable routes — auth-context, debug tools, or per-request lookups.
app.get('/api/ipchecking', requireValidIP(), ipCheckingHandler);
app.get('/api/dnsresolver', dnsResolver);
app.get('/api/dnsleaktest/session/:token', dnsLeakGetResult);
app.get('/api/invisibility', invisibilitytestHandler);
app.get('/api/getuserinfo', getUserinfo);
app.put('/api/updateuserachievement', updateUserAchievement);
// Shared reports stay no-store: an edge cache could serve a report past its
// KV expiry, and private diagnostic data doesn't belong in a public cache.
app.get('/api/report/:id', requireValidReportId(), getReportHandler);
app.post('/api/report', createReportHandler);

// Sentry tunnel — first-party relay for the frontend SDK's envelopes
// Mounted only when this deployment actually built the frontend with a DSN.
//
// `type` must be a catch-all FUNCTION: Replay envelopes are binary
// (deflate-compressed recording) and fetch sends those with NO Content-Type
// header at all — a '*/*' string matcher skips such requests and req.body
// would never be populated.
if (process.env.VITE_SENTRY_DSN_FRONTEND) {
    // Dedicated, more generous per-IP limiter
    const monitoringLimiter = rateLimit({
        windowMs: 20 * 60 * 1000,
        max: 600,
        message: 'Too Many Requests',
    });
    app.post('/api/monitoring', monitoringLimiter, express.raw({ type: () => true, limit: '10mb' }), sentryTunnelHandler);
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
    logger.info('🛰️ Sentry backend monitoring enabled');
}


// Bootstrap every offline dataset (MaxMind, CAIDA) before accepting traffic
// so we never serve mid-download. Each step is non-fatal: a failure leaves
// the dependent API in a degraded state (MaxMind → 503; CAIDA → empty graph
// or RIPEstat fallback) but doesn't block the listener.
async function bootBackend() {
    await bootstrapMaxMindIfMissing({ reload: reloadMaxMindDatabases });
    await reloadMaxMindDatabases('startup').catch(() => {
        logger.error('❌ MaxMind API will return 503 until databases are loaded successfully');
    });
    await bootstrapCaidaIfMissing();
    await bootstrapServiceStatus();

    startMaxMindFileWatcher();
    startMaxMindAutoUpdate({ reload: reloadMaxMindDatabases });
    startCaidaAutoUpdate();
    startServiceStatusPolling();

    app.listen(backEndPort, () => {
        logger.info(`🚀 Backend server ready on http://localhost:${backEndPort}`);
    });
}

bootBackend();
