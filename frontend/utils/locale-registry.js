// Thin re-export of common/locale-registry.js (shared with the tests) so
// front-end code keeps importing from `@/utils/...`.
export { LOCALES, LOCALE_CODES, getLocale, toApiTag, toHtmlLang, matchLocale } from '../../common/locale-registry.js';
