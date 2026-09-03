// Loader for the optional per-locale datasets (privacy copy, the security
// checklist): JSON chunks discovered with import.meta.glob and fetched on
// demand for the active locale. One place owns the failure policy so every
// consumer behaves the same: a chunk that fails to load, or resolves without
// a default export, is skipped and the next locale on the fallback chain is
// tried; only when the whole chain fails does the caller get null.
//
//     const loaders = datasetLoaders(import.meta.glob('../locales/privacy/*.json'));
//     const pack = await loadLocaleDataset(loaders, locale.value, cache);
//     // pack → { code, data } | null

import { fallbackChain } from './locale-registry.js';

// glob result ({ '../locales/privacy/zh.json': loader }) → { zh: loader }.
export const datasetLoaders = (packs) => Object.fromEntries(
    Object.entries(packs).map(([path, loader]) => [path.match(/([^/]+)\.json$/)[1], loader]),
);

// `cache` (a Map, per consumer) memoizes loaded data by pack code, so a locale
// switch back to a seen language never refetches.
export const loadLocaleDataset = async (loaders, code, cache = new Map()) => {
    for (const candidate of fallbackChain(code)) {
        if (cache.has(candidate)) return { code: candidate, data: cache.get(candidate) };
        const load = loaders?.[candidate];
        if (typeof load !== 'function') continue;
        try {
            const data = (await load())?.default;
            if (!data) continue;
            cache.set(candidate, data);
            return { code: candidate, data };
        } catch (err) {
            console.warn(`Locale dataset "${candidate}" failed to load, trying the next fallback:`, err);
        }
    }
    return null;
};
