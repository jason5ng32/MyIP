// Localized country/region names via the built-in Intl.DisplayNames API.
// Names come from the runtime's CLDR/ICU data, so any ISO 3166-1 alpha-2 code
// resolves in any supported locale with zero maintenance and zero bundle weight.

const displayNamesCache = new Map();

const getDisplayNames = (lang) => {
    if (!displayNamesCache.has(lang)) {
        let displayNames = null;
        try {
            // fallback: 'none' → unknown-but-well-formed codes yield undefined
            // instead of echoing the code back, so callers get '' as before
            displayNames = new Intl.DisplayNames([lang], { type: 'region', fallback: 'none' });
        } catch {
            // malformed / unsupported locale — cache the null so we don't retry
        }
        displayNamesCache.set(lang, displayNames);
    }
    return displayNamesCache.get(lang);
};

const getCountryName = (abbr, lang) => {
    if (typeof abbr !== 'string' || typeof lang !== 'string') return '';
    const code = abbr.toUpperCase();
    // ZZ is the ISO "unknown region" placeholder; return '' so callers can fall back
    if (!/^[A-Z]{2}$/.test(code) || code === 'ZZ') return '';
    const displayNames = getDisplayNames(lang);
    return (displayNames && displayNames.of(code)) || '';
};

export default getCountryName;
