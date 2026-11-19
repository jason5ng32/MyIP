// Locale-free codes of an IP card's IPCheck.ing enrichments: made by
// frontend/utils/ip (transform-ip-data.js, scenario-friction.js), whitelisted
// by the report builders and validated by common/report-schema.js.

// Anonymity verdicts.
export const ANONYMITY_CODES = [
    'tor', 'relay', 'residential', 'suspected_residential',
    'proxy', 'proxy_suspected', 'vpn', 'vpn_suspected', 'none',
];

// Line types; an unknown type has no code.
export const IP_TYPE_CODES = ['business', 'residential', 'wireless', 'hosting'];

// Abuse activity levels (the reputation dimension).
export const ABUSE_LEVELS = ['none', 'low', 'medium', 'high'];

// Scenario friction (`advancedData.scenarios`): scenario ids in display order
// and their levels.
export const SCENARIO_FRICTION_IDS = [
    'signup', 'payments', 'finance', 'streaming', 'availability',
    'browsing', 'posting', 'crossBorderSocial', 'automation', 'email',
];
export const SCENARIO_FRICTION_LEVELS = ['low', 'medium', 'high'];
