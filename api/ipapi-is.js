// /api/ipapiis — geolocation source handler backed by api.ipapi.is.
// Picks a random API key and normalizes the response into the canonical
// geo shape (plus isHosting / isProxy) via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    const keys = (process.env.IPAPIIS_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://api.ipapi.is?q=${ipAddress}&key=${key}`;
}

// Both nested objects are optional: the upstream answers 200 with a null
// `location` (and no `asn`) for addresses it can't place — anycast ranges,
// bogons — so neither may be dereferenced directly.
export function modifyJsonForIPAPI(json) {
    const asn = json.asn || {};
    const location = json.location || {};
    const { ip, is_datacenter, is_proxy, is_vpn, is_tor } = json;

    return {
        ip: ip,
        city: location.city || 'N/A',
        region: location.state || 'N/A',
        country: location.country_code || 'N/A',
        country_name: location.country || 'N/A',
        country_code: location.country_code || 'N/A',
        latitude: location.latitude || 'N/A',
        longitude: location.longitude || 'N/A',
        asn: asn.asn === undefined ? 'N/A' : 'AS' + asn.asn,
        org: asn.org || 'N/A',
        isHosting: is_datacenter || false,
        isProxy: is_proxy || is_vpn || is_tor || false
    };
}

export default makeGeoHandler({ name: 'ipapi-is', buildUrl, normalize: modifyJsonForIPAPI });
