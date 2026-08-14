import { createI18n } from 'vue-i18n';
import { PREFS_STORAGE_KEY } from '../data/default-preferences.js';

// Locale messages are loaded on demand so the first-paint path carries only the
// language actually in use. Bundling all four eagerly cost ~44 KB gzipped of dead
// weight (three unused locales). Switching language persists the choice and
// re-boots the app (Preferences.prefLanguage → setLanguage() on next load), so
// only ONE locale is ever active per page load — main.js loads it before mount.
//
// NOTE: the security-checklist datasets (security-checklist/*.json) are likewise
// kept off this path — that tool loads its own locale's dataset on demand
// (see SecurityChecklist.vue).
const localeLoaders = {
  en: () => import('./en.json'),
  zh: () => import('./zh.json'),
  fr: () => import('./fr.json'),
  ru: () => import('./ru.json'),
};

const supportedLanguages = Object.keys(localeLoaders);
const FALLBACK_LOCALE = 'en';

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

// Set language.
function setLanguage() {
  const storedLang = readStoredLang();
  if (storedLang) return storedLang;

  let locale = 'en';
  const searchParams = new URLSearchParams(window.location.search);
  const browserLanguage = navigator.language || navigator.userLanguage;
  const hl = searchParams.get('hl');
  if (hl && supportedLanguages.includes(hl)) {
    locale = hl;
  } else if (!hl) {
      const bl = browserLanguage.substring(0, 2);
      if (supportedLanguages.includes(bl)) {
        locale = bl;
      } else {
        locale = 'en';
      }
  }
  return locale;
}

const activeLocale = setLanguage();

// Create i18n instance (messages are empty at startup, injected by loadActiveLocaleMessages).
const i18n = createI18n({
  legacy: false,
  locale: activeLocale,
  fallbackLocale: FALLBACK_LOCALE,
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

// Load the active locale (plus the fallback, so a missing key still resolves to
// English instead of showing the raw key). Awaited in main.js before mount so the
// first render is already translated. The two loads run in parallel.
export async function loadActiveLocaleMessages() {
  await Promise.all([
    loadOne(activeLocale),
    activeLocale === FALLBACK_LOCALE ? null : loadOne(FALLBACK_LOCALE),
  ]);
  updateMeta();
}

// Update meta tags (depends on messages, so call after loadActiveLocaleMessages).
function updateMeta() {
  // Keep the declared page language in step with the rendered one.
  // index.html ships lang="en"; leaving that stale on a zh/fr/ru UI makes
  // browser auto-translate mis-detect the page and offer to re-translate
  // already-translated content (Chrome-iOS translate churn crashes on the
  // home page's high-frequency DOM updates). Also what screen readers key on.
  // Our zh locale is Simplified-only: declare zh-CN so Han glyph fallback
  // stays Simplified on ja / zh-TW systems and translate prompts treat the
  // content unambiguously. The other locale codes are precise as-is.
  document.documentElement.lang = activeLocale === 'zh' ? 'zh-CN' : activeLocale;

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
