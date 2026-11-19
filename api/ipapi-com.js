// /api/ipapicom — geolocation source handler backed by ip-api.com.
// Forwards the optional ?lang and normalizes the response into the
// canonical geo shape (plus an `extended` block) via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../server/geo-handler.js';
import { anyOf, buildExtended, detectedCode } from '../server/source-extended.js';

// The upstream fields requested by name.
const FIELDS = [
    'status', 'message', 'country', 'countryCode', 'regionName', 'city',
    'lat', 'lon', 'isp', 'as', 'mobile', 'proxy', 'hosting', 'query',
].join(',');

function buildUrl(req) {
    const ipAddress = req.query.ip;

    // Build request URL for ip-api.com
    const lang = req.query.lang || 'en';
    const url = `http://ip-api.com/json/${ipAddress}?fields=${FIELDS}&lang=${lang}`;
    return { url, logContext: { lang } };
}

const lineTypeOf = (json) => {
    if (json.hosting === true) return 'hosting';
    if (json.mobile === true) return 'wireless';
    return undefined;
};

const extendedOf = (json) => buildExtended({
    lineType: lineTypeOf(json),
    anonymityCode: detectedCode(anyOf(json.proxy)),
});

export const modifyJsonForIpApiCom = (json) => {
    const { query, country, countryCode, regionName, city, lat, lon, isp, as } = json;
    const asn = as ? as.split(" ")[0] : '';
    const extended = extendedOf(json);

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
        org: isp,
        ...(extended && { extended }),
    };
};

export default makeGeoHandler({ name: 'ipapi-com', buildUrl, normalize: modifyJsonForIpApiCom });
