const https = require('https');

module.exports = (req, res) => {
    // 限制只能从指定域名访问
    const allowedDomains = ['localhost', ...(process.env.ALLOWED_DOMAINS || '').split(',')];
    const referer = req.headers.referer;

    if (referer) {
        const domain = new URL(referer).hostname;
        if (!allowedDomains.includes(domain)) {
            return res.status(403).json({ error: 'Access denied' });
        }
    } else {
        return res.status(403).json({ error: 'No referer header' });
    }

    // 从请求中获取 IP 地址
    const ipAddress = req.query.ip;
    if (!ipAddress) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    // 构建请求 ipinfo.io 的 URL
    const token = process.env.IPINFO_API_TOKEN;
    const url = `https://ipinfo.io/${ipAddress}?token=${token}`;

    https.get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                const modifiedJson = modifyJson(originalJson);
                res.json(modifiedJson);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

function modifyJson(json) {
    const { ip, city, region, country, loc, org, timezone } = json;

    // 拆分 loc 为 latitude 和 longitude
    const [latitude, longitude] = loc.split(',').map(Number);

    // 从 org 中提取 ASN 和 org 名称
    const [asn, ...orgName] = org.split(' ');
    const modifiedOrg = orgName.join(' ');

    return {
        ip,
        city,
        region,
        country,
        country_name: country,
        country_code: country,
        latitude,
        longitude,
        asn,
        org: modifiedOrg
    };
}
