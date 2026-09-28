// Score-details panel for IPCheck.ing results (IpDetailPanel): a plain-
// language explanation of the quality score, built as a list of i18n
// sentences, and the attribute rows below it. Pure — no Vue, no fetch.
//
// Inputs are the transformed card fields (transform-ip-data.js): `scoreTags`,
// `scoreDimensions`, `qualityScore`, `isp`, `asn`, `ip`. Gated responses (or
// any without `dimensions`) yield nothing.

const KEY = 'ipInfos.scoreDetails';

const LEVELS = new Set(['none', 'low', 'medium', 'high']);
const ANONYMITY_KEYS = { tor: 'tor', relay: 'relay', residential_proxy: 'residentialProxy' };

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isIsoDay = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

// Residential proxy seen only in our own sighting history: no other source
// agrees (isAnyAnonymizer stays false), so the copy says "suspected".
export const isSuspectedResidentialProxy = (tags) =>
    isPlainObject(tags) && tags.isResidentialProxy === true && tags.isAnyAnonymizer !== true;

// Attribute rows in display order: network type, anonymity, then behaviour
// and other. Left out: isBogon (meaningless for the public IPs looked up
// here), isAnyAnonymizer (only summarises the anonymity rows) and isBenignBot.
export const SCORE_TAG_KEYS = [
    'isDatacenter', 'isResidential', 'isMobile', 'isSatellite',
    'isProxy', 'isVPN', 'isResidentialProxy', 'isRelay', 'isTor',
    'isAbuser', 'isCrawler', 'isNative',
];

// Boolean tags as { key, state }: 'yes' / 'no', or 'suspected' for a
// residential proxy only our sighting history reports.
export const listScoreTags = (tags) => {
    if (!isPlainObject(tags)) return [];
    const suspected = isSuspectedResidentialProxy(tags);
    return SCORE_TAG_KEYS
        .filter((key) => typeof tags[key] === 'boolean')
        .map((key) => ({
            key,
            state: key === 'isResidentialProxy' && suspected ? 'suspected' : tags[key] ? 'yes' : 'no',
        }));
};

// Same cut-offs as the score bar's colour tiers.
export const scoreRiskTier = (score) => {
    if (score >= 80) return 'lowRisk';
    if (score >= 50) return 'mediumRisk';
    return 'highRisk';
};

// One sentence per dimension, each { key, params }. Empty unless the card
// carries the v3 `dimensions` block and a numeric score. `t` translates the
// fallback operator name; `formatDate` renders a YYYY-MM-DD day.
export const buildScoreExplanation = (data, { t = (key) => key, formatDate = (day) => day } = {}) => {
    const dims = data?.scoreDimensions;
    const rawScore = data?.qualityScore;
    const score = typeof rawScore === 'number' || /^\d+(\.\d+)?$/.test(rawScore ?? '') ? Number(rawScore) : NaN;
    if (!isPlainObject(dims) || !Number.isFinite(score)) return [];

    const tags = isPlainObject(data.scoreTags) ? data.scoreTags : {};
    const sentences = [];
    const add = (key, params = {}) => sentences.push({ key: `${KEY}.explain.${key}`, params });

    // Summary: who runs it + the verdict.
    const org = data.isp || '';
    const asn = data.asn || '';
    const operator = org && asn ? `${org} (${asn})` : org || asn || t(`${KEY}.explain.unknownOperator`);
    add(`summary.${scoreRiskTier(score)}`, { ip: data.ip || '', operator, score: String(Math.round(score)) });

    // Network type.
    if (tags.isDatacenter === true) add('network.datacenter');
    else if (tags.isMobile === true) add('network.mobile');
    else add('network.isp');

    // Anonymity class, then when it was last observed. A suspected residential
    // proxy carries its date in the one sentence.
    const anonymity = isPlainObject(dims.anonymity) ? dims.anonymity : null;
    if (anonymity) {
        const cls = anonymity.class;
        const suspected = cls === 'residential_proxy' && isSuspectedResidentialProxy(tags);
        if (suspected) {
            if (isIsoDay(anonymity.lastSeen)) {
                add('anonymity.residentialProxySuspected', { date: formatDate(anonymity.lastSeen) });
            } else {
                add('anonymity.residentialProxySuspectedUndated');
            }
        } else if (cls === 'vpn' || cls === 'proxy') {
            // No counts in the copy: only single vs multiple sources.
            add(`anonymity.${cls}${anonymity.sources === 'multi' ? 'Multi' : 'Single'}`);
        } else if (ANONYMITY_KEYS[cls]) {
            add(`anonymity.${ANONYMITY_KEYS[cls]}`);
        } else if (cls == null) {
            add('anonymity.none');
        }
        if (cls != null && !suspected && isIsoDay(anonymity.lastSeen)) {
            add('anonymityLastSeen', { date: formatDate(anonymity.lastSeen) });
        }
    }

    // Reputation (abuse evidence), dated by the latest report when there is one.
    const reputation = isPlainObject(dims.reputation) ? dims.reputation : null;
    if (reputation && LEVELS.has(reputation.level)) {
        if (reputation.level !== 'none' && isIsoDay(reputation.lastSeen)) {
            add(`reputation.${reputation.level}Dated`, { date: formatDate(reputation.lastSeen) });
        } else {
            add(`reputation.${reputation.level}`);
        }
    }

    // ASN neighbourhood.
    const network = isPlainObject(dims.network) ? dims.network : null;
    if (network && LEVELS.has(network.level)) add(`asn.${network.level}`);

    return sentences;
};
