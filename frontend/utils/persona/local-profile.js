// What a local of country X plausibly speaks and which clock they read — the
// two lists the picker offers. Derived from Intl at call time, so choosing a
// country costs no request; the one gap CLDR has no Intl surface for comes
// from data/persona-tables.js. This is the picker's view only — the scoring
// baseline is built where the check runs.

import { EXTRA_LANGUAGES } from '../../data/persona-tables.js';

// Resolve a language + country pair to its CLDR-likely script (ISO 15924).
// The country matters: zh-CN maximizes to Hans, zh-HK to Hant.
const scriptOf = (language, country) => {
    try {
        return new Intl.Locale(`${language}-${country}`).maximize().script || '';
    } catch {
        return '';
    }
};

// The single most likely language of a country, per CLDR likelySubtags.
const primaryLanguageOf = (country) => {
    try {
        return new Intl.Locale(`und-${country}`).maximize().language || '';
    } catch {
        return '';
    }
};

// Uninhabited territories (BV, HM) legitimately have no zone — an empty list
// is data, not an error, and the tool renders it as "nothing to pick".
const timeZonesOf = (country) => {
    try {
        return (new Intl.Locale(`und-${country}`).getTimeZones() || []).slice().sort();
    } catch {
        return [];
    }
};

// Primary language first, then the multilingual-country additions, deduped.
// EXTRA_LANGUAGES entries may repeat the primary; the Set drops it.
const languagesOf = (country) => {
    const primary = primaryLanguageOf(country);
    const ordered = [primary, ...(EXTRA_LANGUAGES[country] || [])].filter(Boolean);
    return [...new Set(ordered)].map((language) => ({
        language,
        tag: `${language}-${country}`,
        script: scriptOf(language, country),
    }));
};

/**
 * Languages and timezones to offer for an ISO 3166-1 alpha-2 code.
 * An unknown code yields empty lists rather than throwing.
 */
export const localProfile = (rawCountry) => {
    const country = String(rawCountry || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(country)) return { country: '', languages: [], timeZones: [] };
    return { country, languages: languagesOf(country), timeZones: timeZonesOf(country) };
};
