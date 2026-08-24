// Unit tests for common/locale-registry.js: the entry shape every consumer
// relies on, plus the shared mappings — apiTag, the fallback chain and
// browser-language matching. Pack contents are gated in locale-packs.test.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    LOCALES,
    LOCALE_CODES,
    FULL_LOCALE_CODES,
    FALLBACK_LOCALE,
    getLocale,
    toApiTag,
    toHtmlLang,
    fallbackChain,
    matchLocale,
} from '../common/locale-registry.js';
import { LOCALES as BRIDGED } from '../frontend/utils/locale-registry.js';

describe('locale registry entries', () => {
    it('every entry carries the full field set', () => {
        for (const locale of LOCALES) {
            assert.match(locale.code, /^[a-z]{2}(-[A-Za-z]{2,4})?$/, `bad code ${locale.code}`);
            assert.ok(locale.nativeName?.length, `${locale.code}: no nativeName`);
            assert.match(locale.flag, /^[a-z]{2}$/, `${locale.code}: flag must be a circle-flags code`);
            assert.ok(locale.apiTag?.length, `${locale.code}: no apiTag`);
            assert.ok(locale.htmlLang?.length, `${locale.code}: no htmlLang`);
            assert.ok(['full', 'beta'].includes(locale.status), `${locale.code}: bad status`);
        }
    });

    it('codes are unique and the fallback locale is registered', () => {
        assert.equal(new Set(LOCALE_CODES).size, LOCALE_CODES.length);
        assert.ok(LOCALE_CODES.includes(FALLBACK_LOCALE));
    });

    it('full locales are a subset of all locales', () => {
        for (const code of FULL_LOCALE_CODES) assert.ok(LOCALE_CODES.includes(code));
        assert.ok(FULL_LOCALE_CODES.includes(FALLBACK_LOCALE), 'en must stay full — everything falls back to it');
    });

    it('the front-end bridge re-exports the same registry', () => {
        assert.equal(BRIDGED, LOCALES);
    });

    it('getLocale finds an entry and returns undefined for anything else', () => {
        assert.equal(getLocale('zh').nativeName, '简体中文');
        assert.equal(getLocale('tr'), undefined);
    });
});

describe('toApiTag / toHtmlLang', () => {
    it('maps zh to zh-CN and leaves the others alone', () => {
        assert.equal(toApiTag('zh'), 'zh-CN');
        assert.equal(toHtmlLang('zh'), 'zh-CN');
        for (const code of ['en', 'fr', 'ru']) {
            assert.equal(toApiTag(code), code);
            assert.equal(toHtmlLang(code), code);
        }
    });

    it('maps zh-TW to the supported upstream tag and preserves its document language', () => {
        assert.equal(toApiTag('zh-TW'), 'zh-CN');
        assert.equal(toHtmlLang('zh-TW'), 'zh-TW');
    });

    it('passes an unregistered code through untouched', () => {
        assert.equal(toApiTag('tr'), 'tr');
        assert.equal(toHtmlLang('tr'), 'tr');
    });
});

describe('fallbackChain', () => {
    it('ends at en, which falls back to nothing', () => {
        assert.deepEqual(fallbackChain('en'), ['en']);
        for (const code of LOCALE_CODES) {
            assert.equal(fallbackChain(code).at(-1), FALLBACK_LOCALE);
        }
    });

    it('sends a plain language straight to en', () => {
        assert.deepEqual(fallbackChain('zh'), ['zh', 'en']);
        assert.deepEqual(fallbackChain('tr'), ['tr', 'en']);
    });

    it('routes a variant through its base — but only a registered one', () => {
        assert.deepEqual(fallbackChain('zh-TW'), ['zh-TW', 'zh', 'en']);
        assert.deepEqual(fallbackChain('pt-BR'), ['pt-BR', 'en']);
    });
});

describe('matchLocale', () => {
    it('prefers an exact match over the base language', () => {
        assert.equal(matchLocale('zh-TW', ['zh', 'zh-TW']), 'zh-TW');
        assert.equal(matchLocale('zh-TW', ['zh']), 'zh');
    });

    it('matches case-insensitively and strips any subtags', () => {
        assert.equal(matchLocale('EN-US'), 'en');
        assert.equal(matchLocale('zh-Hans-CN'), 'zh');
    });

    it('falls sideways within a family when the base itself is unregistered', () => {
        // A pt-BR-only registry still serves a pt-PT visitor.
        assert.equal(matchLocale('pt-PT', ['en', 'pt-BR']), 'pt-BR');
        assert.equal(matchLocale('pt', ['en', 'pt-BR']), 'pt-BR');
        assert.equal(matchLocale('zh-CN', ['en', 'zh-TW']), 'zh-TW');
    });

    it('picks the first sibling in registry order', () => {
        assert.equal(matchLocale('pt-AO', ['en', 'pt-PT', 'pt-BR']), 'pt-PT');
    });

    it('never crosses into another language', () => {
        assert.equal(matchLocale('de-CH', ['en', 'fr', 'zh-TW']), null);
    });

    it('returns null for an unknown or empty tag', () => {
        assert.equal(matchLocale('tr'), null);
        assert.equal(matchLocale(''), null);
        assert.equal(matchLocale(undefined), null);
    });
});
