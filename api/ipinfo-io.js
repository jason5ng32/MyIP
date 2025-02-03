import { get } from 'https';
import { isValidIP } from '../common/valid-ip.js';
import { refererCheck } from '../common/referer-check.js';
import countryLookup from 'country-code-lookup';

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

    // 构建请求 ipinfo.io 的 URL
    const tokens = (process.env.IPINFO_API_TOKEN || '').split(',');
    const token = tokens[Math.floor(Math.random() * tokens.length)];

    const url_hasToken = `https://ipinfo.io/${ipAddress}?token=${token}`;
    const url_noToken = `https://ipinfo.io/${ipAddress}`;
    const url = token ? url_hasToken : url_noToken;

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', async () => {
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
    const { ip, city, region, country, loc, org } = json;

    const countryName = countryLookup.byIso(country).country || 'Unknown Country';

    const [latitude, longitude] = loc.split(',').map(Number);
    const [asn, ...orgName] = org.split(' ');
    const modifiedOrg = orgName.join(' ');

    return {
        ip,
        city,
        region,
        country,
        country_name: countryName,
        country_code: country,
        latitude,
        longitude,
        asn,
        org: modifiedOrg
    };
}
