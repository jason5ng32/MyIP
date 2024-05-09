import whoiser from 'whoiser';

function isValidIP(ip) {
    const ipv4Pattern =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Pattern =
        /^(([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}([0-9a-fA-F]{1,4})?))$/;
    return ipv4Pattern.test(ip) || ipv6Pattern.test(ip);
};

function isValidDomain(domain) {
    const domainPattern = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    return domainPattern.test(domain);
}

export default async (req, res) => {

    // 限制只能从指定域名访问
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];
    const referer = req.headers.referer;

    if (referer) {
        const domain = new URL(referer).hostname;
        if (!allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(403).json({ error: 'What are you doing?' });
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