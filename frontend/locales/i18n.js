import { createI18n } from 'vue-i18n';

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
  tr: () => import('./tr.json'),
  fa: () => import('./fa.json'),
};

const supportedLanguages = Object.keys(localeLoaders);
const FALLBACK_LOCALE = 'en';

// 设置语言
function setLanguage() {
  let locale = 'en';
  // Keep in sync with PREFS_STORAGE_KEY in frontend/store.js — both must read
  // from the same versioned key so an old value doesn't mislead the i18n
  // initialization into a previously-chosen language after we bumped defaults.
  let storedPreferences = localStorage.getItem('userPreferences_v6');
  storedPreferences = storedPreferences ? JSON.parse(storedPreferences) : {};
  if (supportedLanguages.includes(storedPreferences.lang)) {
    locale = storedPreferences.lang;
    return locale;
  }
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

// 创建 i18n 实例（messages 启动时为空，由 loadActiveLocaleMessages 注入）
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

// Languages that require right-to-left layout.
const RTL_LOCALES = new Set(['fa', 'ar', 'he']);

// 更新 meta 标签（依赖 messages，故在 loadActiveLocaleMessages 之后调用）
function updateMeta() {
  document.title = i18n.global.t('page.title');

  // Set dir and lang on <html> for RTL support.
  const locale = i18n.global.locale.value ?? i18n.global.locale;
  document.documentElement.lang = locale;
  document.documentElement.dir = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';

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
