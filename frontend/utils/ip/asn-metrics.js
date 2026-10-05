// Pure shaping of the Radar ASN summary (`/api/cfradar?view=asn`) for the
// traffic-share bars and the connection-quality grid (AsnTrafficShares.vue,
// AsnConnectionQuality.vue). The backend sends both pre-formatted as strings
// ('95.35%', '312.4 Mbps').

// '95.35%' / 95.35 → 95.35 (two decimals); missing or unparseable → null.
export const parsePercentage = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(String(value).replace('%', ''));
    return isNaN(num) ? null : parseFloat(num.toFixed(2));
};

// Bar order; labels double as the ipInfos.ASNInfo.* i18n keys.
const TRAFFIC_PAIRS = [
    { leftLabel: 'IPv4_Pct', rightLabel: 'IPv6_Pct' },
    { leftLabel: 'HTTP_Pct', rightLabel: 'HTTPS_Pct' },
    { leftLabel: 'Desktop_Pct', rightLabel: 'Mobile_Pct' },
    { leftLabel: 'Human_Pct', rightLabel: 'Bot_Pct' },
];

// DataPairBar props per pair; a pair is dropped unless both sides parse.
export const buildTrafficPairs = (info) => {
    if (!info) return [];
    return TRAFFIC_PAIRS.flatMap(({ leftLabel, rightLabel }) => {
        const leftValue = parsePercentage(info[leftLabel]);
        const rightValue = parsePercentage(info[rightLabel]);
        if (leftValue === null || rightValue === null) return [];
        return [{ leftLabel, rightLabel, leftValue, rightValue }];
    });
};

const QUALITY_KEYS = ['speedDownload', 'speedUpload', 'latency', 'jitter'];

// The quality fields present (truthy) on `info`, in display order.
export const pickConnectionQuality = (info) => {
    const picked = {};
    if (!info) return picked;
    for (const key of QUALITY_KEYS) {
        if (info[key]) picked[key] = info[key];
    }
    return picked;
};
