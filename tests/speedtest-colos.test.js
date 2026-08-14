import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import getColoCountry from '../frontend/data/speedtest-colos.js';

describe('getColoCountry(abbr)', () => {
  it('returns country + city for a known Cloudflare PoP', () => {
    assert.deepEqual(getColoCountry('ZRH'), { country: 'CH', city: 'Zurich' });
    assert.deepEqual(getColoCountry('LAX'), { country: 'US', city: 'Los Angeles' });
  });

  it('returns known east-asia PoPs', () => {
    assert.deepEqual(getColoCountry('NRT'), { country: 'JP', city: 'Tokyo' });
    assert.deepEqual(getColoCountry('HKG'), { country: 'HK', city: 'Hong Kong' });
  });

  it('covers PoPs added after the original snapshot', () => {
    assert.deepEqual(getColoCountry('WLG'), { country: 'NZ', city: 'Wellington' });
    assert.deepEqual(getColoCountry('CVG'), { country: 'US', city: 'Cincinnati' });
  });

  it('falls back to empty fields for an unknown abbr', () => {
    assert.deepEqual(getColoCountry('ZZZ'), { country: '', city: '' });
  });
});
