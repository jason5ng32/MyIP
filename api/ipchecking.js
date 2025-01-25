import { get } from 'https';
import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';
import verifyToken from '../common/verify-token.js';

export default async (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    // 验证用户 Token
    const { isValid, email } = await verifyToken(req);
    const isValidUser = isValid;

    // 从请求中获取 IP 地址
    const ipAddress = req.query.ip;
    if (!ipAddress) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidIP(ipAddress)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const key = process.env.IPCHECKING_API_KEY;

    if (!key) {
        return res.status(500).json({ error: 'API key is missing' });
    }

    const lang = req.query.lang || 'en';

    // 构建请求 IPCheck.ing 的 URL
    const url = new URL(`https://api.ipcheck.ing/ipinfo?key=${key}&ip=${ipAddress}&lang=${lang}&email=${email}`);

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                if (isValidUser) {
                    res.json(originalJson);
                } else {
                    const modifiedJson = modifyJsonForIPChecking(originalJson);
                    res.json(modifiedJson);
                }

            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
}

// 修改返回的数据
function modifyJsonForIPChecking(json) {
    const modifiedJson = JSON.parse(JSON.stringify(json));
    if (modifiedJson.proxyDetect) {
        for (const key in modifiedJson.proxyDetect) {
            modifiedJson.proxyDetect[key] = "sign_in_required";
        }
    }

    return modifiedJson;
}