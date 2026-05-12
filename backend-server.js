import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { slowDown } from 'express-slow-down'
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import logger from './common/logger.js';
import { requireReferer, requireValidIP } from './common/guards.js';

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
import dnsResolver from './api/dns-resolver.js';
import { getSessionResult as dnsLeakGetResult } from './api/dns-leak-test.js';
import getWhois from './api/get-whois.js';
import invisibilitytestHandler from './api/invisibility-test.js';
import macChecker from './api/mac-checker.js';
// User
import validateConfigs from './api/configs.js';
import getUserinfo from './api/get-user-info.js';
import updateUserAchievement from './api/update-user-achievement.js';
import { reloadMaxMindDatabases, startMaxMindFileWatcher } from './common/maxmind-service.js';
import { startMaxMindAutoUpdate, bootstrapMaxMindIfMissing } from './common/maxmind-updater.js';

dotenv.config({ quiet: true });

const app = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const blackListIPLogFilePath = process.env.SECURITY_BLACKLIST_LOG_FILE_PATH || 'logs/blacklist-ip.log';
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

// Shanghai TZ — fixed for log consistency across deployments regardless of host locale.
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
}

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
                    logger.warn({ ip, count: newCount }, 'Rate-limited IP hit again');
                    return `${ip},${newCount},${timestamp}`;
                }
                return line;
            }).join('\n');
        }

        if (!logExists) {
            const newLine = `${ip},${newCount},${formatDate(now)}`;
            updatedData += (updatedData ? '\n' : '') + newLine;
            logger.warn({ ip }, 'IP rate-limited for the first time');
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
    handler: (req, res, next) => {
        const ip = getClientIp(req);
        // Log on the exact transition into rate-limited state — not every
        // blocked request — to avoid log flooding when an abusive client
        // keeps hammering after being limited.
        if (req.rateLimit.current === req.rateLimit.limit + 1 && blackListIPLogFilePath) {
            logLimitedIP(ip);
        }
        res.status(429).json({ message: 'Too Many Requests' });
    }
});

const speedLimiter = slowDown({
	windowMs: 60 * 60 * 1000,
	delayAfter: speedLimitSet,
	delayMs: (hits) => hits * 400,
})

if (rateLimitSet !== 0) {
    app.use('/api', rateLimiter);
    logger.info(`🛡️  Rate limiter enabled — ${rateLimitSet} requests per 60 minutes`);
}

if (speedLimitSet !== 0) {
    app.use('/api', speedLimiter);
    logger.info(`🐢 Speed limiter enabled — slow down after ${speedLimitSet} requests`);
}

app.use(express.json());

// Default every /api/* response to no-store. Routes that want edge caching
// declare it explicitly via the `cacheable(maxAge)` middleware below.
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

// Cache-Control middleware factory. Hooks res.json so the header is only
// attached on 2xx — CF must not cache 4xx/5xx error pages. Binary streams
// (res.send) bypass this and must set their own header if needed.
const cacheable = (maxAgeSeconds) => (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (res.statusCode < 400) {
            res.setHeader('Cache-Control', `public, max-age=${maxAgeSeconds}`);
        }
        return originalJson(body);
    };
    next();
};

// Global referer gate for all /api/* routes. Handlers no longer repeat this
// check individually — see common/guards.js.
app.use('/api', requireReferer);

const ONE_HOUR_CACHE = 60 * 60;
const ONE_DAY_CACHE = 24 * 60 * 60;
const THIRTY_DAYS_CACHE = 30 * 24 * 60 * 60;

// Cacheable routes — TTLs picked against each upstream's natural refresh cadence.
app.get('/api/ipinfo', requireValidIP(), cacheable(ONE_HOUR_CACHE), ipinfoHandler);
app.get('/api/ipapicom', requireValidIP(), cacheable(ONE_HOUR_CACHE), ipapicomHandler);
app.get('/api/ipsb', requireValidIP(), cacheable(ONE_HOUR_CACHE), ipsbHandler);
app.get('/api/cfradar', cacheable(ONE_DAY_CACHE), cfHander);
app.get('/api/asn-history', requireValidIP(), cacheable(ONE_DAY_CACHE), asnHistoryHandler);
app.get('/api/whois', cacheable(ONE_HOUR_CACHE), getWhois);
app.get('/api/ipapiis', requireValidIP(), cacheable(ONE_HOUR_CACHE), ipapiisHandler);
app.get('/api/ip2location', requireValidIP(), cacheable(ONE_HOUR_CACHE), ip2locationHandler);
app.get('/api/macchecker', cacheable(THIRTY_DAYS_CACHE), macChecker);
app.get('/api/maxmind', requireValidIP(), cacheable(ONE_DAY_CACHE), maxmindHandler);

// Non-cacheable routes — auth-context, debug tools, or per-request lookups.
app.get('/api/map', mapHandler);
app.get('/api/ipchecking', requireValidIP(), ipCheckingHandler);
app.get('/api/dnsresolver', dnsResolver);
app.get('/api/dnsleaktest/session/:token', dnsLeakGetResult);
app.get('/api/invisibility', invisibilitytestHandler);
app.get('/api/getuserinfo', getUserinfo);
app.put('/api/updateuserachievement', updateUserAchievement);
app.get('/api/configs', validateConfigs);

// Set static file server
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));


// Bootstrap MaxMind before accepting traffic so we never serve mid-download.
// Each step is non-fatal: a failure here leaves the MaxMind API returning
// 503 until the watcher picks up valid databases later.
async function bootBackend() {
    await bootstrapMaxMindIfMissing({ reload: reloadMaxMindDatabases });

    await reloadMaxMindDatabases('startup').catch(() => {
        logger.error('❌ MaxMind API will return 503 until databases are loaded successfully');
    });

    startMaxMindFileWatcher();
    startMaxMindAutoUpdate({ reload: reloadMaxMindDatabases });

    app.listen(backEndPort, () => {
        logger.info(`🚀 Backend server ready on http://localhost:${backEndPort}`);
    });
}

bootBackend();
