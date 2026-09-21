// Pure helpers for the per-section info-banner slot (components/widgets/
// InfoBanner.vue). Every homepage section owns one fixed slot, served by
// one data file: frontend/data/banners/<section>.js (e.g. ipinfo.js serves
// <InfoBanner section="ipinfo" />). The file default-exports either `null`
// (slot explicitly off), one plain object, or an array of up to TWO objects.
// No imports, so the plain Node test runner can load it:
//
//   {
//     id: 'vps',                   // unique across all data files
//     icon: 'Server',              // lucide icon NAME (string, no import);
//                                  // dict in InfoBanner.vue: Globe, Megaphone,
//                                  // Server, Shield, Sparkles, Zap —
//                                  // unknown/absent falls back to Megaphone
//     track: 'IPInfoVPS',          // campaign id — the label on the
//                                  // BannerClick_<section> analytics event
//     copy: { en: { title, note, cta, pricing }, zh: { … }, … }, // wording: en
//                                  // required, other langs optional,
//                                  // fallback is en; pricing is optional,
//                                  // e.g. 'Starting from $2.99', or
//                                  // { prefix: 'From', amount: '$2.99',
//                                  //   suffix: '/ month' } for price hierarchy
//     color: 'info',              // optional theme token: info, action,
//                                  // success, warning, primary, destructive
//                                  // themes border, background, icon, sweep,
//                                  // and CTA; omitted keeps the original
//                                  // info card with an action-colored CTA
//     // Click target — exactly ONE of:
//     url: 'https://…',            // external: new tab, utm params appended
//     utm: { source: '…', … },     // with `url` only; keys WITHOUT the utm_
//                                  // prefix — bannerLink adds it, plus
//                                  // utm_content=<lang>
//     to: '/?tool=invisibilitytest', // internal: router.push target, no utm
//     sheet: 'pulse',              // internal: opens a store-managed side
//                                  // panel (store.setOpenSheet name)
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
// Campaign wording lives in `copy`, independent of locale packs.

export const BANNER_COLORS = ['info', 'action', 'success', 'warning', 'primary', 'destructive'];

// Theme tokens adapt to light/dark mode and carry a matching CTA foreground.
export const bannerTheme = (banner) => {
    const color = BANNER_COLORS.includes(banner?.color) ? banner.color : 'info';
    return { '--banner-color': `var(--${color})`, '--banner-foreground': `var(--${color}-foreground)` };
};

export const bannerShown = (banner, settled) => banner.requireSettled === false || settled;

// Banner wording for the active locale: the language block from the inline
// `copy` map, falling back to English. Always returns a renderable object so
// callers never branch on missing copy.
export const bannerCopy = (banner, lang) => {
    const copy = banner?.copy ?? {};
    return copy[lang] ?? copy.en ?? { title: '', note: '', cta: '' };
};

// Keep free-form campaign prices compatible; structured prices emphasize
// only the amount, without trying to parse currency or language-specific copy.
export const bannerPricing = (pricing) => {
    if (typeof pricing === 'string') return pricing.trim() ? { text: pricing } : null;
    if (!pricing || typeof pricing.amount !== 'string' || !pricing.amount.trim()) return null;
    if (['prefix', 'suffix'].some((key) => pricing[key] !== undefined && typeof pricing[key] !== 'string')) return null;
    return { prefix: pricing.prefix ?? '', amount: pricing.amount, suffix: pricing.suffix ?? '' };
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

// The banners for a section from an import.meta.glob modules map
// ({ path: module }): the file NAMED after the section is its slot —
// data/banners/ipinfo.js serves section "ipinfo". A missing file and a file
// default-exporting null/undefined both mean "no banner" (returns []). Older
// single-object files remain valid; extra entries never render beyond two.
export const pickBanners = (modules, section) => {
    for (const key of Object.keys(modules ?? {})) {
        const name = key.split('/').pop().replace(/\.js$/, '');
        if (name === section) {
            const data = modules[key]?.default;
            if (data == null) return [];
            return Array.isArray(data) ? data.slice(0, 2) : [data];
        }
    }
    return [];
};
