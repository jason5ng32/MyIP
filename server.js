import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import mapHandler from './api/map.js';
import ipinfoHandler from './api/ipinfo.js';
import ipapicomHandler from './api/ipapicom.js';
import keycdnHandler from './api/keycdn.js';
import ipCheckingHandler from './api/ipchecking.js';
import ipsbHandler from './api/ipsb.js';
import cfHander from './api/cfradar.js';
import recaptchaHandler from './api/recaptcha.js';
import validateConfigs from './api/configs.js';
import dnsResolver from './api/dnsresolver.js';
import rateLimit from 'express-rate-limit';
import { slowDown } from 'express-slow-down'

dotenv.config();

const app = express();
const port = process.env.PORT || 11966;
const blackListIPLogFilePath = process.env.BLACKLIST_LOG_FILE_PATH || '';
const rateLimitSet = process.env.RATE_LIMIT || '60';
const deleyAfter = process.env.DELAY_AFTER || '60';

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
                    return `${ip},${newCount},${timestamp}`;  // Update count but keep the original timestamp
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
                console.error('Failed to write to log file:', err);
            }
        });
    });
}

const apiLimiter = rateLimit({
    windowMs: 20 * 60 * 1000,
    max: parseInt(rateLimitSet, 10),
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
	delayAfter: parseInt(deleyAfter, 10),
	delayMs: (hits) => hits * 400,
})

app.use('/api', apiLimiter);
app.use('/api', speedLimiter);

// APIs
app.get('/api/map', mapHandler);
app.get('/api/ipinfo', ipinfoHandler);
app.get('/api/ipapicom', ipapicomHandler);
app.get('/api/keycdn', keycdnHandler);
app.get('/api/ipchecking', ipCheckingHandler);
app.get('/api/ipsb', ipsbHandler);
app.get('/api/cfradar', cfHander);
app.get('/api/recaptcha', recaptchaHandler);

// DNS Resolver
app.get('/api/dnsresolver', dnsResolver);

// 使用查询参数处理所有配置请求
app.get('/api/configs', validateConfigs);

// 设置静态文件服务
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, './dist')));


// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
