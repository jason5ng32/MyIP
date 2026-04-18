// Validates the shared IP parser. frontend/utils/valid-ip.js is a thin
// re-export of common/valid-ip.js; we import both paths and assert they
// agree, which catches any regression where the re-export breaks (e.g.
// someone duplicates the implementation again).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isValidIP as isValidCommonIP } from '../common/valid-ip.js';
import { isValidIP as isValidFrontendIP } from '../frontend/utils/valid-ip.js';

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
