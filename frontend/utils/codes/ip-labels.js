// IP card code → the card's own i18n key, one map per code list in ip.js:
// the card (transform-ip-data.js), the report page, the Persona
// Check and the Snapshots diff all label through these.

// Anonymity verdicts.
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

// Line types; a type without a code reads as IP_TYPE_UNKNOWN_KEY.
export const IP_TYPE_I18N_KEYS = Object.freeze({
    business: 'ipInfos.advancedData.type.Business',
    residential: 'ipInfos.advancedData.type.Residential',
    wireless: 'ipInfos.advancedData.type.Wireless',
    hosting: 'ipInfos.advancedData.type.Hosting',
});
export const IP_TYPE_UNKNOWN_KEY = 'ipInfos.advancedData.type.unknownType';

// Abuse activity levels.
export const ABUSE_LEVEL_I18N_KEYS = Object.freeze({
    none: 'ipInfos.abuseLevel.none',
    low: 'ipInfos.abuseLevel.low',
    medium: 'ipInfos.abuseLevel.medium',
    high: 'ipInfos.abuseLevel.high',
});
