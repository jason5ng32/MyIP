import whoiser from 'whoiser';
import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';

function isValidDomain(domain) {
    const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainPattern.test(domain);
}

export default async (req, res) => {

    // 限制只能从指定域名访问
    const referer = req.headers.referer;
    if (!refererCheck(referer)) {
        return res.status(403).json({ error: referer ? 'Access denied' : 'What are you doing?' });
    }


    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'No address provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidIP(query) && !isValidDomain(query)) {
        return res.status(400).json({ error: 'Invalid IP or address' });
    }

    if (isValidIP(query)) {
        try {
            const ipinfo = await whoiser.ip(query, { timeout: 5000,raw: true});
            res.json(ipinfo);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    } else {
        try {
        const domaininfo = await whoiser.domain(query, { ignorePrivacy: false, timeout: 5000, follow: 2,raw: true});
        res.json(domaininfo);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    }
};