// TEMPORARY — backs the `page_translated` Sentry tag that verifies the boot
// <html lang> fix in index.html; removed with it (see sentry-init.js).
// Whether a browser translator has rewritten the page, read off <html lang>:
// Chrome, Edge, Safari and Firefox all move it to their target language.
import { LOCALE_CODES, matchLocale, toHtmlLang } from './locale-registry.js';

// no — lang is still ours · same — "translated" into the UI's own language ·
// shipped — into another language we ship · other — into one we don't
export const pageTranslationState = (pageLang, uiLocale) => {
  if (!pageLang || !uiLocale) return 'no';
  if (pageLang.toLowerCase() === toHtmlLang(uiLocale).toLowerCase()) return 'no';
  const target = matchLocale(pageLang, LOCALE_CODES);
  if (target === uiLocale) return 'same';
  return target ? 'shipped' : 'other';
};
