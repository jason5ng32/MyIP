// /api/ipinfo — geolocation source handler backed by ipinfo.io.
// Picks a random API token (when configured) and normalizes the response
// into the canonical geo shape via the shared makeGeoHandler factory.

import countryLookup from 'country-code-lookup';
import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    // Build request URL for ipinfo.io
    const tokens = (process.env.IPINFO_API_TOKEN || '').split(',');
    const token = tokens[Math.floor(Math.random() * tokens.length)];

    const url_hasToken = `https://ipinfo.io/${ipAddress}?token=${token}`;
    const url_noToken = `https://ipinfo.io/${ipAddress}`;
    return token ? url_hasToken : url_noToken;
}

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

export default makeGeoHandler({ name: 'ipinfo-io', buildUrl, normalize: modifyJson });
