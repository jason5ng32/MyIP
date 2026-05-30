// /api/ipsb — geolocation source handler backed by api.ip.sb.
// Token-free upstream; normalizes the response into the canonical geo
// shape via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;
    return `https://api.ip.sb/geoip/${ipAddress}`;
}

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

export default makeGeoHandler({ name: 'ip-sb', buildUrl, normalize: modifyJsonForIPSB });
