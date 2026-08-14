// Validates the shared IP parser. frontend/utils/valid-ip.js is a thin
// re-export of common/valid-ip.js; we import both paths and assert they
// agree, which catches any regression where the re-export breaks (e.g.
// someone duplicates the implementation again).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidIP as isValidCommonIP, isValidDomain as isValidCommonDomain, isIPv6 as isCommonIPv6, isUsablePublicIP as isCommonUsablePublicIP } from '../common/valid-ip.js';
import { isValidIP as isValidFrontendIP, isValidDomain as isValidFrontendDomain, isIPv6 as isFrontendIPv6, isUsablePublicIP as isFrontendUsablePublicIP } from '../frontend/utils/valid-ip.js';

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

// Addresses outside publicly routable space — every IP form in the app
// short-circuits on these rather than spending a lookup that can only fail.
// Every v4 case below appeared in a real production Whois query.
const reservedAddresses = [
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
  '::ffff:c000:1',    // IPv4-mapped
  '64:ff9b::1',
  '100::1',
  '4000::1',          // unassigned — outside global unicast 2000::/3
  'fbff::1',          // unassigned, just below the ULA block
  'fd00::1',
  'fe80::1ff:fe23:4567:890a',
  '2001::1',          // Teredo
  '2001:20::1',       // ORCHIDv2
  '2001:db8::1',
  '2002:c000:204::1', // 6to4
  '3fff::1',          // documentation, RFC 9637
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
  '2000::1',          // lower bound of global unicast
  '2001:1::1',        // just above Teredo
  '2001:30::1',       // just above ORCHIDv2
  '2001:db9::1',      // neighbour of the documentation prefix
  '3fff:1000::1',     // just above the RFC 9637 documentation block
];

describe('isUsablePublicIP', () => {
  for (const ip of reservedAddresses) {
    it(`rejects ${ip} as outside public space`, () => {
      assert.equal(isCommonUsablePublicIP(ip), false);
      assert.equal(isFrontendUsablePublicIP(ip), false);
    });
  }

  for (const ip of publicAddresses) {
    it(`accepts ${ip}`, () => {
      assert.equal(isCommonUsablePublicIP(ip), true);
      assert.equal(isFrontendUsablePublicIP(ip), true);
    });
  }

  // Validation is folded in, so anything that isn't an IP is not usable.
  for (const junk of ['', 'hello', '256.1.1.1', '1.1.1', null, undefined, 42]) {
    it(`rejects the non-address ${JSON.stringify(junk)}`, () => {
      assert.equal(isCommonUsablePublicIP(junk), false);
      assert.equal(isFrontendUsablePublicIP(junk), false);
    });
  }
});
