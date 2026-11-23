// /api/bigdatacloud — geolocation source handler backed by api-bdc.net (BigDataCloud).
// Picks a random API key, forwards the optional ?lang as the locality language
// (the upstream falls back to English for a tag it doesn't know) and normalizes
// the response into the canonical geo shape (plus an `extended` block) via the
// shared makeGeoHandler factory.

import { makeGeoHandler } from '../server/geo-handler.js';
import { anyOf, buildExtended, detectedCode } from '../server/source-extended.js';

// Whether a key is set; /api/configs reports it as the `bigdatacloud` flag.
export const isConfigured = () => Boolean(process.env.BIGDATACLOUD_API_KEY);

const buildUrl = (req) => {
    const ipAddress = req.query.ip;
    const lang = req.query.lang || 'en';

    const keys = (process.env.BIGDATACLOUD_API_KEY).split(',');
    const key = keys[Math.floor(Math.random() * keys.length)];
    const url = 'https://api-bdc.net/data/ip-geolocation-full'
        + `?ip=${ipAddress}&localityLanguage=${encodeURIComponent(lang)}&key=${key}`;
    return { url, logContext: { lang } };
};

// "AS64500" or a bare 64500 → "AS64500"; anything else → N/A.
const asnOf = (value) => {
    const text = typeof value === 'number' ? String(value) : (typeof value === 'string' ? value.trim() : '');
    const digits = /^(?:AS)?(\d+)$/i.exec(text)?.[1];
    return digits ? `AS${digits}` : 'N/A';
};

// The ASN flag, then the cellular one; hostingLikelihood is not used (cellular ranges score high too).
const lineTypeOf = (hazard) => {
    if (hazard.isHostingAsn === true) return 'hosting';
    if (hazard.isCellular === true) return 'wireless';
    return undefined;
};

const extendedOf = (json) => {
    const hazard = json.hazardReport || {};
    return buildExtended({
        lineType: lineTypeOf(hazard),
        anonymityCode: detectedCode(anyOf(
            hazard.isKnownAsTorServer, hazard.isKnownAsVpn, hazard.isKnownAsProxy, hazard.iCloudPrivateRelay,
        )),
        abuse: detectedCode(anyOf(
            hazard.isSpamhausDrop, hazard.isSpamhausEdrop, hazard.isSpamhausAsnDrop,
            hazard.isBlacklistedUceprotect, hazard.isBlacklistedBlocklistDe,
        )),
    });
};

// Every nested object is optional: unroutable space answers 200 with nulls and no carriers.
export const modifyJsonForBigDataCloud = (json) => {
    const country = json.country || {};
    const location = json.location || {};
    const network = json.network || {};
    const carrier = (Array.isArray(network.carriers) && network.carriers[0]) || {};
    const extended = extendedOf(json);

    return {
        ip: json.ip,
        city: location.city || 'N/A',
        region: location.principalSubdivision || 'N/A',
        country: country.isoAlpha2 || 'N/A',
        country_name: country.name || 'N/A',
        country_code: country.isoAlpha2 || 'N/A',
        latitude: location.latitude ?? 'N/A',
        longitude: location.longitude ?? 'N/A',
        asn: asnOf(carrier.asn ?? carrier.asnNumeric),
        org: carrier.organisation || network.organisation || 'N/A',
        ...(extended && { extended }),
    };
};

export default makeGeoHandler({ name: 'bigdatacloud', buildUrl, normalize: modifyJsonForBigDataCloud });
