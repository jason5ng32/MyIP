import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';
import { lookupMaxMind } from '../common/maxmind-service.js';

export default (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }

    const ip = req.query.ip;
    if (!ip) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidIP(ip)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    // 获取请求语言
    const supportedLanguages = ['zh-CN', 'en', 'fr', 'tr'];
    const lang = supportedLanguages.includes(req.query.lang) ? req.query.lang : 'en';

    try {
        res.json(lookupMaxMind(ip, lang));
    } catch (e) {
        res.status(e.statusCode || 500).json({ error: e.message });
    }
}
