import { fetchUpstream } from '../common/fetch-with-timeout.js';

export default async (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

    const url = `https://api.ip.sb/geoip/${ipAddress}`;

    try {
        const apiRes = await fetchUpstream(url);
        const json = await apiRes.json();
        res.json(modifyJsonForIPSB(json));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
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