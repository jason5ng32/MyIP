// Derives the IANA timezone of an IP-geolocation result from the coordinates
// that same result reports, so the timezone can never contradict the city and
// country rendered beside it — a card reading "Los Angeles / Asia/Tokyo"
// because a second database disagreed about where the IP lives.
//
// This is the timezone *of a looked-up IP*. The visitor's own browser timezone
// is a separate concern living in frontend/utils/time-utils.js.
//
// Only the zone name travels to the client. The UTC offset is rendered
// frontend-side from this name: geo routes sit behind a 24h edge cache, and a
// cached offset would be an hour wrong for everyone from a DST switch until
// the entry expired.

import tzlookup from '@photostructure/tz-lookup';

// Sources spell a missing coordinate as 'N/A', null, '' or omit it. Number()
// turns null and '' into 0, which is a real point in the Gulf of Guinea, so
// coercion alone would invent a timezone — accept numbers and numeric strings
// only, and reject everything else outright.
const toCoordinate = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

// `Etc/*` is what the lookup returns for open water. Reaching it means the
// source's coordinates are unusable, not that the IP sits in a UTC-fixed zone.
const isOpenWaterZone = (zone) => zone.startsWith('Etc/');

/**
 * Resolve coordinates to an IANA zone name, or '' when they can't be trusted.
 */
export const lookupTimeZone = (latitude, longitude) => {
    const lat = toCoordinate(latitude);
    const lon = toCoordinate(longitude);

    if (lat === null || lon === null) {
        return '';
    }

    try {
        const zone = tzlookup(lat, lon);
        return isOpenWaterZone(zone) ? '' : zone;
    } catch {
        // Out-of-range coordinates; the source's position data is broken.
        return '';
    }
};

/**
 * Add `timezone` to a geo payload in place, always defined so the frontend has
 * one falsy check rather than a presence check. Payloads without usable
 * coordinates get '' — those responses carry no city either, so the card stays
 * consistent by omitting both.
 */
export const attachTimeZone = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }

    payload.timezone = lookupTimeZone(payload.latitude, payload.longitude);
    return payload;
};

/**
 * Route middleware that enriches a geo handler's response. Hooks res.json the
 * same way cacheable() does, and on the same 2xx condition, so error bodies
 * never grow the field. Handlers stay unaware of it; a new geo source inherits
 * the field by adding this middleware to its route in backend-server.js.
 */
export const withTimeZone = () => (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (res.statusCode < 400) {
            attachTimeZone(body);
        }
        return originalJson(body);
    };
    next();
};
