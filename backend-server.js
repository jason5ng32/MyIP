import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { slowDown } from 'express-slow-down'
import rateLimit from 'express-rate-limit';

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
import getWhois from './api/get-whois.js';
import invisibilitytestHandler from './api/invisibility-test.js';
import macChecker from './api/mac-checker.js';
// User
import validateConfigs from './api/configs.js';
import getUserinfo from './api/get-user-info.js';
import updateUserAchievement from './api/update-user-achievement.js';

dotenv.config();

const app = express();
const backEndPort = parseInt(process.env.BACKEND_PORT || 11966, 10);
const blackListIPLogFilePath = process.env.SECURITY_BLACKLIST_LOG_FILE_PATH || 'logs/blacklist-ip.log';
const rateLimitSet = parseInt(process.env.SECURITY_RATE_LIMIT || 0, 10);
const speedLimitSet = parseInt(process.env.SECURITY_DELAY_AFTER || 0, 10);

app.set('trust proxy', 1);

// 获取客户端 IP 的辅助函数
function getClientIp(req) {
    const cfIp = req.headers['cf-connecting-ip']; // Cloudflare IP
    const forwardedIps = req.headers['x-forwarded-for'] ? req.headers['x-forwarded-for'].split(',')[0] : null;
    const cfIpV6 = req.headers['cf-connecting-ipv6'];
    return cfIp || forwardedIps || cfIpV6 || req.ip;
}

// 记录限流触发的 IP 地址
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
}

function logLimitedIP(ip) {
    const logPath = path.join(__dirname, blackListIPLogFilePath);

    // 如果 logs 目录不存在，则创建
    const logDir = path.dirname(logPath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
        console.log('Created log directory:', logDir);
    }

    // 读取日志文件，更新 IP 计数，如果文件不存在则创建新的日志文件
    fs.readFile(logPath, 'utf8', (err, data) => {
        if (err && err.code !== 'ENOENT') {
            console.error('Error reading the log file:', err);
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
                    console.log(`IP ${ip} has been limited ${newCount} times`);
                    return `${ip},${newCount},${timestamp}`;  // Update count but keep the original timestamp
                }
                return line;
            }).join('\n');
        }

        if (!logExists) {
            const newLine = `${ip},${newCount},${formatDate(now)}`;
            updatedData += (updatedData ? '\n' : '') + newLine;
            console.log(`IP ${ip} has been limited for the first time`);
        }

        fs.writeFile(logPath, updatedData, 'utf8', err => {
            if (err) {
                console.error('Failed to write to log file:', err);
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

// 如果 rateLimitSet 为 0，则不启用限流
if (rateLimitSet !== 0) {
    app.use('/api', rateLimiter);
    console.log('Rate limiter is enabled, limit:', rateLimitSet, 'requests per 60 minutes');
}

// 如果 deleyAfter 为 0，则不启用延迟
if (speedLimitSet !== 0) {
    app.use('/api', speedLimiter);
    console.log('Speed limiter is enabled, slowing down after:', speedLimitSet, 'requests');
}

app.use(express.json());

// APIs
app.get('/api/map', mapHandler);
app.get('/api/ipinfo', ipinfoHandler);
app.get('/api/ipapicom', ipapicomHandler);
app.get('/api/ipchecking', ipCheckingHandler);
app.get('/api/ipsb', ipsbHandler);
app.get('/api/cfradar', cfHander);
app.get('/api/dnsresolver', dnsResolver);
app.get('/api/whois', getWhois);
app.get('/api/ipapiis', ipapiisHandler);
app.get('/api/ip2location', ip2locationHandler);
app.get('/api/invisibility', invisibilitytestHandler);
app.get('/api/macchecker', macChecker);
app.get('/api/maxmind', maxmindHandler);
app.get('/api/getuserinfo', getUserinfo);
app.put('/api/updateuserachievement', updateUserAchievement);

// 使用查询参数处理所有配置请求
app.get('/api/configs', validateConfigs);

// 设置静态文件服务
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));


// 启动服务器
app.listen(backEndPort, () => {
    console.log(`Backend server running on http://localhost:${backEndPort}`);
});
