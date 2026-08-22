// Thin re-export of common/locale-registry.js (shared with the tests) so
// front-end code keeps importing from `@/utils/...`.
export {
  LOCALES,
  LOCALE_CODES,
  FULL_LOCALE_CODES,
  FALLBACK_LOCALE,
  getLocale,
  toApiTag,
  toHtmlLang,
  fallbackChain,
  matchLocale,
} from '../../common/locale-registry.js';
