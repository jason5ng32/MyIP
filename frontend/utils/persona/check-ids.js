// The vocabulary the Persona Check report is rendered from — the contract
// between this front end and the API that evaluates the observation. What
// comes back is ids, enums and detail fields; every one needs copy here, and
// `tests/persona-i18n.test.js` checks the four locales against these lists.
// A new id or field upstream lands here, translated, in the same change.

// Every check the report can carry a row for, in registry order.
export const PERSONA_CHECK_IDS = [
    'ip-country',
    'webrtc-leak',
    'dns-resolver-country',
    'asn-type',
    'timezone-vs-persona',
    'language-match',
    'script-fonts',
    'speech-voices',
    'keyboard-layout',
    'edge-geo-consensus',
    'intl-number-format',
    'intl-date-format',
    'intl-hour-cycle',
    'gps-location',
    'payment-region',
    'accept-language-header',
    'ip-timezone-vs-browser',
    'timezone-authenticity',
];

// What a check concluded. Rendered as the row's state label and colour.
export const VERDICT = {
    MATCH: 'match',           // observed value fits the declared persona
    MISMATCH: 'mismatch',     // observed value contradicts the persona
    LEAK: 'leak',             // a channel exposed the real identity outright
    UNNATURAL: 'unnatural',   // internally inconsistent — reads as "being spoofed"
    UNKNOWN: 'unknown',       // the data is missing but obtainable — run the test
    NOT_APPLICABLE: 'not-applicable', // no conclusion is possible or needed here
};

// Which of the three questions a check answers.
export const AXIS = {
    MATCH: 'match',           // do I look like the target country?
    COHERENCE: 'coherence',   // does my browser contradict itself?
    LEAK: 'leak',             // is my real identity escaping?
};

// Who actually gets to see the signal — what a finding's priority hangs on.
export const VISIBILITY = {
    PUBLIC: 'public',         // any site sees it without trying
    PROBED: 'probed',         // needs an active probe (WebRTC, font enumeration)
    RISK_ENGINE: 'risk-engine', // only anti-fraud stacks look this deep
};

export const GRADE = { A: 'A', B: 'B', C: 'C', D: 'D', UNKNOWN: 'unknown' };

// Scalar fields a result's `detail` can carry. The report renders each one as
// a labelled badge, so each needs a `personacheck.detail.<key>` entry.
// Two fields are deliberately absent: `reason` rides on no-answer verdicts
// and is rendered from the `personacheck.reason.*` namespace; `agreement`
// annotates the `actual` value itself ("US · 4/6") rather than earning its
// own badge.
export const PERSONA_DETAIL_KEYS = [
    'accuracyMetres',
    'actual',
    'actualLayout',
    'actualOffset',
    'browserOffset',
    'browserZone',
    'candidateCount',
    'cardIssuer',
    'cardNetwork',
    'cardTier',
    'cardType',
    'colo',
    'demoted',
    'disputed',
    'expected',
    'expectedLanguages',
    'expectedLayout',
    'expectedOffset',
    'expectedScripts',
    'gpsTimezone',
    'headerLanguages',
    'headerPrimary',
    'installedScripts',
    'ipOffset',
    'ipType',
    'ipZone',
    'matching',
    'primary',
    'primaryExpected',
    'reportedOffset',
    'sameOffset',
    'samples',
    'scriptPrimary',
    'timeZone',
    'v4',
    'v6',
    'voiceCount',
    'voiceLanguages',
    'zoneOffset',
];

// Why a check concluded that nothing can be measured. Every not-applicable
// result carries its reason into the report; unknown results keep theirs
// internal ("run the missing test" is the same advice either way) — except
// the ones below, where the visitor's next move differs per reason.
export const PERSONA_NOT_APPLICABLE_REASONS = [
    'font-probe-unavailable',
    'geolocation-unsupported',
    'keyboard-api-unavailable',
    'no-layout-expectation',
    'no-marker-script',
    'no-persona-languages',
    'no-voice-packs',
];

// Unknown-verdict reasons that DO render copy: a card prefix the upstream did
// not know is most often a typo (check the digits), while a failed lookup is
// our service's fault (try later) — generic "not measured" would hide which.
export const PERSONA_UNKNOWN_REASONS = [
    'bin-lookup-failed',
    'bin-not-recognized',
];
