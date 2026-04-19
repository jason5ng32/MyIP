import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import getCountryName from '../frontend/data/country-name.js';

describe('getCountryName(abbr, lang)', () => {
  it('returns English name for known code', () => {
    assert.equal(getCountryName('US', 'en'), 'USA');
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
  });

  it('returns Turkish name for tr', () => {
    assert.equal(getCountryName('TR', 'tr'), 'Türkiye');
    assert.equal(getCountryName('US', 'tr'), 'Amerika Birleşik Devletleri');
  });

  it('returns empty string for unknown abbr', () => {
    assert.equal(getCountryName('ZZ', 'en'), '');
    assert.equal(getCountryName('', 'en'), '');
    assert.equal(getCountryName(null, 'en'), '');
  });

  it('returns undefined for known abbr but unknown lang', () => {
    // unsupported language key will not fallback to other languages
    assert.equal(getCountryName('US', 'de'), undefined);
  });
});
