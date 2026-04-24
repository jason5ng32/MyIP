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

// Helper function to get client IP
function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip']; // Cloudflare IP
    const forwardedIps = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null;
    const cfIpV6 = req.headers['cf-connecting-ipv6'];
    return cfIp || forwardedIps || cfIpV6 || req.ip;
}

// Format timestamp for rate limit log using Shanghai time zone
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
}

// Write IP that triggered the limit to the log and count the number of times the same IP was limited
function logLimitedIP(ip) {
    const logPath = path.join(__dirname, blackListIPLogFilePath);

    // If logs directory does not exist, create it
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        logger.info({ logDir }, 'Created log directory');
    }

    // Read log file, update IP count, create new log file if it does not exist
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
                    return `${ip},${newCount},${timestamp}`;  // Update count but keep the original timestamp
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
    // Handle requests that exceed the rate limit threshold, and record the IP that triggered the limit as needed
    handler: (req, res, next) => {
        const ip = getClientIp(req);
        if (req.rateLimit.current === req.rateLimit.limit + 1 && blackListIPLogFilePath) {
            logLimitedIP(ip);
        }
        res.status(429).json({ message: 'Too Many Requests' });
    }
});

const speedLimiter = slowDown({
	windowMs: 60 * 60 * 1000,
	delayAfter: speedLimitSet,
    // Increase response delay gradually based on the number of hits
	delayMs: (hits) => hits * 400,
})

// If rateLimitSet is 0, do not enable rate limiting
if (rateLimitSet !== 0) {
    app.use('/api', rateLimiter);
    logger.info(`🛡️  Rate limiter enabled — ${rateLimitSet} requests per 60 minutes`);
}

// If delayAfter is 0, do not enable delay
if (speedLimitSet !== 0) {
    app.use('/api', speedLimiter);
    logger.info(`🐢 Speed limiter enabled — slow down after ${speedLimitSet} requests`);
}

app.use(express.json());

// Global referer gate for all /api/* routes. Handlers no longer repeat this
// check individually — see common/guards.js.
app.use('/api', requireReferer);

// APIs. Routes that validate an `?ip=` param attach requireValidIP() so the
// handler body no longer repeats the check.
app.get('/api/map', mapHandler);
app.get('/api/ipinfo', requireValidIP(), ipinfoHandler);
app.get('/api/ipapicom', requireValidIP(), ipapicomHandler);
app.get('/api/ipchecking', requireValidIP(), ipCheckingHandler);
app.get('/api/ipsb', requireValidIP(), ipsbHandler);
app.get('/api/cfradar', cfHander);
app.get('/api/dnsresolver', dnsResolver);
app.get('/api/dnsleaktest/session/:token', dnsLeakGetResult);
app.get('/api/whois', getWhois);
app.get('/api/ipapiis', requireValidIP(), ipapiisHandler);
app.get('/api/ip2location', requireValidIP(), ip2locationHandler);
app.get('/api/invisibility', invisibilitytestHandler);
app.get('/api/macchecker', macChecker);
app.get('/api/maxmind', requireValidIP(), maxmindHandler);
app.get('/api/getuserinfo', getUserinfo);
app.put('/api/updateuserachievement', updateUserAchievement);

// Handle all configuration requests using query parameters
app.get('/api/configs', validateConfigs);

// Set static file server
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));


// Bootstrap the MaxMind layer before accepting traffic. The sequence is:
//   1. bootstrapMaxMindIfMissing — if the .mmdb files are absent and
//      credentials are configured, download them synchronously (capped at
//      5 min). Never throws; logs a warning and moves on if it can't.
//   2. reloadMaxMindDatabases — load readers into memory. Also non-fatal;
//      if the files still aren't there, MaxMind API will return 503.
//   3. startMaxMindFileWatcher — pick up files that arrive later (manual
//      drop-in or a background process publishing updates).
//   4. startMaxMindAutoUpdate — schedule credential-gated periodic updates
//      when MAXMIND_AUTO_UPDATE is enabled.
//   5. app.listen — only after all of the above, so the server never accepts
//      requests mid-download and log order stays readable.
async function bootBackend() {
    await bootstrapMaxMindIfMissing({ reload: reloadMaxMindDatabases });

    await reloadMaxMindDatabases('startup').catch(() => {
        logger.error('❌ MaxMind API will return 503 until databases are loaded successfully');
    });

    startMaxMindFileWatcher();
    startMaxMindAutoUpdate({ reload: reloadMaxMindDatabases });

    app.listen(backEndPort, () => {
        // Output listening address, for local running and process manager log troubleshooting
        logger.info(`🚀 Backend server ready on http://localhost:${backEndPort}`);
    });
}

bootBackend();
