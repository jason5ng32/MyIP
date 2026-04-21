// Validates the shared IP parser. frontend/utils/valid-ip.js is a thin
// re-export of common/valid-ip.js; we import both paths and assert they
// agree, which catches any regression where the re-export breaks (e.g.
// someone duplicates the implementation again).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidIP as isValidCommonIP, isValidDomain as isValidCommonDomain } from '../common/valid-ip.js';
import { isValidIP as isValidFrontendIP, isValidDomain as isValidFrontendDomain } from '../frontend/utils/valid-ip.js';

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
