// The picker's view of a country: which languages and clocks to offer,
// derived from Intl plus one supplement table. Asserted here: the visitor
// gets sensible choices, including for the countries Intl alone would answer
// with a single language.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { localProfile } from '../frontend/utils/persona/local-profile.js';
import { EXTRA_LANGUAGES, FONTS_BY_SCRIPT } from '../frontend/data/persona-tables.js';

describe('localProfile', () => {
    it('derives the primary language, its script and the country timezones', () => {
        const jp = localProfile('JP');
        assert.equal(jp.country, 'JP');
        assert.deepEqual(jp.timeZones, ['Asia/Tokyo']);
        assert.equal(jp.languages[0].language, 'ja');
        assert.equal(jp.languages[0].tag, 'ja-JP');
        assert.equal(jp.languages[0].script, 'Jpan');
    });

    it('offers every language of a multilingual country, primary first', () => {
        const ch = localProfile('CH');
        const tags = ch.languages.map((entry) => entry.tag);
        // Intl.Locale#maximize() alone would answer "de" and stop there; a
        // Swiss persona scored against one language is the reason the
        // supplement table exists.
        assert.ok(tags.includes('de-CH'));
        assert.ok(tags.includes('fr-CH'));
        assert.ok(tags.includes('it-CH'));
        assert.equal(new Set(tags).size, tags.length, 'no language is offered twice');
    });

    it('uppercases the code and sorts the zones for a stable picker', () => {
        const us = localProfile('us');
        assert.equal(us.country, 'US');
        assert.ok(us.timeZones.length > 1);
        assert.deepEqual(us.timeZones, [...us.timeZones].sort());
    });

    it('answers empty rather than throwing for anything that is not a country', () => {
        for (const bad of ['', 'JPN', '1', null, undefined]) {
            assert.deepEqual(localProfile(bad), { country: '', languages: [], timeZones: [] });
        }
    });

    it('reports an uninhabited territory as having nothing to pick', () => {
        // Bouvet Island: a real ISO code with no IANA zone. The tool reads the
        // empty list as "no local profile" rather than as an error.
        assert.deepEqual(localProfile('BV').timeZones, []);
    });
});

describe('persona reference tables', () => {
    it('lists marker scripts only, never the ones every OS ships', () => {
        assert.equal(FONTS_BY_SCRIPT.Latn, undefined);
        assert.equal(FONTS_BY_SCRIPT.Cyrl, undefined);
        assert.ok(Object.keys(FONTS_BY_SCRIPT).length >= 20);
    });

    it('keys the language supplement by two-letter country code', () => {
        for (const [country, languages] of Object.entries(EXTRA_LANGUAGES)) {
            assert.match(country, /^[A-Z]{2}$/, `${country} is not a country code`);
            assert.ok(Array.isArray(languages) && languages.length > 0, `${country} has no languages`);
        }
    });
});
