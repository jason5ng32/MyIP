// Preference overrides from the URL (the `override` rows of data/url-params.js):
// a query string → `{ <preference key>: value }`, valid values only (an
// invalid one is no override), and a route query without the parameters of
// dropped overrides. index.html and vite.config.js carry inline twins of the
// `hl` / `theme` reads, held in step by tests.

import { URL_OVERRIDE_PARAMS } from '../data/url-params.js';
import { IP_DATABASES } from '../data/ip-databases.js';
import { LOCALE_CODES, matchLocale } from './locale-registry.js';
import { THEME_OPTIONS, IP_CARDS_OPTIONS } from './preferences-schema.js';

const DIGITS = /^\d+$/;

// One parser per overridable preference: the raw parameter value → a valid
// preference value, or undefined. `ctx` may narrow the locale codes / sources.
export const URL_OVERRIDE_PARSERS = Object.freeze({
  lang: (raw, { localeCodes = LOCALE_CODES } = {}) => matchLocale(raw, localeCodes) ?? undefined,
  theme: (raw) => THEME_OPTIONS.find((option) => option === raw.toLowerCase()),
  ipGeoSource: (raw, { ipDBs = IP_DATABASES } = {}) => ipDBs.find((db) => db.slug === raw.toLowerCase())?.id,
  ipCardsToShow: (raw) => (DIGITS.test(raw) ? IP_CARDS_OPTIONS.find((count) => count === Number(raw)) : undefined),
});

export const readUrlOverrides = (search = '', ctx = {}) => {
  const params = new URLSearchParams(search);
  const overrides = {};
  for (const { name, preference } of URL_OVERRIDE_PARAMS) {
    const raw = params.get(name)?.trim();
    if (!raw) continue;
    const value = URL_OVERRIDE_PARSERS[preference](raw, ctx);
    if (value !== undefined) overrides[preference] = value;
  }
  return overrides;
};

// The parameter that overrides `preference`, or null.
export const overrideParamOf = (preference) =>
  URL_OVERRIDE_PARAMS.find((param) => param.preference === preference)?.name ?? null;

// `query` without the parameters of these preference keys, or null when it
// carries none of them.
export const queryWithoutOverrides = (query = {}, preferences = []) => {
  const names = preferences.map(overrideParamOf).filter((name) => name && Object.hasOwn(query, name));
  if (!names.length) return null;
  return Object.fromEntries(Object.entries(query).filter(([name]) => !names.includes(name)));
};
