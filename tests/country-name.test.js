// Shared country-name behavior and the frontend compatibility entry point.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import getCountryName from '../common/country-name.js';
import frontendCountryName from '../frontend/data/country-name.js';

describe('getCountryName(abbr, lang)', () => {
  it('shares the same helper with frontend consumers', () => {
    assert.equal(frontendCountryName, getCountryName);
  });

  it('returns English name for known code', () => {
    assert.equal(getCountryName('US', 'en'), 'United States');
    assert.equal(getCountryName('CN', 'en'), 'China');
    assert.equal(getCountryName('FR', 'en'), 'France');
  });

  it('returns Chinese name for zh', () => {
    assert.equal(getCountryName('US', 'zh'), '美国');
    assert.equal(getCountryName('CN', 'zh'), '中国');
  });

  it('returns French name for fr', () => {
    assert.equal(getCountryName('FR', 'fr'), 'France');
    assert.equal(getCountryName('US', 'fr'), 'États-Unis');
    // regressions from the old hand-maintained table
    assert.equal(getCountryName('CA', 'fr'), 'Canada');
    assert.equal(getCountryName('AU', 'fr'), 'Australie');
    assert.equal(getCountryName('KZ', 'fr'), 'Kazakhstan');
    assert.equal(getCountryName('UG', 'fr'), 'Ouganda');
  });

  it('returns Russian name for ru', () => {
    assert.equal(getCountryName('RU', 'ru'), 'Россия');
    assert.equal(getCountryName('US', 'ru'), 'Соединенные Штаты');
  });

  it('is case-insensitive on the country code', () => {
    assert.equal(getCountryName('us', 'en'), 'United States');
  });

  it('covers locales beyond the four bundled ones', () => {
    assert.equal(getCountryName('US', 'de'), 'Vereinigte Staaten');
  });

  it('returns empty string for unknown or malformed abbr', () => {
    assert.equal(getCountryName('ZZ', 'en'), '');
    assert.equal(getCountryName('XX', 'en'), '');
    assert.equal(getCountryName('T1', 'en'), '');
    assert.equal(getCountryName('', 'en'), '');
    assert.equal(getCountryName(null, 'en'), '');
    assert.equal(getCountryName(123, 'en'), '');
  });

  it('returns empty string for a malformed lang', () => {
    assert.equal(getCountryName('US', 'not a locale!'), '');
    assert.equal(getCountryName('US', null), '');
  });
});
