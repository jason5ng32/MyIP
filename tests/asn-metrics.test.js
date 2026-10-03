// Tests for frontend/utils/asn-metrics.js — percentage parsing, traffic-pair
// building and connection-quality picking over the Radar ASN summary.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parsePercentage, buildTrafficPairs, pickConnectionQuality } from '../frontend/utils/asn-metrics.js';

describe('parsePercentage', () => {
  it('parses backend strings with or without the % sign', () => {
    assert.equal(parsePercentage('95.35%'), 95.35);
    assert.equal(parsePercentage('4.65'), 4.65);
    assert.equal(parsePercentage('0.00%'), 0);
  });

  it('rounds to two decimals', () => {
    assert.equal(parsePercentage('33.33333%'), 33.33);
    assert.equal(parsePercentage('66.666%'), 66.67);
  });

  it('accepts numbers', () => {
    assert.equal(parsePercentage(72.456), 72.46);
    assert.equal(parsePercentage(0), 0);
  });

  it('missing or unparseable input is null', () => {
    assert.equal(parsePercentage(undefined), null);
    assert.equal(parsePercentage(null), null);
    assert.equal(parsePercentage(''), null);
    assert.equal(parsePercentage('NaN%'), null);
    assert.equal(parsePercentage('n/a'), null);
  });
});

describe('buildTrafficPairs', () => {
  const FULL = {
    IPv4_Pct: '95.35%', IPv6_Pct: '4.65%',
    HTTP_Pct: '3.16%', HTTPS_Pct: '96.84%',
    Desktop_Pct: '58.88%', Mobile_Pct: '41.12%',
    Bot_Pct: '98.46%', Human_Pct: '1.54%',
  };

  it('emits the four pairs in display order, human on the left of bot', () => {
    assert.deepEqual(buildTrafficPairs(FULL), [
      { leftLabel: 'IPv4_Pct', rightLabel: 'IPv6_Pct', leftValue: 95.35, rightValue: 4.65 },
      { leftLabel: 'HTTP_Pct', rightLabel: 'HTTPS_Pct', leftValue: 3.16, rightValue: 96.84 },
      { leftLabel: 'Desktop_Pct', rightLabel: 'Mobile_Pct', leftValue: 58.88, rightValue: 41.12 },
      { leftLabel: 'Human_Pct', rightLabel: 'Bot_Pct', leftValue: 1.54, rightValue: 98.46 },
    ]);
  });

  it('drops a pair unless both sides parse', () => {
    const pairs = buildTrafficPairs({ ...FULL, IPv6_Pct: undefined, Bot_Pct: 'NaN%' });
    assert.deepEqual(pairs.map((pair) => pair.leftLabel), ['HTTP_Pct', 'Desktop_Pct']);
  });

  it('keeps a pair whose side is 0%', () => {
    const pairs = buildTrafficPairs({ HTTP_Pct: '0.00%', HTTPS_Pct: '100.00%' });
    assert.deepEqual(pairs, [{ leftLabel: 'HTTP_Pct', rightLabel: 'HTTPS_Pct', leftValue: 0, rightValue: 100 }]);
  });

  it('no data gives no pairs', () => {
    assert.deepEqual(buildTrafficPairs(undefined), []);
    assert.deepEqual(buildTrafficPairs(null), []);
    assert.deepEqual(buildTrafficPairs({ error: 'upstream' }), []);
  });
});

describe('pickConnectionQuality', () => {
  it('picks the present fields in display order', () => {
    const picked = pickConnectionQuality({
      jitter: '4.0 ms', asnName: 'X', speedDownload: '312.4 Mbps', latency: '18 ms', speedUpload: '98.1 Mbps',
    });
    assert.deepEqual(Object.entries(picked), [
      ['speedDownload', '312.4 Mbps'], ['speedUpload', '98.1 Mbps'], ['latency', '18 ms'], ['jitter', '4.0 ms'],
    ]);
  });

  it('skips missing / empty fields', () => {
    assert.deepEqual(pickConnectionQuality({ speedDownload: '', latency: '18 ms' }), { latency: '18 ms' });
  });

  it('no data gives an empty object', () => {
    assert.deepEqual(pickConnectionQuality(undefined), {});
    assert.deepEqual(pickConnectionQuality({}), {});
  });
});
