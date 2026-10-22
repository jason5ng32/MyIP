// Builds a docs.ipcheck.ing link: English lives at the section root, every
// other locale under `/<section>/<locale>/`, with `path` appended after that.

const DOCS_ORIGIN = 'https://docs.ipcheck.ing';

const trimSlashes = (value) => String(value ?? '').replace(/^\/+|\/+$/g, '');

export const docsUrl = (section, locale, path = '') => {
    const base = `${DOCS_ORIGIN}/${trimSlashes(section)}/`;
    const lang = !locale || locale === 'en' ? '' : `${trimSlashes(locale)}/`;
    return base + lang + String(path ?? '').replace(/^\/+/, '');
};
