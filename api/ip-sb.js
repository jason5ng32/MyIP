import { get } from 'https';
import { isValidIP } from '../common/valid-ip.js';

export default (req, res) => {
    const ipAddress = req.query.ip;
    if (!ipAddress) {
        return res.status(400).json({ error: 'No IP address provided' });
    }

    // 检查 IP 地址是否合法
    if (!isValidIP(ipAddress)) {
        return res.status(400).json({ error: 'Invalid IP address' });
    }

    const url = new URL(`https://api.ip.sb/geoip/${ipAddress}`);

    get(url, apiRes => {
        let data = '';
        apiRes.on('data', chunk => data += chunk);
        apiRes.on('end', () => {
            try {
                const originalJson = JSON.parse(data);
                const modifiedJson = modifyJsonForIPSB(originalJson);
                res.json(modifiedJson);
            } catch (e) {
                res.status(500).json({ error: 'Error parsing JSON' });
            }
        });
    }).on('error', (e) => {
        res.status(500).json({ error: e.message });
    });
};

function modifyJsonForIPSB(json) {
    return {
        ip: json.ip,
        city: json.city,
        region: json.region ? json.region : json.city,
        country: json.country_code,
        country_name: json.country,
        country_code: json.country_code,
        latitude: json.latitude,
        longitude: json.longitude,
        asn: "AS" + json.asn,
        org: json.isp
    };
}