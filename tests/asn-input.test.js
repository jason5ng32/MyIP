// Tests for common/asn-input.js — the AS-number grammar shared by the ASN
// guards, the Whois tool (prefix required) and ASN Profile (prefix
// optional) — and its frontend/utils/ip/asn-input.js re-export.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_ASN, parseAsnInput } from '../common/asn-input.js';
import * as bridge from '../frontend/utils/ip/asn-input.js';

describe('frontend bridge', () => {
  it('re-exports the shared implementation', () => {
    assert.equal(bridge.parseAsnInput, parseAsnInput);
    assert.equal(bridge.MAX_ASN, MAX_ASN);
  });
});

describe('parseAsnInput', () => {
  it('accepts AS-prefixed and bare numbers, any case, trimmed', () => {
    assert.equal(parseAsnInput('AS13335'), 13335);
    assert.equal(parseAsnInput('as13335'), 13335);
    assert.equal(parseAsnInput('As13335'), 13335);
    assert.equal(parseAsnInput('13335'), 13335);
    assert.equal(parseAsnInput('  AS64500 '), 64500);
    assert.equal(parseAsnInput(13335), 13335);
  });

  it('normalizes leading zeros', () => {
    assert.equal(parseAsnInput('AS013335'), 13335);
  });

  it('honours the 32-bit range and rejects AS0', () => {
    assert.equal(parseAsnInput(String(MAX_ASN)), 4294967295);
    assert.equal(parseAsnInput('AS4294967296'), null);
    assert.equal(parseAsnInput('AS0'), null);
    assert.equal(parseAsnInput('0'), null);
  });

  it('rejects more than ten digits even when the value fits', () => {
    assert.equal(parseAsnInput('00000013335'), null);
  });

  it('rejects anything else', () => {
    for (const raw of ['', 'AS', 'AS 13335', 'ASN13335', '13335a', '-1', '1.5', 'AS13335/24', null, undefined, {}]) {
      assert.equal(parseAsnInput(raw), null, String(raw));
    }
  });
});

describe('parseAsnInput — requirePrefix', () => {
  const strict = (raw) => parseAsnInput(raw, { requirePrefix: true });

  it('accepts the AS prefix in any case', () => {
    assert.equal(strict('AS13335'), 13335);
    assert.equal(strict('as13335'), 13335);
    assert.equal(strict('As13335'), 13335);
    assert.equal(strict(' aS64500 '), 64500);
  });

  it('rejects a bare number', () => {
    assert.equal(strict('13335'), null);
    assert.equal(strict(13335), null);
  });

  it('keeps the same range rules', () => {
    assert.equal(strict('AS4294967295'), MAX_ASN);
    assert.equal(strict('AS4294967296'), null);
    assert.equal(strict('AS0'), null);
    assert.equal(strict('AS00000013335'), null);
  });

  it('does not take IPs or domains', () => {
    for (const raw of ['1.1.1.1', '2606:4700::1111', 'example.com', 'as13335.net']) {
      assert.equal(strict(raw), null, raw);
    }
  });
});
