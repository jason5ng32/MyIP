// Central registry of the languages the UI ships. Adding one = a locale pack
// plus a line here. Front end imports it via `@/utils/locale-registry.js`.
//
// One exception stays hand-maintained: the backend's `?lang` allow-list
// (common/langs.js) — the private upstream's tolerance for unknown tags is
// unverified.

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

export const getLocale = (code) => LOCALES.find((locale) => locale.code === code);

// Both mappings pass an unregistered code through rather than blanking it.
export const toApiTag = (code) => getLocale(code)?.apiTag ?? code;

export const toHtmlLang = (code) => getLocale(code)?.htmlLang ?? code;

// Exact match first, base language second — `zh-TW` prefers a zh-TW pack and
// only falls back to `zh` when there is none.
export const matchLocale = (tag, codes = LOCALE_CODES) => {
    if (!tag) return null;
    const wanted = String(tag).toLowerCase();
    const exact = codes.find((code) => code.toLowerCase() === wanted);
    if (exact) return exact;
    const base = wanted.split('-')[0];
    return codes.find((code) => code.toLowerCase() === base) ?? null;
};
