// Central registry of the languages the UI ships. Adding one = a locale pack
// plus a line here. Front end imports it via `@/utils/locale-registry.js`.
//
// The back end takes no part in that: which languages upstream *data* comes in
// is a separate set owned by the source itself (SUPPORTED_LANGS in
// common/maxmind-service.js), and every `?lang` consumer resolves an unfamiliar
// tag onto its own family instead of rejecting it. A new UI locale is a
// front-end-only change.

// code=UI code + locale file name · apiTag=tag sent upstream ·
// htmlLang=<html lang> · status=full|beta
export const LOCALES = [
    { code: 'en', nativeName: 'English', flag: 'us', apiTag: 'en', htmlLang: 'en', status: 'full' },
    { code: 'zh', nativeName: '简体中文', flag: 'cn', apiTag: 'zh-CN', htmlLang: 'zh-CN', status: 'full' },
    { code: 'fr', nativeName: 'Français', flag: 'fr', apiTag: 'fr', htmlLang: 'fr', status: 'full' },
    { code: 'ru', nativeName: 'Русский', flag: 'ru', apiTag: 'ru', htmlLang: 'ru', status: 'full' },
];

// Registry order — also the order the language picker renders.
export const LOCALE_CODES = LOCALES.map((locale) => locale.code);

// Locales held to full coverage; beta ones may ship a partial pack.
export const FULL_LOCALE_CODES = LOCALES.filter((l) => l.status === 'full').map((l) => l.code);

export const FALLBACK_LOCALE = 'en';

export const getLocale = (code) => LOCALES.find((locale) => locale.code === code);

// Both mappings pass an unregistered code through rather than blanking it.
export const toApiTag = (code) => getLocale(code)?.apiTag ?? code;

export const toHtmlLang = (code) => getLocale(code)?.htmlLang ?? code;

// The chain a missing translation walks: variant → base → en. A base only
// joins the chain when it is registered. This is the single definition of the
// order — i18n, the privacy / checklist datasets and the changelog all use it.
export const fallbackChain = (code) => {
    const chain = [code];
    const base = String(code).split('-')[0];
    if (base !== code && LOCALE_CODES.includes(base)) chain.push(base);
    if (!chain.includes(FALLBACK_LOCALE)) chain.push(FALLBACK_LOCALE);
    return chain;
};

// Resolve a BCP-47 tag against `codes` in three steps: exact, then the base
// language, then any locale of that family (pt-PT → pt-BR), registry order
// deciding between siblings.
export const matchLocale = (tag, codes = LOCALE_CODES) => {
    if (!tag) return null;
    const wanted = String(tag).toLowerCase();
    const base = wanted.split('-')[0];
    return codes.find((code) => code.toLowerCase() === wanted)
        ?? codes.find((code) => code.toLowerCase() === base)
        ?? codes.find((code) => code.toLowerCase().split('-')[0] === base)
        ?? null;
};
