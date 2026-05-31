// /api/ip2location — geolocation source handler backed by api.ip2location.io.
// Picks a random API key and normalizes the response into the canonical
// geo shape via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    const keys = (process.env.IP2LOCATION_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://api.ip2location.io/?ip=${ipAddress}&key=${key}`;
}

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

export default makeGeoHandler({ name: 'ip2location-io', buildUrl, normalize: modifyJsonForIPAPI });
