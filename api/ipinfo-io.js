import countryLookup from 'country-code-lookup';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../common/logger.js';

export default async (req, res) => {
    // IP presence + validity guaranteed by requireValidIP middleware.
    const ipAddress = req.query.ip;

    // Build request URL for ipinfo.io
    const tokens = (process.env.IPINFO_API_TOKEN || '').split(',');
    const token = tokens[Math.floor(Math.random() * tokens.length)];

    const url_hasToken = `https://ipinfo.io/${ipAddress}?token=${token}`;
    const url_noToken = `https://ipinfo.io/${ipAddress}`;
    const url = token ? url_hasToken : url_noToken;

    try {
        const apiRes = await fetchUpstream(url);
        const json = await apiRes.json();
        res.json(modifyJson(json));
    } catch (e) {
        logger.error({ err: e, ip: ipAddress }, 'ipinfo-io handler failed');
        res.status(500).json({ error: e.message });
    }
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
