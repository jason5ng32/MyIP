// pageTranslationState — classifies a translator-rewritten <html lang> against
// the UI locale for the Sentry `page_translated` tag. TEMPORARY, removed with
// frontend/utils/page-translation.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pageTranslationState } from '../frontend/utils/page-translation.js';
import { LOCALE_CODES, toHtmlLang } from '../common/locale-registry.js';

describe('pageTranslationState', () => {
    it('reads an untouched page as no for every locale', () => {
        for (const code of LOCALE_CODES) {
            assert.equal(pageTranslationState(toHtmlLang(code), code), 'no', code);
        }
    });

    it('ignores case on the declared lang', () => {
        assert.equal(pageTranslationState('ZH-cn', 'zh'), 'no');
    });

    it('treats a missing lang or locale as no', () => {
        assert.equal(pageTranslationState('', 'zh'), 'no');
        assert.equal(pageTranslationState(null, 'zh'), 'no');
        assert.equal(pageTranslationState('ja', undefined), 'no');
    });

    it('flags a translation into the UI language itself as same', () => {
        assert.equal(pageTranslationState('zh', 'zh'), 'same');
        assert.equal(pageTranslationState('fr-FR', 'fr'), 'same');
        assert.equal(pageTranslationState('ru-RU', 'ru'), 'same');
    });

    it('flags a translation into another shipped language as shipped', () => {
        assert.equal(pageTranslationState('zh-CN', 'en'), 'shipped');
        assert.equal(pageTranslationState('zh-CN', 'zh-TW'), 'shipped');
        assert.equal(pageTranslationState('en', 'zh'), 'shipped');
    });

    it('flags a translation into an unshipped language as other', () => {
        assert.equal(pageTranslationState('ja-JP', 'en'), 'other');
        assert.equal(pageTranslationState('fa', 'en'), 'other');
        assert.equal(pageTranslationState('be', 'zh'), 'other');
    });
});
