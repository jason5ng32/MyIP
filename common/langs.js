// Shared language allow-list for handlers that accept a ?lang query param.
// Each consumer keeps its own default; pickLang validates against this list.

// Mirrors the apiTag column of common/locale-registry.js by hand, not by
// derivation: a new locale lands here only once the upstream is confirmed to
// accept its tag. Unknown values — including stale clients still sending
// lang=tr — fall back to the caller's default via pickLang.
export const SUPPORTED_LANGS = ['zh-CN', 'en', 'fr', 'ru'];

// Return raw if it's a supported language, otherwise the given fallback.
export function pickLang(raw, fallback) {
    return SUPPORTED_LANGS.includes(raw) ? raw : fallback;
}
