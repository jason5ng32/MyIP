// The global URL parameter registry (frontend/data/url-params.js) and the
// override parsing in frontend/utils/url-overrides.js.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { URL_PARAMS, URL_OVERRIDE_PARAMS } from '../frontend/data/url-params.js';
import {
    URL_OVERRIDE_PARSERS, readUrlOverrides, overrideParamOf, queryWithoutOverrides,
} from '../frontend/utils/url-overrides.js';
import { isSyncedPreferenceKey, isValidPreferenceValue } from '../common/preferences-schema.js';
import { IP_DATABASES } from '../frontend/data/ip-databases.js';

describe('URL_PARAMS registry', () => {
    it('names each parameter once, with a known kind', () => {
        const names = URL_PARAMS.map((param) => param.name);
        assert.equal(new Set(names).size, names.length);
        for (const param of URL_PARAMS) assert.ok(['override', 'dev', 'legacy'].includes(param.kind), param.name);
    });

    it('lists the overrides, dev preview and legacy link', () => {
        assert.deepEqual(URL_OVERRIDE_PARAMS.map(({ name, preference }) => [name, preference]),
            [['hl', 'lang'], ['theme', 'theme'], ['ipdb', 'ipGeoSource'], ['probes', 'ipCardsToShow']]);
        assert.deepEqual(URL_PARAMS.filter((p) => p.kind !== 'override').map((p) => [p.name, p.kind]),
            [['festival', 'dev'], ['tool', 'legacy']]);
    });

    it('ties each override to one synced preference with a parser, and only overrides to one', () => {
        const preferences = URL_OVERRIDE_PARAMS.map((param) => param.preference);
        assert.equal(new Set(preferences).size, preferences.length);
        for (const key of preferences) {
            assert.ok(isSyncedPreferenceKey(key), key);
            assert.equal(typeof URL_OVERRIDE_PARSERS[key], 'function', key);
        }
        assert.deepEqual(Object.keys(URL_OVERRIDE_PARSERS).sort(), [...preferences].sort());
        for (const param of URL_PARAMS.filter((p) => p.kind !== 'override')) assert.equal(param.preference, undefined);
    });
});

describe('override parsers', () => {
    const parse = (key, raw, ctx) => URL_OVERRIDE_PARSERS[key](raw, ctx);

    it('hl: the closest registered locale, else nothing', () => {
        assert.equal(parse('lang', 'fr'), 'fr');
        assert.equal(parse('lang', 'ZH-tw'), 'zh-TW');
        assert.equal(parse('lang', 'zh-CN'), 'zh');
        assert.equal(parse('lang', 'pt'), 'pt-BR');
        assert.equal(parse('lang', 'xx'), undefined);
        assert.equal(parse('lang', 'fr', { localeCodes: ['en'] }), undefined);
    });

    it('theme: auto / light / dark in any case, else nothing', () => {
        assert.equal(parse('theme', 'dark'), 'dark');
        assert.equal(parse('theme', 'LIGHT'), 'light');
        assert.equal(parse('theme', 'Auto'), 'auto');
        assert.equal(parse('theme', 'sepia'), undefined);
    });

    it('ipdb: a source slug in any case → its id, else nothing', () => {
        assert.equal(parse('ipGeoSource', 'maxmind'), 6);
        assert.equal(parse('ipGeoSource', 'IPAPICOM'), 3);
        assert.equal(parse('ipGeoSource', 'ipchecking'), IP_DATABASES.find((db) => db.slug === 'ipchecking').id);
        assert.equal(parse('ipGeoSource', 'MaxMind.com'), undefined);
        assert.equal(parse('ipGeoSource', '6'), undefined);
        assert.equal(parse('ipGeoSource', 'maxmind', { ipDBs: [] }), undefined);
    });

    it('probes: a card count option as digits, else nothing', () => {
        assert.equal(parse('ipCardsToShow', '4'), 4);
        assert.equal(parse('ipCardsToShow', '6'), 6);
        assert.equal(parse('ipCardsToShow', '3'), undefined);
        assert.equal(parse('ipCardsToShow', '4.0'), undefined);
        assert.equal(parse('ipCardsToShow', '-2'), undefined);
        assert.equal(parse('ipCardsToShow', 'four'), undefined);
    });

    it('every value a parser returns is a valid preference value', () => {
        const samples = { lang: ['en', 'zh-TW'], theme: ['dark'], ipGeoSource: IP_DATABASES.map((db) => db.slug), ipCardsToShow: ['2', '6'] };
        for (const [key, raws] of Object.entries(samples)) {
            for (const raw of raws) assert.ok(isValidPreferenceValue(key, parse(key, raw)), `${key}=${raw}`);
        }
    });
});

describe('readUrlOverrides()', () => {
    it('maps valid parameters onto their preference keys', () => {
        assert.deepEqual(readUrlOverrides('?hl=fr&theme=Dark&ipdb=maxmind&probes=6'),
            { lang: 'fr', theme: 'dark', ipGeoSource: 6, ipCardsToShow: 6 });
    });

    it('skips invalid, empty and unrelated parameters', () => {
        assert.deepEqual(readUrlOverrides('?hl=xx&theme=&ipdb=nope&probes=5&q=AS13335&tool=whois'), {});
        assert.deepEqual(readUrlOverrides(''), {});
        assert.deepEqual(readUrlOverrides(), {});
    });

    it('takes the first value, trimmed, with or without the leading ?', () => {
        assert.deepEqual(readUrlOverrides('theme=light&theme=dark'), { theme: 'light' });
        assert.deepEqual(readUrlOverrides('?probes=%204%20'), { ipCardsToShow: 4 });
    });

    it('passes the context to the parsers', () => {
        assert.deepEqual(readUrlOverrides('?hl=fr&ipdb=maxmind', { localeCodes: ['en'], ipDBs: [] }), {});
    });
});

describe('overrideParamOf() / queryWithoutOverrides()', () => {
    it('names the parameter of an overridable key, else null', () => {
        assert.equal(overrideParamOf('ipGeoSource'), 'ipdb');
        assert.equal(overrideParamOf('lang'), 'hl');
        assert.equal(overrideParamOf('simpleMode'), null);
    });

    it('drops only the parameters of the given keys', () => {
        assert.deepEqual(queryWithoutOverrides({ q: 'AS1', ipdb: 'maxmind', hl: 'fr' }, ['ipGeoSource']),
            { q: 'AS1', hl: 'fr' });
        assert.deepEqual(queryWithoutOverrides({ hl: 'fr', theme: 'dark' }, ['lang', 'theme']), {});
    });

    it('is null when the query carries none of them', () => {
        assert.equal(queryWithoutOverrides({ q: 'AS1' }, ['ipGeoSource']), null);
        assert.equal(queryWithoutOverrides({ hl: 'fr' }, []), null);
        assert.equal(queryWithoutOverrides({ hl: 'fr' }, ['simpleMode']), null);
        assert.equal(queryWithoutOverrides(undefined, ['lang']), null);
    });
});
