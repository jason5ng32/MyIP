// /api/ipapiis — geolocation source handler backed by api.ipapi.is.
// Picks a random API key and normalizes the response into the canonical
// geo shape (plus an `extended` block) via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../server/geo-handler.js';
import { anyOf, buildExtended, buildMetric, detectedCode } from '../server/source-extended.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    const keys = (process.env.IPAPIIS_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://api.ipapi.is?q=${ipAddress}&key=${key}`;
}

// company.type → line type, consulted after the data-centre and mobile bits.
const COMPANY_LINE_TYPES = {
    hosting: 'hosting',
    isp: 'residential',
    business: 'business',
    education: 'business',
    government: 'business',
    banking: 'business',
};

const lineTypeOf = (json) => {
    if (json.is_datacenter === true) return 'hosting';
    if (json.is_mobile === true) return 'wireless';
    const type = json.company?.type;
    return typeof type === 'string' ? COMPANY_LINE_TYPES[type.trim().toLowerCase()] : undefined;
};

const extendedOf = (json) => buildExtended({
    lineType: lineTypeOf(json),
    anonymityCode: detectedCode(anyOf(json.is_tor, json.is_vpn, json.is_proxy)),
    abuse: detectedCode(anyOf(json.is_abuser)),
    metrics: [buildMetric('abuserScore', json.company?.abuser_score)],
});

// Both nested objects are optional: the upstream answers 200 with a null
// `location` (and no `asn`) for addresses it can't place — anycast ranges,
// bogons — so neither may be dereferenced directly.
export function modifyJsonForIPAPI(json) {
    const asn = json.asn || {};
    const location = json.location || {};
    const { ip } = json;
    const extended = extendedOf(json);

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
        ...(extended && { extended }),
    };
}

export default makeGeoHandler({ name: 'ipapi-is', buildUrl, normalize: modifyJsonForIPAPI });
