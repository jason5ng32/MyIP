// Tests for frontend/utils/asn-profile.js — per-prefix sizing (v4
// addresses, v6 /48s) and announced-IPv4 totals / share.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  prefixSize, announcedIpv4, ipv4SharePercent,
} from '../frontend/utils/asn-profile.js';

describe('prefixSize', () => {
  it('counts IPv4 addresses', () => {
    assert.deepEqual(prefixSize('198.51.100.0/24'), { family: 4, prefix: 24, count: 256 });
    assert.deepEqual(prefixSize('104.16.0.0/13'), { family: 4, prefix: 13, count: 524288 });
    assert.deepEqual(prefixSize('192.0.2.1/32'), { family: 4, prefix: 32, count: 1 });
    assert.deepEqual(prefixSize('0.0.0.0/0'), { family: 4, prefix: 0, count: 4294967296 });
  });

  it('counts IPv6 in /48s', () => {
    assert.deepEqual(prefixSize('2001:db8::/32'), { family: 6, prefix: 32, count: 65536 });
    assert.deepEqual(prefixSize('2001:db8:1::/48'), { family: 6, prefix: 48, count: 1 });
    assert.deepEqual(prefixSize('2a06:98c0::/29'), { family: 6, prefix: 29, count: 524288 });
  });

  it('an IPv6 prefix longer than /48 has no /48 count', () => {
    assert.deepEqual(prefixSize('2001:db8:1:2::/64'), { family: 6, prefix: 64, count: null });
  });

  it('invalid input is null', () => {
    for (const raw of ['', '198.51.100.0', '198.51.100.0/33', '2001:db8::/129', 'AS13335', null, 42]) {
      assert.equal(prefixSize(raw), null, String(raw));
    }
  });
});

describe('announcedIpv4', () => {
  it('sums disjoint IPv4 prefixes', () => {
    assert.equal(announcedIpv4(['192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24']), 768);
  });

  it('counts a covering route and its more-specifics once', () => {
    assert.equal(announcedIpv4(['198.18.0.0/15', '198.18.0.0/24', '198.19.128.0/18']), 131072);
  });

  it('ignores IPv6 and junk', () => {
    assert.equal(announcedIpv4(['192.0.2.0/24', '2001:db8::/32', 'nonsense']), 256);
  });

  it('empty or missing list is 0', () => {
    assert.equal(announcedIpv4([]), 0);
    assert.equal(announcedIpv4(undefined), 0);
  });
});

describe('ipv4SharePercent', () => {
  it('is the percentage of 2^32', () => {
    assert.equal(ipv4SharePercent(2 ** 32), 100);
    assert.equal(ipv4SharePercent(2 ** 24), 100 / 256);
    assert.equal(ipv4SharePercent(256), (256 / 2 ** 32) * 100);
  });

  it('clamps and guards odd input', () => {
    assert.equal(ipv4SharePercent(2 ** 33), 100);
    assert.equal(ipv4SharePercent(0), 0);
    assert.equal(ipv4SharePercent(-5), 0);
    assert.equal(ipv4SharePercent(NaN), 0);
    assert.equal(ipv4SharePercent(undefined), 0);
  });
});
