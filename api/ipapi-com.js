import { get } from 'http';
import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';

export default (req, res) => {
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

    // 构建请求 ip-api.com 的 URL
    const lang = req.query.lang || 'en';
    const url = `http://ip-api.com/json/${ipAddress}?fields=66842623&lang=${lang}`;

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                const modifiedJson = modifyJsonForIPAPI(originalJson);
                res.json(modifiedJson);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

function modifyJsonForIPAPI(json) {
    const { query, country, countryCode, regionName, city, lat, lon, isp, as } = json;
    const asn = as ? as.split(" ")[0] : '';

    return {
        ip: query,
        city,
        region: regionName,
        country: countryCode,
        country_name: country,
        country_code: countryCode,
        latitude: lat,
        longitude: lon,
        asn,
        org: isp
    };
}
