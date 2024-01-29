import { createI18n } from 'vue-i18n';


import en from './locales/en.json';
import zh from './locales/zh.json';
import fr from './locales/fr.json';


const messages = { en, zh, fr };


const i18n = createI18n({
  legacy: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages,
});

export default i18n;
