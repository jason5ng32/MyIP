// Validates the shared IP parser. frontend/utils/valid-ip.js is a thin
// re-export of common/valid-ip.js; we import both paths and assert they
// agree, which catches any regression where the re-export breaks (e.g.
// someone duplicates the implementation again).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidIP as isValidCommonIP, isValidDomain as isValidCommonDomain, isIPv6 as isCommonIPv6, isPrivateIP as isCommonPrivateIP } from '../common/valid-ip.js';
import { isValidIP as isValidFrontendIP, isValidDomain as isValidFrontendDomain, isIPv6 as isFrontendIPv6, isPrivateIP as isFrontendPrivateIP } from '../frontend/utils/valid-ip.js';

const validAddresses = [
  '1.1.1.1',
  '8.8.8.8',
  '255.255.255.255',
  '2001:4860:4860::8888',
  '::1',
];

const invalidAddresses = [
  '',
  'hello',
  '256.1.1.1',
  '1.1.1',
  '2001:::8888',
];

describe('IP validation helpers', () => {
  for (const ip of validAddresses) {
    it(`accepts ${ip}`, () => {
      assert.equal(isValidCommonIP(ip), true);
      assert.equal(isValidFrontendIP(ip), true);
    });
  }

  for (const ip of invalidAddresses) {
    it(`rejects ${ip || 'empty string'}`, () => {
      assert.equal(isValidCommonIP(ip), false);
      assert.equal(isValidFrontendIP(ip), false);
    });
  }
});

const validDomains = [
  'example.com',
  'sub.example.com',
  'a.b.c.example.co',
  'EXAMPLE.COM',
  'xn--n3h.example',
  'with-hyphen.io',
];

const invalidDomains = [
  '',
  'nodot',
  '.example.com',
  'example.',
  'example..com',
  'has_underscore.com',
  'trailing.dot.',
  'one.1',         // TLD must be 2+ letters, not digits
  '192.168.1.1',   // numeric-only TLD is rejected
  null,
  undefined,
  42,
];

describe('Domain validation helpers', () => {
  for (const d of validDomains) {
    it(`accepts ${d}`, () => {
      assert.equal(isValidCommonDomain(d), true);
      assert.equal(isValidFrontendDomain(d), true);
    });
  }

  for (const d of invalidDomains) {
    const label = d == null ? String(d) : (d === '' ? 'empty string' : d);
    it(`rejects ${label}`, () => {
      assert.equal(isValidCommonDomain(d), false);
      assert.equal(isValidFrontendDomain(d), false);
    });
  }
});

describe('isIPv6', () => {
  it('separates v6 from v4 for valid IPs, both import paths agreeing', () => {
    for (const [ip, expected] of [
      ['2001:4860:4860::8888', true],
      ['::1', true],
      ['1.1.1.1', false],
      ['255.255.255.255', false],
    ]) {
      assert.equal(isCommonIPv6(ip), expected);
      assert.equal(isFrontendIPv6(ip), expected);
    }
  });

  it('is false for non-strings (it does not validate, only discriminates)', () => {
    assert.equal(isCommonIPv6(null), false);
    assert.equal(isCommonIPv6(42), false);
  });
});

// Addresses with no registry record — the Whois tool short-circuits on these
// rather than spending an RDAP / WHOIS lookup that can only fail. Every v4
// case below appeared in a real production Whois query.
const privateAddresses = [
  '10.92.24.150',
  '172.16.0.1',
  '172.30.232.1',
  '192.168.1.1',
  '127.0.0.1',
  '169.254.10.1',
  '100.64.0.1',
  '198.18.0.2',
  '192.0.2.1',
  '203.0.113.9',
  '224.0.0.1',
  '255.255.255.255',
  '0.0.0.0',
  '::',
  '::1',
  'fd00::1',
  'fe80::1ff:fe23:4567:890a',
  '2001:db8::1',
  'ff02::1',
];

const publicAddresses = [
  '1.1.1.1',
  '8.8.8.8',
  '9.9.9.9',
  '172.15.255.255',   // just below the RFC 1918 /12
  '172.32.0.1',       // just above it
  '100.63.255.255',   // just below CGNAT
  '100.128.0.1',      // just above it
  '198.20.0.1',       // just above the benchmarking /15
  '223.255.255.255',  // last address before multicast
  '204.1.92.8',
  '2001:4860:4860::8888',
  '2400:cb00::1',
  '2a03:f80:372:1c55::1',
  '2001:db9::1',      // neighbour of the documentation prefix
];

describe('isPrivateIP', () => {
  for (const ip of privateAddresses) {
    it(`flags ${ip} as non-public`, () => {
      assert.equal(isCommonPrivateIP(ip), true);
      assert.equal(isFrontendPrivateIP(ip), true);
    });
  }

  for (const ip of publicAddresses) {
    it(`treats ${ip} as public`, () => {
      assert.equal(isCommonPrivateIP(ip), false);
      assert.equal(isFrontendPrivateIP(ip), false);
    });
  }

  it('is false for non-strings', () => {
    assert.equal(isCommonPrivateIP(null), false);
    assert.equal(isCommonPrivateIP(42), false);
  });
});
