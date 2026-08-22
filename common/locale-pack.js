// Shape helpers for locale packs — the JSON trees under frontend/locales/.
//
// A beta pack is en's full skeleton with every untranslated value left as "",
// so a translation PR always reads as `"" → text` in the diff. "" is a
// source-level marker only: the Vite plugin in vite.config.js runs every pack
// through stripUntranslated() on the way into the bundle, so what the app ever
// sees has holes for the i18n fallback chain to fill — an untranslated value
// and an absent key are the same thing at runtime.

// path → leaf value, arrays flattened by index.
export const flattenPack = (value, prefix = '', out = new Map()) => {
    for (const [key, child] of Object.entries(value)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (child && typeof child === 'object') flattenPack(child, path, out);
        else out.set(path, child);
    }
    return out;
};

export const isUntranslated = (value) => typeof value === 'string' && value.trim() === '';

// Deep-copy `value` without its untranslated leaves; `undefined` means the
// whole node is untranslated and its parent should drop it too.
//
// An array is all-or-nothing: dropping one element would shift the rest, and
// the arrays here are rendered as a unit (paragraph runs, checklist items), so
// a single empty entry falls the whole array back to en.
export const stripUntranslated = (value) => {
    if (isUntranslated(value)) return undefined;
    if (Array.isArray(value)) {
        const kept = value.map(stripUntranslated);
        return kept.some((entry) => entry === undefined) ? undefined : kept;
    }
    if (value && typeof value === 'object') {
        const kept = Object.entries(value)
            .map(([key, child]) => [key, stripUntranslated(child)])
            .filter(([, child]) => child !== undefined);
        return kept.length === 0 ? undefined : Object.fromEntries(kept);
    }
    return value;
};

// stripUntranslated for a whole pack: an entirely untranslated one collapses to
// an empty container rather than `undefined`, so callers always get a pack.
export const stripPack = (pack) => stripUntranslated(pack) ?? (Array.isArray(pack) ? [] : {});
