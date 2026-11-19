// /api/ip2location — geolocation source handler backed by api.ip2location.io.
// Picks a random API key and normalizes the response into the canonical
// geo shape (plus an `extended` block) via the shared makeGeoHandler factory.
// Fields outside the key's plan are absent, and "-" stands for no value.

import { makeGeoHandler } from '../server/geo-handler.js';
import {
    anyOf, buildExtended, buildMetric, cleanText, detectedCode,
} from '../server/source-extended.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    const keys = (process.env.IP2LOCATION_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://api.ip2location.io/?ip=${ipAddress}&key=${key}`;
}

const PLACEHOLDERS = ['-'];

// usage_type codes → line type, checked data centre first, then mobile, then the rest.
const HOSTING_USAGE = ['DCH', 'CDN', 'SES'];
const OTHER_USAGE_LINE_TYPES = {
    ISP: 'residential',
    COM: 'business',
    ORG: 'business',
    GOV: 'business',
    MIL: 'business',
    EDU: 'business',
    LIB: 'business',
};

// usage_type may join several codes with "/" (e.g. "ISP/MOB").
const usageCodesOf = (json) => {
    const usage = cleanText(json.usage_type, PLACEHOLDERS);
    return usage === undefined ? undefined : usage.toUpperCase().split('/').map((code) => code.trim());
};

const lineTypeOf = (codes) => {
    if (!codes) return undefined;
    if (codes.some((code) => HOSTING_USAGE.includes(code))) return 'hosting';
    if (codes.includes('MOB')) return 'wireless';
    return codes.map((code) => OTHER_USAGE_LINE_TYPES[code]).find(Boolean);
};

const proxyOf = (json) => {
    const { proxy } = json;
    return proxy && typeof proxy === 'object' && !Array.isArray(proxy) ? proxy : undefined;
};

// Any anonymizer bit, the top-level is_proxy included; proxy_type is not an input.
const anonymizerOf = (json) => {
    const proxy = proxyOf(json) || {};
    return anyOf(
        json.is_proxy, proxy.is_vpn, proxy.is_tor, proxy.is_public_proxy, proxy.is_web_proxy,
        proxy.is_residential_proxy, proxy.is_consumer_privacy_network,
    );
};

const abuserOf = (json) => {
    const proxy = proxyOf(json) || {};
    return anyOf(proxy.is_spammer, proxy.is_scanner, proxy.is_botnet);
};

// fraud_score is a number out of 100; anything else is no metric.
const numericMetric = (id, value, max) => (typeof value === 'number' ? buildMetric(id, value, { max }) : undefined);

const extendedOf = (json) => buildExtended({
    lineType: lineTypeOf(usageCodesOf(json)),
    anonymityCode: detectedCode(anonymizerOf(json)),
    abuse: detectedCode(abuserOf(json)),
    metrics: [numericMetric('fraudScore', json.fraud_score, 100)],
});

// The upstream sends `asn` as bare digits (string), or nothing.
const asnOf = (value) => {
    const digits = typeof value === 'number' ? String(value) : cleanText(value, PLACEHOLDERS);
    return digits !== undefined && /^\d+$/.test(digits) ? 'AS' + digits : 'N/A';
};

export const modifyJsonForIp2Location = (json) => {
    const { ip, country_code, country_name, region_name, city_name, latitude, longitude, as } = json;
    const extended = extendedOf(json);

    return {
        ip: ip,
        city: city_name || 'N/A',
        region: region_name || 'N/A',
        country: country_code || 'N/A',
        country_name: country_name || 'N/A',
        country_code: country_code || 'N/A',
        latitude: latitude || 'N/A',
        longitude: longitude || 'N/A',
        asn: asnOf(json.asn),
        org: as || 'N/A',
        ...(extended && { extended }),
    };
};

export default makeGeoHandler({ name: 'ip2location-io', buildUrl, normalize: modifyJsonForIp2Location });
