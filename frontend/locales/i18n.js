import { createI18n } from 'vue-i18n';
import { PREFS_STORAGE_KEY } from '../data/default-preferences.js';
import {
  LOCALE_CODES,
  FALLBACK_LOCALE,
  fallbackChain,
  matchLocale,
  toHtmlLang,
} from '../utils/locale-registry.js';

// Locale messages are loaded on demand so the first-paint path carries only the
// language actually in use. Bundling all four eagerly cost ~44 KB gzipped of dead
// weight (three unused locales). Switching language persists the choice and
// re-boots the app (Preferences.prefLanguage → setLanguage() on next load), so
// only ONE locale is ever active per page load — main.js loads it before mount.
//
// NOTE: the security-checklist datasets (security-checklist/*.json) are likewise
// kept off this path — that tool loads its own locale's dataset on demand
// (see SecurityChecklist.vue).
//
// Packs are discovered by glob, the registry decides which of them the UI
// offers. The glob is a Vite build-time macro, and the Node test runner
// imports this module for real (through store.js) — hence the guard.
let localePacks = {};
try {
  localePacks = import.meta.glob('./*.json');
} catch { /* not running under Vite */ }
const localeLoaders = Object.fromEntries(
  LOCALE_CODES
    .filter((code) => localePacks[`./${code}.json`])
    .map((code) => [code, localePacks[`./${code}.json`]]),
);

const supportedLanguages = Object.keys(localeLoaders);

// Read the saved language from the current prefs key. The key comes from
// default-preferences.js so it stays in step with what store.js writes.
function readStoredLang() {
  const raw = localStorage.getItem(PREFS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const prefs = JSON.parse(raw);
    if (supportedLanguages.includes(prefs?.lang)) return prefs.lang;
  } catch { /* malformed entry — fall through to the default pick */ }
  return null;
}

// Stored preference → ?hl= → browser language → en. Both tags go through
// matchLocale, so a regional one (?hl=zh-CN, a zh-TW browser) lands on the
// closest pack instead of dropping to English.
const setLanguage = () => {
  const storedLang = readStoredLang();
  if (storedLang) return storedLang;

  const hl = new URLSearchParams(window.location.search).get('hl');
  if (hl) return matchLocale(hl, supportedLanguages) || FALLBACK_LOCALE;

  const browserLanguage = navigator.language || navigator.userLanguage;
  return matchLocale(browserLanguage, supportedLanguages) || FALLBACK_LOCALE;
};

const activeLocale = setLanguage();

// Per-locale fallback chains; only regional variants need one of their own
// (zh-TW → zh → en), everything else takes the default.
const fallbackLocale = Object.fromEntries(
  LOCALE_CODES
    .map((code) => [code, fallbackChain(code).slice(1)])
    .filter(([, chain]) => chain.length > 1),
);
fallbackLocale.default = [FALLBACK_LOCALE];

// Messages are empty at startup, injected by loadActiveLocaleMessages.
// A beta locale ships an incomplete pack by design, so a key resolving down
// the chain is normal — the warnings would be noise.
const i18n = createI18n({
  legacy: false,
  locale: activeLocale,
  fallbackLocale,
  missingWarn: false,
  fallbackWarn: false,
  messages: {},
});

// Load one locale's messages into the instance (memoized).
const loaded = new Set();
async function loadOne(locale) {
  if (loaded.has(locale) || !localeLoaders[locale]) return;
  const { default: msgs } = await localeLoaders[locale]();
  i18n.global.setLocaleMessage(locale, msgs);
  loaded.add(locale);
}

// Load the active locale's whole fallback chain — vue-i18n can only fall back
// to messages that are actually in the instance. Awaited in main.js before
// mount so the first render is already translated; the loads run in parallel.
export async function loadActiveLocaleMessages() {
  await Promise.all(fallbackChain(activeLocale).map((code) => loadOne(code)));
  updateMeta();
}

// Update meta tags (depends on messages, so call after loadActiveLocaleMessages).
function updateMeta() {
  // Keep the declared page language in step with the rendered one.
  // index.html ships lang="en"; leaving that stale on a zh/fr/ru UI makes
  // browser auto-translate mis-detect the page and offer to re-translate
  // already-translated content (Chrome-iOS translate churn crashes on the
  // home page's high-frequency DOM updates). Also what screen readers key on.
  // htmlLang is the precise tag: zh declares zh-CN so Han glyph fallback stays
  // Simplified on ja / zh-TW systems.
  document.documentElement.lang = toHtmlLang(activeLocale);

  document.title = i18n.global.t('page.title');

  const metaKeywords = document.querySelector('meta[name="keywords"]');
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaKeywords) {
      metaKeywords.setAttribute('content', i18n.global.t('page.keywords'));
  }
  if (metaDescription) {
      metaDescription.setAttribute('content', i18n.global.t('page.description'));
  }
}

export default i18n;
