import { createI18n } from 'vue-i18n';

// 引入语言文件
// Node ESM 必须显式声明 JSON 导入属性；Vite 也支持这种写法，前后端一致
import en from './en.json' with { type: 'json' };
import zh from './zh.json' with { type: 'json' };
import fr from './fr.json' with { type: 'json' };
import tr from './tr.json' with { type: 'json' };
import enSecurity from './security-checklist/en.json' with { type: 'json' };
import zhSecurity from './security-checklist/zh.json' with { type: 'json' };
import frSecurity from './security-checklist/fr.json' with { type: 'json' };
import trSecurity from './security-checklist/tr.json' with { type: 'json' };


const messages = { en, zh, fr, tr };
const supportedLanguages = Object.keys(messages);

// 引入安全检查清单
function mergeMessagesSync() {
  messages.en = { ...messages.en, securitychecklistdata: enSecurity };
  messages.zh = { ...messages.zh, securitychecklistdata: zhSecurity };
  messages.fr = { ...messages.fr, securitychecklistdata: frSecurity };
  messages.tr = { ...messages.tr, securitychecklistdata: trSecurity };
}

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

// 合并语言包
const messagesLoader = () => {
  mergeMessagesSync();
  return messages;
};

// 创建 i18n 实例
const i18n = createI18n({
  legacy: false,
  locale: setLanguage(),
  fallbackLocale: 'en',
  messages: messagesLoader(),
});

// 更新 meta 标签
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