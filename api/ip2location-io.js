import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

export default async (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

    const keys = (process.env.IP2LOCATION_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    const url = `https://api.ip2location.io/?ip=${ipAddress}&key=${key}`;

    try {
        const apiRes = await fetchUpstream(url);
        const json = await apiRes.json();
        res.json(modifyJsonForIPAPI(json));
    } catch (e) {
        logger.error({ err: e, ip: ipAddress }, 'ip2location-io handler failed');
        res.status(500).json({ error: e.message });
    }
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
