// /api/ipapi — geolocation source handler backed by ip-api.com.
// Forwards the optional ?lang and normalizes the response into the
// canonical geo shape via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    // Build request URL for ip-api.com
    const lang = req.query.lang || 'en';
    const url = `http://ip-api.com/json/${ipAddress}?fields=66842623&lang=${lang}`;
    return { url, logContext: { lang } };
}

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

export default makeGeoHandler({ name: 'ipapi-com', buildUrl, normalize: modifyJsonForIPAPI });
