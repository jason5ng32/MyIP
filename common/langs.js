// Shared language allow-list for handlers that accept a ?lang query param.
// Each consumer keeps its own default; pickLang validates against this list.

export const SUPPORTED_LANGS = ['zh-CN', 'en', 'fr', 'tr'];

// Return raw if it's a supported language, otherwise the given fallback.
export function pickLang(raw, fallback) {
    return SUPPORTED_LANGS.includes(raw) ? raw : fallback;
}
