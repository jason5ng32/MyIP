import { createI18n } from 'vue-i18n';


import en from './en.json';
import zh from './zh.json';
import fr from './fr.json';


const messages = { en, zh, fr };

function setLanguage() {
  let locale = 'en';
  const searchParams = new URLSearchParams(window.location.search);
  const browserLanguage = navigator.language || navigator.userLanguage;
  const hl = searchParams.get('hl');
  if (hl && ['en', 'zh', 'fr'].includes(hl)) {
    locale = hl;
  } else if (!hl) {
      const bl = browserLanguage.substring(0, 2);
      if (['en', 'zh', 'fr'].includes(bl)) {
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
