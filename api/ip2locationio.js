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

    // 构建请求 ip2location.io 的 URL
    const key = process.env.IP2LOCATIONIO_API_KEY;
    const url = `https://api.ip2location.io?ip=${ipAddress}&key=${key}`;

    https.get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                const modifiedJson = modifyJsonForIP2LocationIO(originalJson);
                res.json(modifiedJson);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

function modifyJsonForIP2LocationIO(json) {
    const { ip, country_code, country_name, region_name, city_name, latitude, longitude, zip_code, time_zone, asn, as, is_proxy } = json;

    return {
        ip,
        city_name,
        region_name,
        country: country_code,
        country_name,
        country_code,
        latitude,
        longitude,
        asn,
        org: ''
    };
}

