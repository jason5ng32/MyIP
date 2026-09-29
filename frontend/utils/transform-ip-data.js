import getCountryName from '../data/country-name.js';

// The static map renders at zoom 3 (continent scale), where ~0.176° spans a
// single pixel. Quantizing the request coords to 1 decimal (~0.1°, sub-pixel)
// leaves the marker visually unchanged while collapsing every IP in the same
// 0.1° grid cell onto one CF edge-cache key — the cache key is the client URL,
// so this rounding must happen here, not in the backend handler. The full-
// precision lat/lon are still kept on baseData for display.
function mapCoord(value) {
    return Number(value).toFixed(1);
}

// Parse IP data
function transformDataFromIPapi(data, ipGeoSource, t, mapLanguage) {
    if (data.error) {
        throw new Error(data.reason);
    }

    const hasCoords = data.latitude && data.longitude;
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
        latitude: data.latitude || "",
        longitude: data.longitude || "",
        timezone: data.timezone || "",
        isp: data.org || "",
        asn: data.asn || "",
        asnlink: data.asn ? data.asn.startsWith('AS') ? `https://bgp.tools/as/${data.asn}` : false : false,
        mapUrl: hasCoords ? `/api/map?latitude=${mapLat}&longitude=${mapLon}&language=${mapLanguage}` : "",
        mapUrl_dark: hasCoords ? `/api/map?latitude=${mapLat}&longitude=${mapLon}&language=${mapLanguage}&CanvasMode=Dark` : ""
    };

    if (ipGeoSource === 0) {
        const advancedData = extractAdvancedData(data.advancedData, t);
        return {
            ...baseData,
            ...advancedData,
        };
    }

    return baseData;
};

// Gated sentinels the backend may substitute for the real advanced fields:
// signed-out visitors get 'sign_in_required', over-quota users get
// 'quota_exceeded'. Both propagate as-is so the UI can pick the right CTA.
const gatedSentinel = (value) =>
    value === 'sign_in_required' || value === 'quota_exceeded' ? value : null;

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

// Anonymity verdict code → display text key: one map for the card and the
// report renderer (ReportIpinfo.vue), so the two can't disagree. The codes
// themselves live in the report schema (ANONYMITY_CODES).
export const ANONYMITY_I18N_KEYS = {
    tor: 'ipInfos.anonymity.tor',
    relay: 'ipInfos.anonymity.relay',
    residential: 'ipInfos.anonymity.residential',
    suspected_residential: 'ipInfos.anonymity.suspectedResidential',
    proxy: 'ipInfos.anonymity.proxy',
    proxy_suspected: 'ipInfos.anonymity.proxySuspected',
    vpn: 'ipInfos.anonymity.vpn',
    vpn_suspected: 'ipInfos.anonymity.vpnSuspected',
    none: 'ipInfos.anonymity.none',
};

// Anonymizing service / protocol the API named: null when absent or gated.
const optionalName = (value) => (typeof value === 'string' && value && !gatedSentinel(value) ? value : null);

// Parse the advanced (IPCheck.ing-only) fields
function extractAdvancedData(advancedData = {}, t) {
    const anonymityCode = determineAnonymityCode(advancedData);
    const anonymity = gatedSentinel(advancedData.tags) || t(ANONYMITY_I18N_KEYS[anonymityCode]);
    const type = determineType(advancedData, t);
    const qualityScore = gatedSentinel(advancedData.score) || advancedData.score;
    const anonymityProvider = optionalName(advancedData.anonymityProvider);
    const anonymityProtocol = optionalName(advancedData.anonymityProtocol);
    const isNativeIP = gatedSentinel(advancedData.tags) || advancedData.tags.isNative;

    // Locale-free twins of anonymity / type for the diagnostic report payload
    // (the display fields above are t()-localized at capture time; the report
    // schema only stores enums and renders in the VIEWER's language).
    const ipTypeCode = determineTypeCode(advancedData);

    // Raw inputs for the score-details panel (utils/ip-score-details.js);
    // undefined when gated.
    const scoreTags = isPlainObject(advancedData.tags) ? advancedData.tags : undefined;
    const scoreDimensions = isPlainObject(advancedData.dimensions) ? advancedData.dimensions : undefined;
    const scoreVersion = Number.isFinite(advancedData.scoreVersion) ? advancedData.scoreVersion : undefined;

    return {
        anonymity, anonymityCode, anonymityProvider, anonymityProtocol,
        type, qualityScore, isNativeIP, ipTypeCode,
        scoreTags, scoreDimensions, scoreVersion,
    };
}

// Locale-free anonymity verdict; undefined when gated (the report then omits
// it). Tor and iCloud Private Relay first, then the public anonymity class,
// flagged only when several independent sources agree ('multi'). A
// residential proxy only our sighting history reports stays suspected.
function determineAnonymityCode(advancedData) {
    const tags = advancedData.tags;
    if (gatedSentinel(tags)) return undefined;
    const anonymity = advancedData.dimensions?.anonymity;
    const cls = isPlainObject(anonymity) ? anonymity.class : null;
    const multi = isPlainObject(anonymity) && anonymity.sources === 'multi';
    if (tags.isTor) return 'tor';
    if (tags.isRelay) return 'relay';
    if (tags.isAnyAnonymizer && cls === 'residential_proxy') return 'residential';
    if (cls === 'proxy') return multi ? 'proxy' : 'proxy_suspected';
    if (cls === 'vpn') return multi ? 'vpn' : 'vpn_suspected';
    if (tags.isResidentialProxy) return 'suspected_residential';
    return 'none';
}

// Locale-free code for determineType.
function determineTypeCode(advancedData) {
    if (gatedSentinel(advancedData.operatorType)) return undefined;
    const codes = { Business: 'business', Residential: 'residential', Wireless: 'wireless', Hosting: 'hosting' };
    return codes[advancedData.operatorType] ?? 'unknown';
}

// Determine proxy type
function determineType(advancedData, t) {
    if (gatedSentinel(advancedData.operatorType)) {
        return advancedData.operatorType;
    }
    switch (advancedData.operatorType) {
        case 'Business':
            return t('ipInfos.advancedData.type.Business');
        case 'Residential':
            return t('ipInfos.advancedData.type.Residential');
        case 'Wireless':
            return t('ipInfos.advancedData.type.Wireless');
        case 'Hosting':
            return t('ipInfos.advancedData.type.Hosting');
        default:
            return t('ipInfos.advancedData.type.unknownType');
    }
}

export { transformDataFromIPapi, extractAdvancedData };