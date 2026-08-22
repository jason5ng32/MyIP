// Data-integrity gate for api/data/dns-resolvers.js — the file resolver-
// addition PRs touch. A new entry that breaks any rule here (bad country
// code, malformed doh prefix, duplicate id, …) fails `pnpm test` before it
// can break the live /api/dnsresolver endpoint.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DNS_RESOLVERS } from '../api/data/dns-resolvers.js';
import { isValidIP, isIPv6 } from '../common/valid-ip.js';

// 'EU' is a CLDR-supported region code, so this also validates DNS4EU.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

describe('DNS_RESOLVERS data integrity', () => {
    it('is a non-empty array', () => {
        assert.ok(Array.isArray(DNS_RESOLVERS));
        assert.ok(DNS_RESOLVERS.length > 0);
    });

    it('ids are unique lowercase slugs', () => {
        const ids = DNS_RESOLVERS.map((r) => r.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate id');
        for (const id of ids) {
            assert.match(id, /^[a-z0-9-]+$/, `id "${id}" must be a lowercase slug`);
        }
    });

    it('names are unique non-empty strings', () => {
        const names = DNS_RESOLVERS.map((r) => r.name);
        assert.equal(new Set(names).size, names.length, 'duplicate name');
        for (const name of names) {
            assert.equal(typeof name, 'string');
            assert.ok(name.length > 0);
        }
    });

    it('country is an uppercase two-letter code that Intl.DisplayNames resolves', () => {
        for (const { id, country } of DNS_RESOLVERS) {
            assert.match(country, /^[A-Z]{2}$/, `${id}: country "${country}" must be ISO alpha-2 uppercase`);
            const resolved = regionNames.of(country);
            assert.ok(resolved, `${id}: country "${country}" is not a known region code`);
        }
    });

    it('every entry has at least one of udp / doh', () => {
        for (const { id, udp, doh } of DNS_RESOLVERS) {
            assert.ok(udp || doh, `${id}: needs a udp IP or a doh URL`);
        }
    });

    it('udp, when present, is a valid IPv4 address', () => {
        for (const { id, udp } of DNS_RESOLVERS) {
            if (udp === undefined) continue;
            assert.ok(isValidIP(udp) && !isIPv6(udp), `${id}: udp "${udp}" is not a valid IPv4`);
        }
    });

    it("doh, when present, is https:// and ends with '?' or '&'", () => {
        for (const { id, doh } of DNS_RESOLVERS) {
            if (doh === undefined) continue;
            assert.ok(doh.startsWith('https://'), `${id}: doh must be https://`);
            assert.match(doh, /[?&]$/, `${id}: doh prefix must end with '?' or '&' — the handler appends name=<host>&type=<type>`);
        }
    });
});
