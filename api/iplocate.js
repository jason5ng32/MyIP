// /api/iplocate — geolocation source handler backed by iplocate.io.
// Picks a random API key and normalizes the response into the canonical
// geo shape (plus an `extended` block) via the shared makeGeoHandler factory.

import { makeGeoHandler } from '../server/geo-handler.js';
import { anyOf, buildExtended, detectedCode } from '../server/source-extended.js';

// Whether a key is set; /api/configs reports it as the `iplocate` flag.
export const isConfigured = () => Boolean(process.env.IPLOCATE_IO_API_KEY);

const buildUrl = (req) => {
    const ipAddress = req.query.ip;

    const keys = (process.env.IPLOCATE_IO_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    return `https://iplocate.io/api/lookup/${ipAddress}?apikey=${key}`;
};

// "AS64500" or a bare 64500 → "AS64500"; anything else → N/A.
const asnOf = (value) => {
    const text = typeof value === 'number' ? String(value) : (typeof value === 'string' ? value.trim() : '');
    const digits = /^(?:AS)?(\d+)$/i.exec(text)?.[1];
    return digits ? `AS${digits}` : 'N/A';
};

// company.type, then asn.type → line type, consulted after the hosting bit.
const TYPE_LINE_TYPES = {
    hosting: 'hosting',
    isp: 'residential',
    business: 'business',
    education: 'business',
    government: 'business',
};

const lineTypeFrom = (type) => (typeof type === 'string' ? TYPE_LINE_TYPES[type.trim().toLowerCase()] : undefined);

const lineTypeOf = (json, privacy) => {
    if (privacy.is_hosting === true) return 'hosting';
    return lineTypeFrom(json.company?.type) ?? lineTypeFrom(json.asn?.type);
};

const extendedOf = (json) => {
    const privacy = json.privacy || {};
    return buildExtended({
        lineType: lineTypeOf(json, privacy),
        anonymityCode: detectedCode(anyOf(
            privacy.is_vpn, privacy.is_proxy, privacy.is_tor, privacy.is_icloud_relay, privacy.is_anonymous,
        )),
        abuse: detectedCode(anyOf(privacy.is_abuser)),
    });
};

// `asn`, `privacy`, `company` and `hosting` may each be absent or null.
export const modifyJsonForIPLocate = (json) => {
    const asn = json.asn || {};
    const extended = extendedOf(json);

    return {
        ip: json.ip,
        city: json.city || 'N/A',
        region: json.subdivision || 'N/A',
        country: json.country_code || 'N/A',
        country_name: json.country || 'N/A',
        country_code: json.country_code || 'N/A',
        latitude: json.latitude ?? 'N/A',
        longitude: json.longitude ?? 'N/A',
        asn: asnOf(asn.asn),
        org: asn.name || 'N/A',
        ...(extended && { extended }),
    };
};

export default makeGeoHandler({ name: 'iplocate', buildUrl, normalize: modifyJsonForIPLocate });
