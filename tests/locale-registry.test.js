// Unit tests for common/locale-registry.js: the entry shape every consumer
// relies on, plus the two shared mappings — apiTag and browser-language
// matching.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';

import {
    LOCALES,
    LOCALE_CODES,
    getLocale,
    toApiTag,
    toHtmlLang,
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

    it('codes are unique and en is registered (it is the fallback locale)', () => {
        assert.equal(new Set(LOCALE_CODES).size, LOCALE_CODES.length);
        assert.ok(LOCALE_CODES.includes('en'));
    });

    it('every registered code has a message pack on disk', () => {
        for (const code of LOCALE_CODES) {
            assert.ok(fs.existsSync(new URL(`../frontend/locales/${code}.json`, import.meta.url)),
                `frontend/locales/${code}.json is missing`);
        }
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

    it('passes an unregistered code through untouched', () => {
        assert.equal(toApiTag('tr'), 'tr');
        assert.equal(toHtmlLang('tr'), 'tr');
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

    it('never widens a base tag into a regional pack', () => {
        assert.equal(matchLocale('zh', ['en', 'zh-TW']), null);
    });

    it('returns null for an unknown or empty tag', () => {
        assert.equal(matchLocale('tr'), null);
        assert.equal(matchLocale(''), null);
        assert.equal(matchLocale(undefined), null);
    });
});
