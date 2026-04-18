import { get } from 'https';

export default (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

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
