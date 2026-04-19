import { fetchUpstream } from '../common/fetch-with-timeout.js';

export default async (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

    // Build request URL for ip-api.com
    const lang = req.query.lang || 'en';
    const url = `http://ip-api.com/json/${ipAddress}?fields=66842623&lang=${lang}`;

    try {
        const apiRes = await fetchUpstream(url);
        const json = await apiRes.json();
        res.json(modifyJsonForIPAPI(json));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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
