// /api/ipinfo — geolocation source handler backed by ipinfo.io.
// Picks a random API token (when configured) and normalizes the response
// into the canonical geo shape via the shared makeGeoHandler factory.

import countryLookup from 'country-code-lookup';
import { makeGeoHandler } from '../common/geo-handler.js';

function buildUrl(req) {
    const ipAddress = req.query.ip;

    // Build request URL for ipinfo.io.
    // IPINFO_API_TOKEN is the pre-rename spelling — keep reading it so
    // existing deployments don't lose the token on upgrade.
    const tokens = (process.env.IPINFO_API_KEY || process.env.IPINFO_API_TOKEN || '').split(',');
    const token = tokens[Math.floor(Math.random() * tokens.length)];

    const url_hasToken = `https://ipinfo.io/${ipAddress}?token=${token}`;
    const url_noToken = `https://ipinfo.io/${ipAddress}`;
    return token ? url_hasToken : url_noToken;
}

// Parse one half of `loc`. Blank and non-numeric halves become null rather
// than the 0 Number() would hand back — 0 is a real coordinate.
const toCoordinate = (raw) => {
    const value = Number(raw);
    return raw?.trim() && Number.isFinite(value) ? value : null;
};

// Every field is optional upstream: anycast ranges, bogons ({"bogon":true})
// and degraded answers all come back 200 with `loc`, `org` or `country`
// missing, so nothing here may be split or dereferenced unguarded. Absent
// data degrades to null / empty while the canonical shape stays complete.
export const modifyJson = (json) => {
    const { ip, city, region, country, loc, org } = json || {};

    // byIso returns null for an unknown or absent code.
    const countryName = countryLookup.byIso(country)?.country || 'Unknown Country';

    // "37.4056,-122.0775" — a partial or non-numeric pair degrades to null.
    const [rawLat, rawLon] = typeof loc === 'string' ? loc.split(',') : [];
    const latitude = toCoordinate(rawLat);
    const longitude = toCoordinate(rawLon);

    // "AS15169 Google LLC" — leading token is the ASN, the rest the org name.
    const [asn = '', ...orgName] = typeof org === 'string' ? org.split(' ') : [];

    return {
        ip: ip ?? null,
        city: city ?? null,
        region: region ?? null,
        country: country ?? null,
        country_name: countryName,
        country_code: country ?? null,
        latitude,
        longitude,
        asn,
        org: orgName.join(' ')
    };
};

export default makeGeoHandler({ name: 'ipinfo-io', buildUrl, normalize: modifyJson });
