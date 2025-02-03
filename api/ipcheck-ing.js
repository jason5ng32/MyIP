import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';

export default async (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

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

    // 构建请求
    const lang = req.query.lang || 'en';
    const apiEndpoint = process.env.IPCHECKING_API_ENDPOINT;
    const url = new URL(`${apiEndpoint}/ipinfo?key=${key}&ip=${ipAddress}&lang=${lang}`);

    try {
        const apiResponse = await fetch(url, {
            headers: {
                ...req.headers,
            }
        });

        if (!apiResponse.ok) {
            throw new Error(`API responded with status: ${apiResponse.status}`);
        }

        const data = await apiResponse.json();
        res.json(data);
    } catch (error) {
        console.error("Error during API request:", error);
        res.status(500).json({ error: error.message });
    }
}