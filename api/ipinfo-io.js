// /api/ipinfo — geolocation source handler backed by ipinfo.io.
// With a token it asks the lookup API (canonical geo shape plus an `extended`
// block); a token that API refuses with 403 is answered by, and from then on
// sent to, the legacy endpoint (flat fields only). Without a token it uses the
// legacy endpoint unauthenticated.

import getCountryName from '../common/country-name.js';
import { fetchUpstream } from '../common/fetch-with-timeout.js';
import logger from '../server/logger.js';
import { anyOf, buildExtended, detectedCode } from '../server/source-extended.js';

// IPINFO_API_TOKEN is the pre-rename spelling — keep reading it so
// existing deployments don't lose the token on upgrade.
const configuredTokens = () => (process.env.IPINFO_API_KEY || process.env.IPINFO_API_TOKEN || '').split(',');

const pickToken = (tokens) => tokens[Math.floor(Math.random() * tokens.length)];

const legacyUrl = (ipAddress, token) => (token
    ? `https://ipinfo.io/${ipAddress}?token=${token}`
    : `https://ipinfo.io/${ipAddress}`);

const lookupUrl = (ipAddress) => `https://api.ipinfo.io/lookup/${ipAddress}`;

// Tokens the lookup API refused, kept to the ones still configured.
const legacyTokens = new Set();

const rememberLegacyToken = (token, tokens) => {
    for (const known of legacyTokens) {
        if (!tokens.includes(known)) legacyTokens.delete(known);
    }
    legacyTokens.add(token);
};

// Parse one half of `loc`. Blank and non-numeric halves become null rather
// than the 0 Number() would hand back — 0 is a real coordinate.
const toCoordinate = (raw) => {
    const value = Number(raw);
    return raw?.trim() && Number.isFinite(value) ? value : null;
};

// Legacy endpoint answer. Every field is optional upstream: anycast ranges,
// bogons ({"bogon":true}) and degraded answers all come back 200 with `loc`,
// `org` or `country` missing, so nothing here may be split or dereferenced
// unguarded. Absent data degrades to null / empty while the canonical shape
// stays complete.
export const modifyJson = (json) => {
    const { ip, city, region, country, loc, org } = json || {};

    const countryName = getCountryName(country, 'en') || 'Unknown Country';

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

// as.type → line type, consulted after the hosting and mobile bits.
const AS_LINE_TYPES = {
    hosting: 'hosting',
    isp: 'residential',
    business: 'business',
    education: 'business',
    government: 'business',
};

const objectOf = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const lineTypeOf = (json) => {
    if (json.is_hosting === true) return 'hosting';
    if (json.is_mobile === true) return 'wireless';
    const type = objectOf(json.as).type;
    return typeof type === 'string' ? AS_LINE_TYPES[type.trim().toLowerCase()] : undefined;
};

const extendedOf = (json) => {
    const anonymous = objectOf(json.anonymous);
    const anonymizer = anyOf(
        json.is_anonymous, anonymous.is_vpn, anonymous.is_proxy, anonymous.is_tor,
        anonymous.is_relay, anonymous.is_res_proxy,
    );
    return buildExtended({ lineType: lineTypeOf(json), anonymityCode: detectedCode(anonymizer) });
};

const numberOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const textOr = (value, fallback) => (typeof value === 'string' ? value : fallback);

// Lookup API answer: geography under `geo`, the network under `as`; any key may be absent.
export const modifyLookupJson = (json) => {
    const body = objectOf(json);
    const geo = objectOf(body.geo);
    const as = objectOf(body.as);
    const countryCode = textOr(geo.country_code, null);
    const extended = extendedOf(body);

    return {
        ip: textOr(body.ip, null),
        city: textOr(geo.city, null),
        region: textOr(geo.region, null),
        country: countryCode,
        country_name: getCountryName(countryCode, 'en') || 'Unknown Country',
        country_code: countryCode,
        latitude: numberOrNull(geo.latitude),
        longitude: numberOrNull(geo.longitude),
        asn: textOr(as.asn, ''),
        org: textOr(as.name, ''),
        ...(extended && { extended }),
    };
};

const failure = (status) => new Error(`Upstream responded ${status}`);

// Asks the lookup API; null when it refuses the token (403), so the caller falls back.
const fetchLookup = async (ipAddress, token) => {
    const apiRes = await fetchUpstream(lookupUrl(ipAddress), { headers: { Authorization: `Bearer ${token}` } });
    if (apiRes.status === 403) {
        apiRes.body?.cancel().catch(() => {});
        return null;
    }
    if (!apiRes.ok) throw failure(apiRes.status);
    return modifyLookupJson(await apiRes.json());
};

const fetchLegacy = async (ipAddress, token) => {
    // Outage / gateway pages come back as HTML — fail on status first.
    const apiRes = await fetchUpstream(legacyUrl(ipAddress, token));
    if (!apiRes.ok) throw failure(apiRes.status);
    return modifyJson(await apiRes.json());
};

export default async (req, res) => {
    // Validated and publicly routable, guaranteed by requirePublicIP.
    const ipAddress = req.query.ip;
    const tokens = configuredTokens();
    const token = pickToken(tokens);

    try {
        if (token && !legacyTokens.has(token)) {
            const answer = await fetchLookup(ipAddress, token);
            if (answer) {
                res.json(answer);
                return;
            }
            rememberLegacyToken(token, tokens);
            logger.info('ipinfo-io: a token has no lookup API access, using the legacy endpoint for it');
        }
        res.json(await fetchLegacy(ipAddress, token));
    } catch (e) {
        logger.error({ err: e, ip: ipAddress }, 'ipinfo-io handler failed');
        res.status(500).json({ error: e.message });
    }
};
