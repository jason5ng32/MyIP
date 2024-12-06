import { createI18n } from 'vue-i18n';


import en from './en.json';
import zh from './zh.json';
import fr from './fr.json';


const messages = { en, zh, fr };
const supportedLanguages = Object.keys(messages);

// 设置语言
function setLanguage() {
  let locale = 'en';
  let storedPreferences = localStorage.getItem('userPreferences');
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


const i18n = createI18n({
  legacy: false,
  locale: setLanguage(),
  fallbackLocale: 'en',
  messages,
});

function updateMeta() {
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

updateMeta();
export default i18n;
