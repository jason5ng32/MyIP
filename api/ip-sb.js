import { get } from 'https';

export default (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

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