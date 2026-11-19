// Locale-free codes of an IP card's extended fields: carried by a geo
// source's `extended` block (common/ip-extended.js), whitelisted by the report
// builders and validated by common/report-schema.js.

// Anonymity verdicts; `detected` is a yes that names no kind.
export const ANONYMITY_CODES = [
    'tor', 'relay', 'residential', 'suspected_residential',
    'proxy', 'proxy_suspected', 'vpn', 'vpn_suspected', 'detected', 'none',
];

// Line types; an unknown type has no code.
export const IP_TYPE_CODES = ['business', 'residential', 'wireless', 'hosting'];

// Abuse activity levels (the reputation dimension); `detected` is a yes without a frequency.
export const ABUSE_LEVELS = ['none', 'low', 'medium', 'high', 'detected'];

// Scenario friction (`extended.scenarios`): scenario ids in display order
// and their levels.
export const SCENARIO_FRICTION_IDS = [
    'signup', 'payments', 'finance', 'streaming', 'availability',
    'browsing', 'posting', 'crossBorderSocial', 'automation', 'email',
];
export const SCENARIO_FRICTION_LEVELS = ['low', 'medium', 'high'];
