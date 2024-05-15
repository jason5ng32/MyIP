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

    // 构建请求 keycdn.com 的 URL
    const url = new URL(`https://tools.keycdn.com/geo.json?host=${ipAddress}`);

    // 设置请求选项，包括 User-Agent
    const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
            'User-Agent': 'keycdn-tools:' + process.env.KEYCDN_USER_AGENT
        }
    };

    get(options, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                const modifiedJson = modifyJsonForKeyCDN(originalJson);
                res.json(modifiedJson);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
}

function modifyJsonForKeyCDN(json) {
    const { data: { geo: { ip, city, region_name, country_name, country_code, latitude, longitude, isp, asn } } } = json;

    return {
        ip,
        city,
        region: region_name ? region_name : city,
        country: country_code,
        country_name,
        country_code,
        latitude,
        longitude,
        asn: "AS" + asn,
        org: isp
    };
}