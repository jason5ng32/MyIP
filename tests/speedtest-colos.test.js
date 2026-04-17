import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import getColoCountry from '../frontend/utils/speedtest-colos.js';

describe('getColoCountry(abbr)', () => {
  it('returns country + city for a known Cloudflare PoP', () => {
    assert.deepEqual(getColoCountry('ZRH'), { country: 'CH', city: 'Zurich' });
    assert.deepEqual(getColoCountry('LAX'), { country: 'US', city: 'Los Angeles' });
  });

  it('returns known east-asia PoPs', () => {
    assert.deepEqual(getColoCountry('NRT'), { country: 'JP', city: 'Tokyo' });
    assert.deepEqual(getColoCountry('HKG'), { country: 'HK', city: 'Hong Kong' });
  });

  it('throws for unknown abbr (direct access on undefined)', () => {
    // Note: current implementation `coloList[abbr].country` throws if abbr is unknown.
    // 如果未来改成 safe fallback，本测试需要同步更新。
    assert.throws(() => getColoCountry('ZZZ'));
  });
});
