import { get } from 'https';
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

    const keys = (process.env.IP2LOCATION_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    const url = `https://api.ip2location.io/?ip=${ipAddress}&key=${key}`;

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
    let asn = json.asn || {};
    const { ip, country_code, country_name, region_name, city_name, latitude, longitude, as } = json;

    return {
        ip: ip,
        city: city_name || 'N/A',
        region: region_name || 'N/A',
        country: country_code || 'N/A',
        country_name: country_name || 'N/A',
        country_code: country_code || 'N/A',
        latitude: latitude || 'N/A',
        longitude: longitude || 'N/A',
        asn: asn === undefined || asn === null ? 'N/A' : 'AS' + asn,
        org: as || 'N/A',
    };
}
