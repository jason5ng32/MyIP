// Pure helpers for the per-section info-banner slot (components/widgets/
// InfoBanner.vue). Every homepage section owns one fixed slot, served by
// one data file: frontend/data/banners/<section>.js (e.g. ipinfo.js serves
// <InfoBanner section="ipinfo" />). The file default-exports either `null`
// (slot explicitly off) or ONE plain object — no imports, so the plain Node
// test runner can load it:
//
//   {
//     id: 'vps',                   // unique across all data files
//     icon: 'Server',              // lucide icon NAME (string, no import);
//                                  // dict in InfoBanner.vue: Globe, Megaphone,
//                                  // Server, Shield, Sparkles, Zap —
//                                  // unknown/absent falls back to Megaphone
//     track: 'IPInfoVPS',          // campaign id — the label on the
//                                  // BannerClick_<section> analytics event
//     copy: { en: { title, note, cta }, zh: { … }, … },  // wording: en
//                                  // required, other langs optional,
//                                  // fallback is en
//     // Click target — exactly ONE of:
//     url: 'https://…',            // external: new tab, utm params appended
//     utm: { source: '…', … },     // with `url` only; keys WITHOUT the utm_
//                                  // prefix — bannerLink adds it, plus
//                                  // utm_content=<lang>
//     to: '/?tool=invisibilitytest', // internal: router.push target, no utm
//     requireSettled: true,        // default true when absent: wait for the
//                                  // section's own tests (the parent's
//                                  // `settled` prop) before showing; set
//                                  // false to show immediately
//     transition: true,            // default true when absent: fade-slide
//                                  // appear/disappear; set false for an
//                                  // instant swap
//     sweep: true,                 // optional: border light sweep on entering
//                                  // the viewport; default false
//   }
//
// Banner wording is data by design — the inline `copy` map is the ONLY
// wording form, never locale-pack keys: banners are per-campaign deploy-time
// data files, not product UI, and must ride along without touching locales/.

// Banner wording for the active locale: the language block from the inline
// `copy` map, falling back to English. Always returns a renderable object so
// callers never branch on missing copy.
export const bannerCopy = (banner, lang) => {
    const copy = banner?.copy ?? {};
    return copy[lang] ?? copy.en ?? { title: '', note: '', cta: '' };
};

// External landing URL with utm_* attribution: each `utm` key gains the utm_
// prefix, and utm_content carries the visitor's locale so campaigns see which
// language surface converted. Existing query params on `url` are preserved.
export const bannerLink = (banner, lang) => {
    const url = new URL(banner.url);
    for (const [key, value] of Object.entries(banner.utm ?? {})) {
        url.searchParams.set(`utm_${key}`, String(value));
    }
    url.searchParams.set('utm_content', lang);
    return url.toString();
};

// The banner for a section from an import.meta.glob modules map
// ({ path: module }): the file NAMED after the section is its slot —
// data/banners/ipinfo.js serves section "ipinfo". A missing file and a file
// default-exporting null/undefined both mean "no banner" (returns null).
export const pickBanner = (modules, section) => {
    for (const key of Object.keys(modules ?? {})) {
        const name = key.split('/').pop().replace(/\.js$/, '');
        if (name === section) return modules[key]?.default ?? null;
    }
    return null;
};
