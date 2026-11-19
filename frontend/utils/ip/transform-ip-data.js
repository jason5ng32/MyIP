import getCountryName from '../country-name.js';
import { orderScenarios } from './scenario-friction.js';
import { isValidExtended } from './ip-extended.js';
import { ANONYMITY_I18N_KEYS, IP_TYPE_I18N_KEYS, IP_TYPE_UNKNOWN_KEY } from '../codes/ip-labels.js';

// The static map renders at zoom 3 (continent scale), where ~0.176° spans a
// single pixel. Quantizing the request coords to 1 decimal (~0.1°, sub-pixel)
// leaves the marker visually unchanged while collapsing every IP in the same
// 0.1° grid cell onto one CF edge-cache key — the cache key is the client URL,
// so this rounding must happen here, not in the backend handler. The full-
// precision lat/lon are still kept on baseData for display.
function mapCoord(value) {
    return Number(value).toFixed(1);
}

// A usable coordinate: a finite number or numeric string, 0 included; 'N/A', '' and null are not.
const isCoord = (value) => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== ''))
    && Number.isFinite(Number(value));

// Parse IP data
function transformDataFromIPapi(data, t, mapLanguage) {
    if (data.error) {
        throw new Error(data.reason);
    }

    const hasCoords = isCoord(data.latitude) && isCoord(data.longitude);
    const mapLat = hasCoords ? mapCoord(data.latitude) : "";
    const mapLon = hasCoords ? mapCoord(data.longitude) : "";

    const baseData = {
        // Country display name is derived from the code locally (CLDR via
        // getCountryName) so every geo source shows the same, UI-language
        // name; the upstream's own string is only a fallback for payloads
        // without a usable code.
        country_name: getCountryName(data.country, mapLanguage) || data.country_name || "",
        country_code: data.country === 'N/A' ? '' : data.country,
        region: data.region || "",
        city: data.city || "",
        latitude: data.latitude ?? "",
        longitude: data.longitude ?? "",
        timezone: data.timezone || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? data.asn.startsWith('AS') ? `https://bgp.tools/as/${data.asn}` : false : false,
        mapUrl: hasCoords ? `/api/map?latitude=${mapLat}&longitude=${mapLon}&language=${mapLanguage}` : "",
        mapUrl_dark: hasCoords ? `/api/map?latitude=${mapLat}&longitude=${mapLon}&language=${mapLanguage}&CanvasMode=Dark` : ""
    };

    return { ...baseData, ...extendedFields(data.extended, t) };
};

// Every key extendedFields adds to a card: a card reset to its defaults
// clears them, so a later answer from another source can't inherit them.
export const ADVANCED_CARD_FIELDS = Object.freeze([
    'extendedGate',
    'anonymity', 'anonymityCode', 'anonymityProvider', 'anonymityProtocol',
    'type', 'qualityScore', 'isNativeIP', 'ipTypeCode', 'abuseLevel',
    'flags', 'scoreDimensions', 'frictionScenarios', 'sourceMetrics',
]);

// True when a card carries a gate or any extended field (false and 0 count).
export const hasExtendedFields = (card) =>
    Boolean(card) && ADVANCED_CARD_FIELDS.some((key) => card[key] != null);

// Card fields from the answer's `extended` block (common/ip-extended.js):
// none for a missing or malformed block, only `extendedGate` for a gated one.
// `anonymity` / `type` are localized here; the codes beside them are locale-free.
const extendedFields = (extended, t) => {
    if (!isValidExtended(extended)) return {};
    const fields = Object.fromEntries(ADVANCED_CARD_FIELDS.map((key) => [key, undefined]));
    if (extended.gate) return { ...fields, extendedGate: extended.gate };

    const { anonymity, lineType, scoreDetails } = extended;
    return {
        ...fields,
        anonymity: anonymity && t(ANONYMITY_I18N_KEYS[anonymity.code]),
        anonymityCode: anonymity?.code,
        anonymityProvider: anonymity?.provider ?? null,
        anonymityProtocol: anonymity?.protocol ?? null,
        type: lineType && t(IP_TYPE_I18N_KEYS[lineType] ?? IP_TYPE_UNKNOWN_KEY),
        ipTypeCode: lineType,
        isNativeIP: extended.native,
        qualityScore: extended.score,
        abuseLevel: extended.abuse,
        flags: extended.flags,
        scoreDimensions: scoreDetails?.dimensions,
        frictionScenarios: orderScenarios(extended.scenarios),
        sourceMetrics: extended.metrics,
    };
};

export { transformDataFromIPapi };
