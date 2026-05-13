// Coverage for common/bgp-prefix.js — both the IP→prefix quantizer used by
// the frontend before hitting /api/asn-history and the prefix validator used
// by the backend guard.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { toBgpPrefix, isValidBgpPrefix } from '../common/bgp-prefix.js';

describe('toBgpPrefix — IPv4 → /24', () => {
    const cases = [
        ['8.8.8.8', '8.8.8.0/24'],
        ['1.1.1.1', '1.1.1.0/24'],
        ['18.141.59.1', '18.141.59.0/24'],
        ['255.255.255.255', '255.255.255.0/24'],
        ['0.0.0.0', '0.0.0.0/24'],
        ['10.20.30.40', '10.20.30.0/24'],
    ];
    for (const [ip, expected] of cases) {
        it(`${ip} → ${expected}`, () => {
            assert.equal(toBgpPrefix(ip), expected);
        });
    }
});

describe('toBgpPrefix — IPv6 → /48', () => {
    const cases = [
        // Standard, no shorthand.
        ['2001:4860:4860:0:0:0:0:8888', '2001:4860:4860::/48'],
        // Shorthand at end.
        ['2001:4860:4860::8888', '2001:4860:4860::/48'],
        // Shorthand inside, after the 3rd hextet.
        ['2001:db8:1234::1', '2001:db8:1234::/48'],
        // Shorthand splitting before the 3rd hextet — gap fills with zero.
        ['2001:db8::1', '2001:db8:0::/48'],
        // Address starting with `::`.
        ['::1', '0:0:0::/48'],
        // All zeros.
        ['::', '0:0:0::/48'],
        // Mixed case + leading zeros — normalized to lowercase, no leading zeros.
        ['2001:0DB8:0001::1', '2001:db8:1::/48'],
        // Ending with `::`.
        ['fe80::', 'fe80:0:0::/48'],
    ];
    for (const [ip, expected] of cases) {
        it(`${ip} → ${expected}`, () => {
            assert.equal(toBgpPrefix(ip), expected);
        });
    }
});

describe('toBgpPrefix — rejects garbage', () => {
    const cases = [
        '',
        'nope',
        '8.8.8',                 // missing octet
        '8.8.8.8.8',             // too many octets
        '256.1.1.1',             // octet out of range
        '2001:::8888',           // multiple `::`
        '2001:db8:1234:5:6:7:8:9:10', // too many hextets
        'gggg::1',               // non-hex
        null,
        undefined,
        42,
    ];
    for (const input of cases) {
        it(`rejects ${JSON.stringify(input)}`, () => {
            assert.equal(toBgpPrefix(input), null);
        });
    }
});

describe('isValidBgpPrefix', () => {
    const valid = [
        '8.8.8.0/24',
        '0.0.0.0/0',
        '255.255.255.255/32',
        '2001:db8::/48',
        '::/0',
        '2001:4860:4860::/48',
        'fe80::/64',
    ];
    for (const p of valid) {
        it(`accepts ${p}`, () => {
            assert.equal(isValidBgpPrefix(p), true);
        });
    }

    const invalid = [
        '',
        'nope',
        '8.8.8.0',               // no slash
        '8.8.8.0/',              // empty length
        '/24',                   // no address
        '8.8.8.0/33',            // v4 length out of range
        '2001:db8::/129',        // v6 length out of range
        '8.8.8.0/-1',            // negative
        '8.8.8.0/abc',           // non-numeric length
        '8.8.8.300/24',          // address invalid
        null,
        undefined,
        42,
    ];
    for (const p of invalid) {
        it(`rejects ${JSON.stringify(p)}`, () => {
            assert.equal(isValidBgpPrefix(p), false);
        });
    }
});
