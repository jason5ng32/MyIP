// Coverage for the autnum half of common/rdap.js — bootstrap endpoint
// selection (ASN range match), parsing an RDAP autnum document into the
// /api/whois ASN fields, the WHOIS-like `__raw` formatter, and rdapAutnum's
// query URL and error mapping (fetch stubbed; real network stays out of scope).

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { findAutnumEndpoint, parseAutnum, formatAutnum, rdapAutnum } from '../common/rdap.js';

// Shaped like IANA's asn.json `services` array: [[range, …], [url, …]].
const SERVICES = [
    [['1-1876', '1902-2042'], ['https://rdap.arin.net/registry/', 'http://rdap.arin.net/registry/']],
    [['2043'], ['https://rdap.db.ripe.net/']],
    [['4608-4865'], ['http://insecure.example/', 'https://rdap.apnic.net/']],
];

// Shaped like an ARIN autnum response (abuse contact nested in the org).
const AUTNUM_DOC = {
    objectClassName: 'autnum',
    handle: 'AS13335',
    startAutnum: 13335,
    endAutnum: 13335,
    name: 'CLOUDFLARENET',
    status: ['active'],
    events: [
        { eventAction: 'registration', eventDate: '2010-07-14T18:35:57-04:00' },
        { eventAction: 'last changed', eventDate: '2017-02-17T18:08:51-05:00' },
    ],
    entities: [{
        handle: 'CLOUD14',
        roles: ['registrant'],
        vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'Cloudflare, Inc.']]],
        entities: [{
            handle: 'ABUSE2916-ARIN',
            roles: ['abuse'],
            vcardArray: ['vcard', [
                ['version', {}, 'text', '4.0'],
                ['fn', {}, 'text', 'Abuse'],
                ['email', {}, 'text', 'abuse@cloudflare.com'],
            ]],
        }],
    }],
    remarks: [{ title: 'Registration Comments', description: ['All Cloudflare abuse reporting can be done via https://www.cloudflare.com/abuse'] }],
};

describe('findAutnumEndpoint', () => {
    it('matches an ASN inside a range and prefers https', () => {
        assert.equal(findAutnumEndpoint(SERVICES, 1500), 'https://rdap.arin.net/registry/');
        assert.equal(findAutnumEndpoint(SERVICES, 4700), 'https://rdap.apnic.net/');
    });

    it('matches a single-ASN range and range edges', () => {
        assert.equal(findAutnumEndpoint(SERVICES, 2043), 'https://rdap.db.ripe.net/');
        assert.equal(findAutnumEndpoint(SERVICES, 1876), 'https://rdap.arin.net/registry/');
        assert.equal(findAutnumEndpoint(SERVICES, 1902), 'https://rdap.arin.net/registry/');
    });

    it('returns null for an unallocated ASN', () => {
        assert.equal(findAutnumEndpoint(SERVICES, 1900), null);
        assert.equal(findAutnumEndpoint(SERVICES, 99999), null);
    });
});

describe('parseAutnum', () => {
    it('extracts the registration fields, walking nested entities for abuse', () => {
        const parsed = parseAutnum(AUTNUM_DOC, 13335, 'rdap.arin.net');
        const { __raw, ...fields } = parsed;
        assert.deepEqual(fields, {
            asn: 13335,
            handle: 'AS13335',
            name: 'CLOUDFLARENET',
            rir: 'ARIN',
            status: ['active'],
            registered: '2010-07-14T18:35:57-04:00',
            lastChanged: '2017-02-17T18:08:51-05:00',
            registrant: 'Cloudflare, Inc.',
            country: null,
            abuse: 'abuse@cloudflare.com',
        });
        assert.equal(typeof __raw, 'string');
    });

    it('falls back to the hostname for an unlisted RDAP service', () => {
        assert.equal(parseAutnum({}, 1, 'rdap.example.net').rir, 'rdap.example.net');
    });

    it('nulls every field on a bare document', () => {
        const { __raw, ...fields } = parseAutnum({}, 64500, 'rdap.db.ripe.net');
        assert.deepEqual(fields, {
            asn: 64500, handle: null, name: null, rir: 'RIPE NCC', status: [],
            registered: null, lastChanged: null, registrant: null, country: null, abuse: null,
        });
        assert.equal(__raw, '');
    });

    it('uses the registrant org when the vCard has no fn, and reads country', () => {
        const parsed = parseAutnum({
            country: 'DE',
            entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['org', {}, 'text', 'Example GmbH']]] }],
        }, 64501, 'rdap.db.ripe.net');
        assert.equal(parsed.registrant, 'Example GmbH');
        assert.equal(parsed.country, 'DE');
    });
});

describe('formatAutnum', () => {
    it('renders a WHOIS-like text block', () => {
        const text = formatAutnum(AUTNUM_DOC);
        const lines = text.split('\n');
        assert.equal(lines[0], 'ASNumber: 13335');
        assert.ok(lines.includes('ASName: CLOUDFLARENET'));
        assert.ok(lines.includes('ASHandle: AS13335'));
        assert.ok(lines.includes('Created: 2010-07-14T18:35:57-04:00'));
        assert.ok(lines.includes('Updated: 2017-02-17T18:08:51-05:00'));
        assert.ok(lines.includes('  active'));
        assert.ok(lines.includes('Registrant:'));
        assert.ok(lines.includes('Abuse:'));
        assert.ok(lines.includes('  Email: abuse@cloudflare.com'));
        assert.ok(lines.includes('Registration Comments:'));
    });

    it('prints a block range as start - end', () => {
        assert.equal(formatAutnum({ startAutnum: 64496, endAutnum: 64511 }), 'ASNumber: 64496 - 64511');
    });
});

describe('rdapAutnum', () => {
    const originalFetch = globalThis.fetch;
    afterEach(() => { globalThis.fetch = originalFetch; });

    it('resolves the RIR endpoint via bootstrap and parses the document', async () => {
        const urls = [];
        globalThis.fetch = async (url) => {
            urls.push(String(url));
            if (String(url).includes('data.iana.org')) {
                return new Response(JSON.stringify({ services: [[['13335'], ['https://rdap.arin.net/registry/']]] }));
            }
            return new Response(JSON.stringify(AUTNUM_DOC));
        };
        const result = await rdapAutnum('AS13335');
        assert.equal(urls[0], 'https://data.iana.org/rdap/asn.json');
        assert.equal(urls[1], 'https://rdap.arin.net/registry/autnum/13335');
        assert.equal(result.asn, 13335);
        assert.equal(result.rir, 'ARIN');
        assert.equal(result.__raw, formatAutnum(AUTNUM_DOC));
    });

    it('throws a not-found error on 404', async () => {
        // Reuses the bootstrap cached by the previous case (24h in-module
        // cache) — the ASN must stay inside that bootstrap's range.
        globalThis.fetch = async () => new Response('', { status: 404 });
        await assert.rejects(() => rdapAutnum(13335), /ASN not found/);
    });

    it('throws when no registry serves the ASN', async () => {
        // Cached bootstrap again; the stub only guards against a real call.
        globalThis.fetch = async () => { throw new Error('unexpected network call'); };
        await assert.rejects(() => rdapAutnum(64512), /No RDAP endpoint for AS64512/);
    });
});
